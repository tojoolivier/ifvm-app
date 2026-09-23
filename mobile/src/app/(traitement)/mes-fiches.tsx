import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listDraftTraitements, deleteDraftTraitement, DraftTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { useAsyncAction } from '@/hooks/use-async-action';
import { navigateToTraitement } from '@/lib/fiche-routing';
import { EtatVide } from '@/components/erreurs/etat-vide';

/**
 * Écran "Mes fiches" (traitement) — brouillons locaux (`listDraftTraitements`),
 * sur son propre écran plutôt qu'en liste dépliée sur `select.tsx` (#liste-
 * mes-fiches-melangee-boutons) : la liste apparaissait auparavant mélangée
 * aux boutons Nouveau traitement / Mes fiches / Zones à reprendre sur le
 * même écran, au lieu de vivre dans "Mes fiches" comme les deux autres
 * boutons vivent déjà chacun dans leur propre écran.
 */
export default function TraitementMesFichesScreen() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftTraitementRow[]>([]);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const { run: runDelete } = useAsyncAction();
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  const charger = useCallback(() => {
    void runTask(() => listDraftTraitements(), {
      name: 'traitement.mesFiches',
      criticality: 'essential',
    }).then((outcome) => {
      setErreurDeLecture(outcome.ok ? null : outcome.error);
      if (outcome.ok) setDrafts(outcome.value);
    });
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Éditable slide par slide tant que la fiche n'est pas encore validée
   * (#traitement-brouillon-editable-avant-sync) : cet écran ne liste que des
   * fiches `statut = 'brouillon'` (`listDraftTraitements`), mais figer
   * `isValidationView` à `'1'` sans condition rendait toute fiche rouverte
   * ici en lecture seule dès le premier enregistrement local — impossible de
   * vérifier ni corriger quoi que ce soit avant sa synchronisation, y
   * compris une fiche jamais encore envoyée au serveur. Même politique que
   * `navigateToTraitement` sur l'écran « Mes fiches » global (fiches.tsx) :
   * lecture seule seulement une fois `statut === 'validee'` (verrouillée
   * côté serveur), éditable tant que ce n'est pas le cas — y compris le cas
   * limite où la synchronisation a réussi mais la validation serveur a
   * échoué juste après (`recap.tsx`, `validerEtVerrouillerSurServeur`),
   * laissant la fiche `statut_sync = 'synced'` mais encore `'brouillon'`.
   */
  const openFiche = (draft: DraftTraitementRow) => {
    navigateToTraitement(router, draft, { validationView: draft.statut === 'validee' });
  };

  /**
   * Fiches restées bloquées « ÉCHEC ENVOI » sans espoir d'aboutir (brouillon
   * abandonné avec des champs obligatoires jamais remplis) : `deleteDraftTraitement`
   * refuse toute fiche déjà `'validee'` (même garde que `deleteDraftProspection`,
   * prospection.tsx), donc rien de connu du serveur ne peut être perdu par ce geste.
   */
  const handleDelete = (draft: DraftTraitementRow) => {
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
                await deleteDraftTraitement(draft);
                charger();
              },
              { screen: 'traitement.mesFiches', context: { draftId: draft.id } }
            ),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mes fiches</Text>

      <FlatList
        style={styles.list}
        data={drafts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EtatVide erreur={erreurDeLecture} titreVide="Aucune fiche pour le moment." onReessayer={charger} />
        }
        renderItem={({ item }) => {
          const row = (
            <TouchableOpacity style={styles.row} onPress={() => openFiche(item)}>
              <Text style={styles.rowTitle}>{item.numero_fiche ?? 'généré à l’enregistrement'}</Text>
              <Text style={styles.rowSubtitle}>
                {item.type_traitement} · {item.localite ?? 'localité non renseignée'}
              </Text>
            </TouchableOpacity>
          );

          // Swipe-to-delete réservé aux brouillons : une fiche déjà validée
          // n'est de toute façon pas supprimable (garde dans
          // `deleteDraftTraitement`) — autant ne pas proposer le geste.
          if (item.statut !== 'brouillon') return row;

          return (
            <Swipeable
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteActionText}>Supprimer</Text>
                </TouchableOpacity>
              )}
            >
              {row}
            </Swipeable>
          );
        }}
      />

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>‹ Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp, padding: 16, gap: 12 },
    title: {
      fontFamily: traitementFonts.uiExtraBold,
      fontSize: typeSizes.titreEcran,
      color: traitementColors.texteTitre,
    },
    list: { flex: 1 },
    row: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.carte,
      padding: 10,
      marginBottom: 8,
      gap: 2,
    },
    rowTitle: { fontFamily: traitementFonts.mono, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    rowSubtitle: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteSecondaire },
    deleteAction: {
      backgroundColor: '#DC2626',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      borderRadius: traitementRadii.carte,
      marginBottom: 8,
    },
    deleteActionText: { fontFamily: traitementFonts.uiBold, color: '#FFFFFF', fontSize: typeSizes.label },
    backLink: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: traitementColors.dashedBordure,
      borderRadius: traitementRadii.chip,
      padding: 10,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    backLinkText: { fontFamily: traitementFonts.uiMedium, color: traitementColors.texteSecondaire },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
