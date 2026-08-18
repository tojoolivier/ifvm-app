import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { loadAccueilData, loadValidatedProspections } from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';
import { ProspectionRead } from '@/lib/api-client';
import { listTraitementsByChefEquipe, DraftTraitementRow } from '@/lib/traitement-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { navigateToProspectionConsult, navigateToProspectionDraft, navigateToTraitement } from '@/lib/fiche-routing';
import { FicheCard } from '@/components/fiches/FicheCard';
import { SearchAndFilterBar, FilterOption } from '@/components/fiches/SearchAndFilterBar';
import { NewFicheFab } from '@/components/fiches/NewFicheFab';
import {
  BadgeStyle,
  FICHES_BG,
  FICHES_GREEN_DARK,
  PROSPECTION_SUBTYPE_BADGE_CONFIG,
  STATUT_BADGE_CONFIG,
  TRAITEMENT_SUBTYPE_BADGE_CONFIG,
  TYPE_BADGE_CONFIG,
} from '@/components/fiches/tokens';

type FilterKey = 'TOUS' | 'PROSPECTION' | 'CRT' | 'METEO';

const FILTERS: FilterOption<FilterKey>[] = [
  { value: 'TOUS', label: 'Toutes', icon: '📋' },
  { value: 'PROSPECTION', label: 'Prospection', icon: '🔍' },
  { value: 'CRT', label: 'CRT', icon: '💊' },
  { value: 'METEO', label: 'Météo', icon: '🌤️', disabled: true },
];

interface FicheRow {
  id: string;
  filterKey: FilterKey;
  code: string;
  meta: string;
  typeBadge: BadgeStyle;
  subTypeBadge: BadgeStyle | null;
  statutBadge: BadgeStyle;
  date: string;
  onPress: () => void;
}

export default function FichesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterKey, setFilterKey] = useState<FilterKey>('TOUS');
  const [draftsRecent, setDraftsRecent] = useState<DraftProspection[]>([]);
  const [validated, setValidated] = useState<ProspectionRead[]>([]);
  const [traitements, setTraitements] = useState<DraftTraitementRow[]>([]);

  const refresh = useCallback(() => {
    loadAccueilData().then((data) => setDraftsRecent(data.recent));
    if (user && token) {
      loadValidatedProspections(token, user.id).then(setValidated);
      listTraitementsByChefEquipe(user.id)
        .then(setTraitements)
        .catch(() => setTraitements([]));
    }
  }, [user, token]);

  useFocusEffect(refresh);

  const today = new Date();
  const decade = Math.ceil(today.getDate() / 10);
  const mois = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const periodeLabel = `Décade ${decade} · ${mois}`;

  const rows = useMemo<FicheRow[]>(() => {
    const validatedIds = new Set(validated.map((p) => p.id));

    const prospectionRows: FicheRow[] = draftsRecent
      .filter((draft) => !validatedIds.has(draft.id))
      .map((draft) => ({
        id: draft.id,
        filterKey: 'PROSPECTION',
        code: draft.n_fiche ?? 'Fiche sans numéro',
        meta: `${draft.station_nom ?? draft.station_id ?? 'Localité inconnue'} · ${draft.date_prospection}`,
        typeBadge: TYPE_BADGE_CONFIG.PROSPECTION,
        subTypeBadge: PROSPECTION_SUBTYPE_BADGE_CONFIG[draft.type_prospection] ?? null,
        statutBadge: STATUT_BADGE_CONFIG[draft.statut] ?? STATUT_BADGE_CONFIG.brouillon,
        date: draft.date_prospection,
        onPress: () => navigateToProspectionDraft(router, hydrateFromDraft, draft),
      }));

    const validatedRows: FicheRow[] = validated.map((prospection) => ({
      id: prospection.id,
      filterKey: 'PROSPECTION',
      code: prospection.n_fiche ?? 'Fiche sans numéro',
      meta: `${prospection.station_id ?? 'Localité inconnue'} · ${prospection.date_prospection}`,
      typeBadge: TYPE_BADGE_CONFIG.PROSPECTION,
      subTypeBadge: PROSPECTION_SUBTYPE_BADGE_CONFIG[prospection.type_prospection] ?? null,
      statutBadge: STATUT_BADGE_CONFIG.validee,
      date: prospection.date_prospection,
      onPress: () => navigateToProspectionConsult(router, prospection),
    }));

    const traitementRows: FicheRow[] = traitements.map((traitement) => ({
      id: traitement.id,
      filterKey: 'CRT',
      code: traitement.numero_fiche ?? 'Fiche sans numéro',
      meta: `${traitement.localite ?? 'Localité inconnue'} · ${traitement.date_traitement ?? '—'}`,
      typeBadge: TYPE_BADGE_CONFIG.CRT,
      subTypeBadge: TRAITEMENT_SUBTYPE_BADGE_CONFIG[traitement.type_traitement] ?? null,
      statutBadge: STATUT_BADGE_CONFIG[traitement.statut] ?? STATUT_BADGE_CONFIG.brouillon,
      date: traitement.date_traitement ?? traitement.updated_at,
      onPress: () =>
        navigateToTraitement(router, traitement, { validationView: traitement.statut === 'validee' }),
    }));

    return [...prospectionRows, ...validatedRows, ...traitementRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [draftsRecent, validated, traitements, router, hydrateFromDraft]);

  const fichesFiltrees = useMemo(() => {
    return rows.filter((row) => {
      const matchSearch =
        searchQuery === '' ||
        row.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.meta.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterKey === 'TOUS' || row.filterKey === filterKey;
      return matchSearch && matchType;
    });
  }, [rows, searchQuery, filterKey]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
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

      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher une fiche..."
        filters={FILTERS}
        activeFilter={filterKey}
        onFilterChange={setFilterKey}
      />

      <View style={styles.resultCountContainer}>
        <Text style={styles.resultCount}>
          {fichesFiltrees.length} fiche{fichesFiltrees.length > 1 ? 's' : ''}
          {searchQuery !== '' && ` · "${searchQuery}"`}
        </Text>
      </View>

      <FlatList
        data={fichesFiltrees}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FicheCard
            code={item.code}
            typeBadge={item.typeBadge}
            subTypeBadge={item.subTypeBadge}
            statutBadge={item.statutBadge}
            meta={item.meta}
            onPress={item.onPress}
          />
        )}
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

      <NewFicheFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FICHES_BG,
  },
  header: {
    backgroundColor: FICHES_GREEN_DARK,
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
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#FFFFFFAA',
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    width: 32,
  },
  resultCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  resultCount: {
    fontSize: 13,
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
});
