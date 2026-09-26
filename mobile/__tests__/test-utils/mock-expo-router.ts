/**
 * Mock partagé pour `expo-router`, à utiliser dans les tests d'écran qui
 * montent un composant sous `src/app/**` sans passer par
 * `expo-router/testing-library` (voir infestation-screen.test.tsx pour le
 * pourquoi). Usage :
 *
 *   jest.mock('expo-router', () => require('../test-utils/mock-expo-router').expoRouterMock());
 */
/** Fonctions du routeur factice, stables d'un appel de `useRouter()` à l'autre — pour qu'un test
 * puisse vérifier une navigation (`expect(routerMock.dismissTo).toHaveBeenCalledWith(…)`). */
export const routerMock = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: () => true,
};

export function expoRouterMock(overrides: { params?: Record<string, string> } = {}) {
  return {
    useRouter: () => routerMock,
    useLocalSearchParams: () => overrides.params ?? {},
  };
}
