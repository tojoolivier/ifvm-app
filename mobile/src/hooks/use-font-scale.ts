import { useFontScaleStore } from '@/lib/font-scale-store';
import { FONT_SCALE_FACTORS, FontScaleLevel } from '@/lib/typography';

/**
 * Point d'entrée unique du réglage « Taille de police »
 * (#taille-police-par-utilisateur) — chaque module de tokens de taille
 * (`components/traitement/tokens.ts`, `components/fiches/typography.ts`,
 * `lib/prospection-typography.ts`, `components/shared-typography.ts`) ne lit
 * que `scale` d'ici, jamais directement le store.
 */
export function useFontScale(): { level: FontScaleLevel; scale: number } {
  const level = useFontScaleStore((s) => s.level);
  return { level, scale: FONT_SCALE_FACTORS[level] };
}
