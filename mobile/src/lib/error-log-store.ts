import { create } from 'zustand';
import { useDebugStore } from './debug-store';

const MAX_ENTRIES = 100;

export interface ErrorLogEntry {
  id: string;
  message: string;
  stack?: string | null;
  screen?: string | null;
  context?: Record<string, unknown> | null;
  occurredAt: string;
}

interface ErrorLogState {
  entries: ErrorLogEntry[];
}

interface ErrorLogActions {
  addEntry: (entry: Omit<ErrorLogEntry, 'id' | 'occurredAt'>) => void;
  clear: () => void;
}

export const useErrorLogStore = create<ErrorLogState & ErrorLogActions>((set) => ({
  entries: [],

  addEntry: (entry) => {
    if (!useDebugStore.getState().enabled) return;
    set((state) => ({
      entries: [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, occurredAt: new Date().toISOString() },
        ...state.entries,
      ].slice(0, MAX_ENTRIES),
    }));
  },

  clear: () => set({ entries: [] }),
}));
