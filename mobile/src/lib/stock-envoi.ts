import * as Network from 'expo-network';
import { runTask } from './run-task';
import { synchroniserStock } from './stock-sync';

/**
 * Envoie les mouvements de stock en attente **si le réseau est là** (#645) — appelé juste après une
 * saisie, à l'ouverture de l'écran Stock et au retour de la connectivité. Hors réseau, rien ne part
 * et rien n'échoue : la saisie reste dans la file. Même convention que `site-aerien-envoi.ts`.
 */
export async function envoyerStockSiEnLigne(token: string): Promise<void> {
  await runTask(
    async () => {
      const etat = await Network.getNetworkStateAsync();
      if (!(etat.isConnected && etat.isInternetReachable)) return;
      await synchroniserStock(token);
    },
    { name: 'sync.stock', criticality: 'best-effort' }
  );
}
