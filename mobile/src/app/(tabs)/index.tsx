import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { ThemedText } from '@/components/themed-text';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_CARD = '#1D6B1D';
const IFVM_BG = '#162016';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { postes, isLoading } = useDashboardData();
  const router = useRouter();

  const isProspecteur = user?.role === 'prospecteur';

  const today = new Date();
  const dateLabel = today
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();

  const posteActuel = postes[0];

  if (!isProspecteur) {
    return <SupervisorDashboard postes={postes} isLoading={isLoading} />;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <Image
              source={require('../../../assets/images/logo-ifvm.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.headerTitle}>IFVM Terrain</ThemedText>
              <ThemedText style={styles.headerSub}>
                {user?.prenom} {user?.nom} · {posteActuel?.name ?? '—'}
              </ThemedText>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Carte bienvenue */}
        <View style={styles.welcomeCard}>
          <ThemedText style={styles.welcomeLabel}>Bonjour,</ThemedText>
          <ThemedText style={styles.welcomeName}>
            {user?.prenom} {user?.nom}
          </ThemedText>
          <ThemedText style={styles.welcomeSub}>
            Prospecteur · {posteActuel?.name ?? '—'}
          </ThemedText>
        </View>

        {/* Carte Mission du jour */}
        <View style={styles.missionCard}>
          <ThemedText style={styles.missionTitle}>MISSION DU JOUR · {dateLabel}</ThemedText>
          <Row label="Campagne" value={isLoading ? '…' : 'LMC en cours'} />
          <Row label="Poste acridien" value={isLoading ? '…' : (posteActuel?.name ?? '—')} />
          <Row label="Chef d'équipe" value="—" />
          <Row label="Stations cibles" value="—" />
        </View>

        {/* Compteurs */}
        <View style={styles.countersRow}>
          <Counter value={0} label="Fiches D." color="#16a34a" />
          <Counter value={0} label="À sync." color="#d97706" />
          <Counter value={isLoading ? 0 : postes.length} label="Stations" color="#2563eb" />
        </View>

        {/* Bouton principal */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(tabs)/prospection')}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.btnPrimaryText}>
            + Nouvelle fiche de prospection
          </ThemedText>
        </TouchableOpacity>

        {/* Bouton secondaire */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(tabs)/fiches')}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.btnSecondaryText}>Voir mes fiches</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.missionRow}>
      <ThemedText style={styles.missionRowLabel}>{label}</ThemedText>
      <ThemedText style={styles.missionRowValue}>{value}</ThemedText>
    </View>
  );
}

function Counter({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.counter}>
      <ThemedText style={[styles.counterValue, { color }]}>{value}</ThemedText>
      <ThemedText style={styles.counterLabel}>{label}</ThemedText>
    </View>
  );
}

function SupervisorDashboard({ postes, isLoading }: { postes: { id: number; name: string }[]; isLoading: boolean }) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image
              source={require('../../../assets/images/logo-ifvm.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText style={styles.headerTitle}>IFVM Terrain</ThemedText>
          </View>
        </View>
      </SafeAreaView>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
          {isLoading ? 'Chargement…' : `${postes.length} poste(s) acridien(s)`}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IFVM_BG,
  },
  header: {
    backgroundColor: IFVM_GREEN_DARK,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: '#FFFFFFAA',
    fontSize: 12,
  },
  welcomeCard: {
    backgroundColor: IFVM_GREEN_CARD,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  welcomeLabel: {
    color: '#FFFFFFCC',
    fontSize: 14,
    marginBottom: 4,
  },
  welcomeName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  welcomeSub: {
    color: '#FFFFFFAA',
    fontSize: 13,
  },
  missionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  missionTitle: {
    color: IFVM_GREEN,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  missionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  missionRowLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  missionRowValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '500',
  },
  countersRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  counter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E7EB',
  },
  counterValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  counterLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  btnPrimary: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondary: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF44',
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
