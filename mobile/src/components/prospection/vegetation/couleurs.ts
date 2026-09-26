import type { UiPalette } from '@/constants/theme';
import type { StrateKey } from '@/lib/prospection-vegetation-schema';

export type CleSegment = StrateKey | 'sol_nu';

/** Jeton de couleur de chaque segment de la répartition (barre, légende, pastilles), lu dans la palette. */
export const JETON_COULEUR: Record<CleSegment, keyof UiPalette> = {
  sol_nu: 'strateSolNu',
  arboree: 'strateArboree',
  arbustive: 'strateArbustive',
  buissonneuse: 'strateBuissonneuse',
  herbeuse: 'strateHerbeuse',
  cultures_seches: 'strateCulturesSeches',
  cultures_hygro: 'strateCulturesHygro',
};
