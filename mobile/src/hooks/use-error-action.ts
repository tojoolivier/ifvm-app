/**
 * Résolution de l'action d'une erreur — ADR-012 décision 5, issue #172.
 *
 * L'action est une **propriété de la classe** ; ce hook la traduit en bouton
 * réellement branché. Il porte une seule règle non évidente, et c'est la plus
 * importante du ticket :
 *
 * > **Un « Réessayer » sans reprise à rejouer n'est pas un bouton, c'est un
 * > mensonge.** Il n'est donc pas rendu.
 *
 * C'est le même défaut que le `reset()` de l'`ErrorBoundary` : remonter le même
 * arbre, ou relancer une action qu'on n'a pas gardée, ne peut structurellement
 * pas réussir. Un bouton qui ne peut pas réussir apprend à l'agent que les
 * boutons ne servent à rien — et à la longue il ne signale plus rien.
 */
import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import type { GlobalError } from '@/lib/error-store';
import { LIBELLE_ACTION } from '@/lib/friendly-error';

export interface ActionResolue {
  label: string;
  run: () => void;
}

/** Traduit l'action d'une erreur en bouton branché, ou `null` s'il n'y en a pas. */
export function useErrorAction(erreur: GlobalError | null): ActionResolue | null {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const run = useCallback(
    (action: NonNullable<GlobalError['action']>, retry?: () => void) => {
      switch (action) {
        case 'reessayer':
        case 'reessayer-enregistrer':
          retry?.();
          return;
        case 'se-reconnecter':
          void logout().then(() => router.replace('/(auth)/login'));
          return;
        case 'ouvrir-reglages':
          void Linking.openSettings();
          return;
        case 'synchroniser-referentiels':
          router.push('/(app)/sync');
          return;
        case 'signaler-support':
          router.push('/(app)/debug-logs');
      }
    },
    [logout, router]
  );

  return useMemo(() => {
    if (!erreur?.action) return null;

    const estUneReprise =
      erreur.action === 'reessayer' || erreur.action === 'reessayer-enregistrer';
    if (estUneReprise && !erreur.retry) return null;

    const action = erreur.action;
    const retry = erreur.retry;
    return { label: LIBELLE_ACTION[action], run: () => run(action, retry) };
  }, [erreur, run]);
}
