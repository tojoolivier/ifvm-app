/**
 * La couche d'affichage du jeu fermé d'erreurs — ADR-012 décision 5, issue #172.
 *
 * Traduit une erreur en trois choses que l'écran a besoin de connaître :
 * **quoi dire** (`message`), **quoi proposer** (`action`) et **quoi garder pour
 * le support** (`detail`).
 *
 * Deux règles portent la décision, et rendent ce module volontairement bête :
 *
 * - **La décision se prend par `instanceof`, jamais par regex sur le message.**
 *   L'ancienne version reniflait `/network request failed|fetch/i` : elle
 *   dépendait d'un message anglais produit par le moteur, ratait une
 *   `NetworkError` typée au message français, et diagnostiquait « connexion
 *   impossible » sur n'importe quel bug contenant le mot « fetch ».
 * - **Le message brut ne sort jamais.** Il reste dans `detail`, que seul
 *   l'écran de journal montre. Un agent en brousse ne doit pas lire
 *   « undefined is not an object ».
 *
 * L'**action est une propriété de la classe**, pas du site d'appel : c'est ce
 * qui interdit le « Réessayer » universel proposé même quand rien ne peut
 * réussir — la donnée locale illisible en est le cas d'école.
 */
import {
  AuthError,
  LocalReadError,
  LocalWriteError,
  NetworkError,
  PermissionError,
  PreconditionError,
  ReferentialError,
} from './errors';
import { classeDe } from './logger';

/**
 * Le jeu fermé des actions offertes à l'agent. Fermé pour la même raison que
 * celui des erreurs : une action inconnue serait un bouton sans effet.
 */
export type ActionErreur =
  | 'reessayer'
  | 'reessayer-enregistrer'
  | 'se-reconnecter'
  | 'ouvrir-reglages'
  | 'synchroniser-referentiels'
  | 'signaler-support';

/** Libellés, au même endroit que le jeu — l'écran ne les réécrit pas. */
export const LIBELLE_ACTION: Record<ActionErreur, string> = {
  reessayer: 'Réessayer',
  'reessayer-enregistrer': 'Réessayer d’enregistrer',
  'se-reconnecter': 'Se reconnecter',
  'ouvrir-reglages': 'Ouvrir les réglages',
  'synchroniser-referentiels': 'Synchroniser les référentiels',
  'signaler-support': 'Signaler au support',
};

export interface ErreurAffichable {
  /** Nom de la classe typée, ou `(bug)`. Sert au dédoublonnage de `error-store`. */
  classe: string;
  /** Phrase française, orientée action, montrée à l'agent. */
  message: string;
  /** Message brut. Journal et support uniquement — jamais l'écran principal. */
  detail: string | null;
  /** Action proposée, ou `null` quand aucune n'a de sens. */
  action: ActionErreur | null;
}

const MESSAGE_DE_BUG =
  'Un problème inattendu est survenu. Vos données saisies sont conservées.';

/**
 * Le tableau de la décision 5, sous forme exécutable.
 *
 * `PreconditionError` est absente à dessein : seule classe dont le message est
 * écrit par le développeur au site d'appel et affiché verbatim, elle est
 * traitée à part dans {@link toFriendlyError}.
 */
const PAR_CLASSE: {
  classe: abstract new (...args: never[]) => Error;
  message: string;
  action: ActionErreur;
}[] = [
  {
    classe: NetworkError,
    message: 'Connexion au serveur impossible pour le moment.',
    action: 'reessayer',
  },
  {
    classe: AuthError,
    message: 'Session expirée — reconnectez-vous pour continuer.',
    action: 'se-reconnecter',
  },
  {
    classe: LocalWriteError,
    message:
      'Impossible d’enregistrer sur l’appareil. Ne continuez pas la saisie : ce que vous taperez ensuite serait perdu aussi.',
    action: 'reessayer-enregistrer',
  },
  {
    classe: LocalReadError,
    message:
      'Certaines données n’ont pas pu être relues sur l’appareil. Elles ne sont pas perdues côté serveur.',
    action: 'signaler-support',
  },
  {
    classe: ReferentialError,
    message: 'Cette donnée est absente du référentiel de l’appareil.',
    action: 'synchroniser-referentiels',
  },
  {
    classe: PermissionError,
    message: 'L’appareil a refusé cette autorisation.',
    action: 'ouvrir-reglages',
  },
];

/** Traduit une erreur quelconque en ce que l'écran doit montrer. */
export function toFriendlyError(error: unknown): ErreurAffichable {
  const brut = error instanceof Error ? error.message : String(error);
  const detail = brut || null;
  const classe = classeDe(error);

  // Seule classe dont le message est écrit pour l'agent au site d'appel.
  // `assertPresent(draftId, 'Brouillon introuvable — reprenez la fiche.')` :
  // le réécrire ici perdrait la seule information utile.
  if (error instanceof PreconditionError) {
    return { classe, message: brut || MESSAGE_DE_BUG, detail, action: null };
  }

  const connue = PAR_CLASSE.find((entree) => error instanceof entree.classe);
  if (connue) {
    return { classe, message: connue.message, detail, action: connue.action };
  }

  // Hors du jeu fermé : c'est un bug, et le seul recours de l'agent est le
  // signalement. Surtout pas `message: brut` — c'est ce retour-là qui affichait
  // des piles JavaScript en pleine brousse.
  return { classe, message: MESSAGE_DE_BUG, detail, action: 'signaler-support' };
}
