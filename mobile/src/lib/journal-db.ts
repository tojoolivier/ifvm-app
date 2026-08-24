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

import { LocalReadError } from './errors';
import { configureLogger, type LogLine, type LogTransport } from './logger';
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
export const DDL_JOURNAL = `
  CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    cid TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    event TEXT NOT NULL,
    classe TEXT,
    traitement TEXT,
    raison TEXT,
    err_name TEXT,
    err_message TEXT,
    err_stack TEXT,
    contexte TEXT
  );
`;

/** Ce que le schéma promeut en colonne. Tout le reste part dans `contexte`. */
const COLONNES = ['at', 'cid', 'level', 'event', 'classe', 'traitement', 'raison', 'err'] as const;
const EST_UNE_COLONNE = new Set<string>(COLONNES);

const INSERT = `
  INSERT INTO journal
    (at, cid, level, event, classe, traitement, raison, err_name, err_message, err_stack, contexte)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// ─────────────────────────────────────────────────────────────────────────────
// Rétention
// ─────────────────────────────────────────────────────────────────────────────

const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;

/**
 * Rétention **par niveau**, pas séparation des flux : une seule ligne de temps,
 * sinon le `correlationId` ne relie rien (décision 4).
 *
 * Le niveau, pas le verbe : `detail` et `ignore` tombent tous deux en `debug`,
 * ce qui est cohérent — un silence délibéré n'est pas un échec. Un `failure` de
 * tâche `best-effort` sort en `warn` et est gardé avec les `error` : c'est bien
 * un échec, même si l'agent ne l'a pas vu.
 */
export const RETENTION_MS = {
  /** `detail` et `ignore` — verbeux, purgés agressivement. */
  debug: 24 * HEURE,
  /** Idem, quand l'agent a activé « détails techniques » à la demande du support. */
  debugVerbeux: 7 * JOUR,
  /** `event` — faits notables. */
  info: 7 * JOUR,
  /** `failure`, quelle que soit la frontière. */
  echec: 30 * JOUR,
} as const;

/**
 * Plafond dur, en plus de la rétention temporelle.
 *
 * La rétention seule ne borne rien : une boucle d'échec en rafale — un
 * `useEffect` qui relance une requête qui échoue — écrirait des dizaines de
 * milliers de lignes bien avant la fenêtre de 30 jours, sur un téléphone
 * d'entrée de gamme dont le stockage est la ressource rare.
 */
export const PLAFOND_LIGNES = 5000;

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────────────────────────────────────────

function contexteDe(ligne: LogLine): string | null {
  const reste: Record<string, unknown> = {};
  let vide = true;
  for (const cle of Object.keys(ligne)) {
    if (EST_UNE_COLONNE.has(cle)) continue;
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

      const db = await baseDuJournal();
      await db.withTransactionAsync(async () => {
        for (const l of lignes) {
          await db.runAsync(
            INSERT,
            l.at,
            l.cid,
            l.level,
            l.event,
            l.classe ?? null,
            l.traitement ?? null,
            l.raison ?? null,
            l.err?.name ?? null,
            l.err?.message ?? null,
            l.err?.stack ?? null,
            contexteDe(l)
          );
        }
      });
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

  await db.runAsync(
    'DELETE FROM journal WHERE level = ? AND at < ?',
    'debug',
    borne(maintenant, verbeux ? RETENTION_MS.debugVerbeux : RETENTION_MS.debug)
  );
  await db.runAsync(
    'DELETE FROM journal WHERE level = ? AND at < ?',
    'info',
    borne(maintenant, RETENTION_MS.info)
  );
  await db.runAsync(
    "DELETE FROM journal WHERE level IN ('warn', 'error') AND at < ?",
    borne(maintenant, RETENTION_MS.echec)
  );
  await db.runAsync(
    'DELETE FROM journal WHERE id NOT IN (SELECT id FROM journal ORDER BY id DESC LIMIT ?)',
    PLAFOND_LIGNES
  );
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
