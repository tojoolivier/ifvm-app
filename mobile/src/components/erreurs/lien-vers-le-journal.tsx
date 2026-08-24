import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { FOREGROUND_TERTIARY } from './tokens';

/**
 * Le « +N autres › » d'ADR-012 décision 5.
 *
 * Une seule erreur est montrée à la fois — c'est ce qui garde la bannière
 * lisible — mais les autres ne sont pas jetées : elles sont **comptées ici** et
 * atteignables d'un geste. Sans ce lien, le dédoublonnage recréerait le
 * silence qu'il est censé supprimer.
 */
export function LienVersLeJournal({ autres }: { autres: number }) {
  const router = useRouter();
  // Le journal vit sous `(app)` : hors session, le lien se ferait renvoyer par
  // le garde d'authentification.
  const estAuthentifie = useAuthStore((s) => s.isAuthenticated);

  if (autres <= 0 || !estAuthentifie) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/debug-logs')}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Text style={styles.lien}>
        +{autres} autre{autres > 1 ? 's' : ''} ›
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  lien: { color: FOREGROUND_TERTIARY, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
