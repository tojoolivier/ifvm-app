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
import { AuthError } from './errors';
import { logger } from './logger';
import { runTask } from './run-task';

const log = logger.child({ module: 'referentiel-auto-sync' });

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
    // Silence délibéré : les curseurs ne sont qu'une optimisation. Les perdre
    // coûte un pull complet au prochain passage, jamais une donnée. La raison
    // va dans le journal pour que le support sache que le silence était prévu.
    log.ignore(
      error,
      'Curseurs illisibles — repli sur un pull complet, aucune donnée en jeu.'
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
    // Même raison qu'à la lecture : au pire, le prochain pull repart de zéro.
    log.ignore(
      error,
      'Curseurs non enregistrés — le prochain pull repartira de zéro.'
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
  } catch (error) {
    // Silence délibéré : un jeton illisible est traité comme expirant, donc
    // rafraîchi. C'est le rafraîchissement qui tranchera, et lui n'est pas
    // silencieux.
    log.ignore(
      error,
      'Jeton illisible — traité comme expirant, le rafraîchissement tranchera.'
    );

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
  // Pas de `try/catch` ici : il ne faisait que journaliser puis relancer, ce
  // qui produisait deux lignes pour un seul échec. La frontière `runTask` de
  // `performSync` journalise une fois, avec la classe et le traitement.
  const refreshedToken =
    await refreshAccessTokenSingleFlight();

  return refreshedToken ?? null;
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
              log.event(
                'referentiel.sync.jeton-refuse'
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

        log.event(
          'referentiel.sync.ok'
        );
      },
      []
    );

  const performSync =
    useCallback(
      async (force = false) => {
        const ignorer = (
          raison: string
        ) => {
          log.detail(
            'referentiel.sync.ignoree',
            { raison }
          );
        };

        if (!token) {
          ignorer('pas-de-jeton');

          return;
        }

        if (
          syncInProgressRef.current
        ) {
          ignorer('deja-en-cours');

          return;
        }

        if (
          !isConnected &&
          !force
        ) {
          ignorer('hors-ligne');

          return;
        }

        syncInProgressRef.current =
          true;

        setIsSyncing(true);

        try {
          /*
           * `runTask` remplace le `try/catch` maison. Deux choses changent.
           *
           * D'abord la frontière : l'auto-sync est une tâche de fond
           * `best-effort`, donc son échec est JOURNAL — l'agent n'a rien à
           * faire d'un référentiel un peu vieux, et l'interrompre pour ça
           * serait du bruit.
           *
           * Ensuite la décision de déconnexion, qui se prenait **par regex sur
           * le message** (`'Token invalide' || '401' || 'Unauthorized'`) :
           * elle ratait tout message français, et déconnectait sur n'importe
           * quel bug contenant « 401 ». `api-client` lève désormais `AuthError`
           * (#173), donc `instanceof` suffit — c'est la règle d'ADR-012.
           */
          const resultat = await runTask(
            async () => {
              const tokenExpiring =
                await isTokenExpiringSoon(
                  token
                );

              if (!tokenExpiring) {
                return performSyncWithToken(
                  token
                );
              }

              log.detail(
                'referentiel.sync.jeton-a-rafraichir'
              );

              const newToken =
                await refreshTokenForAutoSync();

              if (!newToken) {
                // Le refus est net, pas une panne : on le dit en `AuthError`
                // plutôt qu'en `return`, pour que la déconnexion ci-dessous
                // parte du même endroit que les 401 du serveur.
                throw new AuthError(
                  'Rafraîchissement du jeton refusé'
                );
              }

              return performSyncWithToken(
                newToken
              );
            },
            {
              name: 'sync.referentiel',
              criticality: 'best-effort',
            }
          );

          if (
            !resultat.ok &&
            resultat.error instanceof AuthError
          ) {
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
            log.detail(
              'referentiel.sync.retour-premier-plan'
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