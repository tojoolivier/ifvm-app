import { create } from 'zustand';
import { storage } from './storage';

const THEME_MODE_KEY = 'app_theme_mode';
export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  isInitialized: boolean;
}

interface ThemeActions {
  init: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState & ThemeActions>((set) => ({
  mode: 'light',
  isInitialized: false,

  init: async () => {
    const value = await storage.getItem(THEME_MODE_KEY);
    const mode = value === 'dark' ? 'dark' : 'light';
    set({ mode, isInitialized: true });
  },

  setMode: async (mode: ThemeMode) => {
    await storage.setItem(THEME_MODE_KEY, mode);
    set({ mode });
  },
}));
