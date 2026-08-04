import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PopulationRow,
  getProspectionPopulation,
  saveProspectionPopulation,
} from '@/lib/prospection-repository';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
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

export default function DensityScreen() {
  const router = useRouter();
  const { draftId, grilleIndex } = useLocalSearchParams<{ draftId: string; grilleIndex: string }>();
  const store = useProspectionCaptureStore();
  const requestedIndex = Number(grilleIndex ?? '0');
  const grille = store.grilleOrder[requestedIndex];

  const [population, setPopulation] = useState<PopulationRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftId || !grille) return;
    getProspectionPopulation(draftId, grille.espece, grille.categorie).then((row) => {
      setPopulation(row ?? emptyPopulation(grille.espece));
    });
  }, [draftId, grille?.espece, grille?.categorie]);

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

  const handleBack = () => {
    if (isFirstGrille) {
      router.replace({ pathname: '/(prospection)/species' as any, params: { draftId } });
    } else {
      router.replace({
        pathname: '/(prospection)/captures' as any,
        params: { draftId, grilleIndex: String(requestedIndex - 1) },
      });
    }
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;
    setIsSaving(true);
    try {
      await saveProspectionPopulation(draftId, population);
      router.replace({
        pathname: '/(prospection)/accouplement' as any,
        params: { draftId, grilleIndex: String(requestedIndex) },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{ESPECE_LABEL[grille.espece]} · densités</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.fieldsRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Densité diffuse (/ha)</Text>
              <TextInput
                value={population.densite_diffuse != null ? String(population.densite_diffuse) : ''}
                onChangeText={(text) => setField('densite_diffuse', text === '' ? null : Number(text))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Densité groupée (/m²)</Text>
              <TextInput
                value={population.densite_groupee != null ? String(population.densite_groupee) : ''}
                onChangeText={(text) => setField('densite_groupee', text === '' ? null : Number(text))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Méthode</Text>
          <View style={styles.chipsRow}>
            {(['visuel', 'comptage_direct'] as const).map((option) => {
              const active = option === population.methode;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setField('methode', option)}
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

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>Accouplement  ›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 14, fontWeight: '700', color: TEXT },
  scroll: { flex: 1 },
  fieldsRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  field: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10 },
  fieldLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 2 },
  fieldInput: { fontSize: 16, fontWeight: '700', color: TEXT, padding: 0 },
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
