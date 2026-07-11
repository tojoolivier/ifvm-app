import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import {
  countGrilles,
  hasSelection,
  parseEspeceSelection,
  saveEspeceSelection,
  EspeceSelection,
} from '@/lib/prospection-especes';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

export default function EspecesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [selection, setSelection] = useState<EspeceSelection>({
    lmcImago: false,
    lmcLarve: false,
    nseImago: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then((row) => {
      setDraft(row);
      if (row) setSelection(parseEspeceSelection(row.especes));
    });
  }, [draftId]);

  const grilleCount = useMemo(() => countGrilles(selection), [selection]);
  const canContinue = hasSelection(selection) && !isSaving;

  const toggle = (key: keyof EspeceSelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinuer = async () => {
    if (!draft || !hasSelection(selection)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveEspeceSelection(draft.id, selection);
      router.push({ pathname: '/(prospection)/captures', params: { draftId: draft.id, grilleIndex: '0' } });
    } catch {
      setSaveError("Impossible d'enregistrer la sélection localement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(prospection)/reference', params: { draftId } })}>
          <Text style={styles.backLink}>‹ Référence & position</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Espèces observées</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 2/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Locusta migratoria capito (LMC)</Text>
          <ToggleRow label="Imagos" active={selection.lmcImago} onPress={() => toggle('lmcImago')} />
          <ToggleRow label="Larves" active={selection.lmcLarve} onPress={() => toggle('lmcLarve')} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Nomadacris septemfasciata (NSE)</Text>
          <ToggleRow label="Imagos" active={selection.nseImago} onPress={() => toggle('nseImago')} />
        </View>

        <View style={styles.card}>
          <Text style={styles.grilleCount}>
            {grilleCount} grille{grilleCount > 1 ? 's' : ''} à remplir
          </Text>
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

function ToggleRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.toggleRow, active && styles.toggleRowActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
      <View style={[styles.toggleIndicator, active && styles.toggleIndicatorActive]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  backLink: { color: '#FFFFFFCC', fontSize: 13, marginBottom: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FFFFFF' },
  progressLabel: { color: '#FFFFFFAA', fontSize: 11, marginTop: 4 },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 6,
  },
  toggleRowActive: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  toggleLabel: { color: '#111827', fontSize: 14, fontWeight: '600' },
  toggleLabelActive: { color: IFVM_GREEN_DARK },
  toggleIndicator: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB' },
  toggleIndicatorActive: { backgroundColor: IFVM_GREEN, borderColor: IFVM_GREEN },
  grilleCount: { color: '#111827', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
