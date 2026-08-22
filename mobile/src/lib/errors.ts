/**
 * Jeu fermé d'erreurs typées du mobile — ADR-012, décision 2.
 *
 * Les frontières de capture décident par `instanceof`, **jamais** par regex sur
 * `error.message`. Toute erreur qui n'appartient pas à ce jeu est, par
 * définition, un bug : le bug n'est pas une huitième classe, c'est l'absence
 * de classe — c'est ce qui rend le jeu réellement fermé.
 *
 * Le typage se fait **à la source** : chaque module de `lib/` enveloppe ses
 * propres erreurs (`throw new NetworkError(msg, { cause: e })`) plutôt que de
 * laisser une frontière deviner de quoi il s'agit.
 */

/** Racine du jeu fermé. Sert à répondre à « cette erreur est-elle typée ? ». */
export abstract class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    // `cause` est posée à la main : la cible de compilation d'Expo ne garantit
    // pas le second argument d'`Error` sur tous les moteurs.
    if (options && 'cause' in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    this.name = new.target.name;
  }
}

/** Serveur injoignable, DNS, timeout réseau. Cas NOMINAL sur le terrain. */
export class NetworkError extends AppError {}

/** Session expirée, 401, jeton irrécupérable. */
export class AuthError extends AppError {}

/**
 * Donnée locale illisible : JSON corrompu, colonne absente, lecture SQLite
 * en échec. La donnée est **déjà perdue** — l'agent n'a aucun recours.
 */
export class LocalReadError extends AppError {}

/**
 * Écriture locale impossible : INSERT/ALTER refusé, contrainte violée.
 * L'agent est en train de saisir et **perdra tout** s'il continue — d'où un
 * traitement BLOQUER là où `LocalReadError` se contente d'INFORMER.
 */
export class LocalWriteError extends AppError {}

/** Campagne, station ou code absent du référentiel local. */
export class ReferentialError extends AppError {}

/** Permission OS refusée : GPS, caméra, galerie. */
export class PermissionError extends AppError {}

/**
 * Précondition violée, levée par {@link assertPresent}.
 *
 * Seule classe du jeu dont le message est **écrit par le développeur au site
 * d'appel** et affiché tel quel à l'agent ; les six autres sont subies et leur
 * message est fabriqué par la couche d'affichage.
 */
export class PreconditionError extends AppError {}

/** Une erreur appartient-elle au jeu fermé ? Sinon, c'est un bug. */
export function isTypedError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Garantit qu'une valeur attendue est présente, ou lève `PreconditionError`.
 *
 * Remplace le guard-clause muet (`if (!draftId) return;`) qui a produit le bug
 * d'ADR-008 trois fois. La revue cherche désormais une **présence** — « je vois
 * `assertPresent` » — au lieu d'une **absence** — « il manque un `throw` » :
 * repérer une absence est précisément ce que l'humain rate.
 *
 * Le message est destiné à l'agent et affiché verbatim, donc écrit en français
 * et orienté action.
 *
 * @example
 * assertPresent(draftId, 'Brouillon introuvable — reprenez la fiche.');
 */
export function assertPresent<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new PreconditionError(message);
  }
}
