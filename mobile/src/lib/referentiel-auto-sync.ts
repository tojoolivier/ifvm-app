import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ReferentielPullResponse, ReferentielSinceCursors } from './api-client';
import { useAuthStore } from './auth-store';

const CURSORS_STORAGE_KEY = 'referentiel_cursors';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes avant expiration

export interface ConnectivityTransition {
  /** `null` = pas encore observé (démarrage de l'app). */
  wasConnected: boolean | null;
  isConnected: boolean;
}

/** ADR-007 : pull auto dès que la connectivité revient — y compris au premier check si déjà connecté. */
export function shouldTriggerAutoSync({ wasConnected, isConnected }: ConnectivityTransition): boolean {
  if (!isConnected) return false;
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
    const raw = await AsyncStorage.getItem(CURSORS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // S'assurer que tous les champs existent
      return { ...getDefaultCursors(), ...parsed };
    }
  } catch (error) {
    console.warn('[referentiel-auto-sync] Erreur chargement curseurs:', error);
  }
  return getDefaultCursors();
}

async function saveCursors(cursors: ReferentielSinceCursors): Promise<void> {
  try {
    await AsyncStorage.setItem(CURSORS_STORAGE_KEY, JSON.stringify(cursors));
  } catch (error) {
    console.warn('[referentiel-auto-sync] Erreur sauvegarde curseurs:', error);
  }
}

function updateCursorsFromResponse(
  cursors: ReferentielSinceCursors,
  response: ReferentielPullResponse
): ReferentielSinceCursors {
  const newCursors = { ...cursors };
  
  if (response.postes_acridiens.server_time) {
    newCursors.postes_acridiens = response.postes_acridiens.server_time;
  }
  if (response.stations_fixes.server_time) {
    newCursors.stations_fixes = response.stations_fixes.server_time;
  }
  if (response.utilisateurs_equipe.server_time) {
    newCursors.utilisateurs_equipe = response.utilisateurs_equipe.server_time;
  }
  if (response.pesticides.server_time) {
    newCursors.pesticides = response.pesticides.server_time;
  }
  if (response.cultures.server_time) {
    newCursors.cultures = response.cultures.server_time;
  }
  if (response.codes_stades.server_time) {
    newCursors.codes_stades = response.codes_stades.server_time;
  }
  if (response.campagnes.server_time) {
    newCursors.campagnes = response.campagnes.server_time;
  }
  
  return newCursors;
}

/**
 * Vérifie si un token JWT est proche de l'expiration
 */
async function isTokenExpiringSoon(token: string): Promise<boolean> {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convertir en millisecondes
    const now = Date.now();
    const timeUntilExpiry = exp - now;
    return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS;
  } catch {
    // Si on ne peut pas décoder, considérer comme expiré
    return true;
  }
}

export function useReferentielAutoSync(token: string | null) {
  const [isConnected, setIsConnected] = useState(true);
  const wasConnectedRef = useRef<boolean | null>(null);
  const syncInProgressRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const performSyncWithToken = async (authToken: string) => {
    const cursors = await loadCursors();
    
    const response = await apiClient.pullReferentiel(
      authToken,
      cursors,
      async () => {
        // OnUnauthorized callback
        console.warn('[referentiel-auto-sync] Token invalide, déconnexion');
        await useAuthStore.getState().logout();
      }
    );

    // Mettre à jour les curseurs
    const newCursors = updateCursorsFromResponse(cursors, response);
    await saveCursors(newCursors);

    console.log('[referentiel-auto-sync] Synchronisation réussie');
  };

  const performSync = async (force: boolean = false) => {
    if (!token) {
      console.log('[referentiel-auto-sync] Pas de token, synchronisation ignorée');
      return;
    }

    if (syncInProgressRef.current) {
      console.log('[referentiel-auto-sync] Synchronisation déjà en cours');
      return;
    }

    if (!isConnected && !force) {
      console.log('[referentiel-auto-sync] Pas de connexion, synchronisation différée');
      return;
    }

    try {
      syncInProgressRef.current = true;
      console.log('[referentiel-auto-sync] Début de la synchronisation...');

      // Vérifier si le token est proche de l'expiration
      const tokenExpired = await isTokenExpiringSoon(token);
      if (tokenExpired) {
        console.log('[referentiel-auto-sync] Token proche de l\'expiration, tentative de rafraîchissement...');
        const refreshed = await useAuthStore.getState().refreshToken();
        if (!refreshed) {
          console.warn('[referentiel-auto-sync] Échec du rafraîchissement du token');
          return;
        }
        // Récupérer le nouveau token
        const newToken = useAuthStore.getState().token;
        if (!newToken) {
          console.warn('[referentiel-auto-sync] Pas de token après rafraîchissement');
          return;
        }
        // Continuer avec le nouveau token
        await performSyncWithToken(newToken);
        return;
      }

      await performSyncWithToken(token);
    } catch (error) {
      console.error('[referentiel-auto-sync] Erreur lors de la synchronisation:', error);
      
      // Si l'erreur est liée au token, déconnecter
      if (error instanceof Error && 
          (error.message.includes('Token invalide') || 
           error.message.includes('401') ||
           error.message.includes('Unauthorized'))) {
        console.warn('[referentiel-auto-sync] Token invalide, déconnexion');
        await useAuthStore.getState().logout();
      }
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Effet pour la synchronisation périodique
  useEffect(() => {
    if (!token) return;

    // Synchronisation initiale (avec un délai pour laisser l'app démarrer)
    const initialTimeout = setTimeout(() => {
      performSync();
    }, 2000);

    // Intervalle régulier
    intervalRef.current = setInterval(() => {
      performSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token]);

  // Effet pour la gestion de la connectivité
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasInBackground = appStateRef.current !== 'active';
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active' && wasInBackground) {
        // L'app revient au premier plan, faire un sync
        console.log('[referentiel-auto-sync] App revient au premier plan, synchronisation...');
        performSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [token]);

  // Exposer la fonction de synchronisation manuelle
  return {
    syncNow: () => performSync(true),
    isSyncing: syncInProgressRef.current,
  };
}