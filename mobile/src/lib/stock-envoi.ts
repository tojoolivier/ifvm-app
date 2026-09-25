import { envoyerSiEnLigne } from './envoi-en-ligne';
import { synchroniserStock } from './stock-sync';

/** Envoie les mouvements de stock en attente si le réseau est là (#645) : après une saisie, à l'ouverture de l'écran Stock. */
export const envoyerStockSiEnLigne = (token: string) =>
  envoyerSiEnLigne('sync.stock', () => synchroniserStock(token));
