import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useErrorLogStore } from '@/lib/error-log-store';
import { useErrorStore } from '@/lib/error-store';
import { toFriendlyError } from '@/lib/friendly-error';
import { BACKGROUND, FOREGROUND, FOREGROUND_TERTIARY, PRIMARY } from './erreurs/tokens';

interface Props {
  children: ReactNode;
  /**
   * Ce que fait le bouton de sortie. **Ce n'est plus un `reset()`.**
   *
   * L'ancienne version remontait le même arbre avec les mêmes props : si la
   * cause persistait — et elle persiste presque toujours, puisqu'elle vient de
   * la donnée, pas du rendu — le bouton replantait aussitôt. Il s'appelait
   * « Réessayer » et n'avait structurellement aucune chance. **Revenir change
   * les props**, donc peut réussir. Voir ADR-012 décision 5.
   */
  onSortie?: () => void;
  /** Libellé du bouton de sortie. */
  libelleSortie?: string;
  /** Nom de la zone protégée, journalisé pour situer la panne. */
  zone?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Frontière de capture du **rendu React** — la deuxième des trois d'ADR-012.
 *
 * Une par route depuis #172 (`RouteErrorBoundary`), la racine restant en filet.
 * Une boundary unique à la racine faisait disparaître l'écran *et* la
 * navigation : l'agent se retrouvait devant un panneau gris sans aucun moyen
 * d'en sortir, ce qui est l'écran blanc silencieux sous un autre nom.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const zone = this.props.zone ?? 'render-error';
    // `errorBoundary` donne BLOQUER (décision 3) : le store en fait une modale
    // si l'agent parvient à quitter la zone cassée, et garde la trace sinon.
    useErrorStore.getState().signaler(error, 'errorBoundary');
    useErrorLogStore.getState().addEntry({
      message: toFriendlyError(error).message,
      stack: [error.stack, info.componentStack].filter(Boolean).join('\n'),
      screen: zone,
      context: null,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { onSortie, libelleSortie = 'Revenir en arrière' } = this.props;

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
            <Text style={styles.buttonText}>{libelleSortie}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
}

/**
 * `ErrorBoundary` branchée sur la navigation — à poser dans chaque `_layout`.
 *
 * La classe reste sans dépendance à `expo-router` (les boundaries React sont
 * forcément des composants de classe, donc sans hooks) : c'est ce wrapper qui
 * lui injecte le retour en arrière.
 */
export function RouteErrorBoundary({ children, zone }: { children: ReactNode; zone: string }) {
  const router = useRouter();

  const revenir = () => {
    // `canGoBack()` est faux à la racine d'une pile ouverte par `replace` :
    // sans repli, le bouton serait à nouveau un bouton qui ne peut pas réussir.
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  return (
    <ErrorBoundary zone={zone} onSortie={revenir}>
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: BACKGROUND },
  title: { fontSize: 16, fontWeight: '800', color: FOREGROUND, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: FOREGROUND_TERTIARY, marginBottom: 18, textAlign: 'center', lineHeight: 19 },
  button: { backgroundColor: PRIMARY, borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
