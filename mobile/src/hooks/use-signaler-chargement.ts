import { useErrorStore } from '@/lib/error-store';
import { useErrorLogStore } from '@/lib/error-log-store';
import { toFriendlyError } from '@/lib/friendly-error';

/**
 * Frontière `runTask:essential` pour les lectures de fond hors `useAsyncAction`
 * (un `useEffect` qui hydrate un écran depuis SQLite) — signale l'échec à la
 * couche d'affichage et le journalise pour le mode debug.
 *
 * Extrait du bloc répété à l'identique dans chaque écran migré (#175) : le
 * dupliquer davantage aurait fait dériver le format de journal d'un site à
 * l'autre.
 */
export function useSignalerChargement(screen: string) {
  const signaler = useErrorStore((s) => s.signaler);
  const logError = useErrorLogStore((s) => s.addEntry);

  return (error: unknown, context?: Record<string, unknown>) => {
    signaler(error, 'runTask:essential');
    logError({
      message: toFriendlyError(error).message,
      stack: error instanceof Error ? error.stack ?? null : null,
      screen,
      context: context ?? null,
    });
  };
}
