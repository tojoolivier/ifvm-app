import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { accouplementOptionsFor } from '@/lib/prospection-especes-stades';
import { accouplementInsight } from '@/lib/prospection-accouplement-insight';
import { dominantPhenotype, rowsToCounts , useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import {
  PopulationRow,
  getProspectionPopulation,
  listProspectionCaptures,
  saveProspectionPopulation,
} from '@/lib/prospection-repository';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const INACTIVE_BG = '#efeada';

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;

function emptyPopulation(espece: 'LMC' | 'NSE'): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
  };
}

export default function AccouplementScreen() {
  const router = useRouter();
  const { draftId, grilleIndex } = useLocalSearchParams<{ draftId: string; grilleIndex: string }>();
  const store = useProspectionCaptureStore();
  const requestedIndex = Number(grilleIndex ?? '0');
  const grille = store.grilleOrder[requestedIndex];

  const [population, setPopulation] = useState<PopulationRow | null>(null);
  const [dominant, setDominant] = useState<ReturnType<typeof dominantPhenotype>>(null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('accouplement');

  useEffect(() => {
    if (!draftId || !grille) return;
    if (grille.categorie !== 'imago') {
      router.replace({ pathname: '/(prospection)/captures' as any, params: { draftId, grilleIndex: String(requestedIndex) } });
      return;
    }
    void getProspectionPopulation(draftId, grille.espece, 'imago')
      .then((row) => {
        setPopulation(row ?? emptyPopulation(grille.espece));
      })
      .catch((error) => signalerChargement(error, { draftId, espece: grille.espece }));
    void listProspectionCaptures(draftId, grille.espece, 'imago')
      .then((rows) => {
        setDominant(dominantPhenotype(rowsToCounts(rows)));
      })
      .catch((error) => signalerChargement(error, { draftId, espece: grille.espece }));
  }, [draftId, grille?.espece, grille?.categorie, requestedIndex, signalerChargement]);

  if (!grille || !population) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const accouplementOpts = accouplementOptionsFor(grille.espece);
  const insight = accouplementInsight(population.ponte, dominant);

  const setField = (field: 'accouplement' | 'ponte', value: string) => {
    setPopulation((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleBack = () => {
    router.replace({
      pathname: '/(prospection)/density' as any,
      params: { draftId, grilleIndex: String(requestedIndex) },
    });
  };

  const handleContinue = () =>
    run(
      async () => {
        await saveProspectionPopulation(draftId, population);
        router.replace({
          pathname: '/(prospection)/captures' as any,
          params: { draftId, grilleIndex: String(requestedIndex) },
        });
      },
      {
        screen: 'accouplement',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, espece: grille.espece, grilleIndex: requestedIndex },
      }
    );

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
            <Text style={styles.title}>{ESPECE_LABEL[grille.espece]} · accouplement & ponte</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.hint}>Intensité pour {ESPECE_LABEL[grille.espece]}</Text>

            <Text style={styles.sectionLabel}>Accouplement</Text>
            <View style={styles.chipsRow}>
              {accouplementOpts.map((option) => {
                const active = option === population.accouplement;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setField('accouplement', option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Ponte</Text>
            <View style={styles.chipsRow}>
              {accouplementOpts.map((option) => {
                const active = option === population.ponte;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setField('ponte', option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {insight && (
              <View style={styles.insightCallout}>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Captures  ›</Text>
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
  hint: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  insightCallout: { backgroundColor: '#fbeae6', borderRadius: 10, padding: 11, marginTop: 4 },
  insightText: { fontSize: 11.5, lineHeight: 16, fontWeight: '500', color: '#a8422c' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
