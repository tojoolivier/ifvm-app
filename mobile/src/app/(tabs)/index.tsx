import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Dimensions,
  Animated,
  AppState,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { ThemedText } from '@/components/themed-text';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  listRecentProspections,
  countUnsyncedProspections,
  getProspection,
  DraftProspection,
} from '@/lib/prospection-repository';
import * as Network from 'expo-network';
import * as Location from 'expo-location';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_LIGHT = '#4CAF50';
const IFVM_GREEN_BG = '#E8F5E9';
const IFVM_BG_LIGHT = '#F0F2F5';
const CARD_BG = '#FFFFFF';
const IFVM_ORANGE = '#E67E22';
const IFVM_ORANGE_BG = '#FFF3E0';
const IFVM_RED = '#E74C3C';
const IFVM_RED_BG = '#FCE4EC';
const IFVM_BLUE = '#2196F3';
const IFVM_BLUE_BG = '#E3F2FD';
const HEADER_BG = '#1B5E1B';
const TEXT_PRIMARY = '#1A237E';
const TEXT_BLACK = '#000000';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#757575';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Configuration des statuts
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; bgColor: string }> = {
  brouillon: { label: 'Brouillon', color: '#9E9E9E', icon: '📝', bgColor: '#F5F5F5' },
  en_attente: { label: 'En attente', color: IFVM_ORANGE, icon: '📤', bgColor: IFVM_ORANGE_BG },
  verifiee: { label: 'Vérifiée', color: IFVM_BLUE, icon: '✅', bgColor: IFVM_BLUE_BG },
  rejetee: { label: 'Rejetée', color: IFVM_RED, icon: '❌', bgColor: IFVM_RED_BG },
  validee: { label: 'Validée', color: IFVM_GREEN_LIGHT, icon: '🏆', bgColor: IFVM_GREEN_BG },
};

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  
  const [prospections, setProspections] = useState<DraftProspection[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true); // ✅ Initialisé à true
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const syncCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Récupérer la position
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPosition({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Erreur localisation:', error);
    }
  };

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Vérifier la connectivité et la synchronisation
  const checkSyncStatus = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      // ✅ Correction: utiliser ?? pour gérer undefined
      const connected = networkState.isConnected ?? false;
      const reachable = networkState.isInternetReachable ?? false;
      const isNetworkAvailable = connected && reachable;
      
      setIsConnected(isNetworkAvailable);
      
      const pendingCount = await countUnsyncedProspections();
      setPendingSyncCount(pendingCount);
      setShowSyncBanner(pendingCount > 0 && isNetworkAvailable);
    } catch (error) {
      console.error('Erreur vérification sync:', error);
      setIsConnected(false);
      setShowSyncBanner(false);
    }
  };

  useEffect(() => {
    checkSyncStatus();
    syncCheckInterval.current = setInterval(checkSyncStatus, 30 * 60 * 1000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkSyncStatus();
      }
    });

    return () => {
      if (syncCheckInterval.current) {
        clearInterval(syncCheckInterval.current);
      }
      subscription.remove();
    };
  }, []);

  // Charger les données
  const loadData = async () => {
    try {
      const [fiches, pendingCount] = await Promise.all([
        listRecentProspections(50),
        countUnsyncedProspections(),
      ]);
      
      setProspections(fiches);
      setPendingSyncCount(pendingCount);
      setShowSyncBanner(pendingCount > 0 && isConnected);

      // Calculer les statistiques par statut
      const statsData: Record<string, number> = {};
      fiches.forEach((f: DraftProspection) => {
        const statut = f.statut || 'brouillon';
        statsData[statut] = (statsData[statut] || 0) + 1;
      });
      setStats(statsData);

    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), getLocation(), checkSyncStatus()]);
    setRefreshing(false);
  };

  const today = new Date();
  const dateLabel = today
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();
  const timeLabel = today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  const totalFiches = prospections.length;
  const statsList = [
    { key: 'total', emoji: '📋', value: totalFiches, label: 'Total', color: IFVM_BLUE, bgColor: IFVM_BLUE_BG },
    { key: 'brouillon', emoji: '📝', value: stats.brouillon || 0, label: 'Brouillons', color: '#9E9E9E', bgColor: '#F5F5F5' },
    { key: 'en_attente', emoji: '📤', value: stats.en_attente || 0, label: 'En attente', color: IFVM_ORANGE, bgColor: IFVM_ORANGE_BG },
    { key: 'verifiee', emoji: '✅', value: stats.verifiee || 0, label: 'Vérifiées', color: IFVM_BLUE, bgColor: IFVM_BLUE_BG },
    { key: 'validee', emoji: '🏆', value: stats.validee || 0, label: 'Validées', color: IFVM_GREEN_LIGHT, bgColor: IFVM_GREEN_BG },
    { key: 'rejetee', emoji: '❌', value: stats.rejetee || 0, label: 'Rejetées', color: IFVM_RED, bgColor: IFVM_RED_BG },
  ];

  const getStatusConfig = (statut: string) => {
    return STATUS_CONFIG[statut] || STATUS_CONFIG.brouillon;
  };

  const getProspectionType = (type: string) => {
    if (type === 'intensive') return '📄 Intensive';
    if (type === 'extensive') return '📄 Extensive';
    if (type === 'validation') return '📄 Validation';
    return '📄 Prospection';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Image
              source={require('../../../assets/images/logo-ifvm.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>IFVM Veille</ThemedText>
              <ThemedText style={styles.headerSub}>
                {user?.prenom} {user?.nom} · Prospecteur
              </ThemedText>
            </View>
            <TouchableOpacity 
              onPress={() => navigateTo('/(tabs)/sync')}
              style={styles.syncButton}
            >
              <ThemedText style={styles.syncIcon}>🔄</ThemedText>
              {pendingSyncCount > 0 && (
                <View style={styles.syncBadge}>
                  <ThemedText style={styles.syncBadgeText}>
                    {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[IFVM_GREEN]}
            tintColor={IFVM_GREEN}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Carte bienvenue */}
        <Animated.View style={[styles.welcomeCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.welcomeHeader}>
            <View style={styles.welcomeTextContainer}>
              <ThemedText style={styles.welcomeGreeting}>Bonjour 👋</ThemedText>
              <ThemedText style={styles.welcomeName}>
                {user?.prenom} {user?.nom}
              </ThemedText>
              <View style={styles.welcomeBadge}>
                <ThemedText style={styles.welcomeBadgeText}>🔍 Prospecteur IFVM</ThemedText>
              </View>
            </View>
            <View style={styles.timeContainer}>
              <ThemedText style={styles.timeText}>{timeLabel}</ThemedText>
              <ThemedText style={styles.dateText}>{dateLabel}</ThemedText>
            </View>
          </View>
          <View style={styles.welcomeFooter}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? IFVM_GREEN_LIGHT : IFVM_RED }]} />
            <ThemedText style={styles.statusText}>
              {isConnected ? 'Connecté' : 'Hors-ligne'}
            </ThemedText>
            {position && (
              <View style={styles.positionContainer}>
                <ThemedText style={styles.positionIcon}>📍</ThemedText>
                <ThemedText style={styles.positionText}>
                  {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                </ThemedText>
              </View>
            )}
            {pendingSyncCount > 0 && (
              <View style={styles.updateBadge}>
                <ThemedText style={styles.updateBadgeText}>📤 {pendingSyncCount} à sync.</ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Bannière de synchronisation */}
        {showSyncBanner && pendingSyncCount > 0 && (
          <Animated.View style={[styles.syncBanner, { opacity: fadeAnim }]}>
            <View style={styles.syncBannerContent}>
              <View style={styles.syncBannerIcon}>
                <ThemedText style={styles.syncBannerIconText}>📡</ThemedText>
              </View>
              <View style={styles.syncBannerText}>
                <ThemedText style={styles.syncBannerTitle}>
                  {pendingSyncCount} fiche(s) en attente
                </ThemedText>
                <ThemedText style={styles.syncBannerSub}>
                  Synchronisez vos fiches dès que possible
                </ThemedText>
              </View>
              <TouchableOpacity 
                style={styles.syncBannerButton}
                onPress={() => navigateTo('/(tabs)/sync')}
              >
                <ThemedText style={styles.syncBannerButtonText}>Sync</ThemedText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Statistiques */}
        <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
          {statsList.map((stat, index) => (
            <View 
              key={index}
              style={[styles.statCard, { backgroundColor: stat.bgColor }]}
            >
              <ThemedText style={styles.statEmoji}>{stat.emoji}</ThemedText>
              <ThemedText style={[styles.statValue, { color: stat.color }]}>{stat.value}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: TEXT_BLACK }]}>{stat.label}</ThemedText>
            </View>
          ))}
        </Animated.View>

        {/* Dernières fiches */}
        {prospections.length > 0 && (
          <Animated.View style={[styles.recentSection, { opacity: fadeAnim }]}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>📋 Mes fiches</ThemedText>
              <TouchableOpacity onPress={() => navigateTo('/(tabs)/fiches')}>
                <ThemedText style={styles.viewAll}>Voir tout →</ThemedText>
              </TouchableOpacity>
            </View>
            {prospections.slice(0, 5).map((fiche, index) => {
              const statusConfig = getStatusConfig(fiche.statut);
              return (
                <TouchableOpacity
                  key={fiche.id}
                  style={[styles.ficheCard, index === Math.min(4, prospections.length - 1) && styles.ficheCardLast]}
                  onPress={() => router.push({ 
                    pathname: '/(prospection)/reference',
                    params: { draftId: fiche.id }
                  } as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ficheCardLeft}>
                    <View style={[styles.ficheStatus, { backgroundColor: statusConfig.color }]} />
                    <View>
                      <ThemedText style={styles.ficheTitle}>
                        {getProspectionType(fiche.type_prospection)}
                      </ThemedText>
                      <ThemedText style={styles.ficheSub}>
                        {fiche.station_id || '📍 Station non spécifiée'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.ficheCardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                        {statusConfig.icon} {statusConfig.label}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.ficheDate}>{formatDate(fiche.date_prospection)}</ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* Boutons d'action */}
        <Animated.View style={[styles.actionsContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigateTo('/(tabs)/prospection')}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.btnPrimaryText}>✚ Nouvelle fiche de prospection</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigateTo('/(tabs)/sync')}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.btnSecondaryText}>
              {pendingSyncCount > 0 ? `🔄 Synchroniser (${pendingSyncCount})` : '✅ Tout est synchronisé'}
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>IFVM Veille · v1.0.0</ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IFVM_BG_LIGHT,
  },
  scrollView: {
    flex: 1,
    backgroundColor: IFVM_BG_LIGHT,
  },
  safeArea: {
    backgroundColor: HEADER_BG,
  },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 6,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 1,
  },
  syncButton: {
    position: 'relative',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  syncIcon: {
    fontSize: 20,
  },
  syncBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: IFVM_RED,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: HEADER_BG,
  },
  syncBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  welcomeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 14,
    color: TEXT_BLACK,
    marginBottom: 2,
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  welcomeBadge: {
    backgroundColor: IFVM_GREEN_BG,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  welcomeBadgeText: {
    fontSize: 11,
    color: IFVM_GREEN,
    fontWeight: '600',
  },
  timeContainer: {
    alignItems: 'flex-end',
    backgroundColor: IFVM_BG_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  dateText: {
    fontSize: 10,
    color: TEXT_BLACK,
  },
  welcomeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: TEXT_BLACK,
    marginRight: 8,
  },
  positionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IFVM_BG_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  positionIcon: {
    fontSize: 12,
  },
  positionText: {
    color: TEXT_BLACK,
    fontSize: 10,
  },
  updateBadge: {
    backgroundColor: IFVM_ORANGE_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  updateBadgeText: {
    color: IFVM_ORANGE,
    fontSize: 10,
    fontWeight: '600',
  },
  syncBanner: {
    backgroundColor: IFVM_ORANGE_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: IFVM_ORANGE + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  syncBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IFVM_ORANGE + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  syncBannerIconText: {
    fontSize: 20,
  },
  syncBannerText: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IFVM_ORANGE,
  },
  syncBannerSub: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  syncBannerButton: {
    backgroundColor: IFVM_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncBannerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: TEXT_BLACK,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  viewAll: {
    color: IFVM_BLUE,
    fontSize: 13,
    fontWeight: '500',
  },
  recentSection: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  ficheCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  ficheCardLast: {
    borderBottomWidth: 0,
  },
  ficheCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ficheStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  ficheTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_BLACK,
  },
  ficheSub: {
    fontSize: 12,
    color: TEXT_DARK,
  },
  ficheCardRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ficheDate: {
    fontSize: 10,
    color: TEXT_DARK,
  },
  actionsContainer: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: IFVM_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: IFVM_GREEN,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: IFVM_GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: '#BDBDBD',
    fontSize: 12,
  },
});