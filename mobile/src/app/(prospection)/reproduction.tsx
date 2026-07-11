import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionPopulation, DraftProspection } from '@/lib/prospection-repository';
import {
  EMPTY_REPRODUCTION,
  INTENSITE_OPTIONS,
  Intensite,
  ReproductionState,
  parseReproduction,
  saveReproduction,
} from '@/lib/prospection-densites';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type NextRoute = 'plan' | 'vegetation';

export default function ReproductionScreen() {
  const router = useRouter();
  const { draftId, espece, next } = useLocalSearchParams<{
    draftId: string;
    espece: 'LMC' | 'NSE';
    next: NextRoute;
  }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<ReproductionState>(EMPTY_REPRODUCTION);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !espece) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const imago = await getProspectionPopulation(row.id, espece, 'imago');
      setState(parseReproduction(imago));
    });
  }, [draftId, espece]);

  const handleContinuer = async () => {
    if (!draft || !espece) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveReproduction(draft.id, espece, state);
      router.push({ pathname: `/(prospection)/${next}`, params: { draftId: draft.id } });
    } catch {
      setSaveError('Impossible d’enregistrer l’accouplement/ponte localement');
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
        <Text style={styles.headerTitle}>Accouplement / Ponte — {espece}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 3/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <IntensiteCard
          label="Accouplement"
          selected={state.accouplement}
          onSelect={(accouplement) => setState((prev) => ({ ...prev, accouplement }))}
        />
        <IntensiteCard
          label="Ponte"
          selected={state.ponte}
          onSelect={(ponte) => setState((prev) => ({ ...prev, ponte }))}
        />

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity style={styles.btnContinuer} onPress={handleContinuer} disabled={isSaving} activeOpacity={0.85}>
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Continuer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function IntensiteCard({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: Intensite | null;
  onSelect: (value: Intensite) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.chipsRow}>
        {INTENSITE_OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(option.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
