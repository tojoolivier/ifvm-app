import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Écran 0 — point d'entrée du module traitement. `prospectionId` reste accepté
 * en paramètre de route pour les entrées directes (ex. "Zones à reprendre") ;
 * sans ce paramètre, "Nouvelle fiche de traitement" passe par le sélecteur de
 * fiche de prospection (#91) avant l'écran Références.
 */
export default function TraitementSelectScreen() {
  const router = useRouter();
  const { prospectionId } = useLocalSearchParams<{ prospectionId?: string }>();

  const handleNouvelleFiche = () => {
    if (prospectionId) {
      router.push({ pathname: '/(traitement)/references' as any, params: { prospectionId } });
      return;
    }
    router.push('/(traitement)/prospection-picker' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fiches de traitement</Text>

      <TouchableOpacity style={styles.primaryCard} onPress={handleNouvelleFiche} accessibilityRole="button">
        <Text style={styles.primaryCardText}>Nouvelle fiche de traitement</Text>
      </TouchableOpacity>

      {/* Chacun des trois boutons de cet écran ouvre son propre écran dédié —
          "Mes fiches" affichait auparavant sa liste directement ici, mêlée
          aux boutons (#liste-mes-fiches-melangee-boutons) ; elle vit
          désormais sur /(traitement)/mes-fiches comme "Zones à reprendre"
          vit déjà sur /(traitement)/zones-a-reprendre. */}
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
