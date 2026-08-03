import { create } from 'zustand';
import { useDebugStore } from './debug-store';

const MAX_ENTRIES = 100;

export interface RequestLogEntry {
  id: string;
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  startedAt: string;
  requestBody?: string | null;
  responseBody?: string | null;
  error?: string | null;
}

interface RequestLogState {
  entries: RequestLogEntry[];
}

interface RequestLogActions {
  addEntry: (entry: Omit<RequestLogEntry, 'id'>) => void;
  clear: () => void;
}

export const useRequestLogStore = create<RequestLogState & RequestLogActions>((set) => ({
  entries: [],

  addEntry: (entry) => {
    if (!useDebugStore.getState().enabled) return;
    set((state) => ({
      entries: [{ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, ...state.entries].slice(
        0,
        MAX_ENTRIES
      ),
    }));
  },

  clear: () => set({ entries: [] }),
}));
