import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listReprenableTraitements, DraftTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Écran "Zones à reprendre" (Lot 3) — fiches terrestres validées dont la
 * surface restante est encore positive (`listReprenableTraitements`,
 * jusqu'ici inutilisée). Amorce une nouvelle fiche sur la même prospection
 * d'origine, avec `origineId` propagé jusqu'à l'écran C (`traitement.tsx`)
 * pour présélectionner automatiquement la reprise sur cette fiche.
 */
export default function TraitementZonesAReprendreScreen() {
  const router = useRouter();
  const [fiches, setFiches] = useState<DraftTraitementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReprenableTraitements()
      .then(setFiches)
      .catch(() => setFiches([]))
      .finally(() => setLoading(false));
  }, []);

  const openFiche = (fiche: DraftTraitementRow) => {
    router.push({
      pathname: '/(traitement)/references' as any,
      params: { prospectionId: fiche.prospection_id, origineId: fiche.id },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Zones à reprendre</Text>

      {loading ? (
        <Text style={styles.emptyText}>Chargement…</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={fiches}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune zone à reprendre pour le moment.</Text>}
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
