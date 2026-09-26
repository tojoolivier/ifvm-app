jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// `useSafeAreaInsets()` lève sans `<SafeAreaProvider>` : la plupart des écrans testés
// ici n'en montent pas un explicitement. On ne mocke que ce hook (le reste du module —
// `SafeAreaView`, `SafeAreaProvider`, etc. — garde son implémentation réelle).
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// i18n : les composants appellent `useTranslation`, l'instance doit être initialisée.
require('@/lib/i18n');
