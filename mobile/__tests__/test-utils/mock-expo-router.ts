/**
 * Mock partagé pour `expo-router`, à utiliser dans les tests d'écran qui
 * montent un composant sous `src/app/**` sans passer par
 * `expo-router/testing-library` (voir infestation-screen.test.tsx pour le
 * pourquoi). Usage :
 *
 *   jest.mock('expo-router', () => require('../test-utils/mock-expo-router').expoRouterMock());
 */
export function expoRouterMock(overrides: { params?: Record<string, string> } = {}) {
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
    useLocalSearchParams: () => overrides.params ?? {},
  };
}
