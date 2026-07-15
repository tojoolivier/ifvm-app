// src/app/(prospection)/densites.tsx

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionPopulation, DraftProspection } from '@/lib/prospection-repository';
import { parseEspeceSelection } from '@/lib/prospection-especes';
import {
  DensitesState,
  EMPTY_DENSITES,
  METHODE_OPTIONS,
  MethodeMesure,
  parseDensites,
  saveDensites,
} from '@/lib/prospection-densites';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type NextRoute = 'plan' | 'infestation' | 'vegetation';

export default function DensitesScreen() {
  const router = useRouter();
  const { draftId, espece, next } = useLocalSearchParams<{
    draftId: string;
    espece: 'LMC' | 'NSE';
    next: NextRoute;
  }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<DensitesState>(EMPTY_DENSITES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !espece) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const [imago, larve] = await Promise.all([
        getProspectionPopulation(row.id, espece, 'imago'),
        getProspectionPopulation(row.id, espece, 'larve'),
      ]);
      setState(parseDensites(imago, larve));
    });
  }, [draftId, espece]);

  const hasImago = useMemo(() => {
    if (!draft) return false;
    const selection = parseEspeceSelection(draft.especes);
    return espece === 'LMC' ? selection.lmcImago : selection.nseImago;
  }, [draft, espece]);

  const handleContinuer = async () => {
    if (!draft || !espece) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveDensites(draft.id, espece, state);
      if (hasImago) {
        router.push({
          pathname: '/(prospection)/reproduction',
          params: { draftId: draft.id, espece, next },
        });
      } else {
        router.push({ pathname: `/(prospection)/${next}`, params: { draftId: draft.id } });
      }
    } catch {
      setSaveError('Impossible d’enregistrer les densités localement');
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft || !espece) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.headerTitle}>Densités — {espece}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 3/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Population diffuse (/ha)</Text>
          <DensiteField
            label="Imagos"
            value={state.diffuseImago}
            onChangeText={(v) => setState((prev) => ({ ...prev, diffuseImago: v }))}
          />
          <DensiteField
            label="Larves"
            value={state.diffuseLarve}
            onChangeText={(v) => setState((prev) => ({ ...prev, diffuseLarve: v }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Population groupée « taches / bandes » (/m²)</Text>
          <DensiteField
            label="Imagos"
            value={state.groupeeImago}
            onChangeText={(v) => setState((prev) => ({ ...prev, groupeeImago: v }))}
          />
          <DensiteField
            label="Larves"
            value={state.groupeeLarve}
            onChangeText={(v) => setState((prev) => ({ ...prev, groupeeLarve: v }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Méthode de mesure</Text>
          <View style={styles.chipsRow}>
            {METHODE_OPTIONS.map((option) => {
              const active = state.methode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, methode: option.value as MethodeMesure }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
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

function DensiteField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
      />
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
