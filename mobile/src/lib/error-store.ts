import { create } from 'zustand';

export interface GlobalError {
  id: string;
  message: string;
  detail?: string | null;
  retry?: () => void;
}

interface ErrorState {
  current: GlobalError | null;
}

interface ErrorActions {
  showError: (input: Omit<GlobalError, 'id'>) => void;
  dismiss: () => void;
}

export const useErrorStore = create<ErrorState & ErrorActions>((set) => ({
  current: null,

  showError: (input) => {
    set({ current: { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } });
  },

  dismiss: () => set({ current: null }),
}));
