import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionInfestation, DraftProspection } from '@/lib/prospection-repository';
import {
  EMPTY_INFESTATION_DESCRIPTION,
  InfestationDescriptionState,
  TYPE_CIBLE_OPTIONS,
  TypeCible,
  isInfestationDescriptionComplete,
  parseInfestationDescription,
  saveInfestationDescription,
} from '@/lib/prospection-infestation';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type NextRoute = 'plan' | 'vegetation';

export default function InfestationDescriptionScreen() {
  const router = useRouter();
  const { draftId, next } = useLocalSearchParams<{ draftId: string; next: NextRoute }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<InfestationDescriptionState>(EMPTY_INFESTATION_DESCRIPTION);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const infestation = await getProspectionInfestation(row.id);
      setState(parseInfestationDescription(infestation));
    });
  }, [draftId]);

  const canContinue = isInfestationDescriptionComplete(state) && !isSaving;

  const handleContinuer = async () => {
    if (!draft || !isInfestationDescriptionComplete(state)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveInfestationDescription(draft.id, state);
      router.push({
        pathname: '/(prospection)/infestation-comportement',
        params: { draftId: draft.id, next },
      });
    } catch {
      setSaveError('Impossible d’enregistrer la description localement');
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
        <Text style={styles.headerTitle}>Infestation — Description</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '85%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type de cible</Text>
          <View style={styles.chipsRow}>
            {TYPE_CIBLE_OPTIONS.map((option) => {
              const active = state.typeCible === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, typeCible: option.value as TypeCible }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Taille (m)</Text>
          <NumberField label="Min" value={state.tailleMin} onChangeText={(v) => setState((p) => ({ ...p, tailleMin: v }))} />
          <NumberField label="Max" value={state.tailleMax} onChangeText={(v) => setState((p) => ({ ...p, tailleMax: v }))} />
          <NumberField label="Moy" value={state.tailleMoy} onChangeText={(v) => setState((p) => ({ ...p, tailleMoy: v }))} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Surface totale (ha)</Text>
          <NumberField label="Surface" value={state.surfaceTot} onChangeText={(v) => setState((p) => ({ ...p, surfaceTot: v }))} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Densité (/m²)</Text>
          <NumberField label="Min" value={state.densiteMin} onChangeText={(v) => setState((p) => ({ ...p, densiteMin: v }))} />
          <NumberField label="Max" value={state.densiteMax} onChangeText={(v) => setState((p) => ({ ...p, densiteMax: v }))} />
          <NumberField label="Moy" value={state.densiteMoy} onChangeText={(v) => setState((p) => ({ ...p, densiteMoy: v }))} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Interdistance (m)</Text>
          <NumberField
            label="Moyenne"
            value={state.interdistance}
            onChangeText={(v) => setState((p) => ({ ...p, interdistance: v }))}
          />
        </View>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.btnContinuer, !canContinue && styles.btnDisabled]}
          onPress={handleContinuer}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Continuer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function NumberField({
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
  btnDisabled: { opacity: 0.5 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
