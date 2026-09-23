import { create } from 'zustand';
import { storage } from './storage';
import { FontScaleLevel } from './typography';

const NIVEAUX_VALIDES: readonly FontScaleLevel[] = ['petite', 'normale', 'grande'];

/**
 * Clé de stockage propre à CET utilisateur (#taille-police-par-utilisateur) —
 * contrairement aux autres clés de `storage.ts` (`debug_mode_enabled`,
 * `profile_image`), globales à l'appareil : la taille de police est un
 * réglage de confort personnel, pas un réglage d'appareil. Deux agents qui se
 * relaient sur le même téléphone gardent chacun le leur.
 */
function cle(userId: string): string {
  return `font_scale_${userId}`;
}

interface FontScaleState {
  level: FontScaleLevel;
  isInitialized: boolean;
}

interface FontScaleActions {
  /** À appeler dès qu'un utilisateur est connu (cf. `_layout.tsx`) — jamais avant, la clé en dépend. */
  init: (userId: string) => Promise<void>;
  setLevel: (userId: string, level: FontScaleLevel) => Promise<void>;
}

export const useFontScaleStore = create<FontScaleState & FontScaleActions>((set) => ({
  level: 'normale',
  isInitialized: false,

  init: async (userId: string) => {
    const value = await storage.getItem(cle(userId));
    const level = NIVEAUX_VALIDES.includes(value as FontScaleLevel) ? (value as FontScaleLevel) : 'normale';
    set({ level, isInitialized: true });
  },

  setLevel: async (userId: string, level: FontScaleLevel) => {
    await storage.setItem(cle(userId), level);
    set({ level });
  },
}));
