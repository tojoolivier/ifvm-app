import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listDraftTraitements, DraftTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Écran 0 — point d'entrée du module traitement. La sélection d'une fiche de
 * prospection à lier (Lot 3, "Zones à reprendre"/"Mes fiches") n'existe pas
 * encore : on accepte `prospectionId` en paramètre de route, injecté par
 * l'écran qui renvoie ici (hors périmètre de ce lot).
 */
export default function TraitementSelectScreen() {
  const router = useRouter();
  const { prospectionId } = useLocalSearchParams<{ prospectionId?: string }>();
  const [showList, setShowList] = useState(false);
  const [drafts, setDrafts] = useState<DraftTraitementRow[]>([]);

  useEffect(() => {
    if (showList) {
      listDraftTraitements().then(setDrafts).catch(() => setDrafts([]));
    }
  }, [showList]);

  const handleNouvelleFiche = () => {
    router.push({ pathname: '/(traitement)/references' as any, params: { prospectionId: prospectionId ?? '' } });
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

      {showList && (
        <FlatList
          style={styles.list}
          data={drafts}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune fiche pour le moment.</Text>}
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
