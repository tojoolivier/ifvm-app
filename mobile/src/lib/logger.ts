/**
 * Logger unifié du mobile — ADR-012, décision 4.
 *
 * Remplace `console.*`. Quatre verbes métier, et **aucun niveau à choisir** :
 * le niveau et le traitement sont déduits de `f(classe, frontière)`, la matrice
 * de la décision 3. La taxonomie devient ainsi une propriété du logger au lieu
 * d'une discipline à tenir sur ~70 sites — oublier de réfléchir ne produit plus
 * un silence.
 *
 * Pas d'échappatoire `log.warn` / `log.error` bruts : le précédent est net,
 * `useAsyncAction` est disponible depuis ADR-008 et adopté par 6 écrans sur 30.
 * Une porte de sortie devient le chemin par défaut.
 *
 * Ce module est le **cœur** : API, dérivation, expurgation, anneau, politique
 * de flush. La persistance SQLite est un `LogTransport` branché par-dessus.
 */
import { AppError } from './errors';
import { expurger } from './log-redaction';

// ─────────────────────────────────────────────────────────────────────────────
// Taxonomie — ADR-012 décision 3
// ─────────────────────────────────────────────────────────────────────────────

export type Frontiere =
  | 'useAsyncAction'
  | 'errorBoundary'
  | 'runTask:best-effort'
  | 'runTask:essential'
  | 'global';

export type Traitement = 'BLOQUER' | 'INFORMER' | 'JOURNAL';
export type Niveau = 'debug' | 'info' | 'warn' | 'error';

/** Nom de la classe typée, ou `(bug)` si l'erreur n'appartient pas au jeu fermé. */
export function classeDe(error: unknown): string {
  return error instanceof AppError ? error.constructor.name : '(bug)';
}

/**
 * La matrice de la décision 3, sous forme exécutable.
 *
 * Les deux colonnes `runTask` sont **plates à dessein** : au fond, c'est la
 * criticité de la tâche qui décide, pas la nature de l'erreur — le même
 * `NetworkError` est bénin dans l'auto-sync et fatal au démarrage de la base.
 */
export function traitementDe(error: unknown, frontiere: Frontiere): Traitement {
  switch (frontiere) {
    case 'runTask:best-effort':
      return 'JOURNAL';
    case 'runTask:essential':
      return 'INFORMER';
    case 'errorBoundary':
    case 'global':
      return 'BLOQUER';
    case 'useAsyncAction': {
      const classe = classeDe(error);
      // Les deux seuls BLOQUER à l'écran : ceux où continuer coûte quelque
      // chose à l'agent — plus rien ne fonctionnera, ou la saisie sera perdue.
      return classe === 'AuthError' || classe === 'LocalWriteError' ? 'BLOQUER' : 'INFORMER';
    }
    default:
      // Inatteignable par le typage. Le garde existe quand même : une frontière
      // inconnue arrivée par un `as` ou du JS non typé retournerait sinon
      // `undefined`, c'est-à-dire un traitement silencieux — précisément ce que
      // cet ADR éradique. En cas de doute, on montre.
      return 'BLOQUER';
  }
}

function niveauDe(traitement: Traitement): Niveau {
  return traitement === 'JOURNAL' ? 'warn' : 'error';
}

// ─────────────────────────────────────────────────────────────────────────────
// La ligne de journal et son puits
// ─────────────────────────────────────────────────────────────────────────────

export interface LogLine {
  at: string;
  cid: string;
  level: Niveau;
  event: string;
  classe?: string;
  traitement?: Traitement;
  raison?: string;
  err?: { name: string; message: string; stack?: string };
  [contexte: string]: unknown;
}

export interface LogTransport {
  write(lines: readonly LogLine[]): void | Promise<void>;
}

interface Config {
  transport?: LogTransport;
  /** Miroir vers `console.*`. Vrai en dev seulement — jamais en release. */
  mirrorToConsole?: boolean;
  /** Taille de l'anneau avant vidage forcé. */
  tailleAnneau?: number;
}

const TAILLE_ANNEAU_DEFAUT = 50;

let transport: LogTransport | null = null;
let mirrorToConsole = false;
let tailleAnneau = TAILLE_ANNEAU_DEFAUT;
let anneau: LogLine[] = [];
let correlationId = nouvelId();

/**
 * Le logger ne peut pas se journaliser lui-même.
 *
 * `sink()` écrit dans SQLite, et une écriture SQLite peut échouer — c'est
 * `LocalWriteError`. Un logger qui journaliserait ses propres échecs de flux
 * via lui-même partirait en récursion infinie sur un appareil déjà en
 * difficulté. L'échec lève donc un simple drapeau mémoire, affiché sur l'écran
 * de journal.
 */
let journalFlushBroken = false;

export function estLeJournalCasse(): boolean {
  return journalFlushBroken;
}

function nouvelId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getCorrelationId(): string {
  return correlationId;
}

export function configureLogger(config: Config): void {
  if (config.transport !== undefined) transport = config.transport;
  if (config.mirrorToConsole !== undefined) mirrorToConsole = config.mirrorToConsole;
  if (config.tailleAnneau !== undefined) tailleAnneau = config.tailleAnneau;
}

/** Remet le module à zéro. Destiné aux tests. */
export function resetLoggerForTests(): void {
  transport = null;
  mirrorToConsole = false;
  tailleAnneau = TAILLE_ANNEAU_DEFAUT;
  anneau = [];
  journalFlushBroken = false;
  correlationId = nouvelId();
}

/** Ce que l'anneau contient et n'a pas encore vidé. */
export function lignesEnAttente(): readonly LogLine[] {
  return anneau;
}

/**
 * Vide l'anneau vers le transport.
 *
 * Toujours sûr à appeler : un transport absent laisse les lignes en mémoire,
 * un transport en échec lève le drapeau sans jamais rappeler le logger.
 */
export async function flush(): Promise<void> {
  if (anneau.length === 0 || transport === null) return;
  const lot = anneau;
  anneau = [];
  try {
    await transport.write(lot);
  } catch {
    // Surtout pas de log ici — voir `journalFlushBroken`.
    journalFlushBroken = true;
  }
}

function descriptionDe(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { name: 'NonError', message: String(error) };
}

function sink(ligne: Omit<LogLine, 'at' | 'cid'>, immediat: boolean): void {
  const complete = expurger({
    ...ligne,
    at: new Date().toISOString(),
    cid: correlationId,
  }) as LogLine;

  anneau.push(complete);

  if (mirrorToConsole) {
    const fn =
      complete.level === 'error'
        ? console.error
        : complete.level === 'warn'
          ? console.warn
          : console.log;
    fn(`[${complete.level}] ${complete.event}`, complete);
  }

  // Flush asymétrique : un crash dur emporterait le dernier lot, c'est-à-dire
  // précisément les lignes qu'on cherche à diagnostiquer. Vider TOUT le tampon
  // sur un échec persiste du même coup le contexte qui le précède, souvent plus
  // utile que l'échec lui-même.
  if (immediat || anneau.length >= tailleAnneau) {
    void flush();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L'API — quatre verbes, aucun niveau à choisir
// ─────────────────────────────────────────────────────────────────────────────

export interface Logger {
  /** Fait notable, gardé dans l'export. */
  event(nom: string, contexte?: Record<string, unknown>): void;
  /** Fait d'investigation, verbeux, purgé agressivement. */
  detail(nom: string, contexte?: Record<string, unknown>): void;
  /**
   * Échec **nommé**. Renvoie le traitement déduit, dont la frontière se sert
   * pour décider ce que l'agent voit.
   */
  failure(nom: string, error: unknown, contexte?: Record<string, unknown>): Traitement;
  /**
   * Silence délibéré — ADR-012 décision 3. La raison va **dans la ligne de
   * journal**, pas seulement en commentaire : le support doit savoir que le
   * silence était prévu. C'est un appel loggeur, donc le lint le laisse passer
   * sans dérogation, et `grep "\.ignore("` donne l'audit complet.
   */
  ignore(error: unknown, raison: string): void;
  /** Sous-logger : contexte figé, frontière éventuellement redéfinie. */
  child(bindings: Record<string, unknown>, frontiere?: Frontiere): Logger;
}

function creer(bindings: Record<string, unknown>, frontiere: Frontiere): Logger {
  return {
    event: (nom, contexte = {}) =>
      sink({ level: 'info', event: nom, ...bindings, ...contexte }, false),

    detail: (nom, contexte = {}) =>
      sink({ level: 'debug', event: nom, ...bindings, ...contexte }, false),

    failure: (nom, error, contexte = {}) => {
      const traitement = traitementDe(error, frontiere);
      sink(
        {
          level: niveauDe(traitement),
          event: nom,
          ...bindings,
          ...contexte,
          classe: classeDe(error),
          traitement,
          err: descriptionDe(error),
        },
        true
      );
      return traitement;
    },

    ignore: (error, raison) =>
      sink(
        {
          level: 'debug',
          event: 'ignored',
          ...bindings,
          raison,
          classe: classeDe(error),
          err: descriptionDe(error),
        },
        true
      ),

    child: (plus, f) => creer({ ...bindings, ...plus }, f ?? frontiere),
  };
}

/** Logger racine. Par défaut à la frontière la moins bruyante. */
export const logger: Logger = creer({}, 'runTask:best-effort');
