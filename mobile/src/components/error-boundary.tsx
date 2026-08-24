import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, type ErrorBoundaryProps } from 'expo-router';
import { logger } from '@/lib/logger';
import { BACKGROUND, FOREGROUND, FOREGROUND_TERTIARY, PRIMARY } from './erreurs/tokens';

/**
 * L'écran de repli, partagé par le filet racine et les frontières de route.
 *
 * Il ne montre **jamais** le message brut : une pile JavaScript n'apprend rien
 * à un agent en brousse, et le support la retrouve dans le journal.
 */
function EcranDeRepli({ onSortie }: { onSortie?: () => void }) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>Cet écran n’a pas pu s’afficher</Text>
      <Text style={styles.subtitle}>
        Vos données saisies sont conservées. Revenez en arrière et reprenez depuis l’écran
        précédent.
      </Text>
      {onSortie && (
        <TouchableOpacity
          style={styles.button}
          onPress={onSortie}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Revenir en arrière</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Frontière de capture du **rendu React** — la deuxième des trois d'ADR-012.
 *
 * Cette classe reste le **filet racine** : elle attrape ce qui explose au-dessus
 * du routeur (le `<Stack>` lui-même, les providers), là où aucune route n'existe
 * encore. Les écrans, eux, passent par {@link RouteErrorBoundary}.
 *
 * Elle **n'appelle pas `error-store`** : elle est déjà une surface d'affichage,
 * et signaler ferait apparaître la modale BLOQUER par-dessus cet écran de repli
 * — un même incident, deux affichages concurrents. Elle journalise, c'est tout.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; zone?: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    journaliserLeCrash(error, this.props.zone ?? 'racine', info.componentStack);
  }

  render() {
    // Pas de bouton : à la racine, il n'y a nulle part où revenir.
    return this.state.hasError ? <EcranDeRepli /> : this.props.children;
  }
}

/**
 * La frontière **par route** d'ADR-012 décision 5, à exporter depuis chaque
 * fichier de route :
 *
 * ```ts
 * export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
 * ```
 *
 * `expo-router` reconnaît cet export et enveloppe la route — et *elle seule* —
 * dans un `<Try>` (`useScreens.js:141`). La navigation, les onglets et le reste
 * de la pile survivent : une boundary unique au-dessus du `<Stack>` les faisait
 * disparaître avec l'écran, ce qui est l'écran blanc silencieux sous un autre nom.
 *
 * **Le `retry` fourni par `expo-router` est délibérément ignoré.** Il remonte le
 * même arbre avec les mêmes props : si la cause persiste — et elle persiste
 * presque toujours, puisqu'elle vient de la donnée et non du rendu — il
 * replante aussitôt. Un bouton « Réessayer » qui n'a structurellement aucune
 * chance apprend à l'agent que les boutons ne servent à rien. **Revenir change
 * les props**, donc peut réussir.
 */
export function RouteErrorBoundary({ error }: ErrorBoundaryProps) {
  const router = useRouter();

  journaliserLeCrash(error, 'route', null);

  const revenir = () => {
    // `canGoBack()` est faux à la racine d'une pile ouverte par `replace` :
    // sans repli, le bouton serait à nouveau un bouton qui ne peut pas réussir.
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  return <EcranDeRepli onSortie={revenir} />;
}

/**
 * Le crash part au journal unifié, pas à `error-store` : c'est le journal que
 * le support exporte, et `logger.failure` y attache la classe et le traitement
 * déduits de la frontière `errorBoundary` (ADR-012 décision 3).
 */
function journaliserLeCrash(error: unknown, zone: string, componentStack?: string | null) {
  logger.child({ zone }, 'errorBoundary').failure('render.crash', error, {
    componentStack: componentStack ?? undefined,
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: BACKGROUND },
  title: { fontSize: 16, fontWeight: '800', color: FOREGROUND, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: FOREGROUND_TERTIARY, marginBottom: 18, textAlign: 'center', lineHeight: 19 },
  button: { backgroundColor: PRIMARY, borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
