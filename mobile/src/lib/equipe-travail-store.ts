import { create } from 'zustand';
import { storage } from './storage';

/**
 * Équipe de travail (#641) : l'équipe que l'agent a choisie dans Paramètres / Accueil, reprise
 * automatiquement par toute nouvelle prospection, traitement ou vol. Clé propre à
 * l'utilisateur, comme `font-scale-store` : deux agents qui se relaient sur le même téléphone
 * gardent chacun la leur.
 */
function cle(userId: string): string {
  return `equipe_travail_${userId}`;
}

interface EquipeTravailState {
  equipeId: string | null;
  isInitialized: boolean;
}

interface EquipeTravailActions {
  /** À appeler dès qu'un utilisateur est connu — jamais avant, la clé en dépend. */
  init: (userId: string) => Promise<void>;
  /** `null` retire l'équipe de travail. */
  setEquipe: (userId: string, equipeId: string | null) => Promise<void>;
}

export const useEquipeTravailStore = create<EquipeTravailState & EquipeTravailActions>((set) => ({
  equipeId: null,
  isInitialized: false,

  init: async (userId: string) => {
    const equipeId = await storage.getItem(cle(userId));
    set({ equipeId: equipeId || null, isInitialized: true });
  },

  setEquipe: async (userId: string, equipeId: string | null) => {
    if (equipeId === null) {
      await storage.deleteItem(cle(userId));
    } else {
      await storage.setItem(cle(userId), equipeId);
    }
    set({ equipeId });
  },
}));
