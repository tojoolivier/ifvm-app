import { Redirect } from 'expo-router';

/**
 * Écran de démonstration du socle UI (#721). `__DEV__` est remplacé à la
 * compilation : en production la branche `require` est éliminée, l'écran n'est
 * donc pas embarqué et la route redirige vers l'accueil.
 */
export default function ComposantsDemoRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ComposantsDemo } = require('@/components/ui/demo/ComposantsDemo');
  return <ComposantsDemo />;
}
