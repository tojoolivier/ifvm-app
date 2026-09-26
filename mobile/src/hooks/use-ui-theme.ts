import { UiColors } from '@/constants/theme';
import { useThemeStore } from '@/lib/theme-store';

/** Palette du socle UI (`UiColors`) pour le thème courant, clair ou sombre. */
export function useUiTheme() {
  const mode = useThemeStore((state) => state.mode);
  return UiColors[mode];
}
