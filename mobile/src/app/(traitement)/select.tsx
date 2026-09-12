import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listDraftTraitements, deleteDraftTraitement, DraftTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { useAsyncAction } from '@/hooks/use-async-action';
import { EtatVide } from '@/components/erreurs/etat-vide';

/**
 * Écran 0 — point d'entrée du module traitement. `prospectionId` reste accepté
 * en paramètre de route pour les entrées directes (ex. "Zones à reprendre") ;
 * sans ce paramètre, "Nouvelle fiche de traitement" passe par le sélecteur de
 * fiche de prospection (#91) avant l'écran Références.
 */
export default function TraitementSelectScreen() {
  const router = useRouter();
  const { prospectionId } = useLocalSearchParams<{ prospectionId?: string }>();
  const [showList, setShowList] = useState(false);
  const [drafts, setDrafts] = useState<DraftTraitementRow[]>([]);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const { run: runDelete } = useAsyncAction();

  const charger = useCallback(() => {
    void runTask(() => listDraftTraitements(), {
      name: 'traitement.select.drafts',
      criticality: 'essential',
    }).then((outcome) => {
      setErreurDeLecture(outcome.ok ? null : outcome.error);
      if (outcome.ok) setDrafts(outcome.value);
    });
  }, []);

  useEffect(() => {
    if (showList) charger();
  }, [showList, charger]);

  const handleNouvelleFiche = () => {
    if (prospectionId) {
      router.push({ pathname: '/(traitement)/references' as any, params: { prospectionId } });
      return;
    }
    router.push('/(traitement)/prospection-picker' as any);
  };

  const openFiche = (draft: DraftTraitementRow) => {
    router.push({
      pathname: '/(traitement)/references' as any,
      params: { traitementId: draft.id, isValidationView: '1' },
    });
  };

  /**
   * Fiches restées bloquées « ÉCHEC ENVOI » sans espoir d'aboutir (brouillon
   * abandonné avec des champs obligatoires jamais remplis) : jusqu'ici sans
   * issue, `deleteDraftTraitement` refuse toute fiche déjà `'validee'` (même
   * garde que `deleteDraftProspection`, prospection.tsx), donc rien de connu
   * du serveur ne peut être perdu par ce geste.
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
              { screen: 'traitement.select', context: { draftId: draft.id } }
            ),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fiches de traitement</Text>

      <TouchableOpacity style={styles.primaryCard} onPress={handleNouvelleFiche} accessibilityRole="button">
        <Text style={styles.primaryCardText}>Nouvelle fiche de traitement</Text>
      </TouchableOpacity>

      {/* Anciennement « Consulter une fiche validée » — renommé en « Mes fiches »
          (le seul bouton « Mes fiches » de cet écran désormais) : même
          comportement fonctionnel exact (bascule la liste locale des
          brouillons via `listDraftTraitements`), seul le libellé change.
          L'ancien bouton « Mes fiches » (qui pointait vers l'écran
          /(traitement)/mes-fiches) est supprimé pour ne plus laisser de
          doublon. Ne pas confondre avec le slide interne « Consulter une
          fiche validée » de prospection-picker.tsx (atteint depuis
          « Nouvelle fiche de traitement »), qui reste inchangé. */}
      <TouchableOpacity
        style={styles.secondaryCard}
        onPress={() => setShowList((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryCardText}>Mes fiches</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryCard}
        onPress={() => router.push('/(traitement)/zones-a-reprendre' as any)}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryCardText}>Zones à reprendre</Text>
      </TouchableOpacity>

      {showList && (
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
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(app)' as any)}>
        <Text style={styles.backLinkText}>‹ Retour Accueil</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp, padding: 16, gap: 12 },
  title: {
    fontFamily: traitementFonts.uiExtraBold,
    fontSize: traitementTypeSizes.titreEcran,
    color: traitementColors.texteTitre,
  },
  primaryCard: {
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.carteAccueil,
    padding: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryCardText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 2 },
  secondaryCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.carteAccueil,
    padding: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryCardText: {
    fontFamily: traitementFonts.uiBold,
    color: traitementColors.texteTitre,
    fontSize: traitementTypeSizes.corps + 2,
  },
  list: { flex: 1 },
  emptyText: { fontFamily: traitementFonts.ui, color: traitementColors.texteLabel, textAlign: 'center', marginTop: 20 },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.carte,
    padding: 10,
    marginBottom: 8,
    gap: 2,
  },
  rowTitle: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  rowSubtitle: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteSecondaire },
  deleteAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: traitementRadii.carte,
    marginBottom: 8,
  },
  deleteActionText: { fontFamily: traitementFonts.uiBold, color: '#FFFFFF', fontSize: traitementTypeSizes.label },
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

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
