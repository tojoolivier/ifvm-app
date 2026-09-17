import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { loadAccueilData, loadMesProspectionsServeur } from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';
import { ProspectionRead } from '@/lib/api-client';
import { listRecentTraitements, DraftTraitementRow } from '@/lib/traitement-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { navigateToProspectionConsult, navigateToProspectionDraft, navigateToTraitement } from '@/lib/fiche-routing';
import { FicheCard } from '@/components/fiches/FicheCard';
import { SearchAndFilterBar, FilterOption } from '@/components/fiches/SearchAndFilterBar';
import { NewFicheFab } from '@/components/fiches/NewFicheFab';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { runTask } from '@/lib/run-task';
import {
  BadgeStyle,
  FICHES_BG,
  FICHES_GREEN_DARK,
  PROSPECTION_SUBTYPE_BADGE_CONFIG,
  STATUT_BADGE_CONFIG,
  TRAITEMENT_SUBTYPE_BADGE_CONFIG,
  TYPE_BADGE_CONFIG,
} from '@/components/fiches/tokens';
import { statutFicheAffiche } from '@/lib/prospection-statut';

type FilterKey = 'TOUS' | 'PROSPECTION' | 'CRT' | 'METEO';

const FILTERS: FilterOption<FilterKey>[] = [
  { value: 'TOUS', label: 'Toutes', icon: '📋' },
  { value: 'PROSPECTION', label: 'Prospection', icon: '🔍' },
  { value: 'CRT', label: 'CRT', icon: '💊' },
  { value: 'METEO', label: 'Météo', icon: '🌤️', disabled: true },
];

/**
 * `station_id` est une clé du référentiel (UUID) — jamais un nom à afficher, et de
 * toute façon absente pour l'extensif (pas de station fixe du référentiel, cf.
 * extensive-reference.tsx). `station_nom` (intensif, référentiel) ou `station_libre`
 * (extensif, saisie libre) sont les vrais noms lisibles ; « Localité inconnue »
 * seulement quand aucun des deux n'est réellement renseigné.
 */
function stationLabel(item: { station_nom?: string | null; station_libre?: string | null }): string {
  return item.station_nom || item.station_libre || 'Localité inconnue';
}

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
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);

  /**
   * Lecture des trois sources de la liste — ADR-012 décisions 1 et 5 (#172).
   *
   * Cet écran portait les trois formes de silence que l'ADR éradique : deux
   * `.then()` sans `.catch()` (des rejets qui flottaient, et que #160 a montré
   * n'être rattrapés par rien en release) et un `.catch(() => setTraitements([]))`
   * qui rendait une liste vide **indiscernable d'une absence de fiches**.
   * L'agent lisait « Aucune fiche trouvée » et concluait qu'il n'avait rien saisi.
   *
   * `runTask` garantit désormais que rien ne flotte ni ne se perd, et l'erreur
   * retenue s'affiche là où la donnée manque, via `EtatVide`.
   */
  const refresh = useCallback(() => {
    void (async () => {
      const lectures = await Promise.all([
        runTask(() => loadAccueilData(), { name: 'fiches.brouillons', criticality: 'essential' }),
        user && token
          ? runTask(() => loadMesProspectionsServeur(token, user.id), {
              name: 'fiches.statut-serveur',
              criticality: 'essential',
            })
          : null,
        // Toute fiche de traitement créée sur cet appareil doit apparaître ici, pas
        // seulement celles où l'utilisateur connecté est déjà chef d'équipe/chef de
        // base (#crt-fiches-creees-absentes-de-mes-fiches) : `listMesTraitements`
        // filtrait par ce rôle, donc une fiche encore en cours de saisie (écran
        // Équipe pas encore atteint) ou créée par un agent qui n'est pas lui-même le
        // chef assigné n'apparaissait jamais, malgré la fiche déjà présente
        // localement — contrairement aux prospections (`loadAccueilData`, aucun
        // filtre par rôle).
        runTask(() => listRecentTraitements(), {
          name: 'fiches.traitements',
          criticality: 'essential',
        }),
      ]);

      const [brouillons, validees, traitementsLus] = lectures;
      if (brouillons.ok) setDraftsRecent(brouillons.value.recent);
      if (validees?.ok) setValidated(validees.value);
      if (traitementsLus?.ok) setTraitements(traitementsLus.value);

      // Une lecture ratée sur trois suffit à rendre la liste incomplète : la
      // taire ferait exactement le vide muet que ce ticket supprime.
      const ratee = lectures.find((l) => l !== null && !l.ok);
      setErreurDeLecture(ratee && !ratee.ok ? ratee.error : null);
    })();
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
        meta: `${stationLabel(draft)} · ${draft.date_prospection}`,
        typeBadge: TYPE_BADGE_CONFIG.PROSPECTION,
        subTypeBadge: PROSPECTION_SUBTYPE_BADGE_CONFIG[draft.type_prospection] ?? null,
        statutBadge:
          STATUT_BADGE_CONFIG[statutFicheAffiche(draft.statut, draft.statut_sync)] ??
          STATUT_BADGE_CONFIG.brouillon,
        date: draft.date_prospection,
        onPress: () => navigateToProspectionDraft(router, hydrateFromDraft, draft),
      }));

    const validatedRows: FicheRow[] = validated.map((prospection) => ({
      id: prospection.id,
      filterKey: 'PROSPECTION',
      code: prospection.n_fiche ?? 'Fiche sans numéro',
      meta: `${stationLabel(prospection)} · ${prospection.date_prospection}`,
      typeBadge: TYPE_BADGE_CONFIG.PROSPECTION,
      subTypeBadge: PROSPECTION_SUBTYPE_BADGE_CONFIG[prospection.type_prospection] ?? null,
      statutBadge: STATUT_BADGE_CONFIG[statutFicheAffiche(prospection.statut, 'synced')],
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
          <EtatVide
            erreur={erreurDeLecture}
            titreVide="Aucune fiche trouvée"
            sousTitreVide={
              searchQuery ? 'Essayez de modifier votre recherche' : 'Créez votre première fiche'
            }
            onReessayer={refresh}
          />
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

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
