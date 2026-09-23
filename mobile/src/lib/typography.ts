/**
 * Base commune à tous les modules de tokens de taille de police
 * (`components/traitement/tokens.ts`, `components/fiches/typography.ts`,
 * `lib/prospection-typography.ts`, `components/shared-typography.ts`) —
 * réglage « Taille de police » des paramètres (#taille-police-par-utilisateur),
 * `hooks/use-font-scale.ts`.
 */

export type FontScaleLevel = 'petite' | 'normale' | 'grande';

export const FONT_SCALE_FACTORS: Record<FontScaleLevel, number> = {
  petite: 0.9,
  normale: 1,
  grande: 1.15,
};

export const FONT_SCALE_LEVELS: { value: FontScaleLevel; label: string }[] = [
  { value: 'petite', label: 'Petite' },
  { value: 'normale', label: 'Normale' },
  { value: 'grande', label: 'Grande' },
];

/**
 * Multiplie chaque taille d'un objet de tokens par `scale` — arrondi au
 * dixième de pixel : un `fontSize` à virgule interminable (ex. 11.5 * 1.15 =
 * 13.225) ne sert à rien sur un écran, et complique la lecture des tokens
 * dérivés en debug.
 */
export function scaleTypeSizes<T extends Record<string, number>>(base: T, scale: number): T {
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, Math.round(value * scale * 10) / 10])
  ) as T;
}
