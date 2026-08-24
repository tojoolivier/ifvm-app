import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listDraftTraitements, DraftTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fiches de traitement</Text>

      <TouchableOpacity style={styles.primaryCard} onPress={handleNouvelleFiche} accessibilityRole="button">
        <Text style={styles.primaryCardText}>Nouvelle fiche de traitement</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryCard}
        onPress={() => setShowList((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryCardText}>Consulter une fiche validée</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryCard}
        onPress={() => router.push('/(traitement)/mes-fiches' as any)}
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
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openFiche(item)}>
              <Text style={styles.rowTitle}>{item.numero_fiche ?? 'généré à l’enregistrement'}</Text>
              <Text style={styles.rowSubtitle}>
                {item.type_traitement} · {item.localite ?? 'localité non renseignée'}
              </Text>
            </TouchableOpacity>
          )}
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
