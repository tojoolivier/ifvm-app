import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { listUnsyncedProspections } from '@/lib/prospection-repository';
import { syncAllProspections } from '@/lib/prospection-review';
import { listUnsyncedTraitements } from '@/lib/traitement-repository';
import { syncAllTraitements } from '@/lib/traitement-sync';
import { runTask } from '@/lib/run-task';
import { synchroniserSitesAeriens } from '@/lib/site-aerien-sync';

interface ConnectivityTransition {
  /** `null` = pas encore observé (démarrage de l'app). */
  wasConnected: boolean | null;
  isConnected: boolean;
}

/**
 * Synchronisation automatique des fiches de prospection et de traitement dès
 * que la connectivité revient (#synchronisation-automatique), y compris au
 * premier check si déjà connecté — même logique qu'ADR-007
 * (useReferentielAutoSync), étendue des référentiels descendants aux fiches
 * remontantes. Avant ce hook, l'envoi n'existait que derrière un bouton
 * « Synchroniser » que l'agent devait presser en étant en ligne : une fiche
 * complète, correctement mise en file (aucun seuil de tentatives ni date
 * d'expiration, cf. sync-lot.ts), pouvait donc attendre indéfiniment que
 * quelqu'un rouvre l'écran et appuie, même une fois le réseau revenu.
 *
 * Fonction pure locale, même motif que `shouldTriggerAutoSync` du référentiel :
 * testable sans moteur de rendu.
 */
function shouldTriggerAutoSync({ wasConnected, isConnected }: ConnectivityTransition): boolean {
  if (!isConnected) return false;
  return wasConnected !== true;
}

/**
 * Relève la connectivité, tire la synchronisation des deux domaines si elle
 * vient de revenir, et rend l'état observé — que l'appelant garde comme
 * prochain `wasConnected`.
 *
 * `syncAllProspections`/`syncAllTraitements` (sync-lot.ts) ne lèvent jamais
 * (« le lot résume ») : un lot partiellement parti est un état normal du
 * terrain, pas une panne à faire remonter. `runTask({ criticality:
 * 'best-effort' })` couvre malgré tout un échec de la lecture locale elle-même
 * (SQLite indisponible) — une synchronisation automatique en tâche de fond ne
 * mérite jamais d'interrompre l'agent, mais l'échec laisse sa trace au journal.
 *
 * Les deux domaines sont indépendants : un échec de lecture/synchronisation
 * des prospections ne doit jamais empêcher celle des traitements (et
 * inversement) — d'où deux appels distincts plutôt qu'un `Promise.all` qui
 * ferait échouer les deux au premier problème.
 *
 * `isConnectedObserve` est capturée hors du résultat de `runTask`, même
 * raison qu'au référentiel : un lot qui échoue après un relevé de
 * connectivité réussi ne doit pas se traduire en « hors ligne » auprès de
 * l'appelant, sous peine de redéclencher une synchronisation à chaque tour.
 */
export async function checkAndSyncFiches(
  token: string,
  wasConnected: boolean | null
): Promise<boolean> {
  let isConnectedObserve = false;

  await runTask(
    async () => {
      const state = await Network.getNetworkStateAsync();
      isConnectedObserve = Boolean(state.isConnected && state.isInternetReachable);

      if (!shouldTriggerAutoSync({ wasConnected, isConnected: isConnectedObserve })) {
        return;
      }

      await runTask(
        async () => {
          const prospections = await listUnsyncedProspections();
          if (prospections.length > 0) {
            await syncAllProspections(prospections, token);
          }
        },
        { name: 'sync.auto.prospections', criticality: 'best-effort' }
      );

      await runTask(
        async () => {
          const traitements = await listUnsyncedTraitements();
          if (traitements.length > 0) {
            await syncAllTraitements(traitements, token);
          }
        },
        { name: 'sync.auto.traitements', criticality: 'best-effort' }
      );

      // Sites aériens saisis sur le terrain (#643) : autre domaine, autre file — même retour du réseau.
      await runTask(() => synchroniserSitesAeriens(token).then(() => undefined), {
        name: 'sync.auto.sites-aeriens',
        criticality: 'best-effort',
      });
    },
    { name: 'sync.auto.fiches', criticality: 'best-effort' }
  );

  return isConnectedObserve;
}

/**
 * Déclenche la synchronisation des fiches en attente dès que la connectivité
 * revient (#synchronisation-automatique) — au retour au premier plan de
 * l'app, comme le référentiel (ADR-007). Monté une seule fois, au même niveau
 * que `useReferentielAutoSync` (racine de l'app), pour tourner quel que soit
 * l'écran affiché.
 */
export function useFichesAutoSync(token: string | null): void {
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!token) return;

    const verifier = async () => {
      wasConnected.current = await checkAndSyncFiches(token, wasConnected.current);
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
