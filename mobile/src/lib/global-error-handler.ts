import type { ErrorUtils as RNErrorUtils } from 'react-native';
import { useErrorStore } from './error-store';
import { useErrorLogStore } from './error-log-store';
import { toFriendlyError } from './friendly-error';

declare const global: typeof globalThis & {
  ErrorUtils?: RNErrorUtils;
};

let installed = false;

function reportUncaught(error: unknown, screen: string) {
  const { message, detail } = toFriendlyError(error);
  useErrorStore.getState().showError({ message, detail });
  useErrorLogStore.getState().addEntry({
    message,
    stack: error instanceof Error ? error.stack ?? null : null,
    screen,
    context: null,
  });
}

/**
 * Filet de sécurité globale : capture les exceptions JS qui ne passent par
 * aucune des trois frontières d'ADR-012 (erreurs de rendu hors `ErrorBoundary`,
 * timers, handlers d'événements natifs).
 *
 * **Ne couvre PAS les rejets de promesse.** Le `global.addEventListener(
 * 'unhandledrejection')` qui vivait ici était une branche morte : c'est une API
 * du DOM, absente de React Native — elle compilait grâce à un `declare` écrit à
 * la main et ne s'exécutait jamais. Elle donnait une fausse confiance, ce qui
 * est pire que rien. Le vrai tracker de rejets fait l'objet d'une issue à part.
 *
 * **Dette assumée** : le corps passe encore par `error-log-store` et
 * `toFriendlyError`, que la décision 4 d'ADR-012 supprime au profit du logger
 * unifié et de la frontière `'global'`. La migration se fait avec le reste de
 * `lib/`, pas ici — la mélanger à la suppression d'une branche morte rendrait
 * les deux illisibles en revue.
 */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  const errorUtils = global.ErrorUtils;
  if (errorUtils) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      reportUncaught(error, 'global-js-error');
      previousHandler?.(error, isFatal);
    });
  }
}
