import * as Network from 'expo-network';
import { runTask } from './run-task';
import { synchroniserSitesAeriens } from './site-aerien-sync';

/**
 * Envoie les sites et déplacements en attente **si le réseau est là** (#643) — appelé juste après
 * une saisie sur le terrain et au retour de la connectivité (`use-fiches-auto-sync`).
 *
 * Hors réseau, rien ne part et rien n'échoue : la saisie reste dans la file, c'est l'état normal.
 * `runTask` (ADR-012) ne rejette jamais et journalise ce qui casse — une tâche de fond n'interrompt
 * pas l'agent, mais elle ne se tait pas non plus.
 */
export async function envoyerSitesSiEnLigne(token: string): Promise<void> {
  await runTask(
    async () => {
      const etat = await Network.getNetworkStateAsync();
      if (!(etat.isConnected && etat.isInternetReachable)) return;
      await synchroniserSitesAeriens(token);
    },
    { name: 'sync.sites-aeriens', criticality: 'best-effort' }
  );
}
