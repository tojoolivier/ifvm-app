import { useCallback, useRef, useState } from 'react';
import { useErrorStore } from '@/lib/error-store';
import { useErrorLogStore } from '@/lib/error-log-store';
import { causeMessage, PreconditionError } from '@/lib/errors';
import { toFriendlyError } from '@/lib/friendly-error';
import type { Traitement } from '@/lib/logger';

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
  /** Signale l'erreur à la couche d'affichage et renvoie le traitement déduit. */
  signaler: (error: unknown, frontiere: 'useAsyncAction', retry?: () => void) => Traitement;
  logError: (entry: { message: string; cause?: string | null; stack?: string | null; screen: string; context?: Record<string, unknown> | null }) => void;
}

/**
 * Logique pure (sans état React) derrière `useAsyncAction` — extraite pour être
 * testable directement, sans moteur de rendu. Remplace le pattern
 * `try { await x() } finally { ... }` sans `catch` qui a causé un bouton
 * d'action silencieusement inopérant (voir ADR-008). Toute précondition
 * manquante ou erreur levée par l'action est systématiquement remontée à la
 * couche d'affichage et journalisée pour le mode debug.
 *
 * Depuis #172, la précondition manquante n'invente plus son propre message :
 * elle lève une `PreconditionError` et repart par le même chemin que le reste.
 * Une seule route vers l'écran, donc un seul endroit où un silence peut naître.
 */
export async function executeAsyncAction(
  action: () => Promise<void>,
  options: RunOptions,
  deps: AsyncActionDeps
): Promise<void> {
  if (options.precondition === false) {
    const erreur = new PreconditionError(
      options.preconditionMessage ?? 'Action impossible : données manquantes.'
    );
    deps.signaler(erreur, 'useAsyncAction');
    deps.logError({ message: erreur.message, screen: options.screen, context: options.context ?? null });
    return;
  }

  try {
    await action();
  } catch (error) {
    deps.signaler(error, 'useAsyncAction', () => {
      void executeAsyncAction(action, options, deps);
    });
    deps.logError({
      message: toFriendlyError(error).message,
      cause: causeMessage(error),
      stack: error instanceof Error ? error.stack ?? null : null,
      screen: options.screen,
      context: options.context ?? null,
    });
  }
}

export function useAsyncAction() {
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const signaler = useErrorStore((s) => s.signaler);
  const logError = useErrorLogStore((s) => s.addEntry);

  const run = useCallback(
    async (action: () => Promise<void>, options: RunOptions) => {
      if (options.precondition === false) {
        return executeAsyncAction(action, options, { signaler, logError });
      }

      if (isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);
      try {
        await executeAsyncAction(action, options, { signaler, logError });
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
      }
    },
    [signaler, logError]
  );

  return { run, isRunning };
}
