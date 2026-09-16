import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Écran de confirmation après création de l'en-tête d'une fiche de vol
 * (#fiche-vol-creation-mobile) — la saisie des vols (chrono, MEP/Application/
 * Prospection combinés, Convoyage/Divers séparés) n'existe pas encore : cet
 * écran est le point d'atterrissage prévu pour ce chantier à venir.
 */
export default function FicheVolRecapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    numeroFiche?: string;
    dateVol?: string;
    immatriculation?: string;
    compagnie?: string;
  }>();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.badge}>✓ Fiche créée</Text>
          <Text style={styles.numero}>{params.numeroFiche}</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Date</Text>
              <Text style={styles.rowValue}>{params.dateVol}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Immatriculation</Text>
              <Text style={styles.rowValue}>{params.immatriculation}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Compagnie</Text>
              <Text style={styles.rowValue}>{params.compagnie}</Text>
            </View>
          </View>

          <Text style={styles.hint}>
            La saisie des vols de la journée (prospection, application, convoyage…) sera bientôt disponible
            depuis cette fiche.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={() => router.replace('/(app)')} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>Retour à l&apos;accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, justifyContent: 'space-between' },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },
  badge: { fontSize: 13, fontWeight: '700', color: GREEN },
  numero: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 12, color: TEXT_SECONDARY },
  rowValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  hint: { fontSize: 12, lineHeight: 17, color: TEXT_SECONDARY, marginTop: 16 },
  footer: { paddingHorizontal: 16, paddingBottom: 8 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
