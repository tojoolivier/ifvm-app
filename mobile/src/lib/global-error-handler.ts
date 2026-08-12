import type { ErrorUtils as RNErrorUtils } from 'react-native';
import { useErrorStore } from './error-store';
import { useErrorLogStore } from './error-log-store';
import { toFriendlyError } from './friendly-error';

declare const global: typeof globalThis & {
  ErrorUtils?: RNErrorUtils;
  addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void;
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
 * Filet de sécurité globale pour le mode debug : capture les exceptions JS et
 * les rejets de promesse qui ne passent jamais par `useAsyncAction` (erreurs
 * de rendu, timers, event handlers hors formulaire...). Sans ça, seule la
 * partie "appel réseau" du mode debug était visible — voir ADR-008.
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

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (event) => {
      reportUncaught(event?.reason, 'unhandled-promise-rejection');
    });
  }
}
