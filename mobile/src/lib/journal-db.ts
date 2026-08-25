/**
 * Transport SQLite du journal — ADR-012, décision 4.
 *
 * Le `LogTransport` qui manquait au cœur du logger : ce qui rend une ligne de
 * journal survivante à la fermeture de l'app, et donc exportable vers le
 * support.
 *
 * ## Pourquoi une table dans `ifvm.db`, et pas un fichier
 *
 * Un fichier posé dans le bundle ou le cache ne survit pas à une mise à jour
 * OTA — et une mise à jour est précisément le moment où l'on veut relire ce qui
 * s'est passé avant. `ifvm.db` est déjà le stockage durable de l'app ; le
 * journal y prend une table, comme le référentiel (`referentiel-db.ts`) prend
 * les siennes sur le même handle.
 *
 * ## Le modèle
 *
 * Une seule entité, `journal`, sans identité dépendante d'une autre — un flux
 * d'événements est une table de faits, pas un modèle métier. Aucune décomposition
 * n'est due : les seules dépendances fonctionnelles vont de `id` vers le reste
 * (`classe → traitement` n'en est PAS une, c'est tout le propos de la matrice
 * `f(classe, frontière)` de la décision 3 — le même `NetworkError` donne
 * INFORMER ou JOURNAL selon d'où il vient).
 *
 * **Le contexte libre reste en JSON, délibérément.** La forme normalisée
 * (`journal_contexte(ligne_id, cle, valeur)`) serait en BCNF et serait le
 * mauvais choix ici, pour trois raisons :
 *
 * 1. Son domaine est **atomique au sens pragmatique de la 1NF** : l'application
 *    ne découpe jamais ce blob. Son unique consommateur est l'export `.jsonl`
 *    (#176), qui le recrache tel quel ; et l'expurgation par nom de clé est
 *    appliquée **avant** l'écriture, dans `sink()`.
 * 2. Le jeu d'attributs n'existe pas : `LogLine` est ouvert par construction
 *    (`[contexte: string]: unknown`) et s'élargit à chaque site migré.
 * 3. Le chemin chaud est l'écriture, déclenchée par un échec sur un appareil
 *    déjà en difficulté. EAV en ferait N INSERT par ligne, plus une cascade à
 *    la purge.
 *
 * Le prix payé est réel et assumé : on ne peut pas requêter une clé de
 * contexte. Si un champ le devient un jour, la réponse n'est pas EAV — c'est
 * de **le promouvoir en colonne**, comme `classe` et `traitement` l'ont été.
 *
 * ## Aucun index secondaire, et c'est un choix
 *
 * La lecture chronologique (`ORDER BY id DESC`) est servie par le rowid. Il
 * reste la purge (`WHERE level = ? AND at < ?`), qui tourne **une fois par
 * démarrage** sur une table que la rétention garde petite par construction. Un
 * index `(level, at)` se paierait à chaque INSERT — c'est-à-dire sur le seul
 * chemin qui compte — pour épargner un scan par lancement. Ne pas « corriger »
 * cette absence sans mesurer d'abord.
 */
import * as SQLite from 'expo-sqlite';

import { LocalReadError, LocalWriteError } from './errors';
import { configureLogger, type LogLine, type LogTransport, type Niveau } from './logger';
import { getDb } from './prospection-db';

// ─────────────────────────────────────────────────────────────────────────────
// Le schéma
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `id INTEGER PRIMARY KEY` est l'alias du rowid : monotone, gratuit, et
 * **plus fin que `at`** — l'anneau vide jusqu'à 50 lignes d'un coup, donc
 * plusieurs partagent la même milliseconde. L'ordre d'insertion est le seul
 * ordre chronologique fiable.
 *
 * Pas d'`AUTOINCREMENT` : il ajoute une écriture de `sqlite_sequence` par
 * insert pour garantir la non-réutilisation des identifiants libérés — une
 * garantie dont la purge n'a pas besoin, puisqu'elle retire les plus anciens
 * et ne fait jamais reculer le maximum.
 */
/**
 * Une colonne, décrite **une seule fois**.
 *
 * Le DDL, la liste du `INSERT`, ses points d'interrogation et l'ordre des
 * arguments passés à `runAsync` en dérivent tous. Écrites à la main, ces
 * quatre listes ordonnées devaient rester alignées de tête : promouvoir un
 * champ du contexte en colonne — que ce module annonce comme SA voie
 * d'évolution — se payait en quatre éditions couplées, dont un décalage
 * positionnel silencieux qui aurait écrit un `stack` dans la colonne `raison`.
 */
interface Colonne {
  nom: string;
  /** Le fragment DDL qui suit le nom. */
  type: string;
  /** D'où vient la valeur, dans la ligne de journal. */
  valeur: (ligne: LogLine) => SQLite.SQLiteBindValue;
}

const COLONNES: Colonne[] = [
  { nom: 'at', type: 'TEXT NOT NULL', valeur: (l) => l.at },
  { nom: 'cid', type: 'TEXT NOT NULL', valeur: (l) => l.cid },
  {
    nom: 'level',
    type: "TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error'))",
    valeur: (l) => l.level,
  },
  { nom: 'event', type: 'TEXT NOT NULL', valeur: (l) => l.event },
  { nom: 'classe', type: 'TEXT', valeur: (l) => l.classe ?? null },
  { nom: 'traitement', type: 'TEXT', valeur: (l) => l.traitement ?? null },
  { nom: 'raison', type: 'TEXT', valeur: (l) => l.raison ?? null },
  // `err` est un attribut composite : la 1NF impose de l'éclater en colonnes
  // atomiques plutôt que de ranger l'objet tel quel.
  { nom: 'err_name', type: 'TEXT', valeur: (l) => l.err?.name ?? null },
  { nom: 'err_message', type: 'TEXT', valeur: (l) => l.err?.message ?? null },
  { nom: 'err_stack', type: 'TEXT', valeur: (l) => l.err?.stack ?? null },
  { nom: 'contexte', type: 'TEXT', valeur: (l) => contexteDe(l) },
];

export const DDL_JOURNAL = `
  CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY,
    ${COLONNES.map((c) => `${c.nom} ${c.type}`).join(',\n    ')}
  );
`;

const INSERT = `
  INSERT INTO journal
    (${COLONNES.map((c) => c.nom).join(', ')})
  VALUES (${COLONNES.map(() => '?').join(', ')})
`;

/**
 * Les clés de `LogLine` que le schéma absorbe ; tout le reste part dans
 * `contexte`.
 *
 * Volontairement distincte de `COLONNES` : côté ligne il y a une clé `err`,
 * côté table trois colonnes `err_*`. Les dériver l'une de l'autre demanderait
 * une indirection qui coûterait plus de lecture qu'elle n'en épargne.
 */
const CLES_ABSORBEES = new Set<string>([
  'at',
  'cid',
  'level',
  'event',
  'classe',
  'traitement',
  'raison',
  'err',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Rétention
// ─────────────────────────────────────────────────────────────────────────────

const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;

/**
 * Rétention **par niveau**, pas séparation des flux : une seule ligne de temps,
 * sinon le `correlationId` ne relie rien (décision 4).
 *
 * Les clés portent les **verbes** du logger, pas les niveaux SQL : c'est le
 * vocabulaire de l'ADR, et une seule taxonomie vaut mieux que deux mêlées.
 * La traduction en niveaux vit dans `politiqueDeRetention`, un seul endroit.
 *
 * `detail` et `ignore` tombent tous deux en `debug`, ce qui est cohérent — un
 * silence délibéré n'est pas un échec. Un `failure` de tâche `best-effort`
 * sort en `warn` et est gardé avec les `error` : c'est bien un échec, même si
 * l'agent ne l'a pas vu.
 */
export const RETENTION_MS = {
  /** `detail` et `ignore` (niveau `debug`) — verbeux, purgés agressivement. */
  detail: 24 * HEURE,
  /** Idem, quand l'agent a activé « détails techniques » à la demande du support. */
  detailVerbeux: 7 * JOUR,
  /** `event` (niveau `info`) — faits notables. */
  evenement: 7 * JOUR,
  /** `failure` (niveaux `warn` et `error`), quelle que soit la frontière. */
  echec: 30 * JOUR,
} as const;

/** Une tranche de la politique : ces niveaux-là vivent cet âge-là. */
interface Tranche {
  niveaux: Niveau[];
  age: number;
}

/**
 * La politique de rétention, en un seul endroit — c'est elle qui se lit en
 * revue, pas les `DELETE` qui en découlent.
 */
function politiqueDeRetention(verbeux: boolean): Tranche[] {
  return [
    { niveaux: ['debug'], age: verbeux ? RETENTION_MS.detailVerbeux : RETENTION_MS.detail },
    { niveaux: ['info'], age: RETENTION_MS.evenement },
    { niveaux: ['warn', 'error'], age: RETENTION_MS.echec },
  ];
}

/**
 * Plafond dur, en plus de la rétention temporelle.
 *
 * La rétention seule ne borne rien : une boucle d'échec en rafale — un
 * `useEffect` qui relance une requête qui échoue — écrirait des dizaines de
 * milliers de lignes bien avant la fenêtre de 30 jours, sur un téléphone
 * d'entrée de gamme dont le stockage est la ressource rare.
 */
export const PLAFOND_LIGNES = 5000;

/**
 * Tous les combien de lots le plafond est réappliqué **en cours de session**.
 *
 * L'appliquer uniquement au démarrage laisserait justement passer la rafale
 * qui motive le plafond : une session qui dure la journée écrirait sans borne
 * jusqu'au prochain lancement. L'appliquer à chaque lot coûterait une
 * sous-requête par flush, sur le chemin chaud. Un lot valant au plus
 * `tailleAnneau` lignes (50 par défaut), ce rythme borne le dépassement à
 * quelques milliers de lignes au pire.
 */
const LOTS_ENTRE_DEUX_PLAFONNEMENTS = 20;

let lotsDepuisPlafonnement = 0;

async function appliquerPlafond(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    'DELETE FROM journal WHERE id NOT IN (SELECT id FROM journal ORDER BY id DESC LIMIT ?)',
    PLAFOND_LIGNES
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ouverture
// ─────────────────────────────────────────────────────────────────────────────

let prete: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * La base, avec la table du journal garantie.
 *
 * L'échec **oublie** la promesse au lieu de la mémoriser : un `SQLITE_BUSY` au
 * démarrage laisserait sinon le journal cassé pour toute la durée de vie du
 * processus, alors que la cause est transitoire par nature.
 *
 * **Sur la ré-entrance, attendue dès #173** : `prospection-db` journalisera ses
 * 21 traces de migration, donc une ligne peut naître *pendant* `getDb()`. Le
 * cycle `write → getDb → log → flush → write` ne boucle pas et ne bloque pas,
 * pour deux raisons qu'il faut préserver : `getDb()` mémorise `dbPromise`
 * **avant** de migrer, si bien qu'un appel ré-entrant reçoit la promesse en
 * cours au lieu de relancer la migration ; et `sink()` déclenche le flush par
 * `void flush()`, jamais attendu par l'appelant, donc la migration ne s'attend
 * pas elle-même. Ne pas rendre `getDb()` non mémoïsant, ni `sink()` awaité.
 */
function baseDuJournal(): Promise<SQLite.SQLiteDatabase> {
  if (!prete) {
    const p = getDb().then(async (db) => {
      await db.execAsync(DDL_JOURNAL);
      return db;
    });
    p.catch(() => {
      if (prete === p) prete = null;
    });
    prete = p;
  }
  return prete;
}

/** Réservé aux tests : force la recréation de la table au prochain accès. */
export function resetJournalForTests(): void {
  prete = null;
  lotsDepuisPlafonnement = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────────────────────────────────────────

function contexteDe(ligne: LogLine): string | null {
  const reste: Record<string, unknown> = {};
  let vide = true;
  for (const cle of Object.keys(ligne)) {
    if (CLES_ABSORBEES.has(cle)) continue;
    reste[cle] = ligne[cle];
    vide = false;
  }
  // Sérialiser ici n'est pas le `JSON.stringify` que le lint de #174 interdit :
  // celui-là est passé en *argument du logger*, donc opaque au filtre par nom
  // de clé. Ici l'expurgation a déjà eu lieu, dans `sink()`, sur l'objet vivant.
  return vide ? null : JSON.stringify(reste);
}

/**
 * Le transport à brancher via `configureLogger`.
 *
 * **Il rejette en cas d'échec, et c'est essentiel** : c'est `flush()` qui
 * attrape, et lève `journalFlushBroken` sans jamais rappeler le logger. Avaler
 * l'erreur ici rendrait le drapeau inatteignable.
 */
export function creerTransportJournal(): LogTransport {
  return {
    async write(lignes: readonly LogLine[]): Promise<void> {
      if (lignes.length === 0) return;

      try {
        const db = await baseDuJournal();
        await db.withTransactionAsync(async () => {
          for (const l of lignes) {
            // L'ordre vient de `COLONNES`, comme le `INSERT` lui-même : les
            // deux ne peuvent plus se désaligner.
            await db.runAsync(INSERT, ...COLONNES.map((c) => c.valeur(l)));
          }
        });


        if (++lotsDepuisPlafonnement >= LOTS_ENTRE_DEUX_PLAFONNEMENTS) {
          lotsDepuisPlafonnement = 0;
          await appliquerPlafond(db);
        }
      } catch (e) {
        // Typé à la source comme partout ailleurs (décision 2), même si le seul
        // lecteur est le `catch` vide de `flush()` : le jour où le drapeau
        // remonte une cause à l'écran de journal, elle sera déjà classée.
        throw new LocalWriteError(`Journal : ${lignes.length} ligne(s) perdue(s)`, { cause: e });
      }
    },
  };
}

/**
 * `__DEV__` existe sous Metro et Hermes, pas sous le runner de tests `logic`
 * (ts-jest / node). Le `typeof` n'est donc pas une précaution superstitieuse :
 * une référence nue lèverait un `ReferenceError` à l'import.
 */
export function estEnDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Branche le journal sur le logger. À appeler **synchroniquement**, au tout
 * début du cycle de vie : ce qui échoue avant n'a pas de transport et reste
 * dans l'anneau mémoire, donc n'est pas exportable.
 *
 * Le miroir console suit `__DEV__` et rien d'autre — en release, `console.*`
 * n'a aucun lecteur et coûte une sérialisation par ligne.
 */
export function installerTransportJournal({ dev = estEnDev() }: { dev?: boolean } = {}): void {
  configureLogger({ transport: creerTransportJournal(), mirrorToConsole: dev });
}

// ─────────────────────────────────────────────────────────────────────────────
// Purge
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionsPurge {
  /**
   * Le flag `debug-store`. **Ce n'est plus un gate d'écriture** (décision 4) :
   * tout part au journal, sans condition. C'est un réglage de verbosité, et il
   * n'agit qu'ici — en allongeant la durée de vie des `detail`.
   */
  verbeux: boolean;
  maintenant?: Date;
}

function borne(maintenant: Date, age: number): string {
  return new Date(maintenant.getTime() - age).toISOString();
}

/**
 * Applique la rétention. Best-effort par nature : une purge ratée ne coûte que
 * du stockage, jamais une donnée de saisie.
 */
export async function purgerJournal({
  verbeux,
  maintenant = new Date(),
}: OptionsPurge): Promise<void> {
  const db = await baseDuJournal();

  for (const { niveaux, age } of politiqueDeRetention(verbeux)) {
    const trous = niveaux.map(() => '?').join(', ');
    await db.runAsync(
      `DELETE FROM journal WHERE level IN (${trous}) AND at < ?`,
      ...niveaux,
      borne(maintenant, age)
    );
  }

  await appliquerPlafond(db);
}

/** Vide le journal — l'action « Effacer » de l'écran de journal. */
export async function viderJournal(): Promise<void> {
  const db = await baseDuJournal();
  await db.runAsync('DELETE FROM journal');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────────────────────────────────────────

/** Une ligne relue : la `LogLine` d'origine, plus son rang chronologique. */
export type LigneJournal = LogLine & { id: number };

interface RangeeBrute {
  id: number;
  at: string;
  cid: string;
  level: LogLine['level'];
  event: string;
  classe: string | null;
  traitement: LogLine['traitement'] | null;
  raison: string | null;
  err_name: string | null;
  err_message: string | null;
  err_stack: string | null;
  contexte: string | null;
}

function recomposer(r: RangeeBrute): LigneJournal {
  let contexte: Record<string, unknown> = {};
  if (r.contexte !== null) {
    try {
      contexte = JSON.parse(r.contexte) as Record<string, unknown>;
    } catch (e) {
      // Surtout pas de `{}` de repli : un contexte corrompu rendrait une ligne
      // d'apparence normale, amputée en silence — exactement la famille de bugs
      // qu'ADR-012 éradique. La donnée est perdue, l'écran doit le dire.
      throw new LocalReadError(`Ligne de journal ${r.id} illisible`, { cause: e });
    }
  }

  return {
    ...contexte,
    id: r.id,
    at: r.at,
    cid: r.cid,
    level: r.level,
    event: r.event,
    ...(r.classe !== null ? { classe: r.classe } : {}),
    ...(r.traitement !== null ? { traitement: r.traitement } : {}),
    ...(r.raison !== null ? { raison: r.raison } : {}),
    ...(r.err_name !== null
      ? {
          err: {
            name: r.err_name,
            message: r.err_message ?? '',
            ...(r.err_stack !== null ? { stack: r.err_stack } : {}),
          },
        }
      : {}),
  };
}

/** Les `limite` lignes les plus récentes, de la plus récente à la plus ancienne. */
export async function lireJournal(limite = 500): Promise<LigneJournal[]> {
  const db = await baseDuJournal();
  const rangees = await db.getAllAsync<RangeeBrute>(
    'SELECT * FROM journal ORDER BY id DESC LIMIT ?',
    limite
  );
  return rangees.map(recomposer);
}

/** Une session relue, et **ce qu'elle pesait** avant que le `LIMIT` ne coupe. */
export interface SessionJournal {
  /** Les lignes rendues, en ordre chronologique croissant. */
  lignes: LigneJournal[];
  /** Le nombre total de lignes de la session en base, coupure comprise. */
  total: number;
}

/**
 * La tranche exportée par le signalement (#176) : **la session courante**, en
 * ordre chronologique **croissant**.
 *
 * Le `correlationId` est posé une seule fois au chargement de `logger.ts` et ne
 * tourne pas : « toutes les lignes de même `cid` » et « depuis le dernier
 * démarrage » désignent donc la même chose. C'est un meilleur critère qu'un
 * filtre sur `at`, dont l'horloge d'un téléphone de terrain peut sauter — et
 * qui découperait alors la tranche au mauvais endroit sans rien dire.
 *
 * Le `LIMIT` porte sur les plus **récentes** (`ORDER BY id DESC`), puis l'ordre
 * est inversé : une session très bavarde perd son début, jamais l'incident qui
 * la termine.
 *
 * **`total` n'est pas un ornement.** Sans lui, la coupure faite ici, en SQL,
 * serait parfaitement invisible pour l'export : il compterait ses lignes
 * écartées sur ce qu'il a reçu et déclarerait complet un rapport amputé. Le
 * `COUNT(*)` coûte un scan de plus, une fois, sur un geste rare — le prix d'un
 * en-tête qui ne ment pas.
 */
export async function lireSession(
  cid: string,
  limite = PLAFOND_LIGNES
): Promise<SessionJournal> {
  const db = await baseDuJournal();

  const rangees = await db.getAllAsync<RangeeBrute>(
    'SELECT * FROM journal WHERE cid = ? ORDER BY id DESC LIMIT ?',
    cid,
    limite
  );
  const comptes = await db.getAllAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM journal WHERE cid = ?',
    cid
  );

  return {
    lignes: rangees.reverse().map(recomposer),
    // Un compte absent vaut « rien de plus que ce qu'on tient » plutôt qu'un
    // `NaN` qui contaminerait le compteur d'écartées de l'en-tête.
    total: comptes[0]?.total ?? rangees.length,
  };
}
