import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProspectionExtensiveObservations } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { NIVEAU_OPTIONS } from '@/lib/prospection-extensive';
import { DateField } from '@/components/DateField';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

export default function ExtensiveObservationsScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);

  const [degats, setDegats] = useState(draft?.degats_cultures_pourcent ?? 0);
  const [verdure, setVerdure] = useState(draft?.verdure_strate ?? 'moyenne');
  const [hauteur, setHauteur] = useState(draft?.hauteur_herbe_cm != null ? String(draft.hauteur_herbe_cm) : '');
  const [dernierePluie, setDernierePluie] = useState(draft?.derniere_pluie ?? '');
  const [intensite, setIntensite] = useState(draft?.intensite_pluie ?? 'faible');
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (!draftId || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await updateProspectionExtensiveObservations(draftId, {
        degatsCulturesPourcent: degats,
        verdureStrate: verdure || null,
        hauteurHerbeCm: hauteur ? parseFloat(hauteur) : null,
        dernierePluie: dernierePluie || null,
        intensitePluie: intensite || null,
      });
      setDraft(updated);
      router.push({ pathname: '/(prospection)/extensive-recap' as any, params: { draftId } });
    } finally {
      setIsSaving(false);
    }
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
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Observations</Text>
          </View>
          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.progressBar, styles.progressActive]} />
            ))}
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <View style={styles.card}>
              <Text style={styles.label}>Dégâts sur les cultures</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperButton} onPress={() => setDegats(Math.max(0, degats - 5))}>
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  value={String(degats)}
                  onChangeText={(v) => {
                    const parsed = parseInt(v, 10);
                    setDegats(Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed)));
                  }}
                  keyboardType="number-pad"
                  style={styles.stepperInput}
                />
                <Text style={styles.stepperUnit}>%</Text>
                <TouchableOpacity style={[styles.stepperButton, styles.stepperButtonAdd]} onPress={() => setDegats(Math.min(100, degats + 5))}>
                  <Text style={[styles.stepperButtonText, styles.stepperButtonAddText]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Verdure strate herbeuse</Text>
            <View style={[styles.chipsRow, { marginBottom: 10 }]}>
              {NIVEAU_OPTIONS.map((option) => {
                const active = option.value === verdure;
                return (
                  <TouchableOpacity key={option.value} style={{ flex: 1 }} onPress={() => setVerdure(option.value)} activeOpacity={0.7}>
                    <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { marginBottom: 9 }]}>
              <Text style={styles.label}>H Str Herb (cm)</Text>
              <TextInput value={hauteur} onChangeText={setHauteur} keyboardType="decimal-pad" style={styles.input} />
            </View>

            <View style={styles.row}>
              <View style={[styles.card, styles.flex1]}>
                <Text style={styles.label}>Dernière pluie le</Text>
                <DateField
                  value={dernierePluie || null}
                  onChange={setDernierePluie}
                  maximumDate={new Date()}
                  style={styles.dateFieldBox}
                  textStyle={styles.input}
                  placeholderStyle={[styles.input, { fontWeight: '500', color: TEXT_SECONDARY }]}
                />
              </View>
              <View style={[styles.flex1, { gap: 5 }]}>
                <Text style={styles.label}>Intensité</Text>
                <View style={styles.chipsRow}>
                  {NIVEAU_OPTIONS.map((option) => {
                    const active = option.value === intensite;
                    return (
                      <TouchableOpacity key={option.value} style={{ flex: 1 }} onPress={() => setIntensite(option.value)} activeOpacity={0.7}>
                        <Text style={[styles.chip, styles.chipCompact, active && styles.chipActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>Dernier écran de saisie — données culture/climat, communes aux deux espèces.</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Suivant : Récapitulatif ›</Text>
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 9 },
  label: { fontSize: 9, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  input: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepperButton: { width: 32, height: 32, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  stepperButtonAdd: { backgroundColor: '#c0412b' },
  stepperButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  stepperButtonAddText: { color: '#fff' },
  stepperValue: { fontSize: 15, fontWeight: '700', color: TEXT, fontFamily: 'monospace', flex: 1 },
  stepperInput: { fontSize: 15, fontWeight: '700', color: TEXT, fontFamily: 'monospace', flex: 1, textAlign: 'right', padding: 0 },
  stepperUnit: { fontSize: 15, fontWeight: '700', color: TEXT },
  sectionLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingVertical: 8, textAlign: 'center', borderRadius: 8, overflow: 'hidden' },
  chipCompact: { fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 2 },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 9, marginBottom: 9 },
  flex1: { flex: 1 },
  footerNote: { marginTop: 14, backgroundColor: '#eaf2ec', borderRadius: 10, padding: 11 },
  footerNoteText: { fontSize: 11, lineHeight: 16, color: GREEN, fontWeight: '500' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
