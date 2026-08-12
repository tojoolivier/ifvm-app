import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorStore } from '@/lib/error-store';

const RED = '#B91C1C';
const RED_BG = '#FEE2E2';
const RED_BORDER = '#FCA5A5';

/**
 * Bannière d'erreur globale persistante, montée une seule fois à la racine
 * de l'app. Ne disparaît jamais seule — l'utilisateur doit la fermer ou
 * relancer l'action pour la faire disparaître. Voir ADR-008.
 */
export function ErrorBanner() {
  const current = useErrorStore((s) => s.current);
  const dismiss = useErrorStore((s) => s.dismiss);

  if (!current) return null;

  const handleRetry = () => {
    dismiss();
    current.retry?.();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.message} numberOfLines={3}>
          {current.message}
        </Text>
        <View style={styles.actions}>
          {current.retry && (
            <TouchableOpacity onPress={handleRetry} activeOpacity={0.7} style={styles.retryBtn}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={dismiss} activeOpacity={0.7} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED_BG,
    borderBottomWidth: 1,
    borderColor: RED_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  message: { flex: 1, color: RED, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retryBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: RED },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  closeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: RED, fontSize: 15, fontWeight: '700' },
});
