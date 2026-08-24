import { create } from 'zustand';

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
    // Le flag debug **ne gate plus aucune écriture** — ADR-012 décision 4, #171.
    // Il ne règle plus que la verbosité, c'est-à-dire la rétention des `detail`
    // dans `journal-db`. Gater ici, c'était exiger de l'agent qu'il active
    // l'interrupteur AVANT le bug : une dépendance temporelle impossible à
    // satisfaire. (Ce store disparaît en #173, absorbé par le logger.)
    set((state) => ({
      entries: [{ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, ...state.entries].slice(
        0,
        MAX_ENTRIES
      ),
    }));
  },

  clear: () => set({ entries: [] }),
}));
