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
import { listToutesProspectionsLocal, countUnsyncedProspections, DraftProspection } from '@/lib/prospection-repository';
import { listToutesTraitementsLocal, DraftTraitementRow } from '@/lib/traitement-repository';
import { NewFicheFab } from '@/components/fiches/NewFicheFab';
import * as Network from 'expo-network';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { peutVoirEquipesAeriennes } from '@/lib/equipe-aerienne-access';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

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
const IFVM_BROUILLON = '#6B7280';
const IFVM_BROUILLON_BG = '#F3F4F6';
const HEADER_BG = '#1B5E1B';
const TEXT_BLACK = '#000000';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#757575';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * `station_nom` (intensif, référentiel) ou `station_libre` (extensif, saisie
 * libre) sont les deux vrais noms lisibles — même règle que `stationLabel`
 * dans fiches.tsx/prospection.tsx, dupliquée ici plutôt que mutualisée (même
 * choix que ces deux fichiers). « Activité récente » affichait « Station non
 * spécifiée » pour toute fiche extensive/validation alors que la localité
 * saisie (station_libre) existait bel et bien.
 */
function stationLabel(item: { station_nom?: string | null; station_libre?: string | null }): string {
  return item.station_nom || item.station_libre || 'Station non spécifiée';
}

/** Une ligne de la carte « Activité récente » — prospection ou traitement,
 * réduits à ce que la carte affiche, pour ne pas faire dépendre le rendu de
 * deux formes de données différentes (#activite-recente-traitements). */
interface ActiviteItem {
  id: string;
  titre: string;
  sousTitre: string;
  synced: boolean;
  /** #brouillon-prospection-hors-a-synchro : une prospection encore en cours de saisie
   * (`statut = 'brouillon'`) n'est jamais « à synchro » — elle ne devient une fiche
   * envoyable qu'une fois tout le parcours validé (`completeProspection`). */
  brouillon: boolean;
  updatedAt: string;
}

function prospectionVersActivite(fiche: DraftProspection): ActiviteItem {
  return {
    id: fiche.id,
    titre: stationLabel(fiche),
    sousTitre: `N°${fiche.n_fiche ?? '—'} · ${fiche.date_prospection}`,
    synced: fiche.statut_sync === 'synced',
    brouillon: fiche.statut === 'brouillon',
    updatedAt: fiche.updated_at,
  };
}

function traitementVersActivite(fiche: DraftTraitementRow): ActiviteItem {
  return {
    id: fiche.id,
    titre: fiche.localite || 'Localité non spécifiée',
    sousTitre: `N°${fiche.numero_fiche ?? '—'} · ${fiche.date_traitement ?? '—'}`,
    synced: fiche.statut_sync === 'synced',
    brouillon: false,
    updatedAt: fiche.updated_at,
  };
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const [prospections, setProspections] = useState<DraftProspection[]>([]);
  const [traitements, setTraitements] = useState<DraftTraitementRow[]>([]);
  // #dossier-brouillons : pastille sur la tuile ACCÈS RAPIDE — dérivée de
  // `prospections` (déjà chargée intégralement par `loadData`), pas d'appel
  // réseau/local supplémentaire.
  const draftsCount = useMemo(() => prospections.filter((p) => p.statut === 'brouillon').length, [prospections]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Animations
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideAnim = useMemo(() => new Animated.Value(30), []);

  // Référence pour le timer de vérification
  const syncCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const signalerChargement = useSignalerChargement('index');

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
      const networkState = await Network.getNetworkStateAsync();
      const isConnected = networkState.isConnected && networkState.isInternetReachable;
      setIsOffline(!isConnected);

      const pendingCount = await countUnsyncedProspections();
      setPendingSyncCount(pendingCount);
      setShowSyncBanner(pendingCount > 0);
    } catch (error) {
      logger.failure('index.checkSyncStatus.failed', error);
      signalerChargement(error);
    }
  };

  // Effet pour vérifier la sync au chargement et périodiquement
  useEffect(() => {
    const initialCheck = setTimeout(() => void checkSyncStatus(), 0);

    syncCheckInterval.current = setInterval(() => {
      void checkSyncStatus();
    }, 30 * 60 * 1000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void checkSyncStatus();
      }
    });

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
      const [fiches, ficheTraitements, pendingCount] = await Promise.all([
        listToutesProspectionsLocal(),
        listToutesTraitementsLocal(),
        countUnsyncedProspections(),
      ]);

      setProspections(fiches);
      setTraitements(ficheTraitements);
      setPendingSyncCount(pendingCount);
      setShowSyncBanner(pendingCount > 0);
    } catch (error) {
      logger.failure('index.loadData.failed', error, { userId: user.id });
      signalerChargement(error, { userId: user.id });
    }
  }, [user, signalerChargement]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), checkSyncStatus()]);
    setRefreshing(false);
  };

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  // Activité récente — prospections ET traitements confondus, triés par
  // dernière modification (#activite-recente-traitements : les fiches de
  // traitement n'y apparaissaient pas du tout, alors que « Mes fiches »
  // (fiches.tsx) les affiche déjà toutes les deux).
  const activiteRecente = useMemo(() => {
    return [...prospections.map(prospectionVersActivite), ...traitements.map(traitementVersActivite)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, [prospections, traitements]);

  // Fiches par jour sur la semaine en cours (L -> D)
  const weekCounts = useMemo(() => {
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndex);

    return WEEK_LABELS.map((_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayKey = day.toISOString().split('T')[0];
      const count = prospections.filter((p) => p.date_prospection === dayKey).length;
      return { count, isToday: i === dayIndex };
    });
  }, [prospections]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {isOffline && (
              <View style={styles.headerTopRow}>
                <ThemedText style={styles.networkStatus}>⚠ Hors-ligne</ThemedText>
              </View>
            )}

            <View style={styles.headerContent}>
              <Image
                source={require('../../../assets/images/logo-ifvm.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.headerTextContainer} testID="dashboard-header">
                <ThemedText style={styles.headerGreeting}>Bonjour</ThemedText>
                <ThemedText style={styles.headerName}>
                  {user?.prenom} {user?.nom}
                </ThemedText>
                <ThemedText style={styles.headerRole}>Agent de terrain</ThemedText>
              </View>
              <TouchableOpacity onPress={() => navigateTo('/(app)/profile')} activeOpacity={0.7}>
                <ThemedText style={styles.gearIcon}>⚙️</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.badgeAvailable}>
                <View style={styles.badgeDot} />
                <ThemedText style={styles.badgeAvailableText}>Disponible</ThemedText>
              </View>
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
        {/* Fiches par jour */}
        <Animated.View style={[styles.chartCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ThemedText style={styles.chartTitle}>Fiches par jour</ThemedText>
          <WeekChart data={weekCounts} />
        </Animated.View>

        {/* Bannière de synchronisation */}
        {showSyncBanner && (
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
                  {pendingSyncCount > 3
                    ? '⚠️ Certaines fiches attendent depuis plus de 3 jours'
                    : 'Synchronisez vos fiches dès que possible'}
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.syncBannerButton} onPress={() => navigateTo('/(app)/sync')}>
                <ThemedText style={styles.syncBannerButtonText}>Sync</ThemedText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Accès rapide */}
        <Animated.View style={[styles.quickAccessSection, { opacity: fadeAnim }]}>
          <ThemedText style={styles.sectionTitle}>ACCÈS RAPIDE</ThemedText>
          <View style={styles.quickAccessGrid}>
            <TouchableOpacity
              style={[styles.quickTile, styles.quickTilePrimary]}
              onPress={() => navigateTo('/(app)/prospection')}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.quickTileIcon}>✚</ThemedText>
              <ThemedText style={styles.quickTileTextPrimary}>Nouvelle prospection</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              onPress={() => navigateTo('/(app)/fiches')}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.quickTileIcon}>📄</ThemedText>
              <ThemedText style={styles.quickTileText}>Mes fiches</ThemedText>
            </TouchableOpacity>

            {/* #dossier-brouillons : toutes les fiches de prospection encore en
                cours de saisie (intensive/extensive/validation) — jamais
                envoyées tant qu'elles ne sont pas terminées (completeProspection).
                Distinct de « Mes fiches », qui liste tout SAUF ces brouillons
                en pratique confus (cf. statutFicheAffiche avant #dossier-brouillons). */}
            <TouchableOpacity
              style={styles.quickTile}
              onPress={() => navigateTo('/(app)/brouillons')}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.quickTileIcon}>📝</ThemedText>
              <ThemedText style={styles.quickTileText}>
                Brouillons{draftsCount > 0 ? ` (${draftsCount})` : ''}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              onPress={() => navigateTo('/(traitement)/select')}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.quickTileIcon}>🚁</ThemedText>
              <ThemedText style={styles.quickTileText}>Nouveau traitement</ThemedText>
            </TouchableOpacity>

            {/* Gestion des équipes aériennes (équipes, bases, stands) : réservée
                au chef de base et à l'équipe aérienne (pilote/mécanicien) —
                masquée pour les autres rôles plutôt qu'un raccourci qui mène à
                un écran inutilisable. */}
            {peutVoirEquipesAeriennes(user?.role) && (
              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => navigateTo('/(app)/equipes-aeriennes')}
                activeOpacity={0.85}
              >
                <ThemedText style={styles.quickTileIcon}>🛫</ThemedText>
                <ThemedText style={styles.quickTileText}>Équipes aériennes</ThemedText>
              </TouchableOpacity>
            )}

            <View style={[styles.quickTile, styles.quickTileDisabled]}>
              <ThemedText style={styles.quickTileIcon}>🔔</ThemedText>
              <ThemedText style={styles.quickTileText}>Alertes</ThemedText>
              <ThemedText style={styles.quickTileSoon}>Bientôt disponible</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Activité récente */}
        {activiteRecente.length > 0 && (
          <Animated.View style={[styles.recentSection, { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, new Animated.Value(0.1)) }] }]}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>ACTIVITÉ RÉCENTE</ThemedText>
              <TouchableOpacity onPress={() => navigateTo('/(app)/fiches')}>
                <ThemedText style={styles.viewAll}>Tout voir ›</ThemedText>
              </TouchableOpacity>
            </View>
            {activiteRecente.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.ficheCard, index === activiteRecente.length - 1 && styles.ficheCardLast]}
                onPress={() => navigateTo('/(app)/fiches')}
                activeOpacity={0.7}
              >
                <View>
                  <ThemedText style={styles.ficheTitle}>{item.titre}</ThemedText>
                  <ThemedText style={styles.ficheSub}>{item.sousTitre}</ThemedText>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: item.brouillon
                        ? IFVM_BROUILLON_BG
                        : item.synced
                          ? IFVM_GREEN_BG
                          : IFVM_ORANGE_BG,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.statusBadgeText,
                      { color: item.brouillon ? IFVM_BROUILLON : item.synced ? IFVM_GREEN_LIGHT : IFVM_ORANGE },
                    ]}
                  >
                    {item.brouillon ? 'BROUILLON' : item.synced ? 'SYNCHRO ✓' : 'À SYNCHRO'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>IFVM Veille · v1.0.0</ThemedText>
        </View>
      </ScrollView>

      <NewFicheFab />
    </View>
  );
}

// ============================================
// COMPOSANTS ENFANTS
// ============================================

function WeekChart({ data }: { data: { count: number; isToday: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  return (
    <View style={styles.weekChart}>
      {data.map((d, i) => {
        const height = 6 + (d.count / max) * 48;
        return (
          <View key={i} style={styles.weekChartColumn}>
            <View
              style={[
                styles.weekChartBar,
                { height, backgroundColor: d.isToday ? IFVM_GREEN : '#D9D3C7' },
              ]}
            />
            <ThemedText style={[styles.weekChartLabel, d.isToday && styles.weekChartLabelToday]}>
              {WEEK_LABELS[i]}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const BASE_TYPE_SIZES = {
  networkStatus: 12,
  gearIcon: 18,
  headerGreeting: 13,
  headerName: 20,
  headerRole: 12,
  badgeAvailableText: 12,
  chartTitle: 16,
  weekChartLabel: 12,
  syncBannerIconText: 20,
  syncBannerTitle: 14,
  syncBannerSub: 11,
  syncBannerButtonText: 12,
  sectionTitle: 12,
  viewAll: 13,
  ficheTitle: 15,
  ficheSub: 12,
  statusBadgeText: 10,
  quickTileIcon: 26,
  quickTileText: 13,
  quickTileTextPrimary: 13,
  quickTileSoon: 10,
  footerText: 12,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>, theme: ThemePalette) {
  return StyleSheet.create({
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
      paddingBottom: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
    },
    networkStatus: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: typeSizes.networkStatus,
      fontWeight: '600',
    },
    gearIcon: {
      fontSize: typeSizes.gearIcon,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.15)',
      padding: 6,
    },
    headerTextContainer: {
      flex: 1,
      marginLeft: 10,
    },
    headerGreeting: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: typeSizes.headerGreeting,
    },
    headerName: {
      color: '#FFFFFF',
      fontSize: typeSizes.headerName,
      fontWeight: '700',
    },
    headerRole: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: typeSizes.headerRole,
      marginTop: 1,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
    badgeAvailable: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    badgeDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: IFVM_GREEN_LIGHT,
      marginRight: 6,
    },
    badgeAvailableText: {
      color: '#FFFFFF',
      fontSize: typeSizes.badgeAvailableText,
      fontWeight: '600',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    scrollContentTablet: {
      paddingHorizontal: 32,
      paddingVertical: 24,
    },
    chartCard: {
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
    chartTitle: {
      fontSize: typeSizes.chartTitle,
      fontWeight: '700',
      color: TEXT_DARK,
      marginBottom: 16,
    },
    weekChart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    weekChartColumn: {
      alignItems: 'center',
      flex: 1,
    },
    weekChartBar: {
      width: 20,
      borderRadius: 6,
      marginBottom: 8,
    },
    weekChartLabel: {
      fontSize: typeSizes.weekChartLabel,
      color: TEXT_SECONDARY,
    },
    weekChartLabelToday: {
      color: IFVM_GREEN,
      fontWeight: '700',
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
      fontSize: typeSizes.syncBannerIconText,
    },
    syncBannerText: {
      flex: 1,
    },
    syncBannerTitle: {
      fontSize: typeSizes.syncBannerTitle,
      fontWeight: '600',
      color: IFVM_ORANGE,
    },
    syncBannerSub: {
      fontSize: typeSizes.syncBannerSub,
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
      fontSize: typeSizes.syncBannerButtonText,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      color: TEXT_SECONDARY,
      fontSize: typeSizes.sectionTitle,
      fontWeight: '700',
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    viewAll: {
      color: IFVM_GREEN,
      fontSize: typeSizes.viewAll,
      fontWeight: '600',
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
    ficheTitle: {
      fontSize: typeSizes.ficheTitle,
      fontWeight: '700',
      color: TEXT_BLACK,
    },
    ficheSub: {
      fontSize: typeSizes.ficheSub,
      color: TEXT_SECONDARY,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: typeSizes.statusBadgeText,
      fontWeight: '700',
    },
    quickAccessSection: {
      marginBottom: 16,
    },
    quickAccessGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    quickTile: {
      width: '48%',
      backgroundColor: CARD_BG,
      borderRadius: 16,
      paddingVertical: 22,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    quickTilePrimary: {
      backgroundColor: IFVM_ORANGE,
    },
    quickTileDisabled: {
      opacity: 0.55,
    },
    quickTileIcon: {
      fontSize: typeSizes.quickTileIcon,
      marginBottom: 8,
    },
    quickTileText: {
      fontSize: typeSizes.quickTileText,
      fontWeight: '600',
      color: TEXT_DARK,
      textAlign: 'center',
    },
    quickTileTextPrimary: {
      fontSize: typeSizes.quickTileTextPrimary,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    quickTileSoon: {
      fontSize: typeSizes.quickTileSoon,
      color: TEXT_SECONDARY,
      marginTop: 4,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    footerText: {
      color: theme.faint,
      fontSize: typeSizes.footerText,
    },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
