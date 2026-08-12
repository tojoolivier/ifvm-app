import { useCallback, useRef, useState } from 'react';
import { useErrorStore } from '@/lib/error-store';
import { useErrorLogStore } from '@/lib/error-log-store';
import { toFriendlyError } from '@/lib/friendly-error';

interface RunOptions {
  /** Nom de l'écran, pour le journal de debug. */
  screen: string;
  /** Doit être vraie pour que l'action s'exécute ; sinon une erreur visible est déclenchée à la place d'un retour silencieux. */
  precondition?: boolean;
  /** Message affiché quand `precondition` est fausse. */
  preconditionMessage?: string;
  /** Contexte additionnel (état du formulaire, ids...) capturé dans le journal de debug en cas d'erreur. */
  context?: Record<string, unknown>;
}

interface AsyncActionDeps {
  showError: (input: { message: string; detail?: string | null; retry?: () => void }) => void;
  logError: (entry: { message: string; stack?: string | null; screen: string; context?: Record<string, unknown> | null }) => void;
}

/**
 * Logique pure (sans état React) derrière `useAsyncAction` — extraite pour être
 * testable directement, sans moteur de rendu. Remplace le pattern
 * `try { await x() } finally { ... }` sans `catch` qui a causé un bouton
 * d'action silencieusement inopérant (voir ADR-008). Toute précondition
 * manquante ou erreur levée par l'action est systématiquement remontée via la
 * bannière d'erreur globale et journalisée pour le mode debug.
 */
export async function executeAsyncAction(
  action: () => Promise<void>,
  options: RunOptions,
  deps: AsyncActionDeps
): Promise<void> {
  if (options.precondition === false) {
    const message = options.preconditionMessage ?? 'Action impossible : données manquantes.';
    deps.showError({ message });
    deps.logError({ message, screen: options.screen, context: options.context ?? null });
    return;
  }

  try {
    await action();
  } catch (error) {
    const { message, detail } = toFriendlyError(error);
    deps.showError({
      message,
      detail,
      retry: () => {
        executeAsyncAction(action, options, deps);
      },
    });
    deps.logError({
      message,
      stack: error instanceof Error ? error.stack ?? null : null,
      screen: options.screen,
      context: options.context ?? null,
    });
  }
}

export function useAsyncAction() {
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const showError = useErrorStore((s) => s.showError);
  const logError = useErrorLogStore((s) => s.addEntry);

  const run = useCallback(
    async (action: () => Promise<void>, options: RunOptions) => {
      if (options.precondition === false) {
        return executeAsyncAction(action, options, { showError, logError });
      }

      if (isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);
      try {
        await executeAsyncAction(action, options, { showError, logError });
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
      }
    },
    [showError, logError]
  );

  return { run, isRunning };
}
