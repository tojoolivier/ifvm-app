import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { useAuthStore } from '@/lib/auth-store';
import { loadAccueilData, loadMesProspectionsServeur, deleteDraftProspection, AccueilViewModel } from '@/lib/prospection-accueil';
import { syncAllProspections } from '@/lib/prospection-review';
import { estToutParti, resumerEnPhrase } from '@/lib/sync-lot';
import { DraftProspection } from '@/lib/prospection-repository';
import { ProspectionRead } from '@/lib/api-client';
import { navigateToProspectionConsult, navigateToProspectionDraft } from '@/lib/fiche-routing';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { runTask } from '@/lib/run-task';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FicheCard } from '@/components/fiches/FicheCard';
import { SearchAndFilterBar, FilterOption } from '@/components/fiches/SearchAndFilterBar';
import {
  FICHES_GREEN_DARK,
  FICHES_ORANGE,
  PROSPECTION_SUBTYPE_BADGE_CONFIG,
  STATUT_BADGE_CONFIG,
} from '@/components/fiches/tokens';
import { statutFicheAffiche, StatutFicheAffiche } from '@/lib/prospection-statut';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, recent: [], validated: [], pendingSync: [] };

type BadgeKind = StatutFicheAffiche;
type FilterKey = 'TOUS' | StatutFicheAffiche;

const FILTERS: FilterOption<FilterKey>[] = [
  { value: 'TOUS', label: 'Toutes' },
  { value: 'a_synchro', label: 'À synchro' },
  { value: 'echec_synchro', label: 'Échec envoi' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'verifiee', label: 'Vérifiées' },
  { value: 'validee', label: 'Validées' },
  { value: 'rejetee', label: 'Rejetées' },
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

interface FicheListItem {
  id: string;
  title: string;
  nFiche: string | null;
  date: string;
  badge: BadgeKind;
  typeProspection: string;
  onPress?: () => void;
  draft: DraftProspection | null;
}

export default function ProspectionScreen() {
  const router = useRouter();
  const { justSaved, syncWarning } = useLocalSearchParams<{ justSaved?: string; syncWarning?: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { run: runSyncAll, isRunning: isSyncingAll } = useAsyncAction();
  const [syncToast, setSyncToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKey, setFilterKey] = useState<FilterKey>('TOUS');
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const { run: runDelete } = useAsyncAction();
  const { run: runNavigate } = useAsyncAction();

  /*
   * Trois `.then()` sans `.catch()` flottaient ici. Tant que
   * `loadValidatedProspections` avalait ses échecs, ça ne se voyait pas ; elle
   * les propage désormais typés (#173), et #160 a établi qu'aucun filet global
   * ne les rattraperait en release. `runTask` est la frontière prévue pour ça :
   * elle ne rejette jamais et laisse une trace dans le journal.
   *
   * L'affichage de ces échecs à l'agent reste à faire — c'est #174.
   */
  const refresh = useCallback(() => {
    void (async () => {
      const accueil = await runTask(() => loadAccueilData(), {
        name: 'prospection.accueil',
        criticality: 'essential',
      });
      if (accueil.ok) setData(accueil.value);

      if (user && token) {
        const fichesServeur = await runTask(() => loadMesProspectionsServeur(token, user.id), {
          name: 'prospection.statut-serveur',
          criticality: 'essential',
        });
        if (fichesServeur.ok) {
          // Le champ historique `validated` contient désormais les fiches du
          // serveur, tous statuts confondus. Cela évite un changement de
          // schéma local tout en faisant primer l'état de revue officiel.
          setData((current) => ({ ...current, validated: fichesServeur.value }));
        }
      }

      // `best-effort` : ne pas connaître l'état du réseau n'empêche aucune
      // saisie, et l'app est offline-first.
      const reseau = await runTask(() => Network.getNetworkStateAsync(), {
        name: 'prospection.reseau',
        criticality: 'best-effort',
      });
      if (reseau.ok) {
        setIsOffline(!(reseau.value.isConnected && reseau.value.isInternetReachable));
      }
    })();
  }, [user, token]);

  useFocusEffect(refresh);

  useEffect(() => {
    if (justSaved !== '1') return;
    router.setParams({ justSaved: undefined });
    const showTimeout = setTimeout(() => setShowSavedToast(true), 0);
    const hideTimeout = setTimeout(() => setShowSavedToast(false), 3000);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [justSaved, router]);

  useEffect(() => {
    if (!syncWarning) return;
    router.setParams({ syncWarning: undefined });
    const showTimeout = setTimeout(
      () =>
        setSyncToast({
          type: 'error',
          message: `Fiche enregistrée localement — échec de synchronisation : ${syncWarning}`,
        }),
      0
    );
    const hideTimeout = setTimeout(() => setSyncToast(null), 6000);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [syncWarning, router]);

  const resumeDraft = (draft: DraftProspection) =>
    runNavigate(
      () => navigateToProspectionDraft(router, hydrateFromDraft, draft),
      { screen: 'prospection', context: { draftId: draft.id } }
    );

  const openFicheLecture = (prospection: ProspectionRead) => {
    navigateToProspectionConsult(router, prospection);
  };

  const items = useMemo<FicheListItem[]>(() => {
    const serverIds = new Set(data.validated.map((item) => item.id));
    const draftItems: FicheListItem[] = data.recent
      .filter((item) => !serverIds.has(item.id))
      .map((item) => ({
      id: item.id,
      title: stationLabel(item),
      nFiche: item.n_fiche,
      date: item.date_prospection,
      badge: statutFicheAffiche(item.statut, item.statut_sync),
      typeProspection: item.type_prospection,
      onPress: () => resumeDraft(item),
      draft: item.statut === 'brouillon' ? item : null,
    }));
    const serverItems: FicheListItem[] = data.validated.map((item) => ({
      id: item.id,
      title: stationLabel(item),
      nFiche: item.n_fiche,
      date: item.date_prospection,
      badge: statutFicheAffiche(item.statut, 'synced'),
      typeProspection: item.type_prospection,
      onPress: () => openFicheLecture(item),
      draft: null,
    }));
    return [...draftItems, ...serverItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.recent, data.validated]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nFiche && item.nFiche.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFilter = filterKey === 'TOUS' || item.badge === filterKey;
      return matchSearch && matchFilter;
    });
  }, [items, searchQuery, filterKey]);

  // File d'envoi réelle (#synchronisation-automatique) — distincte de
  // `data.recent`, plafonné à 20 fiches pour l'affichage : une fiche en
  // attente au-delà de ces 20 ne doit jamais être exclue d'une
  // synchronisation. Déjà filtrée par `loadAccueilData` (statut = 'en_attente',
  // hors 'echec' — le serveur a refusé ces dernières, les renvoyer à
  // l'identique reproduirait le refus ; elles se relancent depuis l'écran de
  // synchronisation, qui montre leur motif, #177).
  const pendingSync = data.pendingSync;

  const handleNewProspection = () => {
    router.push('/(prospection)/type-chooser' as any);
  };

  const handleSyncAll = () =>
    runSyncAll(
      async () => {
        // Le lot résume, il ne lève pas : la boucle `try/catch` qui concaténait
        // des chaînes est devenue `syncAll` (ADR-012 décision 9, #177).
        const resume = await syncAllProspections(pendingSync, token!);

        setSyncToast({
          type: estToutParti(resume) ? 'success' : 'error',
          message: resumerEnPhrase(resume),
        });
        refresh();
        setTimeout(() => setSyncToast(null), 6000);
      },
      {
        screen: 'prospection',
        precondition: !!token && pendingSync.length > 0,
        preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
        context: { pendingCount: pendingSync.length },
      }
    );

  const handleDelete = (draft: DraftProspection) => {
    Alert.alert(
      'Supprimer la fiche ?',
      'Cette fiche brouillon sera définitivement supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            runDelete(
              async () => {
                await deleteDraftProspection(draft);
                refresh();
              },
              { screen: 'prospection', context: { draftId: draft.id } }
            ),
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          {isOffline && (
            <View style={styles.offlineRow}>
              <Text style={styles.offlineText}>⚠ Hors-ligne</Text>
            </View>
          )}
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Image
                source={require('../../../assets/images/logo-ifvm.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Mes prospections</Text>
              {/* TODO: remplacer par le vrai poste avancé une fois exposé sur le profil utilisateur */}
              <Text style={styles.headerSub}>
                {user?.nom} {user?.prenom?.charAt(0)}. · Poste avancé
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher une prospection..."
        filters={FILTERS}
        activeFilter={filterKey}
        onFilterChange={setFilterKey}
      />

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {showSavedToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Fiche enregistrée hors-ligne</Text>
          </View>
        )}

        {syncToast && (
          <View style={[styles.toast, syncToast.type === 'error' && styles.toastError]}>
            <Text style={[styles.toastText, syncToast.type === 'error' && styles.toastTextError]}>
              {syncToast.message}
            </Text>
          </View>
        )}

        {data.unsyncedCount > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>☁</Text>
            <Text style={styles.bannerText}>
              <Text style={styles.bannerTextStrong}>{data.unsyncedCount} fiche{data.unsyncedCount > 1 ? 's' : ''}</Text>
              {' '}en attente de synchronisation
            </Text>
            {pendingSync.length > 0 && (
              <TouchableOpacity
                style={[styles.bannerSyncButton, isSyncingAll && styles.btnDisabled]}
                onPress={handleSyncAll}
                activeOpacity={0.85}
                disabled={isSyncingAll}
              >
                <Text style={styles.bannerSyncButtonText}>
                  {isSyncingAll ? 'Synchro…' : '↻ Synchroniser'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {data.activeDraft && (
          <TouchableOpacity
            style={styles.draftCard}
            onPress={() => resumeDraft(data.activeDraft as DraftProspection)}
            activeOpacity={0.85}
          >
            <Text style={styles.draftLabel}>Reprendre le brouillon</Text>
            <Text style={styles.draftTitle}>
              {stationLabel(data.activeDraft)} · {data.activeDraft.date_prospection}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.list}>
          {filteredItems.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery || filterKey !== 'TOUS'
                ? 'Aucune fiche ne correspond à votre recherche.'
                : 'Aucune fiche de prospection pour le moment.'}
            </Text>
          ) : (
            filteredItems.map((item) => {
              const card = (
                <FicheCard
                  code={`N°${item.nFiche ?? '—'}`}
                  typeBadge={PROSPECTION_SUBTYPE_BADGE_CONFIG[item.typeProspection] ?? PROSPECTION_SUBTYPE_BADGE_CONFIG.intensive}
                  statutBadge={STATUT_BADGE_CONFIG[item.badge]}
                  meta={`${item.title} · ${item.date}`}
                  onPress={item.onPress ?? (() => {})}
                />
              );

              if (!item.draft) {
                return <View key={item.id}>{card}</View>;
              }

              const draft = item.draft;
              return (
                <Swipeable
                  key={item.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.deleteAction}
                      onPress={() => handleDelete(draft)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.deleteActionText}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                >
                  {card}
                </Swipeable>
              );
            })
          )}
        </View>

      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={styles.btnNouvelle}
          onPress={handleNewProspection}
          activeOpacity={0.85}
        >
          <Text style={styles.btnNouvelleText}>+ Nouvelle prospection</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: FICHES_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 22 },
  offlineRow: { paddingTop: 8 },
  offlineText: { color: '#FFD27A', fontSize: 12, fontWeight: '700' },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  logo: { width: 40, height: 40, borderRadius: 8 },
  headerTextContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#FFFFFFAA', fontSize: 12, marginTop: 1 },
  content: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 14,
    marginTop: -22,
    marginBottom: 16,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { flex: 1, color: '#8A5A00', fontSize: 13 },
  bannerTextStrong: { fontWeight: '700' },
  bannerSyncButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bannerSyncButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  toast: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  toastText: { color: '#15803d', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  toastError: { backgroundColor: '#FEE2E2' },
  toastTextError: { color: '#DC2626' },
  draftCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  draftLabel: { color: '#15803d', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  draftTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  list: { gap: 8, marginBottom: 20 },
  emptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  deleteAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 10,
    marginLeft: 8,
  },
  deleteActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  footer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  btnNouvelle: {
    backgroundColor: FICHES_ORANGE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnNouvelleText: { color: '#3D2200', fontSize: 15, fontWeight: '700' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
