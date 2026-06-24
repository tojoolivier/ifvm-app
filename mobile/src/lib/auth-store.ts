import { create } from 'zustand';
import { apiClient, User } from './api-client';
import { storage } from './storage';

const tokenKey = 'auth_token';

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
  const base64Url = token.split('.')[1];
  return JSON.parse(decodeBase64Url(base64Url));
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
    } catch {
      try {
        await storage.deleteItem(tokenKey);
      } catch {
        // cleanup failed — ignore
      }
      set({ isInitialized: true });
    }
  },

  login: async (email: string, password: string) => {
    try {
      console.log('[auth] login start', email);
      const response = await apiClient.login({ email, password });
      console.log('[auth] login API ok, token:', response.access_token?.substring(0, 30));
      const token = response.access_token;
      await storage.setItem(tokenKey, token);
      console.log('[auth] token stored');
      let user = null;
      try {
        user = await apiClient.getProfile(token);
        console.log('[auth] getProfile ok:', user);
      } catch (e) {
        console.warn('[auth] getProfile failed:', e);
      }
      set({ token, user, isAuthenticated: true });
      console.log('[auth] state set, isAuthenticated=true');
    } catch (e) {
      console.error('[auth] login FAILED:', e);
      set({ token: null, user: null, isAuthenticated: false });
      throw new Error('Login failed');
    }
  },

  logout: async () => {
    await storage.deleteItem(tokenKey);
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
