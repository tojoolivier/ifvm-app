import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Point de chute des parcours dont l'ancienne implémentation est supprimée en attendant leur
 * réécriture (Prospection, #681) : mieux qu'un écran cassé ou un lien mort.
 */
export default function EnReconstructionScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ThemedText style={styles.titre}>En reconstruction</ThemedText>
        <ThemedText style={styles.texte}>
          Ce parcours est en cours de réécriture et n’est pas disponible pour le moment.
        </ThemedText>
        <TouchableOpacity
          style={styles.bouton}
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="en-reconstruction-retour"
        >
          <ThemedText style={styles.boutonTexte}>Retour</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  titre: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  texte: { fontSize: 14, textAlign: 'center' },
  bouton: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#235a36' },
  boutonTexte: { color: '#FFFFFF', fontWeight: '600' },
});
