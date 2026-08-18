import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AppState,
  AppStateStatus,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  apiClient,
  ReferentielPullResponse,
  ReferentielSinceCursors,
  refreshAccessTokenSingleFlight,
} from './api-client';

import { useAuthStore } from './auth-store';

const CURSORS_STORAGE_KEY =
  'referentiel_cursors';

const SYNC_INTERVAL_MS =
  5 * 60 * 1000;

const TOKEN_REFRESH_THRESHOLD_MS =
  5 * 60 * 1000;

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
    const raw =
      await AsyncStorage.getItem(
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

  if (
    response.utilisateurs_equipe
      .server_time
  ) {
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
 *
 * Retourne true si :
 * - le token est malformé ;
 * - le payload JWT est invalide ;
 * - exp est absent ou invalide ;
 * - le token est déjà expiré ;
 * - le token expire dans moins de 5 minutes.
 */
export async function isTokenExpiringSoon(
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
    return true;
  }
}

/**
 * Rafraîchit le token en utilisant exactement
 * le même mécanisme single-flight que api-client.
 *
 * Il n'existe volontairement aucun mécanisme
 * de refresh local supplémentaire ici.
 *
 * Comportement :
 *
 * - refresh réussi :
 *   retourne le nouveau token ;
 *
 * - refresh refusé avec retour null :
 *   retourne null ;
 *
 * - erreur technique/rejet de la Promise :
 *   l'erreur est propagée à l'appelant.
 *
 * Le single-flight est entièrement géré par
 * refreshAccessTokenSingleFlight().
 */
export async function refreshTokenForAutoSync(): Promise<string | null> {
  try {
    const refreshedToken =
      await refreshAccessTokenSingleFlight();

    return refreshedToken ?? null;
  } catch (error) {
    console.warn(
      '[referentiel-auto-sync] Échec du rafraîchissement du token:',
      error
    );

    throw error;
  }
}

export function useReferentielAutoSync(
  token: string | null
) {
  const [
    isConnected,
    setIsConnected,
  ] = useState(true);

  /**
   * Sert uniquement à empêcher deux synchronisations
   * simultanées.
   */
  const syncInProgressRef =
    useRef(false);

  const [
    isSyncing,
    setIsSyncing,
  ] = useState(false);

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

  const performSync =
    useCallback(
      async (force = false) => {
        if (!token) {
          console.log(
            '[referentiel-auto-sync] Pas de token, synchronisation ignorée'
          );

          return;
        }

        if (
          syncInProgressRef.current
        ) {
          console.log(
            '[referentiel-auto-sync] Synchronisation déjà en cours'
          );

          return;
        }

        if (
          !isConnected &&
          !force
        ) {
          console.log(
            '[referentiel-auto-sync] Pas de connexion, synchronisation différée'
          );

          return;
        }

        try {
          syncInProgressRef.current =
            true;

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
              '[referentiel-auto-sync] Token proche de l\'expiration, utilisation du refresh single-flight...'
            );

            const newToken =
              await refreshTokenForAutoSync();

            if (!newToken) {
              console.warn(
                '[referentiel-auto-sync] Échec du rafraîchissement du token'
              );

              await useAuthStore
                .getState()
                .logout();

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
          syncInProgressRef.current =
            false;

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