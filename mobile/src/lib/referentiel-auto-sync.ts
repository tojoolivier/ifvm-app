import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiClient,
  ReferentielPullResponse,
  ReferentielSinceCursors,
} from './api-client';
import { useAuthStore } from './auth-store';

const CURSORS_STORAGE_KEY = 'referentiel_cursors';
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export interface ConnectivityTransition {
  /** `null` = pas encore observé (démarrage de l'app). */
  wasConnected: boolean | null;
  isConnected: boolean;
}

/**
 * ADR-007 :
 * pull automatique dès que la connectivité revient,
 * y compris au premier check si déjà connecté.
 */
export function shouldTriggerAutoSync({
  wasConnected,
  isConnected,
}: ConnectivityTransition): boolean {
  if (!isConnected) {
    return false;
  }

  return wasConnected !== true;
}

function getDefaultCursors(): ReferentielSinceCursors {
  return {
    postes_acridiens: null,
    stations_fixes: null,
    utilisateurs_equipe: null,
    pesticides: null,
    cultures: null,
    codes_stades: null,
    campagnes: null,
  };
}

async function loadCursors(): Promise<ReferentielSinceCursors> {
  try {
    const raw = await AsyncStorage.getItem(
      CURSORS_STORAGE_KEY
    );

    if (raw) {
      const parsed = JSON.parse(raw);

      return {
        ...getDefaultCursors(),
        ...parsed,
      };
    }
  } catch (error) {
    console.warn(
      '[referentiel-auto-sync] Erreur chargement curseurs:',
      error
    );
  }

  return getDefaultCursors();
}

async function saveCursors(
  cursors: ReferentielSinceCursors
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CURSORS_STORAGE_KEY,
      JSON.stringify(cursors)
    );
  } catch (error) {
    console.warn(
      '[referentiel-auto-sync] Erreur sauvegarde curseurs:',
      error
    );
  }
}

function updateCursorsFromResponse(
  cursors: ReferentielSinceCursors,
  response: ReferentielPullResponse
): ReferentielSinceCursors {
  const newCursors = {
    ...cursors,
  };

  if (response.postes_acridiens.server_time) {
    newCursors.postes_acridiens =
      response.postes_acridiens.server_time;
  }

  if (response.stations_fixes.server_time) {
    newCursors.stations_fixes =
      response.stations_fixes.server_time;
  }

  if (response.utilisateurs_equipe.server_time) {
    newCursors.utilisateurs_equipe =
      response.utilisateurs_equipe.server_time;
  }

  if (response.pesticides.server_time) {
    newCursors.pesticides =
      response.pesticides.server_time;
  }

  if (response.cultures.server_time) {
    newCursors.cultures =
      response.cultures.server_time;
  }

  if (response.codes_stades.server_time) {
    newCursors.codes_stades =
      response.codes_stades.server_time;
  }

  if (response.campagnes.server_time) {
    newCursors.campagnes =
      response.campagnes.server_time;
  }

  return newCursors;
}

/**
 * Vérifie si un token JWT est proche de l'expiration.
 */
async function isTokenExpiringSoon(
  token: string
): Promise<boolean> {
  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return true;
    }

    const payload = JSON.parse(
      atob(parts[1])
    );

    const exp = payload.exp;

    if (typeof exp !== 'number') {
      return true;
    }

    const expiryTime = exp * 1000;
    const now = Date.now();

    return (
      expiryTime - now <
      TOKEN_REFRESH_THRESHOLD_MS
    );
  } catch {
    // Si le token ne peut pas être décodé,
    // on le considère comme expiré.
    return true;
  }
}

export function useReferentielAutoSync(
  token: string | null
) {
  const [isConnected, setIsConnected] =
    useState(true);

  /**
   * IMPORTANT :
   * `syncInProgressRef` sert uniquement à empêcher
   * deux synchronisations simultanées.
   *
   * On ne le lit jamais directement pendant le render.
   */
  const syncInProgressRef =
    useRef(false);

  /**
   * Etat React utilisé pour exposer `isSyncing`
   * au composant appelant.
   */
  const [isSyncing, setIsSyncing] =
    useState(false);

  const intervalRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const appStateRef =
    useRef<AppStateStatus>(
      AppState.currentState
    );

  const performSyncWithToken =
    useCallback(
      async (authToken: string) => {
        const cursors =
          await loadCursors();

        const response =
          await apiClient.pullReferentiel(
            authToken,
            cursors,
            async () => {
              console.warn(
                '[referentiel-auto-sync] Token invalide, déconnexion'
              );

              await useAuthStore
                .getState()
                .logout();
            }
          );

        const newCursors =
          updateCursorsFromResponse(
            cursors,
            response
          );

        await saveCursors(
          newCursors
        );

        console.log(
          '[referentiel-auto-sync] Synchronisation réussie'
        );
      },
      []
    );

  const performSync = useCallback(
    async (force = false) => {
      if (!token) {
        console.log(
          '[referentiel-auto-sync] Pas de token, synchronisation ignorée'
        );
        return;
      }

      if (syncInProgressRef.current) {
        console.log(
          '[referentiel-auto-sync] Synchronisation déjà en cours'
        );
        return;
      }

      if (!isConnected && !force) {
        console.log(
          '[referentiel-auto-sync] Pas de connexion, synchronisation différée'
        );
        return;
      }

      try {
        syncInProgressRef.current = true;
        setIsSyncing(true);

        console.log(
          '[referentiel-auto-sync] Début de la synchronisation...'
        );

        const tokenExpiring =
          await isTokenExpiringSoon(
            token
          );

        if (tokenExpiring) {
          console.log(
            '[referentiel-auto-sync] Token proche de l\'expiration, tentative de rafraîchissement...'
          );

          const refreshed =
            await useAuthStore
              .getState()
              .refreshToken();

          if (!refreshed) {
            console.warn(
              '[referentiel-auto-sync] Échec du rafraîchissement du token'
            );
            return;
          }

          const newToken =
            useAuthStore
              .getState()
              .token;

          if (!newToken) {
            console.warn(
              '[referentiel-auto-sync] Pas de token après rafraîchissement'
            );
            return;
          }

          await performSyncWithToken(
            newToken
          );

          return;
        }

        await performSyncWithToken(
          token
        );
      } catch (error) {
        console.error(
          '[referentiel-auto-sync] Erreur lors de la synchronisation:',
          error
        );

        if (
          error instanceof Error &&
          (
            error.message.includes(
              'Token invalide'
            ) ||
            error.message.includes(
              '401'
            ) ||
            error.message.includes(
              'Unauthorized'
            )
          )
        ) {
          console.warn(
            '[referentiel-auto-sync] Token invalide, déconnexion'
          );

          await useAuthStore
            .getState()
            .logout();
        }
      } finally {
        syncInProgressRef.current = false;
        setIsSyncing(false);
      }
    },
    [
      token,
      isConnected,
      performSyncWithToken,
    ]
  );

  /**
   * Synchronisation périodique.
   */
  useEffect(() => {
    if (!token) {
      return;
    }

    const initialTimeout =
      setTimeout(() => {
        void performSync();
      }, 2000);

    intervalRef.current =
      setInterval(() => {
        void performSync();
      }, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(
        initialTimeout
      );

      if (intervalRef.current) {
        clearInterval(
          intervalRef.current
        );

        intervalRef.current =
          null;
      }
    };
  }, [
    token,
    performSync,
  ]);

  /**
   * Synchronisation lorsque l'application
   * revient au premier plan.
   */
  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (
          nextAppState: AppStateStatus
        ) => {
          const wasInBackground =
            appStateRef.current !==
            'active';

          appStateRef.current =
            nextAppState;

          if (
            nextAppState ===
              'active' &&
            wasInBackground
          ) {
            console.log(
              '[referentiel-auto-sync] App revient au premier plan, synchronisation...'
            );

            void performSync();
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [performSync]);

  return {
    syncNow: () =>
      performSync(true),

    isSyncing,
  };
}