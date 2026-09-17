import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { useAsyncAction } from '@/hooks/use-async-action';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const ORANGE = '#c07a2b';
const ORANGE_BG = '#fdf1e3';
const GREEN_BG = '#eaf3ec';

interface FicheVolResume {
  id: string;
  numero_fiche: string;
  date_vol: string;
  immatriculation: string;
  compagnie: string;
  statut: string;
}

function StatutBadge({ statut }: { statut: string }) {
  const validee = statut === 'validee';
  return (
    <View style={[styles.badge, validee ? styles.badgeValidee : styles.badgeBrouillon]}>
      <Text style={[styles.badgeText, { color: validee ? GREEN : ORANGE }]}>
        {validee ? 'VALIDÉE' : 'BROUILLON'}
      </Text>
    </View>
  );
}

/**
 * Liste des fiches de vol (#fiche-vol-menu-entree) — pas de filtre « créées
 * par moi » : une fiche de vol couvre tout un hélicoptère pour une journée,
 * partagée par l'équipe (pas de champ créateur en base, contrairement à la
 * prospection). Lecture seule pour l'instant : la consultation détaillée
 * (vols, signatures) est un chantier à venir, avec la saisie des vols.
 */
export default function MesFichesVolScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [fiches, setFiches] = useState<FicheVolResume[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { run, isRunning } = useAsyncAction();

  const charger = () =>
    run(
      async () => {
        const resultat = await apiClient.listFichesVol(token!);
        setFiches(
          [...resultat]
            .sort((a, b) => b.date_vol.localeCompare(a.date_vol))
            .map((f) => ({
              id: f.id,
              numero_fiche: f.numero_fiche,
              date_vol: f.date_vol,
              immatriculation: f.immatriculation,
              compagnie: f.compagnie,
              statut: f.statut,
            }))
        );
        setLoaded(true);
      },
      { screen: 'mes-fiches-vol', precondition: !!token }
    );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mes fiches de vol</Text>
        </View>

        {!loaded && !isRunning && (
          <View style={styles.centre}>
            <TouchableOpacity onPress={charger} accessibilityRole="button">
              <Text style={styles.chargerLinkText}>Charger les fiches ›</Text>
            </TouchableOpacity>
          </View>
        )}
        {isRunning && (
          <View style={styles.centre}>
            <ActivityIndicator color={GREEN} />
          </View>
        )}

        {loaded && (
          <ScrollView contentContainerStyle={styles.content}>
            {fiches.length === 0 && <Text style={styles.vide}>Aucune fiche de vol.</Text>}
            {fiches.map((fiche) => (
              <View key={fiche.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.numero}>{fiche.numero_fiche}</Text>
                  <StatutBadge statut={fiche.statut} />
                </View>
                <Text style={styles.sousTexte}>
                  {fiche.date_vol} · {fiche.immatriculation} · {fiche.compagnie}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chargerLinkText: { fontSize: 14, fontWeight: '700', color: GREEN },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  vide: { fontSize: 13, color: TEXT_SECONDARY, fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 13, gap: 6 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontSize: 14, fontWeight: '800', color: TEXT },
  sousTexte: { fontSize: 12, color: TEXT_SECONDARY },
  badge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10 },
  badgeValidee: { backgroundColor: GREEN_BG },
  badgeBrouillon: { backgroundColor: ORANGE_BG },
  badgeText: { fontSize: 9.5, fontWeight: '700' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
