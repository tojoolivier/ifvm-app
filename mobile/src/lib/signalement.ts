/**
 * Parcours de signalement et export du journal — ADR-012, décision 7 (#176).
 *
 * ## Le défaut corrigé
 *
 * L'export **existait déjà**. Ce qui manquait, c'était le droit d'y accéder :
 * `profile.tsx` ne montrait le lien que si le mode débogage était actif, donc
 * l'agent devait l'avoir activé **avant** le bug. Une dépendance temporelle
 * impossible à satisfaire — celui qui subit un problème arrive toujours trop
 * tard. Le flag redevient ce qu'il aurait toujours dû être, un réglage de
 * verbosité (`journal-db.ts`, `OptionsPurge.verbeux`), et l'entrée du
 * signalement est inconditionnelle.
 *
 * ## Ce module est pur, et c'est délibéré
 *
 * Aucun import natif ici : ni `expo-constants`, ni `expo-device`, ni
 * `expo-file-system`, ni `expo-sharing`. Tout arrive par `SignalementDeps`,
 * fournies par `signalement-natif.ts`. C'est la même séparation qu'`app-startup.ts` :
 * la logique se teste sous le runner `logic`, sans moteur de rendu ni module
 * natif — et le chemin du dernier recours de l'agent mérite d'être testé.
 *
 * ## Aucune responsabilité de confidentialité — sauf une
 *
 * Le filtre est posé à l'écriture, dans `sink()` (décision 6) : les lignes du
 * journal sont déjà expurgées quand elles arrivent ici. **L'en-tête est la seule
 * exception** : il est fabriqué ici, n'est jamais passé par `sink()`, et porte
 * du texte libre saisi par l'agent. Il repasse donc par `expurger`.
 */
import { LocalWriteError } from './errors';
import { expurger } from './log-redaction';
import { logger, type LogLine } from './logger';

// La frontière est prononcée, pas laissée par défaut : `envoyerSignalement` est
// toujours appelée depuis un geste de l'agent, derrière `useAsyncAction`. Sans
// elle, le journal hériterait de `runTask:best-effort` et dirait au support que
// l'échec vient d'une tâche de fond — décision 4.
const log = logger.child({ module: 'signalement' }, 'useAsyncAction');

/**
 * Plafond du rapport, en octets.
 *
 * Ce n'est pas une valeur de confort : le fichier part sur WhatsApp depuis un
 * téléphone d'entrée de gamme en 2G rurale, et **un envoi qui échoue est un
 * signalement perdu**. Mieux vaut un rapport tronqué qui arrive qu'un rapport
 * complet qui n'arrive pas.
 */
export const PLAFOND_OCTETS = 1_000_000;

/**
 * Longueur maximale du commentaire, en caractères.
 *
 * Le champ est du texte libre, donc sans borne l'en-tête peut à lui seul crever
 * le plafond : le budget des lignes deviendrait négatif, le corps partirait
 * vide, **et** le fichier dépasserait quand même. Autrement dit, un agent
 * bavard supprimerait le journal qu'il essaie d'envoyer.
 *
 * 2 000 caractères, c'est plusieurs paragraphes — largement au-delà de ce
 * qu'on tape sur un clavier de téléphone en brousse.
 */
export const LONGUEUR_MAX_COMMENTAIRE = 2_000;

// ─────────────────────────────────────────────────────────────────────────────
// L'en-tête
// ─────────────────────────────────────────────────────────────────────────────

export interface ContexteApp {
  version: string | null;
  build: string | null;
  runtime: string | null;
}

export interface ContexteAppareil {
  marque: string | null;
  modele: string | null;
  os: string | null;
  osVersion: string | null;
}

/**
 * Qui signale. Passe l'expurgation délibérément : `log-redaction.ts` filtre ce
 * qui *authentifie*, pas ce qui *décrit* — et le support doit pouvoir rappeler
 * l'agent.
 */
export interface IdentiteAgent {
  id: string;
  nom: string;
  prenom: string;
  role: string;
}

/** Ce que l'appelant fournit ; les compteurs de troncature sont ajoutés ici. */
export interface BaseEntete {
  generatedAt: string;
  correlationId: string;
  app: ContexteApp;
  appareil: ContexteAppareil;
  agent: IdentiteAgent | null;
  commentaire: string | null;
}

export interface Entete extends BaseEntete {
  type: 'entete';
  /** Nombre de lignes de journal qui suivent. */
  lignes: number;
  /**
   * Nombre de lignes écartées par le plafond.
   *
   * **Ce champ est le cœur du ticket.** Un rapport amputé qui ne le dit pas
   * enverrait le support chercher une cause dans un trou — précisément le
   * silence qu'ADR-012 éradique.
   */
  tronquees: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Longueur en octets UTF-8.
 *
 * Écrit à la main plutôt que `new TextEncoder().encode(s).length` : Hermes ne
 * garantit pas ce global, et le motif récurrent de ce projet est justement le
 * code d'apparence correcte qui ne s'exécute jamais sur l'appareil. Le plafond
 * est une contrainte physique — il ne peut pas dépendre d'un global absent.
 *
 * `.length` compterait des unités de code UTF-16 : « é » vaut 1 en UTF-16 et 2
 * octets en UTF-8, et un journal français en est plein.
 */
export function octetsUtf8(texte: string): number {
  let total = 0;
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i);
    if (code < 0x80) total += 1;
    else if (code < 0x800) total += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // Paire de substitution : deux unités UTF-16 pour un seul point de code
      // de 4 octets. On avale la seconde ici pour ne pas la compter deux fois.
      total += 4;
      i++;
    } else total += 3;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le rapport
// ─────────────────────────────────────────────────────────────────────────────

function enteteComplet(base: BaseEntete, lignes: number, tronquees: number): string {
  // `type` en premier : le support lit `head -1`, et le premier champ doit dire
  // ce qu'il tient en main.
  return JSON.stringify(expurger({ type: 'entete' as const, ...base, lignes, tronquees }));
}

/**
 * Sérialise le rapport `.jsonl` : l'en-tête, puis les lignes de journal.
 *
 * **La troncature retire les plus anciennes.** Le journal est fourni en ordre
 * chronologique croissant, et ce que le support cherche est ce qui entoure
 * l'incident — c'est-à-dire la fin. Couper par le début préserve donc la
 * fenêtre utile sans avoir à la localiser.
 *
 * @param lignes Ordre chronologique **croissant** (la plus ancienne d'abord).
 */
export function construireRapport({
  base,
  lignes,
  totalSession = lignes.length,
  plafondOctets = PLAFOND_OCTETS,
}: {
  base: BaseEntete;
  lignes: readonly LogLine[];
  /**
   * Ce que la session **pesait en base**, `LIMIT` compris.
   *
   * `lireSession` coupe déjà au-delà de `PLAFOND_LIGNES`, en SQL. Compter les
   * écartées sur les seules lignes reçues ferait déclarer complet un rapport
   * amputé de milliers de lignes — le silence de la décision 7, déplacé d'un
   * cran plus bas.
   */
  totalSession?: number;
  plafondOctets?: number;
}): string {
  // Borné ici, et pas seulement par `maxLength` sur le champ : l'écran n'est
  // pas la seule voie d'entrée, et un en-tête sans borne crève le plafond.
  const borne: BaseEntete = {
    ...base,
    commentaire: base.commentaire?.slice(0, LONGUEUR_MAX_COMMENTAIRE) ?? null,
  };

  // Le budget se calcule contre un en-tête de taille **maximale**, faute de quoi
  // le calcul serait circulaire : la taille de l'en-tête dépend des compteurs,
  // qui dépendent du budget. `totalSession` majore les deux compteurs, donc
  // l'en-tête réel ne peut qu'être plus court — le plafond tient toujours.
  const budget = plafondOctets - octetsUtf8(enteteComplet(borne, totalSession, totalSession));

  const corps: string[] = [];
  let utilises = 0;
  for (let i = lignes.length - 1; i >= 0; i--) {
    const serialisee = JSON.stringify(lignes[i]);
    const cout = octetsUtf8(serialisee) + 1; // +1 pour le saut de ligne
    if (utilises + cout > budget) break;
    utilises += cout;
    corps.unshift(serialisee);
  }

  const entete = enteteComplet(borne, corps.length, totalSession - corps.length);
  return [entete, ...corps].join('\n');
}

/** Nom de fichier : horodaté et porteur du `correlationId`, comme l'en-tête. */
export function nomDuFichier(maintenant: Date, correlationId: string): string {
  const horodatage = maintenant.toISOString().slice(0, 19).replace(/:/g, '-');
  return `ifvm-signalement-${horodatage}-${correlationId}.jsonl`;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'envoi
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalementDeps {
  /** Vide l'anneau mémoire du logger vers le transport SQLite. */
  flush: () => Promise<void>;
  /**
   * Les lignes de la session (ordre chronologique croissant) **et** ce qu'elle
   * pesait en base : la coupure faite en SQL doit rester visible d'ici.
   */
  lireSession: (correlationId: string) => Promise<{ lignes: LogLine[]; total: number }>;
  correlationId: () => string;
  app: () => ContexteApp;
  appareil: () => ContexteAppareil;
  agent: () => IdentiteAgent | null;
  maintenant: () => Date;
  /** Écrit le fichier et renvoie son URI. */
  ecrire: (nom: string, contenu: string) => Promise<string>;
  /** Ouvre la feuille de partage de l'OS. */
  partager: (uri: string) => Promise<void>;
}

/** Un commentaire blanc n'est pas un commentaire : c'est « envoyer sans ». */
function commentaireUtile(commentaire: string | null): string | null {
  const propre = commentaire?.trim() ?? '';
  return propre === '' ? null : propre;
}

/**
 * Construit le rapport de la session courante et ouvre la feuille de partage.
 *
 * Les deux sorties de l'écran — « Envoyer au support » et « Envoyer sans
 * commentaire » — passent toutes deux par ici ; seule la valeur de
 * `commentaire` change. Un seul chemin, donc un seul endroit où un silence
 * pourrait naître.
 */
export async function envoyerSignalement(
  { commentaire }: { commentaire: string | null },
  deps: SignalementDeps
): Promise<void> {
  // Avant la lecture, sans quoi le rapport raterait précisément les lignes de
  // l'incident : `sink()` les a poussées dans l'anneau il y a une seconde, et
  // l'anneau ne se vide qu'à 50 lignes.
  try {
    await deps.flush();
  } catch (e) {
    // Un flux cassé ne doit pas emporter le signalement : les lignes déjà
    // persistées valent mieux que rien, et le drapeau `estLeJournalCasse()` dit
    // déjà que le journal est incomplet.
    log.ignore(e, 'Flush impossible avant signalement — on exporte ce qui est déjà en base');
  }

  const cid = deps.correlationId();
  const maintenant = deps.maintenant();

  // Le journal de la session courante — voir `journal-db.lireSession` pour
  // pourquoi le `cid` découpe cette tranche mieux qu'un filtre sur `at`.
  const { lignes, total } = await deps.lireSession(cid);

  const rapport = construireRapport({
    totalSession: total,
    base: {
      generatedAt: maintenant.toISOString(),
      correlationId: cid,
      app: deps.app(),
      appareil: deps.appareil(),
      agent: deps.agent(),
      commentaire: commentaireUtile(commentaire),
    },
    lignes,
  });

  let uri: string;
  try {
    uri = await deps.ecrire(nomDuFichier(maintenant, cid), rapport);
  } catch (e) {
    throw new LocalWriteError(
      'Le rapport n’a pas pu être écrit sur l’appareil. Libérez de l’espace et réessayez.',
      { cause: e }
    );
  }

  // Le partage n'est pas enveloppé : la feuille est celle de l'OS, son refus
  // n'est pas une écriture locale en échec. `useAsyncAction` l'attrape et
  // l'affiche comme n'importe quel autre échec de geste.
  await deps.partager(uri);
}
