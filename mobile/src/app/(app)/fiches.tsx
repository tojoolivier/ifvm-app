import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { loadAccueilData, loadMesProspectionsServeur } from '@/lib/prospection-accueil';
import { DraftProspection, synchroniserStatutServeur } from '@/lib/prospection-repository';
import { syncAllProspections } from '@/lib/prospection-review';
import { ProspectionRead } from '@/lib/api-client';
import {
  listToutesTraitementsLocal,
  listReprenableTraitements,
  getTraitement,
  DraftTraitementRow,
} from '@/lib/traitement-repository';
import { syncAllTraitements } from '@/lib/traitement-sync';
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
  TRAITEMENT_INSIGNE_REPRISE,
  TRAITEMENT_SUBTYPE_BADGE_CONFIG,
  TYPE_BADGE_CONFIG,
} from '@/components/fiches/tokens';
import { statutFicheAffiche } from '@/lib/prospection-statut';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

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

/**
 * Pendant de `statutFicheAffiche` (prospection-statut.ts) pour un traitement —
 * même priorité (`statut_sync` d'abord), mais le domaine traitement ne connaît
 * que `'brouillon'`/`'validee'` (pas de vérifiée/en attente/rejetée) : la case
 * par défaut de `statutFicheAffiche` retomberait donc à tort sur « En attente »
 * pour un brouillon jamais synchronisé.
 */
function statutTraitementAffiche(traitement: DraftTraitementRow): string {
  if (traitement.statut_sync === 'echec') return 'echec_synchro';
  if (traitement.statut_sync !== 'synced') return 'a_synchro';
  return traitement.statut === 'validee' ? 'validee' : 'brouillon';
}

/** Cette clé de badge signale-t-elle une fiche encore à envoyer (#synchro-fiche-par-fiche) ? */
function estEncoreASynchroniser(cleBadge: string): boolean {
  return cleBadge === 'a_synchro' || cleBadge === 'echec_synchro';
}

interface FicheRow {
  id: string;
  filterKey: FilterKey;
  code: string;
  meta: string;
  typeBadge: BadgeStyle;
  subTypeBadge: BadgeStyle | null;
  /** #zone-a-reprendre-insigne : cf. `FicheCard.insigneBadge`. */
  insigneBadge?: BadgeStyle | null;
  statutBadge: BadgeStyle;
  date: string;
  onPress: () => void;
  /**
   * Non-null seulement pour une fiche encore « à synchro »/« échec envoi » —
   * le badge de statut devient alors le bouton qui synchronise CETTE fiche
   * seule, sans passer par l'écran Synchronisation (#synchro-fiche-par-fiche).
   */
  onSyncPress: (() => void) | null;
}

export default function FichesScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterKey, setFilterKey] = useState<FilterKey>('TOUS');
  const [draftsRecent, setDraftsRecent] = useState<DraftProspection[]>([]);
  const [validated, setValidated] = useState<ProspectionRead[]>([]);
  const [traitements, setTraitements] = useState<DraftTraitementRow[]>([]);
  // #zone-a-reprendre-insigne : ids des traitements déjà validés dont la
  // surface restante justifie une reprise (mêmes critères que
  // zones-a-reprendre.tsx) — sert uniquement à poser l'insigne « REPRISE
  // POSSIBLE » sur la carte de la fiche d'origine, purement informatif :
  // jamais critique, une lecture ratée se contente de ne pas l'afficher.
  const [reprenableIds, setReprenableIds] = useState<Set<string>>(new Set());
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
        runTask(() => listToutesTraitementsLocal(), {
          name: 'fiches.traitements',
          criticality: 'essential',
        }),
      ]);

      const [brouillons, validees, traitementsLus] = lectures;
      if (brouillons.ok) setDraftsRecent(brouillons.value.recent);
      if (validees?.ok) {
        setValidated(validees.value);
        // #liste-traitement-apres-validation : reporte le statut serveur
        // authentique en local — cf. commentaire équivalent dans
        // (app)/prospection.tsx, même correctif, même raison.
        await runTask(
          () =>
            synchroniserStatutServeur(
              validees.value.map((f) => ({ id: f.id, statut: f.statut, validated_at: f.validated_at ?? null }))
            ),
          { name: 'fiches.statut-serveur.persistance', criticality: 'best-effort' }
        );
      }
      if (traitementsLus?.ok) setTraitements(traitementsLus.value);

      // Une lecture ratée sur trois suffit à rendre la liste incomplète : la
      // taire ferait exactement le vide muet que ce ticket supprime.
      const ratee = lectures.find((l) => l !== null && !l.ok);
      setErreurDeLecture(ratee && !ratee.ok ? ratee.error : null);

      // #zone-a-reprendre-insigne : purement informatif (insigne), pas critique
      // — hors du `Promise.all` ci-dessus, jamais comptée dans `ratee`.
      const reprenables = await runTask(() => listReprenableTraitements(), {
        name: 'fiches.traitements.reprenables',
        criticality: 'best-effort',
      });
      if (reprenables.ok) setReprenableIds(new Set(reprenables.value.map((r) => r.id)));
    })();
  }, [user, token]);

  useFocusEffect(refresh);

  /**
   * Synchro d'une seule fiche depuis son badge « À SYNCHRO »/« ÉCHEC ENVOI »
   * (#synchro-fiche-par-fiche) : l'agent n'a plus besoin d'aller sur l'écran
   * Synchronisation pour renvoyer une fiche isolée.
   *
   * Une seule à la fois — `syncingIdRef` (lu à l'appel, pas dans les deps des
   * callbacks ci-dessous) bloque un second appui pendant qu'un envoi est en
   * cours, y compris sur une autre fiche.
   */
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncingIdRef = useRef<string | null>(null);
  const { run: runSync } = useAsyncAction();

  const demarrerSync = (id: string) => {
    syncingIdRef.current = id;
    setSyncingId(id);
  };
  const terminerSync = () => {
    syncingIdRef.current = null;
    setSyncingId(null);
  };

  const handleSyncProspection = useCallback(
    (draft: DraftProspection) => {
      if (syncingIdRef.current) return;
      demarrerSync(draft.id);
      void runSync(
        async () => {
          // Le lot résume, il ne lève pas (ADR-012 décision 9) : un lot d'une
          // seule fiche reste le même contrat, réutilisé tel quel plutôt que
          // réécrit (marquage échec/conflit compris, cf. sync-lot.ts).
          const resume = await syncAllProspections([draft], token!);
          if (resume.echouees.length > 0) {
            Alert.alert('Échec de synchronisation', resume.echouees[0].message);
          } else if (resume.conflits.length > 0) {
            Alert.alert(
              'Fiche modifiée sur le serveur',
              `${resume.conflits[0].label} a été modifiée ou validée sur le serveur. Votre version est conservée sur l'appareil.`
            );
          }
          refresh();
        },
        {
          screen: 'fiches',
          precondition: !!token,
          preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
          context: { prospectionId: draft.id },
        }
      ).finally(terminerSync);
    },
    [runSync, token, refresh]
  );

  const handleSyncTraitement = useCallback(
    (row: DraftTraitementRow) => {
      if (syncingIdRef.current) return;
      demarrerSync(row.id);
      void runSync(
        async () => {
          // `getTraitement` reconstruit la fiche complète (aerien/terrestre/
          // rotations/produits) — la ligne à plat ne suffit pas à
          // `syncOneTraitement` (même commentaire que sync.tsx).
          const complet = await getTraitement(row.id);
          if (!complet) {
            Alert.alert('Fiche introuvable', "Cette fiche n'existe plus sur cet appareil.");
            return;
          }
          const resume = await syncAllTraitements([complet], token!);
          if (resume.echouees.length > 0) {
            Alert.alert('Échec de synchronisation', resume.echouees[0].message);
          } else if (resume.conflits.length > 0) {
            Alert.alert(
              'Fiche modifiée sur le serveur',
              `${resume.conflits[0].label} a été modifiée ou validée sur le serveur. Votre version est conservée sur l'appareil.`
            );
          }
          refresh();
        },
        {
          screen: 'fiches',
          precondition: !!token,
          preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
          context: { traitementId: row.id },
        }
      ).finally(terminerSync);
    },
    [runSync, token, refresh]
  );

  const today = new Date();
  const decade = Math.ceil(today.getDate() / 10);
  const mois = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const periodeLabel = `Décade ${decade} · ${mois}`;

  const rows = useMemo<FicheRow[]>(() => {
    const validatedIds = new Set(validated.map((p) => p.id));

    const prospectionRows: FicheRow[] = draftsRecent
      .filter((draft) => !validatedIds.has(draft.id))
      .map((draft) => {
        const cleBadge = statutFicheAffiche(draft.statut, draft.statut_sync);
        return {
          id: draft.id,
          filterKey: 'PROSPECTION',
          code: draft.n_fiche ?? 'Fiche sans numéro',
          meta: `${stationLabel(draft)} · ${draft.date_prospection}`,
          typeBadge: TYPE_BADGE_CONFIG.PROSPECTION,
          subTypeBadge: PROSPECTION_SUBTYPE_BADGE_CONFIG[draft.type_prospection] ?? null,
          statutBadge: STATUT_BADGE_CONFIG[cleBadge] ?? STATUT_BADGE_CONFIG.brouillon,
          date: draft.date_prospection,
          onPress: () => navigateToProspectionDraft(router, hydrateFromDraft, draft),
          onSyncPress: estEncoreASynchroniser(cleBadge) ? () => handleSyncProspection(draft) : null,
        };
      });

    // Déjà connue du serveur (`statut_sync` forcé à 'synced' ici) : jamais
    // « à synchro », donc jamais de bouton de synchro sur ces lignes.
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
      onSyncPress: null,
    }));

    const traitementRows: FicheRow[] = traitements.map((traitement) => {
      const cleBadge = statutTraitementAffiche(traitement);
      return {
        id: traitement.id,
        filterKey: 'CRT',
        code: traitement.numero_fiche ?? 'Fiche sans numéro',
        meta: `${traitement.localite ?? 'Localité inconnue'} · ${traitement.date_traitement ?? '—'}`,
        typeBadge: TYPE_BADGE_CONFIG.CRT,
        subTypeBadge: TRAITEMENT_SUBTYPE_BADGE_CONFIG[traitement.type_traitement] ?? null,
        insigneBadge: reprenableIds.has(traitement.id) ? TRAITEMENT_INSIGNE_REPRISE : null,
        statutBadge: STATUT_BADGE_CONFIG[cleBadge] ?? STATUT_BADGE_CONFIG.brouillon,
        date: traitement.date_traitement ?? traitement.updated_at,
        onPress: () =>
          navigateToTraitement(router, traitement, { validationView: traitement.statut === 'validee' }),
        onSyncPress: estEncoreASynchroniser(cleBadge) ? () => handleSyncTraitement(traitement) : null,
      };
    });

    return [...prospectionRows, ...validatedRows, ...traitementRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [draftsRecent, validated, traitements, reprenableIds, router, hydrateFromDraft, handleSyncProspection, handleSyncTraitement]);

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
            insigneBadge={item.insigneBadge}
            statutBadge={item.statutBadge}
            meta={item.meta}
            onPress={item.onPress}
            onSyncPress={item.onSyncPress ?? undefined}
            syncing={syncingId === item.id}
            syncDisabled={syncingId !== null && syncingId !== item.id}
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

const BASE_TYPE_SIZES = {
  backIcon: 22,
  headerTitle: 18,
  headerSub: 12,
  resultCount: 13,
  emptyIcon: 48,
  emptyTitle: 18,
  emptySub: 14,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>, theme: ThemePalette) {
  return StyleSheet.create({
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
      fontSize: typeSizes.backIcon,
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
      fontSize: typeSizes.headerTitle,
      fontWeight: '700',
    },
    headerSub: {
      color: '#FFFFFFAA',
      fontSize: typeSizes.headerSub,
      marginTop: 1,
    },
    headerRight: {
      width: 32,
    },
    resultCountContainer: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.inputBg,
    },
    resultCount: {
      fontSize: typeSizes.resultCount,
      color: theme.muted,
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
      fontSize: typeSizes.emptyIcon,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: typeSizes.emptyTitle,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    emptySub: {
      fontSize: typeSizes.emptySub,
      color: theme.muted,
      textAlign: 'center',
    },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
