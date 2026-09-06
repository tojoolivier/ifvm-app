import { create } from 'zustand';
import { apiClient, User } from './api-client';
import { storage } from './storage';
import { AuthError, LocalReadError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'auth-store' });

const tokenKey = 'auth_token';
const refreshTokenKey = 'refresh_token';
// Dernier profil connu, mis en cache pour qu'un démarrage hors ligne affiche
// autre chose que `null` (#offline-apres-premiere-connexion) — ex. l'auto-
// remplissage "chef de base = utilisateur connecté" sur l'écran Équipe.
const userKey = 'auth_user';

function lireUserCache(): Promise<User | null> {
  return storage.getItem(userKey).then((raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch (error) {
      // Silence délibéré : un cache de profil corrompu n'est qu'un confort
      // d'affichage perdu, jamais une raison de bloquer la restauration de
      // session — `getProfile()` le regénérera dès que le réseau reviendra.
      log.ignore(error, 'Cache de profil illisible — ignoré, sans conséquence sur la session.');
      return null;
    }
  });
}

function ecrireUserCache(user: User): Promise<void> {
  return storage.setItem(userKey, JSON.stringify(user));
}

/**
 * Efface les trois clés de session locales. N'est appelée que pour une vraie
 * raison de déconnexion (jeton corrompu, ou rejeté explicitement par le
 * serveur) — jamais pour une simple panne réseau. Échec d'effacement toléré :
 * l'état mémoire est déjà à jour, et le disque ne change rien à ce que
 * l'agent peut faire dans l'immédiat.
 */
async function deconnecterLocalement(): Promise<void> {
  for (const key of [tokenKey, refreshTokenKey, userKey]) {
    try {
      await storage.deleteItem(key);
    } catch (error) {
      log.ignore(error, `Effacement de ${key} impossible — sans conséquence pour l’agent.`);
    }
  }
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<number, number> = {};
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

function decodeBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';

  const bytes: number[] = [];
  for (let i = 0; i < base64.length; i += 4) {
    const a = B64_LOOKUP[base64.charCodeAt(i)] || 0;
    const b = B64_LOOKUP[base64.charCodeAt(i + 1)] || 0;
    const c = B64_LOOKUP[base64.charCodeAt(i + 2)] || 0;
    const d = B64_LOOKUP[base64.charCodeAt(i + 3)] || 0;
    bytes.push((a << 2) | (b >> 4));
    if (base64.charCodeAt(i + 2) !== 61) bytes.push(((b & 15) << 4) | (c >> 2));
    if (base64.charCodeAt(i + 3) !== 61) bytes.push(((c & 3) << 6) | d);
  }

  return decodeURIComponent(
    bytes.map((b) => '%' + ('0' + b.toString(16)).slice(-2)).join('')
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1];
    return JSON.parse(decodeBase64Url(base64Url));
  } catch (error) {
    // Le jeton stocké est corrompu : donnée locale illisible, et déjà perdue.
    throw new LocalReadError('Jeton d’authentification stocké illisible', {
      cause: error,
    });
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  init: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  init: async () => {
    let token: string | null;
    try {
      token = await storage.getItem(tokenKey);
    } catch (error) {
      // Magasin illisible : aucun jeton exploitable, quelle qu'en soit la
      // raison. Pas de nettoyage à tenter ici (on ne sait même pas lire).
      log.failure('auth.init.failed', error);
      set({ isInitialized: true });
      return;
    }

    if (!token) {
      set({ isInitialized: true });
      return;
    }

    let userId: unknown;
    try {
      const payload = decodeJwtPayload(token);
      userId = payload.sub ?? payload.user_id;
    } catch (error) {
      // Jeton stocké corrompu (pas décodable) : une vraie raison de
      // déconnexion, indépendante du réseau.
      log.failure('auth.init.failed', error);
      await deconnecterLocalement();
      set({ isInitialized: true });
      return;
    }

    if (typeof userId !== 'string' && typeof userId !== 'number') {
      // Jeton structurellement invalide (pas de sujet) : même raisonnement.
      await deconnecterLocalement();
      set({ isInitialized: true });
      return;
    }

    // Le jeton stocké est structurellement valide : la session est restaurée
    // immédiatement, SANS attendre le réseau (#offline-apres-premiere-connexion)
    // — un appareil qui rouvre l'app hors couverture ne doit jamais se
    // retrouver éjecté vers l'écran de connexion. Le profil affiché est
    // d'abord le dernier connu en cache local, en attendant mieux.
    const userEnCache = await lireUserCache();
    set({ token, user: userEnCache, isAuthenticated: true, isInitialized: true });

    try {
      const user = await apiClient.getProfile(token);
      set({ user });
      await ecrireUserCache(user);
    } catch (error) {
      if (error instanceof AuthError) {
        // Ici, et seulement ici, le serveur a explicitement rejeté ce jeton
        // (expiré/révoqué, rafraîchissement lui-même refusé) : la déconnexion
        // est justifiée — ce n'est plus une panne réseau.
        log.failure('auth.init.failed', error);
        await deconnecterLocalement();
        set({ token: null, user: null, isAuthenticated: false });
      } else {
        // `NetworkError` (hors ligne) ou toute autre panne transitoire :
        // la session reste ouverte avec le profil en cache. `getProfile`
        // sera retenté à la prochaine ouverture, ou via la resynchro
        // automatique du référentiel dès que le réseau revient.
        log.ignore(error, 'Profil indisponible au démarrage (hors ligne ?) — session conservée.');
      }
    }
  },

  login: async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });
      const token = response.access_token;
      await storage.setItem(tokenKey, token);
      await storage.setItem(refreshTokenKey, response.refresh_token);

      let user = null;
      try {
        user = await apiClient.getProfile(token);
        await ecrireUserCache(user);
      } catch (erreurProfil) {
        // Silence délibéré : la session est ouverte et le jeton posé. Le
        // profil n'est qu'un confort d'affichage, et il sera relu au prochain
        // `init()`. Refuser la connexion pour ça enfermerait dehors un agent
        // parfaitement authentifié.
        log.ignore(
          erreurProfil,
          'Profil indisponible — la session est ouverte, il sera relu au prochain démarrage.'
        );
      }

      set({ token, user, isAuthenticated: true });
      log.event('auth.login.ok', { avecProfil: user !== null });
    } catch (error) {
      // L'état est remis à zéro pour ne pas laisser une demi-session ; l'erreur
      // repart typée telle quelle vers l'écran, qui décide de l'afficher
      // inline (identifiants) ou en bannière (panne).
      set({ token: null, user: null, isAuthenticated: false });
      throw error;
    }
  },

  logout: async () => {
    await deconnecterLocalement();
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    set({ user });
  },

  refreshToken: async () => {
    const refreshToken = await storage.getItem(refreshTokenKey);
    if (!refreshToken) return false;

    try {
      const response = await apiClient.refresh(refreshToken);
      await storage.setItem(tokenKey, response.access_token);
      set({ token: response.access_token });
      return true;
    } catch (error) {
      // Silence délibéré : un refresh refusé n'est pas un incident, c'est la
      // fin normale d'une session. Le `false` rendu **dit** l'échec — il n'est
      // pas indiscernable d'un succès — et l'appelant renvoie vers l'écran de
      // connexion.
      log.ignore(error, 'Rafraîchissement refusé — fin de session normale, retour à la connexion.');

      await storage.deleteItem(tokenKey);
      await storage.deleteItem(refreshTokenKey);
      set({ token: null, user: null, isAuthenticated: false });
      return false;
    }
  },
}));
