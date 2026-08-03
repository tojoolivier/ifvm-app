import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { pullReferentiel } from '@/lib/referentiel-sync';
import { loadAccueilData, AccueilViewModel } from '@/lib/prospection-accueil';
import { retrySyncProspection } from '@/lib/prospection-review';
import { DraftProspection } from '@/lib/prospection-repository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, recent: [], validated: [] };

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export default function SyncScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [failures, setFailures] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [referentielError, setReferentielError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadAccueilData().then(setData);
  }, []);

  useFocusEffect(refresh);

  // Fiches complétées localement mais pas encore confirmées côté serveur (cf. prospection.tsx).
  const pendingFiches = data.recent.filter(
    (item) => item.statut === 'en_attente' && item.statut_sync !== 'synced'
  );
  const syncedFiches = data.recent.filter((item) => item.statut_sync === 'synced');

  const stats = {
    total: data.recent.length,
    pending: pendingFiches.length,
    synced: syncedFiches.length,
  };

  const ficheLabel = (draft: DraftProspection) => draft.n_fiche ?? `Fiche du ${draft.date_prospection}`;

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('syncing');
    setReferentielError(null);
    setFailures([]);

    if (token) {
      try {
        await pullReferentiel(token);
      } catch (error) {
        setReferentielError(
          error instanceof Error ? error.message : 'Échec de la synchronisation du référentiel'
        );
      }
    }

    if (pendingFiches.length === 0 || !token) {
      setSyncStatus(pendingFiches.length === 0 ? 'idle' : 'error');
      if (pendingFiches.length === 0) {
        Alert.alert('✅ Synchronisation', 'Aucune fiche à synchroniser');
      }
      setIsSyncing(false);
      return;
    }

    const currentFailures: string[] = [];
    for (const draft of pendingFiches) {
      try {
        await retrySyncProspection(draft, token);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erreur inconnue';
        currentFailures.push(`${ficheLabel(draft)} : ${message}`);
      }
    }

    setFailures(currentFailures);
    setLastSync(new Date());
    refresh();

    if (currentFailures.length === 0) {
      setSyncStatus('success');
      Alert.alert('✅ Synchronisation réussie', 'Toutes les fiches ont été synchronisées');
    } else {
      setSyncStatus('error');
      Alert.alert(
        '⚠️ Synchronisation partielle',
        'Certaines fiches n\'ont pas pu être synchronisées. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    }

    setIsSyncing(false);
    setTimeout(() => setSyncStatus((current) => (current === 'error' ? current : 'idle')), 3000);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccueilData().then(setData);
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Synchronisation</Text>
              <Text style={styles.headerSub}>Gestion des données hors-ligne</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[IFVM_GREEN]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#15803D' }]}>{stats.synced}</Text>
            <Text style={styles.statLabel}>Synchronisé</Text>
          </View>
        </View>

        {/* Statut de synchronisation */}
        {isSyncing && (
          <View style={styles.progressContainer}>
            <ActivityIndicator color={IFVM_GREEN} />
            <Text style={styles.progressLabel}>Synchronisation en cours…</Text>
          </View>
        )}
        {syncStatus === 'success' && !isSyncing && (
          <View style={[styles.statusBanner, styles.statusSuccess]}>
            <Text style={styles.statusBannerText}>✅ Synchronisation réussie</Text>
          </View>
        )}
        {failures.length > 0 && (
          <View style={[styles.statusBanner, styles.statusError]}>
            <Text style={styles.statusBannerText}>❌ {failures.join('\n')}</Text>
          </View>
        )}
        {referentielError && (
          <View style={[styles.statusBanner, styles.statusError]}>
            <Text style={styles.statusBannerText}>❌ Référentiel : {referentielError}</Text>
          </View>
        )}

        {/* Dernière synchronisation */}
        {lastSync && (
          <View style={styles.lastSyncContainer}>
            <Text style={styles.lastSyncText}>
              Dernière synchronisation : {lastSync.toLocaleString('fr-FR')}
            </Text>
          </View>
        )}

        {/* Liste des fiches à synchroniser */}
        <View style={styles.syncListContainer}>
          <View style={styles.syncListHeader}>
            <Text style={styles.syncListTitle}>Fiches en attente</Text>
            <Text style={styles.syncListCount}>{pendingFiches.length}</Text>
          </View>

          {pendingFiches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune fiche en attente</Text>
              <Text style={styles.emptySub}>Toutes vos prospections sont synchronisées</Text>
            </View>
          ) : (
            pendingFiches.map((draft) => (
              <View key={draft.id} style={styles.syncItem}>
                <View style={styles.syncItemLeft}>
                  <View style={[styles.typeBadge, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[styles.typeBadgeText, { color: '#2563EB' }]}>🔍 PRO</Text>
                  </View>
                  <View style={styles.syncItemInfo}>
                    <Text style={styles.syncItemCode}>{draft.n_fiche ?? '—'}</Text>
                    <Text style={styles.syncItemDate}>{draft.date_prospection}</Text>
                  </View>
                </View>
                <View style={styles.syncItemRight}>
                  <Text style={[styles.syncItemStatus, { color: '#D97706' }]}>⏳</Text>
                  <Text style={[styles.syncItemStatusLabel, { color: '#D97706' }]}>En attente</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bouton de synchronisation */}
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={isSyncing}
          activeOpacity={0.85}
        >
          {isSyncing ? (
            <View style={styles.syncButtonContent}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.syncButtonText}>Synchronisation...</Text>
            </View>
          ) : (
            <Text style={styles.syncButtonText}>
              {stats.pending > 0 ? `🔄 Synchroniser (${stats.pending})` : '✅ Tout est synchronisé'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#FFFFFFAA',
    fontSize: isSmallScreen ? 10 : 12,
    marginTop: 1,
  },
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: isSmallScreen ? 10 : 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
  lastSyncContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  syncListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  syncListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  syncListCount: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  syncItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  typeBadgeText: {
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: '700',
  },
  syncItemInfo: {
    flex: 1,
  },
  syncItemCode: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
    color: '#111827',
  },
  syncItemDate: {
    fontSize: isSmallScreen ? 10 : 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  syncItemRight: {
    alignItems: 'flex-end',
  },
  syncItemStatus: {
    fontSize: 16,
  },
  syncItemStatusLabel: {
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  syncButton: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
    ...(isTablet && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
  },
});
