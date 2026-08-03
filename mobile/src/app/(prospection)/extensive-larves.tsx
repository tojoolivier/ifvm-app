import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Espece, stadesFor } from '@/lib/prospection-especes-stades';
import { getProspectionPopulation, saveProspectionPopulation } from '@/lib/prospection-repository';
import {
  DEPLACEMENT_OPTIONS,
  ExtensiveLarveState,
  emptyExtensiveLarveState,
  larveStateToPopulationRow,
  populationRowToLarveState,
} from '@/lib/prospection-extensive';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';
const AMBER = '#e89b2b';

export default function ExtensiveLarvesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [species, setSpecies] = useState<Espece>('LMC');
  const [states, setStates] = useState<Record<Espece, ExtensiveLarveState>>({
    LMC: emptyExtensiveLarveState('LMC'),
    NSE: emptyExtensiveLarveState('NSE'),
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const [lmc, nse] = await Promise.all([
        getProspectionPopulation(draftId, 'LMC', 'larve'),
        getProspectionPopulation(draftId, 'NSE', 'larve'),
      ]);
      setStates({ LMC: populationRowToLarveState('LMC', lmc), NSE: populationRowToLarveState('NSE', nse) });
    })();
  }, [draftId]);

  const state = states[species];
  const updateState = (patch: Partial<ExtensiveLarveState>) => {
    setStates((prev) => ({ ...prev, [species]: { ...prev[species], ...patch } }));
  };
  const updateDensite = (stade: string, delta: number) => {
    setStates((prev) => {
      const current = prev[species];
      const value = Math.max(0, (current.densites[stade] || 0) + delta);
      return { ...prev, [species]: { ...current, densites: { ...current.densites, [stade]: value } } };
    });
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.all([
        saveProspectionPopulation(draftId, larveStateToPopulationRow('LMC', states.LMC)),
        saveProspectionPopulation(draftId, larveStateToPopulationRow('NSE', states.NSE)),
      ]);
      router.push({ pathname: '/(prospection)/extensive-observations' as any, params: { draftId } });
    } finally {
      setIsSaving(false);
    }
  };

  const stades = stadesFor(species, 'larve', null);
  const densiteCourante = state.densites[state.stade] ?? 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Larves</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
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
          <Text style={styles.sectionLabel}>Stade larvaire</Text>
          <View style={[styles.chipsRow, { marginBottom: 12 }]}>
            {stades.map((stade) => {
              const active = stade === state.stade;
              return (
                <TouchableOpacity key={stade} onPress={() => updateState({ stade })} activeOpacity={0.7}>
                  <Text style={[styles.chip, active && styles.chipActive]}>{stade}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.densiteRow}>
            <Text style={styles.densiteLabel}>Densité comptée</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterButton} onPress={() => updateDensite(state.stade, -1)}>
                <Text style={styles.counterButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{densiteCourante}</Text>
              <TouchableOpacity style={[styles.counterButton, styles.counterButtonAdd]} onPress={() => updateDensite(state.stade, 1)}>
                <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.markCard, state.tl && styles.markCardActive]}
              onPress={() => updateState({ tl: !state.tl })}
              activeOpacity={0.85}
            >
              <Text style={styles.markLabel}>TL</Text>
              <Text style={[styles.markValue, state.tl && styles.markValueActive]}>{state.tl ? '✓' : '—'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.markCard, state.bl && styles.markCardActive]}
              onPress={() => updateState({ bl: !state.bl })}
              activeOpacity={0.85}
            >
              <Text style={styles.markLabel}>BL</Text>
              <Text style={[styles.markValue, state.bl && styles.markValueActive]}>{state.bl ? '✓' : '—'}</Text>
            </TouchableOpacity>
            <View style={[styles.card, { flex: 1.4 }]}>
              <Text style={styles.label}>Interdist. m</Text>
              <TextInput
                value={state.interdist}
                onChangeText={(v) => updateState({ interdist: v })}
                keyboardType="decimal-pad"
                style={styles.inputMono}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Déplacement</Text>
          <View style={[styles.chipsRow, { marginBottom: 16 }]}>
            {DEPLACEMENT_OPTIONS.map((option) => {
              const active = option.value === state.deplacement;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={{ flex: 1 }}
                  onPress={() => updateState({ deplacement: option.value })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>Suivant : Observations ›</Text>
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
  speciesButton: { flex: 1, borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, overflow: 'hidden', textAlign: 'center' },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  densiteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: GREEN, borderRadius: 10, paddingVertical: 6, paddingLeft: 13, paddingRight: 8, marginBottom: 12 },
  densiteLabel: { fontSize: 13, fontWeight: '700', color: TEXT },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 32, height: 32, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 17, fontWeight: '700', color: TEXT, minWidth: 16, textAlign: 'center', fontFamily: 'monospace' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  markCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 9, padding: 8, alignItems: 'center' },
  markCardActive: { backgroundColor: '#f6f3e9', borderWidth: 0 },
  markLabel: { fontSize: 9, fontWeight: '500', color: '#9a9484' },
  markValue: { fontSize: 13, fontWeight: '700', color: '#bdb6a2' },
  markValueActive: { color: TEXT },
  card: { backgroundColor: '#f6f3e9', borderRadius: 9, padding: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484' },
  inputMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: AMBER, borderRadius: 13, padding: 14, alignItems: 'center' },
  continueButtonText: { color: TEXT, fontWeight: '800', fontSize: 14 },
});
