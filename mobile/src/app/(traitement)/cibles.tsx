import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, Cible } from '@/lib/traitement-repository';
import { Card } from '@/components/traitement/Card';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  return String(value);
}

/**
 * Écran B — Cibles (snapshot figé à la création).
 *
 * Déviation notée : ce lot ne construit pas la logique qui alimente `cible`
 * depuis la fiche de prospection liée (choix de la fiche = Lot 3, pas encore
 * livré). Cet écran se contente de lire `getTraitement(id).cible` tel qu'il
 * existe déjà en base ; s'il est vide (aucune capture amont), chaque champ
 * affiche "non renseigné" comme prévu par le brief.
 */
export default function CiblesScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const [cible, setCible] = useState<Cible | null>(null);

  useEffect(() => {
    if (traitementId) {
      getTraitement(traitementId).then((draft) => setCible(draft?.cible ?? null));
    }
  }, [traitementId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={1} />
        <Text style={styles.title}>Cibles</Text>

        <Card variant="avertissement">
          <Text style={styles.warningText}>⚠ Snapshot figé à la création</Text>
        </Card>

        <View style={styles.field}>
          <Text style={styles.label}>Espèce</Text>
          <Text style={styles.value}>{display(cible?.espece)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Petites larves</Text>
          <Text style={styles.value}>{display(cible?.petites_larves)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Grandes larves</Text>
          <Text style={styles.value}>{display(cible?.grandes_larves)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Vols/essaims</Text>
          <Text style={styles.value}>{display(cible?.vols_clairs_essaims)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Répartition de la population</Text>
          <Text style={styles.value}>{display(cible?.repartition_population)}</Text>
        </View>

        <Card variant="derivee">
          <Text style={styles.label}>Surface infestée (ha)</Text>
          <Text style={styles.derivedValue}>{display(cible?.surface_infestee_ha)}</Text>
        </Card>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() =>
            router.push({ pathname: '/(traitement)/traitement' as any, params: { traitementId, isValidationView } })
          }
        >
          <Text style={styles.continueButtonText}>Continuer  ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  warningText: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.avertissementTexte },
  field: { gap: 3 },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  value: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  derivedValue: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.valeurDerivee, color: traitementColors.vertPrincipal },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});
