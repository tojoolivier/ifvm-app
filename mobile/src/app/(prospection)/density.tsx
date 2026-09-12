import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import {
  PopulationRow,
  getProspectionPopulation,
  saveProspectionPopulation,
} from '@/lib/prospection-repository';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { parseEspeceSelection, buildGrilles, parseGrillesCompletees } from '@/lib/prospection-especes';
import { parseDensite } from '@/lib/prospection-extensive';
import { retourArriere } from '@/lib/fiche-routing';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;
const CATEGORIE_LABEL = { imago: 'imagos', larve: 'larves' } as const;

function emptyPopulation(espece: 'LMC' | 'NSE', categorie: 'imago' | 'larve'): PopulationRow {
  return {
    espece,
    categorie,
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
  };
}

export default function DensityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId, grilleIndex } = useLocalSearchParams<{ draftId: string; grilleIndex: string }>();
  const store = useProspectionCaptureStore();
  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const requestedIndex = Number(grilleIndex ?? '0');
  const grille = store.grilleOrder[requestedIndex];

  const [population, setPopulation] = useState<PopulationRow | null>(null);
  const [showDensiteDiffuseError, setShowDensiteDiffuseError] = useState(false);
  const [showDensiteGroupeeError, setShowDensiteGroupeeError] = useState(false);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('density');

  // Reconstruit le store si l'app Android a été tuée en arrière-plan puis
  // restaurée directement sur cet écran (le store zustand n'est pas persisté).
  useEffect(() => {
    if (!draftId) return;
    if (draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

  useEffect(() => {
    if (!draft || draft.id !== draftId) return;
    if (store.grilleOrder.length === 0) {
      const selection = parseEspeceSelection(draft.especes);
      const grilles = buildGrilles(selection);
      const completed = parseGrillesCompletees(draft.grilles_completees);
      store.initGrilles(grilles, completed, captures);
    }
  }, [draft, draftId, captures, store]);

  useEffect(() => {
    if (!draftId || !grille) return;
    getProspectionPopulation(draftId, grille.espece, grille.categorie)
      .then((row) => {
        setPopulation(row ?? emptyPopulation(grille.espece, grille.categorie));
        setShowDensiteDiffuseError(false);
        setShowDensiteGroupeeError(false);
      })
      .catch((error) =>
        // Chargement de fond, pas un geste de l'agent : la frontière est celle
        // de `runTask` (décision 1). Déclarer `useAsyncAction` ferait passer une
        // lecture ratée en BLOQUER, une insistance que la matrice ne prévoit pas.
        signalerChargement(error, { draftId, espece: grille.espece, categorie: grille.categorie })
      );
  }, [draftId, grille, signalerChargement]);

  if (!grille || !population) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const isFirstGrille = requestedIndex === 0;

  const setField = (field: keyof PopulationRow, value: PopulationRow[keyof PopulationRow]) => {
    setPopulation((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleBack = () =>
    retourArriere(router, () => {
      if (isFirstGrille) {
        router.replace(`/(prospection)/species?draftId=${draftId}`);
      } else {
        router.replace(`/(prospection)/captures?draftId=${draftId}&grilleIndex=${requestedIndex - 1}`);
      }
    });

  const handleContinue = () => {
    // Densité diffuse obligatoire, indépendamment pour chaque combinaison espèce/stade
    // (population est déjà chargée/sauvée par (espece, categorie) — cf. getProspectionPopulation).
    if (population.densite_diffuse == null) {
      setShowDensiteDiffuseError(true);
      Alert.alert('Densité diffuse requise', 'Veuillez renseigner la densité diffuse (ind./ha).');
      return;
    }

    // #densite-groupee-obligatoire : même traitement que la densité diffuse ci-dessus.
    if (population.densite_groupee == null) {
      setShowDensiteGroupeeError(true);
      Alert.alert('Densité groupée requise', 'La densité groupée (ind./m²) est obligatoire.');
      return;
    }

    return run(
      async () => {
        await saveProspectionPopulation(draftId, population);
        // L'accouplement/ponte ne concerne que les imagos : les grilles larve vont
        // directement à leurs captures (cf. le garde-fou déjà présent dans accouplement.tsx).
        const next =
          grille.categorie === 'imago'
            ? `/(prospection)/accouplement?draftId=${draftId}&grilleIndex=${requestedIndex}`
            : `/(prospection)/captures?draftId=${draftId}&grilleIndex=${requestedIndex}`;
        router.replace(next as any);
      },
      {
        screen: 'density',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, espece: grille.espece, grilleIndex: requestedIndex },
      }
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {ESPECE_LABEL[grille.espece]} · densités {CATEGORIE_LABEL[grille.categorie]}
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <View style={styles.fieldsRow}>
              <View style={[styles.field, showDensiteDiffuseError && population.densite_diffuse == null && styles.fieldError]}>
                <Text style={[styles.fieldLabel, styles.requiredLabel]}>Densité diffuse (ind./ha) *</Text>
                <TextInput
                  value={population.densite_diffuse != null ? String(population.densite_diffuse) : ''}
                  onChangeText={(text) => setField('densite_diffuse', parseDensite(text))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
              <View style={[styles.field, showDensiteGroupeeError && population.densite_groupee == null && styles.fieldError]}>
                <Text style={[styles.fieldLabel, styles.requiredLabel]}>Densité groupée (ind./m²) *</Text>
                <TextInput
                  value={population.densite_groupee != null ? String(population.densite_groupee) : ''}
                  onChangeText={(text) => setField('densite_groupee', parseDensite(text))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
            </View>
            {showDensiteDiffuseError && population.densite_diffuse == null && (
              <Text style={styles.errorText}>Veuillez renseigner la densité diffuse (ind./ha).</Text>
            )}
            {showDensiteGroupeeError && population.densite_groupee == null && (
              <Text style={styles.errorText}>La densité groupée (ind./m²) est obligatoire.</Text>
            )}

            <Text style={styles.sectionLabel}>Méthode</Text>
            <View style={styles.chipsRow}>
              {(['visuel', 'comptage_direct'] as const).map((option) => {
                const active = option === population.methode;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setField('methode', active ? null : option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option === 'visuel' ? 'Visuel' : 'Comptage direct'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>
                {grille.categorie === 'imago' ? 'Accouplement  ›' : 'Captures  ›'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 14, fontWeight: '700', color: TEXT },
  scroll: { flex: 1 },
  fieldsRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  field: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10 },
  fieldError: { borderColor: '#c0412b', borderWidth: 1.5 },
  fieldLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 2 },
  requiredLabel: { color: '#c0412b' },
  fieldInput: { fontSize: 16, fontWeight: '700', color: TEXT, padding: 0 },
  errorText: { color: '#c0412b', fontSize: 11, marginTop: -6, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
