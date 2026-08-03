import { create } from 'zustand';
import { storage } from './storage';

const DEBUG_MODE_KEY = 'debug_mode_enabled';

interface DebugState {
  enabled: boolean;
  isInitialized: boolean;
}

interface DebugActions {
  init: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  enabled: false,
  isInitialized: false,

  init: async () => {
    const value = await storage.getItem(DEBUG_MODE_KEY);
    set({ enabled: value === '1', isInitialized: true });
  },

  setEnabled: async (enabled: boolean) => {
    await storage.setItem(DEBUG_MODE_KEY, enabled ? '1' : '0');
    set({ enabled });
  },
}));
