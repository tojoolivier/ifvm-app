import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { peutSaisirFicheVol } from '@/lib/fiche-vol-access';
import { AccesRestreint } from '@/components/fiche-vol/AccesRestreint';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Point d'entrée du parcours fiche de vol (#fiche-vol-menu-entree) — le
 * raccourci « Fiche de vol » du tableau de bord ouvre ce menu plutôt que
 * d'aller droit à la création, pour donner accès aux trois actions du
 * parcours : gérer les référentiels aériens, créer une fiche, consulter les
 * fiches existantes.
 *
 * Réservé au chef de base et à l'équipe aérienne (#fiche-vol-acces-roles) —
 * garde-fou au cas où cet écran serait atteint par lien direct plutôt que
 * depuis le raccourci du tableau de bord (déjà masqué pour les autres rôles).
 */
export default function FicheVolMenuScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  if (!peutSaisirFicheVol(role)) {
    return <AccesRestreint />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Fiche de vol</Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(fiche-vol)/referentiels' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Créer un lieu aérien</Text>
              <Text style={styles.cardSubtitle}>
                Équipe aérienne, base principale, base secondaire, stand de remplissage.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(fiche-vol)/creation' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🛫</Text>
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Nouvelle fiche de vol</Text>
              <Text style={styles.cardSubtitle}>
                En-tête de la fiche : date, hélicoptère, base, équipage.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(fiche-vol)/mes-fiches' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>📄</Text>
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Mes fiches de vol</Text>
              <Text style={styles.cardSubtitle}>Consulter les fiches déjà créées.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
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
  content: { paddingHorizontal: 16, gap: 12, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: { fontSize: 24 },
  cardTextGroup: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  cardSubtitle: { fontSize: 11.5, lineHeight: 15, color: TEXT_SECONDARY },
  chevron: { fontSize: 20, fontWeight: '700', color: GREEN },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
