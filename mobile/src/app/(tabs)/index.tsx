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
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  getProspectionsByUser,
  getStatsByStatus,
  checkPendingSync,
  shouldCheckSync,
  updateLastSyncCheck,
  getPendingSyncCount,
} from '@/lib/storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';

// ============================================
// CONSTANTES - PALETTE CLAIRE
// ============================================

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
  envoye: { label: 'Envoyé', color: IFVM_ORANGE, icon: '📤', bgColor: IFVM_ORANGE_BG },
  verifie: { label: 'Vérifié', color: IFVM_BLUE, icon: '✅', bgColor: IFVM_BLUE_BG },
  rejete: { label: 'Rejeté', color: IFVM_RED, icon: '❌', bgColor: IFVM_RED_BG },
  valide: { label: 'Validé', color: IFVM_GREEN_LIGHT, icon: '🏆', bgColor: IFVM_GREEN_BG },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  
  const [prospections, setProspections] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  
  // Animations
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideAnim = useMemo(() => new Animated.Value(30), []);

  // Référence pour le timer de vérification
  const syncCheckInterval = useRef<NodeJS.Timeout | null>(null);

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

  // Récupérer la position
  useEffect(() => {
    const id = setTimeout(() => getLocation(), 0);
    return () => clearTimeout(id);
  }, []);

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Vérifier la connectivité et la synchronisation
  const checkSyncStatus = async () => {
    try {
      // Vérifier la connexion réseau
      const networkState = await Network.getNetworkStateAsync();
      const isConnected = networkState.isConnected && networkState.isInternetReachable;
      
      if (isConnected) {
        // Si connecté, vérifier les fiches en attente
        const pendingCount = await getPendingSyncCount();
        setPendingSyncCount(pendingCount);
        setShowSyncBanner(pendingCount > 0);
      } else {
        // Si pas connecté, vérifier les fiches en attente depuis plus de 3 jours
        const shouldCheck = await shouldCheckSync();
        if (shouldCheck) {
          const pendingFiches = await checkPendingSync();
          setPendingSyncCount(pendingFiches.length);
          setShowSyncBanner(pendingFiches.length > 0);
          await updateLastSyncCheck();
        }
      }
    } catch (error) {
      console.error('Erreur vérification sync:', error);
    }
  };

  // Effet pour vérifier la sync au chargement et périodiquement
  useEffect(() => {
    // Vérification initiale
    const initialCheck = setTimeout(() => checkSyncStatus(), 0);

    // Vérification toutes les 30 minutes
    syncCheckInterval.current = setInterval(() => {
      checkSyncStatus();
    }, 30 * 60 * 1000);

    // Écouter les changements d'état de l'application
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkSyncStatus();
      }
    });

    // Nettoyage
    return () => {
      clearTimeout(initialCheck);
      if (syncCheckInterval.current) {
        clearInterval(syncCheckInterval.current);
      }
      subscription.remove();
    };
  }, []);

  // Charger les données
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [fiches, statsData, pendingCount] = await Promise.all([
        getProspectionsByUser(user.id),
        getStatsByStatus(user.id),
        getPendingSyncCount(),
      ]);

      setProspections(fiches);
      setStats(statsData);
      setPendingSyncCount(pendingCount);
      setShowSyncBanner(pendingCount > 0);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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

  // Statistiques totales
  const totalFiches = prospections.length;
  const statsList = [
    { key: 'total', emoji: '📋', value: totalFiches, label: 'Total', color: IFVM_BLUE, bgColor: IFVM_BLUE_BG },
    { key: 'brouillon', emoji: '📝', value: stats.brouillon || 0, label: 'Brouillons', color: '#9E9E9E', bgColor: '#F5F5F5' },
    { key: 'envoye', emoji: '📤', value: stats.envoye || 0, label: 'Envoyés', color: IFVM_ORANGE, bgColor: IFVM_ORANGE_BG },
    { key: 'verifie', emoji: '✅', value: stats.verifie || 0, label: 'Vérifiés', color: IFVM_BLUE, bgColor: IFVM_BLUE_BG },
    { key: 'valide', emoji: '🏆', value: stats.valide || 0, label: 'Validés', color: IFVM_GREEN_LIGHT, bgColor: IFVM_GREEN_BG },
    { key: 'rejete', emoji: '❌', value: stats.rejete || 0, label: 'Rejetés', color: IFVM_RED, bgColor: IFVM_RED_BG },
  ];

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
            <View style={styles.statusDot} />
            <ThemedText style={styles.statusText}>Connecté</ThemedText>
            {position && (
              <View style={styles.positionContainer}>
                <ThemedText style={styles.positionIcon}>📍</ThemedText>
                <ThemedText style={styles.positionText}>
                  {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                </ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Bannière de synchronisation */}
        {showSyncBanner && (
          <Animated.View style={[styles.syncBanner, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, new Animated.Value(0.7)) }] }]}>
            <View style={styles.syncBannerContent}>
              <View style={styles.syncBannerIcon}>
                <ThemedText style={styles.syncBannerIconText}>📡</ThemedText>
              </View>
              <View style={styles.syncBannerText}>
                <ThemedText style={styles.syncBannerTitle}>
                  {pendingSyncCount} fiche(s) en attente
                </ThemedText>
                <ThemedText style={styles.syncBannerSub}>
                  {pendingSyncCount > 3 ? '⚠️ Certaines fiches attendent depuis plus de 3 jours' : 'Synchronisez vos fiches dès que possible'}
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
        <Animated.View style={[styles.statsGrid, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, new Animated.Value(0.5)) }] }]}>
          {statsList.map((stat, index) => (
            <StatCard 
              key={index}
              emoji={stat.emoji}
              value={stat.value}
              label={stat.label}
              color={stat.color}
              bgColor={stat.bgColor}
            />
          ))}
        </Animated.View>

        {/* Dernières fiches */}
        {prospections.length > 0 && (
          <Animated.View style={[styles.recentSection, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, new Animated.Value(0.1)) }] }]}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>📋 Mes fiches</ThemedText>
              <TouchableOpacity onPress={() => navigateTo('/(tabs)/fiches')}>
                <ThemedText style={styles.viewAll}>Voir tout →</ThemedText>
              </TouchableOpacity>
            </View>
            {prospections.slice(0, 5).map((fiche, index) => {
              const status = fiche.status || 'brouillon';
              const statusConfig = STATUS_CONFIG[status];
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.ficheCard, index === Math.min(4, prospections.length - 1) && styles.ficheCardLast]}
                  onPress={() => router.push({ pathname: '/(tabs)/fiches/[id]', params: { id: fiche.id } } as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ficheCardLeft}>
                    <View style={[styles.ficheStatus, { backgroundColor: statusConfig.color }]} />
                    <View>
                      <ThemedText style={styles.ficheTitle}>
                        {fiche.type === 'cdv' ? '📄 CdV' : '🦗 IFVM'}
                      </ThemedText>
                      <ThemedText style={styles.ficheSub}>
                        {fiche.station || 'Station non spécifiée'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.ficheCardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                        {statusConfig.icon} {statusConfig.label}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.ficheDate}>{fiche.date}</ThemedText>
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
            <ThemedText style={styles.btnSecondaryText}>🔄 Synchroniser mes données</ThemedText>
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

// ============================================
// COMPOSANTS ENFANTS
// ============================================

function StatCard({ emoji, value, label, color, bgColor }: { 
  emoji: string; 
  value: number; 
  label: string; 
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <ThemedText style={styles.statEmoji}>{emoji}</ThemedText>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: TEXT_BLACK }]}>{label}</ThemedText>
    </View>
  );
}

// ============================================
// STYLES - FOND CLAIR AVEC TEXTES NOIRS
// ============================================

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
    backgroundColor: IFVM_GREEN_LIGHT,
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