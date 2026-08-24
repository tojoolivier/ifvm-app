import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
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

  if (autres <= 0) return null;

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
