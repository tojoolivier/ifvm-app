import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeStore } from '@/lib/theme-store';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const storeMode = useThemeStore((state) => state.mode);

  useEffect(() => {
    const id = setTimeout(() => setHasHydrated(true), 0);
    return () => clearTimeout(id);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return storeMode === 'dark' || storeMode === 'light' ? storeMode : colorScheme ?? 'light';
  }

  return 'light';
}
