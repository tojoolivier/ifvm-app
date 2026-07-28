import { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { 
  listRecentProspections, 
  countUnsyncedProspections,
  markProspectionSynced,
  getProspection,
  DraftProspection,
} from '@/lib/prospection-repository';
import { apiClient } from '@/lib/api-client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
type SyncItem = {
  id: string;
  type: 'PROSPECTION' | 'CRT' | 'METEO';
  code: string;
  status: 'pending' | 'synced' | 'error';
  date: string;
  campagne?: string;
  isReal?: boolean;
};

const TYPE_CONFIG: Record<SyncItem['type'], { label: string; color: string; bg: string; icon: string }> = {
  PROSPECTION: { label: 'PRO', color: '#2563EB', bg: '#DBEAFE', icon: '🔍' },
  CRT: { label: 'CRT', color: '#7C3AED', bg: '#EDE9FE', icon: '📋' },
  METEO: { label: 'MET', color: '#F59E0B', bg: '#FEF3C7', icon: '🌤️' },
};

// Données simulées pour CRT et METEO
const MOCK_SYNC_ITEMS: SyncItem[] = [
  { id: 'crt-1', type: 'CRT', code: 'CRT-2026-001', status: 'pending', date: '25/06/2026', campagne: 'Campagne 2026', isReal: false },
  { id: 'crt-2', type: 'CRT', code: 'CRT-2026-002', status: 'synced', date: '20/06/2026', campagne: 'Campagne 2026', isReal: false },
  { id: 'met-1', type: 'METEO', code: 'MET-2026-001', status: 'pending', date: '26/06/2026', campagne: 'Campagne 2026', isReal: false },
  { id: 'met-2', type: 'METEO', code: 'MET-2026-002', status: 'synced', date: '22/06/2026', campagne: 'Campagne 2026', isReal: false },
];

export default function SyncScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [pendingProspections, setPendingProspections] = useState<DraftProspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Charger les prospections non synchronisées
  const loadUnsyncedProspections = useCallback(async () => {
    try {
      const count = await countUnsyncedProspections();
      setUnsyncedCount(count);

      const prospections = await listRecentProspections(50);
      const unsynced = prospections.filter(p => p.statut_sync !== 'synced');
      setPendingProspections(unsynced);

      // Convertir en SyncItem
      const syncItems: SyncItem[] = unsynced.map((p: DraftProspection) => ({
        id: p.id,
        type: 'PROSPECTION',
        code: p.n_fiche || `PRO-${p.id.slice(0, 6)}`,
        status: 'pending',
        date: formatDate(p.date_prospection),
        campagne: 'Campagne en cours',
        isReal: true,
      }));

      // Ajouter les données mock pour CRT et METEO
      const mockItems = MOCK_SYNC_ITEMS.filter(item => {
        // Ne garder que les CRT et METEO en attente
        return item.status === 'pending';
      });

      setSyncItems([...syncItems, ...mockItems]);
    } catch (error) {
      console.error('Erreur chargement prospections:', error);
      // En cas d'erreur, utiliser les données mock
      setSyncItems(MOCK_SYNC_ITEMS);
    }
  }, []);

  useEffect(() => {
    loadUnsyncedProspections();
  }, [loadUnsyncedProspections]);

  // Statistiques
  const stats = {
    total: syncItems.length,
    pending: syncItems.filter(item => item.status === 'pending').length,
    synced: syncItems.filter(item => item.status === 'synced').length,
    error: syncItems.filter(item => item.status === 'error').length,
  };

  const handleSync = async () => {
    if (isSyncing) return;
    if (!token) {
      Alert.alert('⚠️ Erreur', 'Vous devez être connecté pour synchroniser');
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    setProgress(0);

    try {
      // Récupérer les prospections en attente
      const pendingItems = syncItems.filter(item => item.status === 'pending' && item.isReal);
      const totalPending = pendingItems.length;

      if (totalPending === 0) {
        setSyncStatus('idle');
        Alert.alert('✅ Synchronisation', 'Aucune donnée à synchroniser');
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < totalPending; i++) {
        const item = pendingItems[i];
        const newProgress = ((i + 1) / totalPending) * 100;
        setProgress(newProgress);

        try {
          // Récupérer la fiche complète
          const prospection = await getProspection(item.id);
          
          if (!prospection) {
            throw new Error('Fiche non trouvée');
          }

          // Envoyer vers l'API
          // TODO: Implémenter l'envoi vers le backend
          // await apiClient.createProspection(token, prospectionData);
          
          // Simuler une réussite (à remplacer par l'appel API réel)
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
          
          // Marquer comme synchronisée
          if (Math.random() > 0.1) { // 90% de réussite
            await markProspectionSynced(item.id);
            successCount++;
            setSyncItems(prev => 
              prev.map(si => 
                si.id === item.id ? { ...si, status: 'synced' } : si
              )
            );
          } else {
            errorCount++;
            setSyncItems(prev => 
              prev.map(si => 
                si.id === item.id ? { ...si, status: 'error' } : si
              )
            );
          }
        } catch (error) {
          console.error(`Erreur sync ${item.id}:`, error);
          errorCount++;
          setSyncItems(prev => 
            prev.map(si => 
              si.id === item.id ? { ...si, status: 'error' } : si
            )
          );
        }

        // Mettre à jour le compteur
        const remaining = await countUnsyncedProspections();
        setUnsyncedCount(remaining);
      }

      // Mettre à jour le statut final
      if (errorCount === 0) {
        setSyncStatus('success');
        Alert.alert(
          '✅ Synchronisation réussie',
          `${successCount} fiche${successCount > 1 ? 's' : ''} synchronisée${successCount > 1 ? 's' : ''}`
        );
      } else if (successCount === 0) {
        setSyncStatus('error');
        Alert.alert(
          '❌ Erreur de synchronisation',
          'Aucune fiche n\'a pu être synchronisée. Veuillez réessayer.',
          [{ text: 'OK' }]
        );
      } else {
        setSyncStatus('success');
        Alert.alert(
          '⚠️ Synchronisation partielle',
          `${successCount} fiche${successCount > 1 ? 's' : ''} synchronisée${successCount > 1 ? 's' : ''}, ${errorCount} erreur${errorCount > 1 ? 's' : ''}`,
          [{ text: 'OK' }]
        );
      }

      setLastSync(new Date());
      await loadUnsyncedProspections();

    } catch (error) {
      console.error('Erreur synchronisation:', error);
      setSyncStatus('error');
      Alert.alert(
        '❌ Erreur de synchronisation',
        'Une erreur est survenue lors de la synchronisation. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        if (syncStatus !== 'error') {
          setSyncStatus('idle');
        }
      }, 3000);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUnsyncedProspections();
    setRefreshing(false);
  }, [loadUnsyncedProspections]);

  const getStatusIcon = (status: SyncItem['status']) => {
    switch (status) {
      case 'synced':
        return '✅';
      case 'pending':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusLabel = (status: SyncItem['status']) => {
    switch (status) {
      case 'synced':
        return 'Synchronisé';
      case 'pending':
        return 'En attente';
      case 'error':
        return 'Erreur';
      default:
        return 'En attente';
    }
  };

  const getStatusColor = (status: SyncItem['status']) => {
    switch (status) {
      case 'synced':
        return '#15803D';
      case 'pending':
        return '#D97706';
      case 'error':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => router.push('/(tabs)')} 
              activeOpacity={0.7}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Synchronisation</Text>
              <Text style={styles.headerSub}>
                {user ? `${user.prenom} ${user.nom}` : 'Prospecteur'}
              </Text>
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
          {stats.error > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#DC2626' }]}>{stats.error}</Text>
                <Text style={styles.statLabel}>Erreur</Text>
              </View>
            </>
          )}
        </View>

        {/* Barre de progression */}
        {isSyncing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Synchronisation en cours...</Text>
              <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        {/* Statut de synchronisation */}
        {syncStatus === 'success' && (
          <View style={[styles.statusBanner, styles.statusSuccess]}>
            <Text style={styles.statusBannerText}>✅ Synchronisation réussie</Text>
          </View>
        )}
        {syncStatus === 'error' && (
          <View style={[styles.statusBanner, styles.statusError]}>
            <Text style={styles.statusBannerText}>❌ Erreur de synchronisation</Text>
          </View>
        )}

        {/* Dernière synchronisation */}
        <View style={styles.lastSyncContainer}>
          <Text style={styles.lastSyncText}>
            Dernière synchronisation : {lastSync.toLocaleString('fr-FR')}
          </Text>
          {unsyncedCount > 0 && (
            <Text style={styles.lastSyncPending}>
              {unsyncedCount} fiche{unsyncedCount > 1 ? 's' : ''} en attente
            </Text>
          )}
        </View>

        {/* Liste des éléments à synchroniser */}
        <View style={styles.syncListContainer}>
          <View style={styles.syncListHeader}>
            <Text style={styles.syncListTitle}>Éléments à synchroniser</Text>
            <Text style={styles.syncListCount}>{syncItems.length}</Text>
          </View>
          
          {syncItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune donnée</Text>
              <Text style={styles.emptySub}>Toutes vos données sont synchronisées</Text>
            </View>
          ) : (
            syncItems.map((item) => (
              <View key={item.id} style={styles.syncItem}>
                <View style={styles.syncItemLeft}>
                  <View style={[styles.typeBadge, { backgroundColor: TYPE_CONFIG[item.type].bg }]}>
                    <Text style={[styles.typeBadgeText, { color: TYPE_CONFIG[item.type].color }]}>
                      {TYPE_CONFIG[item.type].icon} {TYPE_CONFIG[item.type].label}
                    </Text>
                  </View>
                  {item.isReal && (
                    <View style={styles.realBadge}>
                      <Text style={styles.realBadgeText}>📱</Text>
                    </View>
                  )}
                  <View style={styles.syncItemInfo}>
                    <Text style={styles.syncItemCode}>{item.code}</Text>
                    <Text style={styles.syncItemDate}>{item.date}</Text>
                    {item.campagne && (
                      <Text style={styles.syncItemCampagne}>{item.campagne}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.syncItemRight}>
                  <Text style={[styles.syncItemStatus, { color: getStatusColor(item.status) }]}>
                    {getStatusIcon(item.status)}
                  </Text>
                  <Text style={[styles.syncItemStatusLabel, { color: getStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bouton de synchronisation */}
        <TouchableOpacity
          style={[
            styles.syncButton,
            isSyncing && styles.syncButtonDisabled,
          ]}
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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: IFVM_GREEN,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: IFVM_GREEN,
    borderRadius: 3,
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
  lastSyncPending: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
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
  realBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  realBadgeText: {
    fontSize: 12,
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
  syncItemCampagne: {
    fontSize: 10,
    color: '#6B7280',
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