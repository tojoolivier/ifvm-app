import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';

const IFVM_GREEN = '#1B5E1B';
const IFVM_BG_LIGHT = '#F0F2F5';

export default function CarteDeZoneScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ThemedText style={styles.backText}>‹ Retour</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title}>Carte de zone</ThemedText>
      </View>
      <View style={styles.content}>
        <ThemedText style={styles.emoji}>🗺️</ThemedText>
        <ThemedText style={styles.message}>La carte de zone arrive bientôt</ThemedText>
        <ThemedText style={styles.sub}>
          Vous pourrez y visualiser vos fiches de prospection géolocalisées.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IFVM_BG_LIGHT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 8,
  },
  backText: {
    fontSize: 15,
    color: IFVM_GREEN,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
  },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
