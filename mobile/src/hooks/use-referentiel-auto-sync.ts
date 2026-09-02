import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { pullReferentiel } from '@/lib/referentiel-sync';
import { runTask } from '@/lib/run-task';

interface ConnectivityTransition {
  /** `null` = pas encore observé (démarrage de l'app). */
  wasConnected: boolean | null;
  isConnected: boolean;
}

/**
 * ADR-007 : pull automatique dès que la connectivité revient, y compris au
 * premier check si déjà connecté.
 *
 * Fonction pure locale : ce fichier-ci **est** le hook vivant (voir plus bas).
 * Elle a d'abord été dupliquée depuis un jumeau mort `lib/referentiel-auto-
 * sync.ts` (supprimé en #188) plutôt qu'importée de là, pour ne pas recoupler
 * le code qui tourne à celui qui ne tournait pas.
 */
function shouldTriggerAutoSync({ wasConnected, isConnected }: ConnectivityTransition): boolean {
  if (!isConnected) return false;
  return wasConnected !== true;
}

/**
 * Relève la connectivité, tire le pull si elle vient de revenir, et rend
 * l'état observé — que l'appelant garde comme prochain `wasConnected`.
 *
 * Logique pure (sans état React), extraite pour être testable sans moteur de
 * rendu — même motif qu'`executeAsyncAction`. Trouvée en revue de #173 : le
 * `catch { console.warn }` qui vivait ici était le dernier échec avalé du
 * chemin référentiel — invisible d'abord parce que rien ne l'exerçait, mais
 * surtout parce que ce fichier avait un **jumeau mort**, `lib/referentiel-
 * auto-sync.ts`, que la migration de #173 avait refondu à sa place et que
 * #188 a supprimé.
 *
 * Tout passe par `runTask({ criticality: 'best-effort' })` : un référentiel
 * un peu vieux ne mérite pas d'interrompre l'agent, mais l'échec laisse
 * désormais sa trace. Et `runTask` ne rejetant jamais, les deux appels
 * flottants du hook (`void ...`) le sont en toute légalité — c'est le seul
 * endroit du mobile où une promesse peut flotter (ADR-012 décision 1).
 *
 * Sur panne du relevé de connectivité lui-même, l'état rendu est « hors
 * ligne » : la prochaine transition vers « en ligne » re-déclenchera le pull,
 * là où « en ligne » à tort l'aurait supprimé.
 *
 * `isConnectedObserve` est capturée **hors** du résultat de `runTask` : un
 * pull qui échoue après un relevé de connectivité réussi ne doit pas se
 * traduire en « hors ligne » auprès de l'appelant. Confondre l'échec de la
 * tâche avec une déconnexion masquerait la vraie transition au prochain
 * passage — l'agent resterait relié, mais `shouldTriggerAutoSync` croirait
 * le contraire et redéclencherait un pull à chaque tour au lieu d'un seul.
 */
export async function checkAndSyncReferentiel(
  token: string,
  wasConnected: boolean | null
): Promise<boolean> {
  let isConnectedObserve = false;

  await runTask(
    async () => {
      const state = await Network.getNetworkStateAsync();
      isConnectedObserve = Boolean(state.isConnected && state.isInternetReachable);

      if (shouldTriggerAutoSync({ wasConnected, isConnected: isConnectedObserve })) {
        await pullReferentiel(token);
      }
    },
    { name: 'sync.referentiel', criticality: 'best-effort' }
  );

  return isConnectedObserve;
}

/** ADR-007 : déclenche le pull du référentiel dès que la connectivité revient. */
export function useReferentielAutoSync(token: string | null): void {
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!token) return;

    const verifier = async () => {
      wasConnected.current = await checkAndSyncReferentiel(token, wasConnected.current);
    };

    void verifier();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void verifier();
      }
    });

    return () => subscription.remove();
  }, [token]);
}
