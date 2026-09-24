import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadAccueilData, deleteDraftProspection } from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';
import { navigateToProspectionDraft } from '@/lib/fiche-routing';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { runTask } from '@/lib/run-task';
import { FicheCard } from '@/components/fiches/FicheCard';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { FICHES_BG, FICHES_GREEN_DARK, FICHES_TEXT_SECONDARY, PROSPECTION_SUBTYPE_BADGE_CONFIG, STATUT_BADGE_CONFIG } from '@/components/fiches/tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

/**
 * #dossier-brouillons : « dossier » dédié aux fiches de prospection encore en
 * cours de saisie (intensive/extensive/validation confondues) — un brouillon
 * n'est par construction jamais envoyé à la synchronisation
 * (`listUnsyncedProspections` exclut `statut = 'brouillon'`) : cet écran ne
 * fait que lister ce que
 * `listDraftProspections` sait déjà filtrer, pour que l'agent puisse reprendre
 * N'IMPORTE LEQUEL de ses brouillons — pas seulement le plus récent (la seule
 * reprise possible jusqu'ici, depuis la carte « Reprendre le brouillon » de
 * l'accueil/Mes prospections, `AccueilViewModel.activeDraft`).
 *
 * Un brouillon disparaît naturellement de cet écran dès qu'il est terminé
 * (`completeProspection` fait passer son `statut` de `'brouillon'` à
 * `'en_attente'`/`'validee'`) — il devient alors une fiche prête à
 * synchroniser, visible sur « Mes fiches »/« Mes prospections ».
 */

/**
 * `station_id` est une clé du référentiel — jamais un nom à afficher, et de
 * toute façon absente pour l'extensif. `station_nom` (intensif, référentiel)
 * ou `station_libre` (extensif, saisie libre) sont les vrais noms lisibles ;
 * même fonction que (app)/prospection.tsx et (app)/fiches.tsx.
 */
function stationLabel(item: { station_nom?: string | null; station_libre?: string | null }): string {
  return item.station_nom || item.station_libre || 'Localité inconnue';
}

export default function BrouillonsScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const [drafts, setDrafts] = useState<DraftProspection[]>([]);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const { run: runDelete } = useAsyncAction();
  const { run: runNavigate } = useAsyncAction();

  /**
   * `loadAccueilData` (même source que (app)/prospection.tsx/(app)/fiches.tsx)
   * plutôt que `listDraftProspections` directement : une seule lecture locale
   * partagée, filtrée ici sur `statut === 'brouillon'` — cohérent avec la
   * façon dont ces deux écrans distinguent déjà un brouillon dans `recent`
   * (toutes fiches locales, tous statuts).
   */
  const refresh = useCallback(() => {
    void (async () => {
      const lecture = await runTask(() => loadAccueilData(), {
        name: 'brouillons.liste',
        criticality: 'essential',
      });
      if (lecture.ok) {
        setDrafts(lecture.value.recent.filter((item) => item.statut === 'brouillon'));
        setErreurDeLecture(null);
      } else {
        setErreurDeLecture(lecture.error);
      }
    })();
  }, []);

  useFocusEffect(refresh);

  const triesParDate = useMemo(
    () => [...drafts].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [drafts]
  );

  const resumeDraft = (draft: DraftProspection) =>
    runNavigate(
      () => navigateToProspectionDraft(router, hydrateFromDraft, draft),
      { screen: 'brouillons', context: { draftId: draft.id } }
    );

  const handleDelete = (draft: DraftProspection) => {
    Alert.alert(
      'Supprimer ce brouillon ?',
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
              { screen: 'brouillons', context: { draftId: draft.id } }
            ),
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Brouillons</Text>
        </View>
        <Text style={styles.subtitle}>
          Fiches en cours de saisie — jamais envoyées tant qu’elles ne sont pas terminées.
        </Text>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {triesParDate.length === 0 ? (
          <EtatVide
            erreur={erreurDeLecture}
            titreVide="Aucun brouillon en cours."
            sousTitreVide="Une fiche apparaît ici dès que vous commencez une prospection, et en disparaît dès qu'elle est terminée."
            onReessayer={refresh}
          />
        ) : (
          triesParDate.map((draft) => (
            <Swipeable
              key={draft.id}
              renderRightActions={() => (
                <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(draft)} activeOpacity={0.85}>
                  <Text style={styles.deleteActionText}>Supprimer</Text>
                </TouchableOpacity>
              )}
            >
              <FicheCard
                code={`N°${draft.n_fiche ?? draft.n_message ?? '—'}`}
                typeBadge={PROSPECTION_SUBTYPE_BADGE_CONFIG[draft.type_prospection] ?? PROSPECTION_SUBTYPE_BADGE_CONFIG.intensive}
                statutBadge={STATUT_BADGE_CONFIG.brouillon}
                meta={`${stationLabel(draft)} · ${draft.date_prospection}`}
                onPress={() => resumeDraft(draft)}
              />
            </Swipeable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  back: 22,
  title: 17,
  subtitle: 12,
  deleteActionText: 13,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>, theme: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: FICHES_BG },
    header: { backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
    back: { fontSize: typeSizes.back, fontWeight: '700', color: FICHES_TEXT_SECONDARY },
    title: { fontSize: typeSizes.title, fontWeight: '700', color: FICHES_GREEN_DARK },
    subtitle: { fontSize: typeSizes.subtitle, color: FICHES_TEXT_SECONDARY, paddingHorizontal: 16, paddingBottom: 12 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    deleteAction: {
      backgroundColor: '#DC2626',
      justifyContent: 'center',
      alignItems: 'center',
      width: 96,
      borderRadius: 12,
      marginBottom: 10,
    },
    deleteActionText: { color: '#fff', fontWeight: '700', fontSize: typeSizes.deleteActionText },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
