import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient, User } from './api-client';

const TOKEN_KEY = 'auth_token';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
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
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const payload = decodeJwtPayload(token);
        const userId = payload.user_id;
        if (typeof userId === 'number') {
          const user = await apiClient.getProfile(token);
          set({ token, user, isAuthenticated: true, isInitialized: true });
          return;
        }
      }
      set({ isInitialized: true });
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ isInitialized: true });
    }
  },

  login: async (username: string, password: string) => {
    const response = await apiClient.login({ username, password });
    const token = response.access_token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const user = await apiClient.getProfile(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
