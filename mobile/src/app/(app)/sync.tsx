import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { pullReferentiel, resetReferentielSyncCursors } from '@/lib/referentiel-sync';
import { compterReferentielLocal, EtatTableReferentiel } from '@/lib/referentiel-db';
import { loadAccueilData, AccueilViewModel } from '@/lib/prospection-accueil';
import { syncAllProspections } from '@/lib/prospection-review';
import { DraftProspection } from '@/lib/prospection-repository';
import {
  DraftTraitementRow,
  getTraitement,
  listToutesTraitementsLocal,
} from '@/lib/traitement-repository';
import { syncAllTraitements } from '@/lib/traitement-sync';
import { TRAITEMENT_SUBTYPE_BADGE_CONFIG } from '@/components/fiches/tokens';
import {
  LIBELLE_STATUT_FICHE,
  estDansLaFile,
  estToutParti,
  resumerEnPhrase,
  statutFicheDe,
  type ResumeSync,
  type StatutFiche,
} from '@/lib/sync-lot';
import { LIBELLE_ACTION, toFriendlyError, type ActionErreur } from '@/lib/friendly-error';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, draftsCount: 0, recent: [], validated: [], pendingSync: [] };

/**
 * Le badge d'état d'une fiche. Sa valeur vient de `statut_sync`, en base : il
 * **survit au départ de l'écran**, contrairement au `useState` d'avant qui
 * repartait de zéro à chaque retour sur l'onglet (ADR-012 décision 9, #177).
 */
const STYLE_STATUT: Record<StatutFiche, { icone: string; couleur: string }> = {
  'en-attente': { icone: '⏳', couleur: '#D97706' },
  echec: { icone: '❌', couleur: '#B91C1C' },
  conflit: { icone: '⚠️', couleur: '#B45309' },
  synchronisee: { icone: '✅', couleur: '#15803D' },
};

export default function SyncScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  // Domaine « traitement » (#erreur-sync-fiche-introuvable) — absent de cet
  // écran jusqu'ici : ni affiché, ni envoyé par le bouton « Synchroniser »,
  // d'où une fiche de traitement complète signalée indéfiniment « Aucune
  // fiche à synchroniser ».
  const [traitements, setTraitements] = useState<DraftTraitementRow[]>([]);
  const [resume, setResume] = useState<ResumeSync | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [referentielError, setReferentielError] = useState<string | null>(null);
  const [etatReferentiel, setEtatReferentiel] = useState<EtatTableReferentiel[]>([]);

  const signalerChargement = useSignalerChargement('sync');
  // `isRunning` remplace l'ancien `isSyncing` : un seul état, remis à zéro par
  // le hook même si l'action lève — le `finally` maison ne pouvait pas mieux.
  const { run, isRunning: isSyncing } = useAsyncAction();

  const refresh = useCallback(() => {
    void loadAccueilData().then(setData).catch((error) => signalerChargement(error));
    void listToutesTraitementsLocal().then(setTraitements).catch((error) => signalerChargement(error));
    // « Synchro réussie » ne dit pas ce qui a atterri : on montre le contenu réel.
    void compterReferentielLocal()
      .then(setEtatReferentiel)
      .catch((error) => signalerChargement(error));
  }, [signalerChargement]);

  useFocusEffect(refresh);

  // Fiches complétées localement mais pas encore confirmées côté serveur (cf. prospection.tsx).
  // `statut !== 'brouillon'` et non `statut === 'en_attente'` (#revalidation-
  // validation-jamais-synchronisee, cf. listUnsyncedProspections) : une fiche
  // `type_prospection = 'validation'` (signalisation, y compris sa
  // revalidation) passe directement de 'brouillon' à 'validee', sans jamais
  // transiter par 'en_attente' — le filtre précédent la faisait disparaître de
  // cette liste et du bouton « Synchroniser » qui s'appuie dessus.
  const pendingFiches = data.recent.filter(
    (item) => item.statut !== 'brouillon' && item.statut_sync !== 'synced'
  );
  const syncedFiches = data.recent.filter((item) => item.statut_sync === 'synced');

  // Pendant du filtrage ci-dessus, côté traitement — sans le filtre
  // `statut === 'en_attente'` : une fiche de traitement reste `'brouillon'`
  // jusqu'à son premier envoi réussi (cf. listUnsyncedTraitements), donc
  // l'exiger ici l'aurait rendue hors de portée de toute synchronisation.
  const pendingTraitements = traitements.filter((item) => item.statut_sync !== 'synced');
  const syncedTraitements = traitements.filter((item) => item.statut_sync === 'synced');

  const stats = {
    total: data.recent.length + traitements.length,
    pending: pendingFiches.length + pendingTraitements.length,
    synced: syncedFiches.length + syncedTraitements.length,
  };

  /**
   * Le lot à envoyer, et rien d'autre.
   *
   * Une fiche en `'echec'` est **sortie de la file** : le serveur l'a refusée,
   * la renvoyer à l'identique produirait le même refus. Elle reste visible avec
   * son badge, et ne repart que par le bouton dédié.
   *
   * Les deux listes se lisent en base — pas dans le résumé du dernier envoi :
   * c'est ce qui permet au « Réessayer les N en échec » d'être encore là quand
   * l'agent revient sur l'écran.
   */
  const aEnvoyer = pendingFiches.filter((item) => estDansLaFile(item.statut_sync));
  const enEchec = pendingFiches.filter((item) => statutFicheDe(item.statut_sync) === 'echec');
  const aEnvoyerTraitements = pendingTraitements.filter((item) => estDansLaFile(item.statut_sync));
  const enEchecTraitements = pendingTraitements.filter(
    (item) => statutFicheDe(item.statut_sync) === 'echec'
  );

  const synchroniser = (drafts: DraftProspection[], draftsTraitements: DraftTraitementRow[] = []) =>
    run(
      async () => {
        setReferentielError(null);
        setResume(null);

        try {
          // Un pull incrémental (curseur par table) ne redemande que ce qui a
          // changé depuis le dernier succès — si une table locale contient déjà
          // des lignes mais qu'il en manque une partie (ex: un espece/sexe/
          // catégorie jamais reçu), le garde-fou #201 ("table vide -> full
          // pull") ne se déclenche pas et ces lignes ne reviennent jamais. Le
          // bouton "Synchroniser" doit tenir la promesse du message "Stades
          // indisponibles hors ligne" (cf. intensive-imagos.tsx/intensive-
          // larves.tsx) : reset les curseurs pour forcer un pull complet, comme
          // le fait déjà "Forcer une resynchronisation complète" (profile.tsx).
          await resetReferentielSyncCursors();
          await pullReferentiel(token!);
        } catch (error) {
          logger.failure('sync.referentiel.failed', error);
          // Le message technique brut ne s'affiche jamais (décision 2).
          setReferentielError(toFriendlyError(error).message);
        }

        // `getTraitement` reconstruit la fiche complète (aerien/terrestre/
        // rotations/produits) — `listToutesTraitementsLocal` ne rend que la
        // ligne à plat, insuffisante pour `syncOneTraitement` (cf. traitement-sync.ts).
        const traitementsComplets = (
          await Promise.all(draftsTraitements.map((row) => getTraitement(row.id)))
        ).filter((t): t is NonNullable<typeof t> => t !== null);

        // `syncAll` ne lève pas : un lot partiellement parti est un état du
        // terrain, pas une erreur. L'`Alert` modale qui l'annonçait
        // interrompait l'agent pour lui dire « réessayez » sans lui dire quoi
        // (ADR-012 décision 9). Les deux domaines sont indépendants — un échec
        // de lecture/synchronisation des traitements ne doit jamais empêcher
        // celle des prospections (et inversement, cf. use-fiches-auto-sync.ts).
        const resumeProspections = await syncAllProspections(drafts, token!);
        const resumeTraitements = await syncAllTraitements(traitementsComplets, token!);
        setResume({
          reussies: [...resumeProspections.reussies, ...resumeTraitements.reussies],
          echouees: [...resumeProspections.echouees, ...resumeTraitements.echouees],
          conflits: [...resumeProspections.conflits, ...resumeTraitements.conflits],
        });
        setLastSync(new Date());
        refresh();
      },
      {
        screen: 'sync',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
        context: { nbFiches: drafts.length + draftsTraitements.length },
      }
    );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadAccueilData()
      .then(setData)
      .catch((error) => signalerChargement(error))
      .finally(() => setRefreshing(false));
  }, [signalerChargement]);

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
        {resume && !isSyncing && (
          <View
            style={[
              styles.statusBanner,
              estToutParti(resume) ? styles.statusSuccess : styles.statusPartiel,
            ]}
          >
            <Text style={styles.statusBannerText}>{resumerEnPhrase(resume)}</Text>

            {/* Le motif par fiche, traduit par classe (#172) — jamais le message brut. */}
            {resume.echouees.map((fiche) => (
              <Text key={fiche.id} style={styles.resumeLigne}>
                • {fiche.label} — {fiche.message}
                {fiche.action ? ` (${LIBELLE_ACTION[fiche.action as ActionErreur]})` : ''}
              </Text>
            ))}
            {resume.conflits.map((fiche) => (
              <Text key={fiche.id} style={styles.resumeLigne}>
                • {fiche.label} — modifiée sur le serveur. Votre version est conservée sur
                l’appareil.
              </Text>
            ))}

          </View>
        )}

        {/*
          Hors de la bannière du dernier envoi, et volontairement : `enEchec` se
          lit en base, donc le retry ciblé est encore là quand l'agent revient
          sur l'écran — alors qu'un bouton rendu depuis `resume` disparaîtrait
          avec lui (#177, « Réessayer les N en échec »).
        */}
        {(enEchec.length > 0 || enEchecTraitements.length > 0) && !isSyncing && (
          <TouchableOpacity
            style={styles.retryCible}
            onPress={() => void synchroniser(enEchec, enEchecTraitements)}
            activeOpacity={0.85}
          >
            <Text style={styles.retryCibleText}>
              Réessayer{' '}
              {enEchec.length + enEchecTraitements.length === 1
                ? 'la fiche'
                : `les ${enEchec.length + enEchecTraitements.length} fiches`}{' '}
              en échec
            </Text>
          </TouchableOpacity>
        )}
        {referentielError && (
          <View style={[styles.statusBanner, styles.statusError]}>
            <Text style={styles.statusBannerText}>❌ Référentiel : {referentielError}</Text>
          </View>
        )}

        {/* Contenu réel du référentiel local — une table vide se voit ici. */}
        {etatReferentiel.length > 0 && (
          <View style={styles.referentielEtat}>
            <Text style={styles.referentielEtatTitre}>Référentiel sur cet appareil</Text>
            {etatReferentiel.map(({ table, lignes }) => (
              <View key={table} style={styles.referentielEtatLigne}>
                <Text style={styles.referentielEtatTable}>{table}</Text>
                <Text
                  style={[
                    styles.referentielEtatNombre,
                    lignes === 0 && styles.referentielEtatVide,
                  ]}
                >
                  {lignes === 0 ? 'vide' : lignes}
                </Text>
              </View>
            ))}
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

        {/* Liste des fiches à synchroniser — prospection ET traitement (#erreur-sync-fiche-introuvable) */}
        <View style={styles.syncListContainer}>
          <View style={styles.syncListHeader}>
            <Text style={styles.syncListTitle}>Fiches en attente</Text>
            <Text style={styles.syncListCount}>{pendingFiches.length + pendingTraitements.length}</Text>
          </View>

          {pendingFiches.length === 0 && pendingTraitements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune fiche en attente</Text>
              <Text style={styles.emptySub}>Toutes vos fiches sont synchronisées</Text>
            </View>
          ) : (
            <>
              {pendingFiches.map((draft) => {
                const statut = statutFicheDe(draft.statut_sync);
                const { icone, couleur } = STYLE_STATUT[statut];
                return (
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
                      <Text style={[styles.syncItemStatus, { color: couleur }]}>{icone}</Text>
                      <Text style={[styles.syncItemStatusLabel, { color: couleur }]}>
                        {LIBELLE_STATUT_FICHE[statut]}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {pendingTraitements.map((draft) => {
                const statut = statutFicheDe(draft.statut_sync);
                const { icone, couleur } = STYLE_STATUT[statut];
                const badge = TRAITEMENT_SUBTYPE_BADGE_CONFIG[draft.type_traitement];
                return (
                  <View key={draft.id} style={styles.syncItem}>
                    <View style={styles.syncItemLeft}>
                      <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.typeBadgeText, { color: badge.color }]}>
                          {badge.icon} {badge.label}
                        </Text>
                      </View>
                      <View style={styles.syncItemInfo}>
                        <Text style={styles.syncItemCode}>{draft.numero_fiche ?? '—'}</Text>
                        <Text style={styles.syncItemDate}>{draft.date_traitement ?? '—'}</Text>
                      </View>
                    </View>
                    <View style={styles.syncItemRight}>
                      <Text style={[styles.syncItemStatus, { color: couleur }]}>{icone}</Text>
                      <Text style={[styles.syncItemStatusLabel, { color: couleur }]}>
                        {LIBELLE_STATUT_FICHE[statut]}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Bouton de synchronisation */}
        {/*
          Le bouton reste actif sans fiche en attente : il tire aussi le
          référentiel, et le désactiver rendrait cette mise à jour impossible
          tant qu'il n'y a rien à envoyer.
        */}
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={() => void synchroniser(aEnvoyer, aEnvoyerTraitements)}
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
              {aEnvoyer.length + aEnvoyerTraitements.length > 0
                ? `🔄 Synchroniser (${aEnvoyer.length + aEnvoyerTraitements.length})`
                : '🔄 Mettre à jour le référentiel'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  backIcon: 22,
  headerTitle: isSmallScreen ? 16 : 18,
  headerSub: isSmallScreen ? 10 : 12,
  statNumber: isSmallScreen ? 18 : 20,
  statLabel: isSmallScreen ? 10 : 11,
  progressLabel: 13,
  statusBannerText: isSmallScreen ? 14 : 15,
  resumeLigne: isSmallScreen ? 13 : 14,
  retryCibleText: 13,
  referentielEtatTitre: isSmallScreen ? 13 : 14,
  referentielEtatTable: isSmallScreen ? 13 : 14,
  referentielEtatNombre: isSmallScreen ? 13 : 14,
  lastSyncText: isSmallScreen ? 12 : 13,
  syncListTitle: 14,
  syncListCount: 12,
  typeBadgeText: isSmallScreen ? 10 : 11,
  syncItemCode: isSmallScreen ? 13 : 14,
  syncItemDate: isSmallScreen ? 11 : 12,
  syncItemStatus: 16,
  syncItemStatusLabel: isSmallScreen ? 10 : 11,
  emptyIcon: 40,
  emptyTitle: 16,
  emptySub: 13,
  syncButtonText: isSmallScreen ? 14 : 15,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
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
      fontSize: typeSizes.statNumber,
      fontWeight: '700',
      color: '#111827',
    },
    statLabel: {
      fontSize: typeSizes.statLabel,
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
      fontSize: typeSizes.progressLabel,
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
    /** Partiel ≠ échec : l'ambre dit « à finir », le rouge disait « c'est cassé ». */
    statusPartiel: {
      backgroundColor: '#FEF3C7',
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    statusBannerText: {
      fontSize: typeSizes.statusBannerText,
      fontWeight: '600',
      textAlign: 'center',
      color: '#111827',
    },
    // #lisibilite-terrain-sync : le motif exact du serveur (souvent une longue
    // phrase technique, cf. resumeLigne) doit rester lisible en plein soleil —
    // même bascule que fieldLabel dans intensive-imagos.tsx (9.5→11), ici sur un
    // texte encore plus consulté (l'écran de synchronisation).
    resumeLigne: {
      fontSize: typeSizes.resumeLigne,
      color: '#374151',
      marginTop: 6,
      lineHeight: isSmallScreen ? 19 : 20,
    },
    retryCible: {
      marginBottom: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D97706',
      alignItems: 'center',
    },
    retryCibleText: {
      fontSize: typeSizes.retryCibleText,
      fontWeight: '700',
      color: '#B45309',
    },
    referentielEtat: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      backgroundColor: '#fff',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#e7e0cd',
    },
    // #lisibilite-terrain-sync : même bascule que resumeLigne ci-dessus — ce
    // bloc (compteurs par table de référentiel) était le plus petit texte de
    // l'écran (11.5px, gris) alors qu'il sert justement à diagnostiquer un
    // référentiel manquant sur le terrain.
    referentielEtatTitre: {
      fontSize: typeSizes.referentielEtatTitre,
      fontWeight: '800',
      color: IFVM_GREEN,
      marginBottom: 6,
    },
    referentielEtatLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    referentielEtatTable: { fontSize: typeSizes.referentielEtatTable, color: '#6f6a59' },
    referentielEtatNombre: { fontSize: typeSizes.referentielEtatNombre, fontWeight: '700', color: '#16201a' },
    referentielEtatVide: { color: '#c0412b' },
    lastSyncContainer: {
      marginBottom: 16,
      alignItems: 'center',
    },
    lastSyncText: {
      fontSize: typeSizes.lastSyncText,
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
      fontSize: typeSizes.syncListTitle,
      fontWeight: '600',
      color: '#111827',
    },
    syncListCount: {
      fontSize: typeSizes.syncListCount,
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
    // #lisibilite-terrain-sync : « Fiches en attente » — badge/date/statut
    // tombaient jusqu'à 9px, illisibles en plein soleil (même raison que
    // resumeLigne/referentielEtat* ci-dessus).
    typeBadgeText: {
      fontSize: typeSizes.typeBadgeText,
      fontWeight: '700',
    },
    syncItemInfo: {
      flex: 1,
    },
    syncItemCode: {
      fontSize: typeSizes.syncItemCode,
      fontWeight: '600',
      color: '#111827',
    },
    syncItemDate: {
      fontSize: typeSizes.syncItemDate,
      color: '#9CA3AF',
      marginTop: 1,
    },
    syncItemRight: {
      alignItems: 'flex-end',
    },
    syncItemStatus: {
      fontSize: typeSizes.syncItemStatus,
    },
    syncItemStatusLabel: {
      fontSize: typeSizes.syncItemStatusLabel,
      fontWeight: '600',
      marginTop: 2,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 30,
    },
    emptyIcon: {
      fontSize: typeSizes.emptyIcon,
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: typeSizes.emptyTitle,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 4,
    },
    emptySub: {
      fontSize: typeSizes.emptySub,
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
      fontSize: typeSizes.syncButtonText,
      fontWeight: '600',
    },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
