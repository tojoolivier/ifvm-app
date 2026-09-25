import * as Network from 'expo-network';
import { runTask } from './run-task';

/**
 * Lance `tache` **si le réseau est là** (ADR-012) : hors réseau rien ne part et rien n'échoue, la
 * saisie reste dans sa file. `runTask` ne rejette jamais et journalise ce qui casse — une tâche de
 * fond n'interrompt pas l'agent, mais elle ne se tait pas non plus.
 */
export async function envoyerSiEnLigne(nom: string, tache: () => Promise<unknown>): Promise<void> {
  await runTask(
    async () => {
      const etat = await Network.getNetworkStateAsync();
      if (!(etat.isConnected && etat.isInternetReachable)) return;
      await tache();
    },
    { name: nom, criticality: 'best-effort' }
  );
}
