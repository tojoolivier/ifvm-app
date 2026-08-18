import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listValidatedProspections, DraftProspection } from '@/lib/prospection-repository';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Sélecteur de fiche de prospection à lier (point ouvert du Lot 2, fermé au
 * Lot 3 — #91). Seules les fiches extensives ou de vérification de
 * signalement, déjà synchronisées, sont proposées — condition affichée en
 * lecture seule à l'écran Références une fois liée.
 */
export default function TraitementProspectionPickerScreen() {
  const router = useRouter();
  const [prospections, setProspections] = useState<DraftProspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listValidatedProspections()
      .then(setProspections)
      .catch(() => setProspections([]))
      .finally(() => setLoading(false));
  }, []);

  const choisir = (prospection: DraftProspection) => {
    router.push({
      pathname: '/(traitement)/references' as any,
      params: { prospectionId: prospection.id },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Choisir une fiche de prospection</Text>

      {loading ? (
        <Text style={styles.emptyText}>Chargement…</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={prospections}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune fiche de prospection éligible pour le moment.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => choisir(item)}>
              <Text style={styles.rowTitle}>
                {item.n_message ?? 'Fiche sans numéro'} · {item.date_prospection?.slice(0, 10) ?? 'date inconnue'}
              </Text>
              <Text style={styles.rowSubtitle}>
                {[item.region, item.district, item.commune].filter(Boolean).join(' · ') || 'localisation non renseignée'}
              </Text>
              <Text style={styles.rowDetail}>{item.id}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>‹ Retour</Text>
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
  rowDetail: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
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
