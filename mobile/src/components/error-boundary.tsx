import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useErrorLogStore } from '@/lib/error-log-store';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Filet de sécurité pour les erreurs de rendu React (hors formulaires passant
 * par useAsyncAction) : évite l'écran blanc silencieux et journalise
 * l'exception + la pile d'appel pour le mode debug. Voir ADR-008.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    useErrorLogStore.getState().addEntry({
      message: error.message,
      stack: [error.stack, info.componentStack].filter(Boolean).join('\n'),
      screen: 'render-error',
      context: null,
    });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.subtitle}>L&apos;écran n&apos;a pas pu s&apos;afficher correctement.</Text>
        <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#faf7ef' },
  title: { fontSize: 16, fontWeight: '700', color: '#16201a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6f6a59', marginBottom: 18, textAlign: 'center' },
  button: { backgroundColor: '#235a36', borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
