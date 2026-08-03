import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { pullReferentiel } from '@/lib/referentiel-sync';
import { shouldTriggerAutoSync } from '@/lib/referentiel-auto-sync';

/** ADR-007 : déclenche le pull du référentiel dès que la connectivité revient. */
export function useReferentielAutoSync(token: string | null): void {
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!token) return;

    const checkAndSync = async () => {
      const state = await Network.getNetworkStateAsync();
      const isConnected = Boolean(state.isConnected && state.isInternetReachable);

      if (shouldTriggerAutoSync({ wasConnected: wasConnected.current, isConnected })) {
        try {
          await pullReferentiel(token);
        } catch (error) {
          console.warn('[referentiel-auto-sync] pull failed:', error);
        }
      }
      wasConnected.current = isConnected;
    };

    checkAndSync();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAndSync();
      }
    });

    return () => subscription.remove();
  }, [token]);
}
