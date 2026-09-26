import { envoyerSiEnLigne } from './envoi-en-ligne';
import { synchroniserSitesAeriens } from './site-aerien-sync';

/**
 * Envoie les sites et déplacements en attente si le réseau est là (#643) — appelé juste après une
 * saisie sur le terrain et au retour de la connectivité (`use-fiches-auto-sync`).
 */
export const envoyerSitesSiEnLigne = (token: string) =>
  envoyerSiEnLigne('sync.sites-aeriens', () => synchroniserSitesAeriens(token));
