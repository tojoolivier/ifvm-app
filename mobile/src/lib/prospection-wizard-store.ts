import { create } from 'zustand';
import { CaptureRow, DraftProspection, getProspection, listAllProspectionCaptures } from './prospection-repository';

interface WizardState {
  draft: DraftProspection | null;
  captures: CaptureRow[];
  hydrateFromDraft: (draftId: string) => Promise<void>;
  setDraft: (draft: DraftProspection) => void;
  refreshCaptures: () => Promise<void>;
  reset: () => void;
}

export const useProspectionWizardStore = create<WizardState>((set, get) => ({
  draft: null,
  captures: [],

  hydrateFromDraft: async (draftId: string) => {
    const [draft, captures] = await Promise.all([getProspection(draftId), listAllProspectionCaptures(draftId)]);
    set({ draft, captures });
  },

  setDraft: (draft: DraftProspection) => {
    set({ draft });
  },

  refreshCaptures: async () => {
    const draft = get().draft;
    if (!draft) return;
    const captures = await listAllProspectionCaptures(draft.id);
    set({ captures });
  },

  reset: () => {
    set({ draft: null, captures: [] });
  },
}));
