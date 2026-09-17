import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';

/**
 * Écran affiché à la place du parcours fiche de vol pour un utilisateur dont
 * le rôle n'est ni chef de base ni équipe aérienne (#fiche-vol-acces-roles) —
 * garde-fou d'affichage sur le point d'entrée (`(fiche-vol)/menu.tsx`) et sur
 * la création (`(fiche-vol)/creation.tsx`), au cas où l'un des deux serait
 * atteint par lien direct plutôt que depuis le raccourci du tableau de bord
 * (déjà masqué pour ces rôles, cf. `(app)/index.tsx`).
 */
export function AccesRestreint() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>Accès réservé</Text>
          <Text style={styles.message}>
            La saisie d&apos;une fiche de vol est réservée au chef de base et à l&apos;équipe
            aérienne (pilote, mécanicien).
          </Text>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  icon: { fontSize: 36 },
  title: { fontSize: 17, fontWeight: '800', color: TEXT },
  message: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 19 },
  footer: { paddingHorizontal: 16, paddingBottom: 16 },
  button: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
