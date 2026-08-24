import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listTraitementsByChefEquipe, DraftTraitementRow } from '@/lib/traitement-repository';
import { useAuthStore } from '@/lib/auth-store';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Écran "Mes fiches" (Lot 3) — fiches de traitement dont le chef d'équipe
 * connecté est responsable, à partir de la copie locale déjà synchronisée
 * (`listTraitementsByChefEquipe`, jusqu'ici inutilisée).
 */
export default function TraitementMesFichesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [fiches, setFiches] = useState<DraftTraitementRow[]>([]);
  const [loading, setLoading] = useState(() => !!user?.id);

  useEffect(() => {
    const chefEquipeId = user?.id;
    if (!chefEquipeId) {
      return;
    }
    listTraitementsByChefEquipe(chefEquipeId)
      .then(setFiches)
      .catch(() => setFiches([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const openFiche = (fiche: DraftTraitementRow) => {
    router.push({
      pathname: '/(traitement)/references' as any,
      params: { traitementId: fiche.id, isValidationView: '1' },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mes fiches</Text>

      {loading ? (
        <Text style={styles.emptyText}>Chargement…</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={fiches}
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

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
