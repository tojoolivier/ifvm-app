import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeStore } from '@/lib/theme-store';

export function useColorScheme() {
  const storeMode = useThemeStore((state) => state.mode);
  const systemScheme = useRNColorScheme();

  if (storeMode === 'dark' || storeMode === 'light') {
    return storeMode;
  }

  return systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : 'light';
}
