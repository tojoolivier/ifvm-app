import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement } from '@/lib/traitement-repository';
import { Card } from '@/components/traitement/Card';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

/**
 * Écran « Surface traitée » (#326) — aérien uniquement, dernière étape avant
 * Signatures. Lecture seule : `surface_traitee_ha` (produit de choc) ou
 * `surface_protegee_ha` (produit de barrière, mode BARRIERE — migration 0081)
 * est déjà la somme des `surface_ha` de chaque rotation, dérivée et persistée
 * par le backend à chaque écriture sur `traitement_rotation` (migration 0047) —
 * jamais recalculée ni saisissable ici, seulement relue telle quelle (même
 * posture que cibles.tsx pour son snapshot `cible`).
 */
export default function SurfaceTraiteeScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const [surfaceTraiteeHa, setSurfaceTraiteeHa] = useState<number | null>(null);
  const [estProtegee, setEstProtegee] = useState(false);
  const signalerChargement = useSignalerChargement('surface-traitee');
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  useEffect(() => {
    if (!traitementId) return;
    void getTraitement(traitementId)
      .then((draft) => {
        const protegee = draft?.mode_traitement === 'BARRIERE';
        setEstProtegee(protegee);
        setSurfaceTraiteeHa(
          (protegee ? draft?.aerien?.surface_protegee_ha : draft?.aerien?.surface_traitee_ha) ?? null
        );
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={6} segments={PROGRESS_SEGMENTS_AERIEN} />
        <Text style={styles.title}>{estProtegee ? 'Surface protégée' : 'Surface traitée'}</Text>

        <Card variant="derivee" style={styles.deriveeCentree}>
          <Text style={styles.label}>{estProtegee ? 'Surface protégée (ha)' : 'Surface traitée (ha)'}</Text>
          <Text style={styles.derivedValue}>{surfaceTraiteeHa ?? 'non renseigné'}</Text>
        </Card>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() =>
            router.push({ pathname: '/(traitement)/signatures' as any, params: { traitementId, isValidationView } })
          }
        >
          <Text style={styles.continueButtonText}>Continuer  ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp },
    content: { padding: 16, gap: 12 },
    title: { fontFamily: traitementFonts.uiExtraBold, fontSize: typeSizes.titreEcran, color: traitementColors.texteTitre },
    label: {
      fontFamily: traitementFonts.uiSemiBold,
      fontSize: typeSizes.corps + 1,
      color: traitementColors.texteLabel,
      textAlign: 'center',
    },
    derivedValue: {
      fontFamily: traitementFonts.monoBold,
      fontSize: typeSizes.valeurDerivee,
      color: traitementColors.vertPrincipal,
      textAlign: 'center',
    },
    deriveeCentree: { alignItems: 'center' },
    continueButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: traitementColors.vertPrincipal,
      borderRadius: traitementRadii.boutonPrincipal,
      marginTop: 8,
    },
    continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: typeSizes.corps + 1 },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
