import { create } from 'zustand';
import { apiClient, User } from './api-client';
import { storage } from './storage';
import { LocalReadError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'auth-store' });

const tokenKey = 'auth_token';
const refreshTokenKey = 'refresh_token';

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
    try {
      const token = await storage.getItem(tokenKey);
      if (token) {
        const payload = decodeJwtPayload(token);
        const userId = payload.sub ?? payload.user_id;
        if (typeof userId === 'string' || typeof userId === 'number') {
          const user = await apiClient.getProfile(token);
          set({ token, user, isAuthenticated: true, isInitialized: true });
          return;
        }
      }
      set({ isInitialized: true });
    } catch (error) {
      // `failure` et non `throw` : `init()` est appelée derrière `runTask` au
      // démarrage, et un jeton illisible n'a qu'une conséquence — l'agent se
      // reconnecte. Ce qui manquait, c'est la trace : le compte se
      // déconnectait tout seul sans que rien ne dise pourquoi.
      log.failure('auth.init.failed', error);

      try {
        await storage.deleteItem(tokenKey);
      } catch (erreurNettoyage) {
        // Silence délibéré, l'un des quatre du mobile : le jeton est déjà
        // écarté en mémoire, et échouer à l'effacer du disque ne change rien à
        // ce que l'agent peut faire. La raison va dans le journal plutôt que
        // dans ce commentaire, pour que le support la voie.
        log.ignore(
          erreurNettoyage,
          'Jeton déjà écarté en mémoire — son effacement disque ne change rien pour l’agent.'
        );
      }

      set({ isInitialized: true });
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
    await storage.deleteItem(tokenKey);
    await storage.deleteItem(refreshTokenKey);
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
