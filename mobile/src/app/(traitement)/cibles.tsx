import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, Cible } from '@/lib/traitement-repository';
import { Card } from '@/components/traitement/Card';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  return String(value);
}

/** `vols_clairs_essaims` est stocké en base locale sous forme 1/0 (colonne REAL,
 * cf. construireCible dans traitement-cible.ts) — jamais renseigné si null. */
function displayVolsClairsEssaims(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'non renseigné';
  return value ? 'oui' : 'non';
}

/**
 * Écran B — Cibles (snapshot figé à la création).
 *
 * Terrestre uniquement depuis #326 : côté Aérien, cet écran est remplacé par
 * « Synthèse » (synthese.tsx), qui reprend le même contenu de cible en lecture
 * seule et y ajoute la végétation (déplacée depuis Moyens) — `references.tsx`
 * route vers l'un ou l'autre selon `type_traitement`.
 *
 * La cible est calculée une seule fois, à la création de la fiche de traitement
 * (references.tsx, via `construireCible` dans traitement-cible.ts — même logique que
 * `construire_cible()` côté backend), à partir des populations/infestations de la
 * fiche de prospection liée. Cet écran se contente de la relire telle quelle
 * (`getTraitement(id).cible`) : elle ne se recalcule jamais après coup, même si la
 * prospection est modifiée ensuite. Si vide (aucune capture amont), chaque champ
 * affiche "non renseigné" comme prévu par le brief.
 */
export default function CiblesScreen() {
  const router = useRouter();
  const { traitementId, isValidationView, origineId } =
    useLocalSearchParams<{ traitementId: string; isValidationView?: string; origineId?: string }>();
  const [cible, setCible] = useState<Cible | null>(null);
  // Type de traitement de la fiche — décide du nombre d'étapes de ProgressBar (7 en
  // aérien avec l'écran Rotations, 6 en terrestre sans lui).
  const [typeTraitement, setTypeTraitement] = useState<'AERIEN' | 'TERRESTRE' | null>(null);
  const signalerChargement = useSignalerChargement('cibles');

  useEffect(() => {
    if (!traitementId) return;
    void getTraitement(traitementId)
      .then((draft) => {
        setCible(draft?.cible ?? null);
        setTypeTraitement(draft?.type_traitement ?? null);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={1}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
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
          <Text style={styles.value}>{displayVolsClairsEssaims(cible?.vols_clairs_essaims)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Répartition de la population</Text>
          <Text style={styles.value}>{display(cible?.repartition_population)}</Text>
        </View>

        <Card variant="derivee" style={styles.deriveeCentree}>
          <Text style={styles.label}>Surface infestée (ha)</Text>
          <Text style={styles.derivedValue}>{display(cible?.surface_infestee_ha)}</Text>
        </Card>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() =>
            router.push({ pathname: '/(traitement)/traitement' as any, params: { traitementId, isValidationView, origineId } })
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
  // `alignItems: 'center'` centre le bloc de chaque Text (titre puis valeur)
  // dans la largeur de l'écran, quelle que soit sa longueur ; combiné au
  // `textAlign: 'center'` ci-dessous, une valeur qui retourne à la ligne
  // reste centrée ligne par ligne, pas seulement en bloc.
  field: { gap: 4, alignItems: 'center' },
  // Légèrement agrandi par rapport au reste de l'app (traitementTypeSizes.label,
  // 9) — amélioration de lisibilité ciblée à cet écran seulement, sans toucher
  // au token partagé ni aux autres slides qui l'utilisent.
  label: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps + 1,
    color: traitementColors.texteLabel,
    textAlign: 'center',
  },
  // Valeur plus visible que le titre (hiérarchie titre → valeur), mais toujours
  // nettement en retrait de `derivedValue` (Surface infestée, seule valeur
  // "vedette" de cet écran) pour ne pas aplatir cette hiérarchie-là.
  value: {
    fontFamily: traitementFonts.uiBold,
    fontSize: traitementTypeSizes.corps + 3,
    color: traitementColors.texteTitre,
    textAlign: 'center',
  },
  derivedValue: {
    fontFamily: traitementFonts.monoBold,
    fontSize: traitementTypeSizes.valeurDerivee,
    color: traitementColors.vertPrincipal,
    textAlign: 'center',
  },
  // Override local, propre à cet écran : centre le contenu de cette carte
  // "derivee" précise sans toucher au composant `Card` partagé (utilisé tel
  // quel, non centré, par d'autres écrans de la fiche de traitement).
  deriveeCentree: { alignItems: 'center' },
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

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
