import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

type TypeFiche = 'PROSPECTION' | 'CRT' | 'METEO';
type StatutFiche = 'en_attente' | 'verifiee' | 'validee' | 'rejetee';

interface FicheItem {
  id: string;
  code: string;
  type: TypeFiche;
  typeProspection?: 'EXT' | 'INT';
  poste: string;
  date: string;
  statut: StatutFiche;
  campagne?: string;
}

const STATUT_CONFIG: Record<StatutFiche, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
  verifiee:   { label: 'Vérifiée',  color: '#2563EB', bg: '#DBEAFE' },
  validee:    { label: 'Validée',   color: '#15803D', bg: '#DCFCE7' },
  rejetee:    { label: 'Rejetée',   color: '#DC2626', bg: '#FEE2E2' },
};

const TYPE_CONFIG: Record<TypeFiche, { label: string; color: string; bg: string; icon: string }> = {
  PROSPECTION: { label: 'PRO', color: '#2563EB', bg: '#DBEAFE', icon: '🔍' },
  CRT:         { label: 'CRT', color: '#7C3AED', bg: '#EDE9FE', icon: '📋' },
  METEO:       { label: 'MET', color: '#F59E0B', bg: '#FEF3C7', icon: '🌤️' },
};

// Données mock
const MOCK_FICHES: FicheItem[] = [
  { 
    id: '1', 
    code: 'PRO-2451', 
    type: 'PROSPECTION',
    typeProspection: 'EXT',
    poste: 'PA Betioky', 
    date: '24/06/2026', 
    statut: 'en_attente',
    campagne: 'Campagne 2026'
  },
  { 
    id: '2', 
    code: 'PRO-2449', 
    type: 'PROSPECTION',
    typeProspection: 'EXT',
    poste: 'PA Betioky', 
    date: '23/06/2026', 
    statut: 'verifiee',
    campagne: 'Campagne 2026'
  },
  { 
    id: '3', 
    code: 'PRO-2446', 
    type: 'PROSPECTION',
    typeProspection: 'INT',
    poste: 'PA Betioky', 
    date: '22/06/2026', 
    statut: 'validee',
    campagne: 'Campagne 2026'
  },
  { 
    id: '4', 
    code: 'PRO-2440', 
    type: 'PROSPECTION',
    typeProspection: 'EXT',
    poste: 'PA Betioky', 
    date: '19/06/2026', 
    statut: 'rejetee',
    campagne: 'Campagne 2026'
  },
  { 
    id: '5', 
    code: 'CRT-2026-001', 
    type: 'CRT',
    poste: 'PA Toliara', 
    date: '25/06/2026', 
    statut: 'en_attente',
    campagne: 'Campagne 2026'
  },
  { 
    id: '6', 
    code: 'CRT-2026-002', 
    type: 'CRT',
    poste: 'PA Morondava', 
    date: '20/06/2026', 
    statut: 'validee',
    campagne: 'Campagne 2026'
  },
  {
    id: '7',
    code: 'MET-2026-001',
    type: 'METEO',
    poste: 'PA Toliara',
    date: '26/06/2026',
    statut: 'en_attente',
    campagne: 'Campagne 2026'
  },
];

export default function FichesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TypeFiche | 'TOUS'>('TOUS');
  const scrollViewRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  const today = new Date();
  const decade = Math.ceil(today.getDate() / 10);
  const mois = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const periodeLabel = `Décade ${decade} · ${mois}`;

  // Filtrer les fiches
  const fichesFiltrees = useMemo(() => {
    return MOCK_FICHES.filter(fiche => {
      const matchSearch = searchQuery === '' || 
        fiche.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fiche.poste.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fiche.campagne && fiche.campagne.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchType = filterType === 'TOUS' || fiche.type === filterType;
      
      return matchSearch && matchType;
    });
  }, [searchQuery, filterType]);

  const handleFichePress = (fiche: FicheItem) => {
    if (fiche.type === 'PROSPECTION') {
      router.push({
        pathname: '/(prospection)/especes' as any,
        params: { draftId: fiche.id }
      });
    } else if (fiche.type === 'CRT') {
      router.push({
        pathname: '/(app)/fiches',
        params: { id: fiche.id, view: 'crt' }
      });
    } else {
      // Météo
      router.push({
        pathname: '/(app)/fiches',
        params: { id: fiche.id, view: 'meteo' }
      });
    }
  };

  const renderFiche = ({ item }: { item: FicheItem }) => (
    <FicheCard 
      fiche={item} 
      onPress={() => handleFichePress(item)}
    />
  );

  // Déterminer si on affiche les icônes
  const showIcons = windowWidth >= 400;

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
              <Text style={styles.headerTitle}>Mes fiches</Text>
              <Text style={styles.headerSub}>{periodeLabel}</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
        </SafeAreaView>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une fiche..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtres - Version responsive simple */}
      <View style={styles.filtersWrapper}>
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
          decelerationRate="fast"
        >
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'TOUS' && styles.filterChipActive]}
            onPress={() => setFilterType('TOUS')}
          >
            <Text style={[styles.filterChipText, filterType === 'TOUS' && styles.filterChipTextActive]}>
              {showIcons ? '📋 ' : ''}Toutes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'PROSPECTION' && styles.filterChipActive]}
            onPress={() => setFilterType('PROSPECTION')}
          >
            <Text style={[styles.filterChipText, filterType === 'PROSPECTION' && styles.filterChipTextActive]}>
              {showIcons ? '🔍 ' : ''}Prospection
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'CRT' && styles.filterChipActive]}
            onPress={() => setFilterType('CRT')}
          >
            <Text style={[styles.filterChipText, filterType === 'CRT' && styles.filterChipTextActive]}>
              {showIcons ? '💊 ' : ''}CRT
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'METEO' && styles.filterChipActive]}
            onPress={() => setFilterType('METEO')}
          >
            <Text style={[styles.filterChipText, filterType === 'METEO' && styles.filterChipTextActive]}>
              {showIcons ? '🌤️ ' : ''}Météo
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Nombre de résultats */}
      <View style={styles.resultCountContainer}>
        <Text style={styles.resultCount}>
          {fichesFiltrees.length} fiche{fichesFiltrees.length > 1 ? 's' : ''}
          {searchQuery !== '' && ` · "${searchQuery}"`}
        </Text>
      </View>

      {/* Liste */}
      <FlatList
        data={fichesFiltrees}
        keyExtractor={(item) => item.id}
        renderItem={renderFiche}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>Aucune fiche trouvée</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? 'Essayez de modifier votre recherche' : 'Créez votre première fiche'}
            </Text>
          </View>
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Bouton Nouvelle fiche */}
      <TouchableOpacity
        style={styles.btnNouvelle}
        onPress={() => router.push('/(app)/prospection')}
        activeOpacity={0.85}
      >
        <Text style={styles.btnNouvelleText}>+ Nouvelle fiche</Text>
      </TouchableOpacity>
    </View>
  );
}

function FicheCard({ fiche, onPress }: { fiche: FicheItem; onPress: () => void }) {
  const statut = STATUT_CONFIG[fiche.statut];
  const type = TYPE_CONFIG[fiche.type];

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: type.bg }]}>
            <Text style={[styles.typeBadgeText, { color: type.color }]}>
              {type.icon} {type.label}
            </Text>
          </View>
          {fiche.typeProspection && (
            <View style={[styles.subTypeBadge, { backgroundColor: TYPE_CONFIG.PROSPECTION.bg }]}>
              <Text style={[styles.subTypeText, { color: TYPE_CONFIG.PROSPECTION.color }]}>
                {fiche.typeProspection}
              </Text>
            </View>
          )}
          <View style={[styles.statutBadge, { backgroundColor: statut.bg }]}>
            <Text style={[styles.statutBadgeText, { color: statut.color }]}>
              {statut.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardCode}>{fiche.code}</Text>
          <View style={styles.cardMetaContainer}>
            <Text style={styles.cardMeta}>{fiche.poste}</Text>
            <Text style={styles.cardMetaDot}>·</Text>
            <Text style={styles.cardMeta}>{fiche.date}</Text>
          </View>
          {fiche.campagne && (
            <Text style={styles.cardCampagne}>{fiche.campagne}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: isSmallScreen ? 40 : 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 15,
    color: '#111827',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersContainer: {
    paddingVertical: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: isSmallScreen ? 12 : 14,
    paddingVertical: isSmallScreen ? 5 : 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterChipActive: {
    backgroundColor: IFVM_GREEN_LIGHT,
    borderColor: IFVM_GREEN,
  },
  filterChipText: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: IFVM_GREEN_DARK,
    fontWeight: '600',
  },
  resultCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  resultCount: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...(isTablet && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  typeBadgeText: {
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '700',
  },
  subTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  statutBadgeText: {
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '600',
  },
  cardBody: {
    flex: 1,
  },
  cardCode: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  cardMeta: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
  },
  cardMetaDot: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
    marginHorizontal: 4,
  },
  cardCampagne: {
    fontSize: isSmallScreen ? 11 : 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  btnNouvelle: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: IFVM_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    ...(isTablet && {
      maxWidth: 600,
      alignSelf: 'center',
    }),
  },
  btnNouvelleText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
  },
});