import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type StatutFiche = 'brouillon' | 'synchronisee' | 'validee' | 'rejetee';

interface FicheItem {
  id: string;
  code: string;
  type: 'EXT' | 'INT';
  poste: string;
  date: string;
  statut: StatutFiche;
}

const STATUT_CONFIG: Record<StatutFiche, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon',    color: '#6B7280', bg: '#F3F4F6' },
  synchronisee: { label: 'Synchronisée', color: '#16a34a', bg: '#DCFCE7' },
  validee:      { label: 'Validée',      color: '#15803d', bg: '#DCFCE7' },
  rejetee:      { label: 'Rejetée',      color: '#dc2626', bg: '#FEE2E2' },
};

const TYPE_CONFIG: Record<'EXT' | 'INT', { color: string; bg: string }> = {
  EXT: { color: '#2563eb', bg: '#DBEAFE' },
  INT: { color: '#7c3aed', bg: '#EDE9FE' },
};

// Données mock — sera remplacé par l'API
const MOCK_FICHES: FicheItem[] = [
  { id: '1', code: 'PRO-2451', type: 'EXT', poste: 'PA Betioky', date: '24 juin', statut: 'brouillon' },
  { id: '2', code: 'PRO-2449', type: 'EXT', poste: 'PA Betioky', date: '23 juin', statut: 'synchronisee' },
  { id: '3', code: 'PRO-2446', type: 'INT', poste: 'PA Betioky', date: '22 juin', statut: 'validee' },
  { id: '4', code: 'PRO-2440', type: 'EXT', poste: 'PA Betioky', date: '19 juin', statut: 'rejetee' },
];

export default function FichesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const today = new Date();
  const decade = Math.ceil(today.getDate() / 10);
  const mois = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const periodeLabel = `Décade ${decade} · ${mois}`;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Mes fiches</Text>
              <Text style={styles.headerSub}>{periodeLabel}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Compteur */}
        <Text style={styles.count}>
          {MOCK_FICHES.length} fiches · Décade {decade} {mois}
        </Text>

        {/* Liste */}
        <View style={styles.list}>
          {MOCK_FICHES.map((fiche) => (
            <FicheCard key={fiche.id} fiche={fiche} />
          ))}
        </View>

        {/* Bouton */}
        <TouchableOpacity
          style={styles.btnNouvelle}
          onPress={() => router.push('/(tabs)/prospection')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnNouvelleText}>+ Nouvelle fiche</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function FicheCard({ fiche }: { fiche: FicheItem }) {
  const statut = STATUT_CONFIG[fiche.statut];
  const type = TYPE_CONFIG[fiche.type];

  return (
    <View style={styles.card}>
      <View style={[styles.typeBadge, { backgroundColor: type.bg }]}>
        <Text style={[styles.typeBadgeText, { color: type.color }]}>{fiche.type}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardCode}>{fiche.code}</Text>
        <Text style={styles.cardMeta}>{fiche.poste} · {fiche.date}</Text>
      </View>

      <View style={[styles.statutBadge, { backgroundColor: statut.bg }]}>
        <Text style={[styles.statutBadgeText, { color: statut.color }]}>{statut.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: IFVM_GREEN_DARK,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
    marginTop: -2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#FFFFFFAA',
    fontSize: 12,
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  count: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    fontWeight: '500',
  },
  list: {
    gap: 8,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
  },
  cardCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statutBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnNouvelle: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnNouvelleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
