import { statutHttpDe } from './api-client';
import { NetworkError } from './errors';

/** Statuts 4xx qui parlent d'un délai ou d'une charge, pas d'un refus métier : on les laisse à la couche réseau. */
const STATUTS_TRANSITOIRES = new Set([408, 425, 429]);

const REPLI_PAR_STATUT: Record<number, string> = {
  403: 'Action refusée : votre rôle ne le permet pas.',
  404: 'Élément introuvable côté serveur — synchronisez puis réessayez.',
  409: 'Conflit : cette donnée existe déjà ou est en cours d’utilisation.',
  422: 'Le serveur a refusé ces données — vérifiez la saisie.',
};

/**
 * Message lisible d'un **refus métier** du serveur (4xx : immatriculation déjà prise, chevauchement
 * d'affectation, rôle refusé…), ou `null` s'il s'agit d'autre chose — panne réseau, 5xx, session
 * expirée, bug — que la couche d'affichage générale (`toFriendlyError`) traite comme avant.
 *
 * `api-client` type tout échec HTTP en `NetworkError` : sans ce helper l'écran ne montre que
 * « Connexion au serveur impossible » alors que le serveur a répondu et dit pourquoi (#673, appliqué
 * pour l'instant aux seuls écrans équipes / parc aéronefs).
 */
export function messageRefusServeur(error: unknown): string | null {
  if (!(error instanceof NetworkError)) return null;
  const statut = statutHttpDe(error);
  if (statut === null || statut < 400 || statut > 499 || STATUTS_TRANSITOIRES.has(statut)) return null;
  const message = error.message.trim();
  if (message && !message.startsWith('HTTP error!')) return message;
  return REPLI_PAR_STATUT[statut] ?? 'Le serveur a refusé cette demande.';
}

/**
 * Exécute `action` ; un refus métier du serveur est passé à `afficher` (message lisible sur l'écran)
 * au lieu de remonter à la couche générale. Toute autre erreur est relancée telle quelle.
 */
export async function surRefusAfficher(action: () => Promise<void>, afficher: (message: string) => void): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = messageRefusServeur(error);
    if (message === null) throw error;
    afficher(message);
  }
}
