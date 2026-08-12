import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAsyncAction } from '@/hooks/use-async-action';
import { Espece } from '@/lib/prospection-especes-stades';
import { getProspectionPopulation, saveProspectionPopulation } from '@/lib/prospection-repository';
import {
  EXTENSIVE_IMAGO_PHASES,
  PHENOTYPE_ROWS,
  ExtensiveImagoState,
  emptyExtensiveImagoState,
  imagoStateToPopulationRow,
  populationRowToImagoState,
} from '@/lib/prospection-extensive';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

export default function ExtensiveImagosScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [species, setSpecies] = useState<Espece>('LMC');
  const [states, setStates] = useState<Record<Espece, ExtensiveImagoState>>({
    LMC: emptyExtensiveImagoState(),
    NSE: emptyExtensiveImagoState(),
  });
  const { run, isRunning: isSaving } = useAsyncAction();

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const [lmc, nse] = await Promise.all([
        getProspectionPopulation(draftId, 'LMC', 'imago'),
        getProspectionPopulation(draftId, 'NSE', 'imago'),
      ]);
      setStates({ LMC: populationRowToImagoState(lmc), NSE: populationRowToImagoState(nse) });
    })();
  }, [draftId]);

  const state = states[species];
  const updateState = (patch: Partial<ExtensiveImagoState>) => {
    setStates((prev) => ({ ...prev, [species]: { ...prev[species], ...patch } }));
  };

  const handleContinue = () =>
    run(
      async () => {
        await Promise.all([
          saveProspectionPopulation(draftId, imagoStateToPopulationRow('LMC', states.LMC)),
          saveProspectionPopulation(draftId, imagoStateToPopulationRow('NSE', states.NSE)),
        ]);
        router.push({ pathname: '/(prospection)/extensive-larves' as any, params: { draftId } });
      },
      {
        screen: 'extensive-imagos',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, species },
      }
    );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Imagos</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>

        <View style={styles.speciesRow}>
          {(['LMC', 'NSE'] as Espece[]).map((sp) => {
            const active = sp === species;
            return (
              <TouchableOpacity
                key={sp}
                style={[styles.speciesButton, active && styles.speciesButtonActive]}
                onPress={() => setSpecies(sp)}
                activeOpacity={0.7}
              >
                <Text style={[styles.speciesButtonText, active && styles.speciesButtonTextActive]}>{sp}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
          <Text style={styles.sectionLabel}>Nbre captures par phénotype</Text>
          <View style={{ gap: 6, marginBottom: 12 }}>
            {PHENOTYPE_ROWS.map(({ key, label }) => {
              const active = state.active === key;
              const count = state[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.phenoRow, active && styles.phenoRowActive]}
                  onPress={() => updateState({ active: key })}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.phenoLabel, active && styles.phenoLabelActive]}>{label}</Text>
                  {active ? (
                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => updateState({ [key]: Math.max(0, count - 1) } as Partial<ExtensiveImagoState>)}
                      >
                        <Text style={styles.counterButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{count}</Text>
                      <TouchableOpacity
                        style={[styles.counterButton, styles.counterButtonAdd]}
                        onPress={() => updateState({ [key]: count + 1 } as Partial<ExtensiveImagoState>)}
                      >
                        <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.phenoStaticCount}>{count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Phase</Text>
          <View style={[styles.chipsRow, { marginBottom: 12 }]}>
            {EXTENSIVE_IMAGO_PHASES.map((phase) => {
              const active = phase === state.phase;
              return (
                <TouchableOpacity key={phase} style={{ flex: 1 }} onPress={() => updateState({ phase })} activeOpacity={0.7}>
                  <Text style={[styles.chip, active && styles.chipActive]}>{phase}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={[styles.card, styles.flex1]}>
              <Text style={styles.label}>Pop diff D/ha</Text>
              <TextInput
                value={state.popDiff}
                onChangeText={(v) => updateState({ popDiff: v })}
                keyboardType="decimal-pad"
                style={styles.inputMono}
              />
            </View>
            <View style={[styles.card, styles.flex1]}>
              <Text style={styles.label}>Pop group D/m²</Text>
              <TextInput
                value={state.popGroup}
                onChangeText={(v) => updateState({ popGroup: v })}
                keyboardType="decimal-pad"
                style={styles.inputMono}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.essaimRow}
            onPress={() => updateState({ essaim: !state.essaim })}
            activeOpacity={0.85}
          >
            <Text style={styles.essaimLabel}>Essaim observé</Text>
            <View style={[styles.toggleTrack, state.essaim && styles.toggleTrackActive]}>
              <View style={[styles.toggleThumb, state.essaim && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>Suivant : Larves ›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  speciesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  speciesButton: { flex: 1, textAlign: 'center', borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  phenoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 13 },
  phenoRowActive: { borderWidth: 2, borderColor: GREEN, paddingVertical: 6, paddingLeft: 13 },
  phenoLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  phenoLabelActive: { fontWeight: '700', color: TEXT },
  phenoStaticCount: { fontSize: 13, fontWeight: '600', color: TEXT, fontFamily: 'monospace' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 32, height: 32, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 17, fontWeight: '700', color: TEXT, minWidth: 16, textAlign: 'center', fontFamily: 'monospace' },
  chipsRow: { flexDirection: 'row', gap: 5 },
  chip: { fontSize: 11.5, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingVertical: 8, textAlign: 'center', borderRadius: 8, overflow: 'hidden' },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  flex1: { flex: 1 },
  card: { backgroundColor: '#f6f3e9', borderRadius: 9, padding: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484' },
  inputMono: { fontSize: 15, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  essaimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 10, padding: 12, marginBottom: 16 },
  essaimLabel: { fontSize: 12.5, fontWeight: '700', color: '#8a6d2f' },
  toggleTrack: { width: 38, height: 21, borderRadius: 12, backgroundColor: '#e0d8b8', padding: 2, justifyContent: 'center' },
  toggleTrackActive: { backgroundColor: GREEN, alignItems: 'flex-end' },
  toggleThumb: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#fff' },
  toggleThumbActive: {},
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
