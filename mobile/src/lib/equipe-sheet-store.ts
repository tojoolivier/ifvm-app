import { create } from 'zustand';

/**
 * Ouverture de la feuille « Définir l'équipe de travail » depuis n'importe quel écran (#678) : la
 * feuille elle-même est montée une seule fois à la racine (`EquipeSheetGlobale`), plutôt que
 * recopiée dans chaque écran qui peut demander à changer d'équipe.
 */
interface EquipeSheetState {
  visible: boolean;
  ouvrir: () => void;
  fermer: () => void;
}

export const useEquipeSheetStore = create<EquipeSheetState>((set) => ({
  visible: false,
  ouvrir: () => set({ visible: true }),
  fermer: () => set({ visible: false }),
}));
