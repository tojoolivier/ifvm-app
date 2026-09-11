import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, updateTraitementMoyens, Cible } from '@/lib/traitement-repository';
import { getProspection } from '@/lib/prospection-repository';
import { validateRecouvrement } from '@/lib/traitement-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { Card } from '@/components/traitement/Card';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

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

// Saisie francophone : la virgule est le séparateur décimal attendu par l'utilisateur,
// mais JS/JSON n'utilisent que le point en interne — même paire de fonctions que
// moyens.tsx (#326, pas mutualisée pour l'instant, cf. commentaire équivalent là-bas).
function parseDecimalInput(raw: string): number | null {
  if (raw === '') return null;
  const val = Number(raw.replace(',', '.'));
  return isNaN(val) ? null : val;
}

function formatDecimalDisplay(value: number | null): string {
  return value != null ? String(value).replace('.', ',') : '';
}

type VegetationDecimalField = 'herbeuse' | 'arboree' | 'recouvrement';

/**
 * Écran « Synthèse » (#326) — aérien uniquement : fusionne l'ancien écran « Cibles »
 * (snapshot figé, lecture seule, cf. cibles.tsx toujours utilisé tel quel côté
 * terrestre) et la section « Végétation » de moyens.tsx, déplacée ici pour
 * correspondre au nouvel ordre de saisie (Références → Synthèse → Équipe →
 * Pesticides & rotations → Moyens & protection → Impacts & risque → Surface
 * traitée → Signatures).
 *
 * Ce ticket (#326) est volontairement scopé au réordonnancement : la cible reste
 * le snapshot `cible` construit et écrit par le backend à la création (comme
 * aujourd'hui), pas encore la lecture directe de la prospection liée envisagée par
 * #325 (bloquant non résolu, cf. discussion) — hors périmètre ici.
 *
 * `kit_*`/`zones_exposees` sont chargés et réécrits tels quels (round-trip, jamais
 * affichés ni modifiés ici) : `updateTraitementMoyens` persiste toute la ligne
 * `traitement` en un seul UPDATE, et moyens.tsx fait le même round-trip en sens
 * inverse pour la végétation — les deux écrans se repassent mutuellement les
 * champs qu'ils ne possèdent pas, sans jamais les écraser.
 */
export default function SyntheseScreen() {
  const router = useRouter();
  const { traitementId, isValidationView, origineId } =
    useLocalSearchParams<{ traitementId: string; isValidationView?: string; origineId?: string }>();
  const readOnly = isValidationView === '1';

  const [cible, setCible] = useState<Cible | null>(null);
  const [kit, setKit] = useState<Record<string, number>>({});
  const [zones, setZones] = useState<Record<string, boolean>>({});
  const [hauteurHerbeuse, setHauteurHerbeuse] = useState<number | null>(null);
  const [hauteurArboree, setHauteurArboree] = useState<number | null>(null);
  const [recouvrement, setRecouvrement] = useState<number | null>(null);
  // Cf. handleVegetationChange/Blur ci-dessous — même garde de saisie intermédiaire
  // ("1," / "1.") que moyens.tsx.
  const [decimalDrafts, setDecimalDrafts] = useState<Partial<Record<VegetationDecimalField, string>>>({});
  const [prospectionId, setProspectionId] = useState<string | null>(null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('synthese');

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        setCible(draft.cible ?? null);
        setProspectionId(draft.prospection_id ?? null);
        setKit({
          kit_combinaison: draft.kit_combinaison ?? 0,
          kit_gants: draft.kit_gants ?? 0,
          kit_lunettes: draft.kit_lunettes ?? 0,
          kit_masques: draft.kit_masques ?? 0,
          kit_botte: draft.kit_botte ?? 0,
        });
        if (draft.zones_exposees) {
          try {
            setZones(JSON.parse(draft.zones_exposees));
          } catch (e) {
            logger.ignore(e, 'Zones exposées corrompues — repli sur aucune zone cochée, re-saisissable.');
          }
        }
        setHauteurHerbeuse(draft.hauteur_strate_herbeuse_m);
        setHauteurArboree(draft.hauteur_strate_arboree_m);
        setRecouvrement(draft.recouvrement_percent);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  // Pré-remplit Strate herbeuse/Recouvrement depuis la fiche de prospection liée
  // (déjà renseignés là — intensive ou extensive, `hauteur_herbe_cm`/
  // `verdissement_pourcent` sont des champs communs aux deux) — même patron que
  // moyens.tsx côté Terrestre. Modifiable ensuite, jamais d'écrasement d'une
  // valeur déjà présente. Strate arborée n'a pas d'équivalent sur la
  // prospection : reste en saisie manuelle. N'anticipe pas #325 (lecture seule
  // de la cible/population depuis la prospection, bloqué par le ticket 6) —
  // seule la végétation est concernée ici, et reste modifiable.
  useEffect(() => {
    if (!prospectionId) return;
    getProspection(prospectionId)
      .then((prospection) => {
        if (!prospection) return;
        if (prospection.hauteur_herbe_cm != null) {
          const herbeuseM = Math.round((prospection.hauteur_herbe_cm / 100) * 100) / 100;
          setHauteurHerbeuse((current) => (current == null ? herbeuseM : current));
        }
        if (prospection.verdissement_pourcent != null) {
          setRecouvrement((current) => (current == null ? prospection.verdissement_pourcent : current));
        }
      })
      .catch((error) => signalerChargement(error, { prospectionId }));
  }, [prospectionId, signalerChargement]);

  const recouvrementErrors = validateRecouvrement(recouvrement);

  const vegetationFieldSetters: Record<VegetationDecimalField, (v: number | null) => void> = {
    herbeuse: setHauteurHerbeuse,
    arboree: setHauteurArboree,
    recouvrement: setRecouvrement,
  };

  const handleVegetationChange = (field: VegetationDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setDecimalDrafts((current) => ({ ...current, [field]: raw }));
    if (raw === '') {
      vegetationFieldSetters[field](null);
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    vegetationFieldSetters[field](val);
  };

  const handleVegetationBlur = (field: VegetationDecimalField) => {
    setDecimalDrafts((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleContinuer = () =>
    run(
      async () => {
        if (recouvrementErrors.length > 0) return;
        await updateTraitementMoyens(traitementId, {
          kit_combinaison: kit.kit_combinaison ?? 0,
          kit_gants: kit.kit_gants ?? 0,
          kit_lunettes: kit.kit_lunettes ?? 0,
          kit_masques: kit.kit_masques ?? 0,
          kit_botte: kit.kit_botte ?? 0,
          zones_exposees: zones,
          hauteur_strate_herbeuse_m: hauteurHerbeuse,
          hauteur_strate_arboree_m: hauteurArboree,
          recouvrement_percent: recouvrement,
        });
        router.push({ pathname: '/(traitement)/traitement' as any, params: { traitementId, isValidationView, origineId } });
      },
      {
        screen: 'synthese',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId },
      }
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={1} segments={PROGRESS_SEGMENTS_AERIEN} />
        <Text style={styles.title}>Synthèse</Text>

        <Card variant="avertissement">
          <Text style={styles.warningText}>⚠ Cibles : snapshot figé à la création</Text>
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

        <Text style={styles.sectionLabel}>Végétation</Text>

        <Text style={styles.fieldLabel}>Strate herbeuse (m) — pré-remplie, modifiable</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 1,5"
          keyboardType="decimal-pad"
          value={decimalDrafts.herbeuse ?? formatDecimalDisplay(hauteurHerbeuse)}
          onChangeText={(v) => handleVegetationChange('herbeuse', v)}
          onBlur={() => handleVegetationBlur('herbeuse')}
        />
        <Text style={styles.fieldLabel}>Strate arborée (m)</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 2,5"
          keyboardType="decimal-pad"
          value={decimalDrafts.arboree ?? formatDecimalDisplay(hauteurArboree)}
          onChangeText={(v) => handleVegetationChange('arboree', v)}
          onBlur={() => handleVegetationBlur('arboree')}
        />
        <Text style={styles.fieldLabel}>Recouvrement (%) — pré-rempli, modifiable</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 80"
          keyboardType="decimal-pad"
          value={decimalDrafts.recouvrement ?? formatDecimalDisplay(recouvrement)}
          onChangeText={(v) => handleVegetationChange('recouvrement', v)}
          onBlur={() => handleVegetationBlur('recouvrement')}
        />
        {recouvrementErrors.map((e) => (
          <Text key={e.field} style={styles.error}>{e.message}</Text>
        ))}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  warningText: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.avertissementTexte },
  field: { gap: 4, alignItems: 'center' },
  label: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps + 1,
    color: traitementColors.texteLabel,
    textAlign: 'center',
  },
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
  deriveeCentree: { alignItems: 'center' },
  sectionLabel: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  fieldLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
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
