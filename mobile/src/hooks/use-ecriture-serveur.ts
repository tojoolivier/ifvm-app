import { useCallback } from 'react';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useAuthStore } from '@/lib/auth-store';
import { surRefusAfficher } from '@/lib/erreur-serveur';

/**
 * Écriture en ligne d'un écran équipes / parc (#642) : jeton exigé, refus métier du serveur montré sur
 * l'écran (`afficher`, cf. #673), toute autre erreur laissée à la couche générale. Le jeton est passé
 * à l'action, qui n'a plus à le re-tester ni à le caster.
 *
 * Réseau requis : ces écritures ne passent pas par la file d'envoi hors-ligne — le serveur seul juge
 * l'unicité d'une immatriculation ou le chevauchement de deux affectations.
 */
export function useEcritureServeur(screen: string, afficher: (message: string) => void) {
  const token = useAuthStore((s) => s.token);
  const { run, isRunning } = useAsyncAction();

  const ecrire = useCallback(
    (action: (token: string) => Promise<void>, options?: { precondition?: boolean; preconditionMessage?: string }) =>
      run(() => surRefusAfficher(() => action(token as string), afficher), {
        screen,
        precondition: !!token && (options?.precondition ?? true),
        preconditionMessage: options?.preconditionMessage ?? 'Session expirée — reconnectez-vous.',
      }),
    [run, token, afficher, screen]
  );

  return { ecrire, isRunning };
}
