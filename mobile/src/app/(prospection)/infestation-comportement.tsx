// src/app/(prospection)/infestation-comportement.tsx

import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionInfestation, DraftProspection } from '@/lib/prospection-repository';
import {
  COMPORTEMENT_OPTIONS,
  Comportement,
  DIRECTION_OPTIONS,
  Direction,
  EMPTY_INFESTATION_COMPORTEMENT,
  InfestationComportementState,
  parseInfestationComportement,
  saveInfestationComportement,
} from '@/lib/prospection-infestation';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type NextRoute = 'plan' | 'vegetation';

export default function InfestationComportementScreen() {
  const router = useRouter();
  const { draftId, next } = useLocalSearchParams<{ draftId: string; next: NextRoute }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<InfestationComportementState>(EMPTY_INFESTATION_COMPORTEMENT);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const infestation = await getProspectionInfestation(row.id);
      setState(parseInfestationComportement(infestation));
    });
  }, [draftId]);

  const handleContinuer = async () => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveInfestationComportement(draft.id, state);
      router.push({ pathname: `/(prospection)/${next ?? 'vegetation'}`, params: { draftId: draft.id } });
    } catch {
      setSaveError('Impossible d’enregistrer le comportement localement');
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.headerTitle}>Infestation — Comportement</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '90%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>État</Text>
          <View style={styles.chipsRow}>
            {COMPORTEMENT_OPTIONS.map((option) => {
              const active = state.comportement === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, comportement: option.value as Comportement }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Direction du déplacement</Text>
          <View style={styles.chipsRow}>
            {DIRECTION_OPTIONS.map((option) => {
              const active = state.directionVers === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, directionVers: option.value as Direction }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vent — direction</Text>
          <View style={styles.chipsRow}>
            {DIRECTION_OPTIONS.map((option) => {
              const active = state.ventDe === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, ventDe: option.value as Direction }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vent — vitesse (km/h)</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Vitesse</Text>
            <TextInput
              style={styles.fieldInput}
              value={state.ventVitesse}
              onChangeText={(v) => setState((prev) => ({ ...prev, ventVitesse: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity style={styles.btnContinuer} onPress={handleContinuer} disabled={isSaving} activeOpacity={0.85}>
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Continuer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FFFFFF' },
  progressLabel: { color: '#FFFFFFAA', fontSize: 11, marginTop: 4 },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { color: '#6B7280', fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    textAlign: 'right',
    color: '#111827',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  chipText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: IFVM_GREEN_DARK },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
