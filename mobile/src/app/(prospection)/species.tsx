import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EMPTY_ESPECE_SELECTION,
  EspeceSelection,
  countGrilles,
  buildGrilles,
  saveEspeceSelection,
} from '@/lib/prospection-especes';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#f1ede1';
const INACTIVE_TEXT = '#9a9484';

export default function SpeciesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const captures = useProspectionWizardStore((s) => s.captures);
  const initGrilles = useProspectionCaptureStore((s) => s.initGrilles);
  const [selection, setSelection] = useState<EspeceSelection>({ ...EMPTY_ESPECE_SELECTION });
  const [isSaving, setIsSaving] = useState(false);

  const stepsCount = countGrilles(selection);

  const toggle = (field: keyof EspeceSelection) => {
    setSelection((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleContinue = async () => {
    if (!draftId || stepsCount === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await saveEspeceSelection(draftId, selection);
      const grilles = buildGrilles(selection);
      initGrilles(grilles, [], captures);
      const firstScreen = grilles[0]?.categorie === 'imago' ? 'density' : 'captures';
      router.push({ pathname: `/(prospection)/${firstScreen}` as any, params: { draftId, grilleIndex: '0' } });
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
            <Text style={styles.title}>Qu&apos;avez-vous observé ?</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <View style={styles.content}>
            <Text style={styles.hint}>Touchez les stades présents. Seules les grilles cochées apparaîtront.</Text>

            <View style={[styles.card, styles.cardActive]}>
              <Text style={styles.cardTitle}>
                Locusta migratoria <Text style={styles.italic}>capito</Text>
              </Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggle, selection.lmcImago && styles.toggleActive]}
                  onPress={() => toggle('lmcImago')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, selection.lmcImago && styles.toggleTextActive]}>Imagos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggle, selection.lmcLarve && styles.toggleActive]}
                  onPress={() => toggle('lmcLarve')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, selection.lmcLarve && styles.toggleTextActive]}>Larves</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Nomadacris <Text style={styles.italic}>septemfasciata</Text>
              </Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggle, selection.nseImago && styles.toggleActive]}
                  onPress={() => toggle('nseImago')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, selection.nseImago && styles.toggleTextActive]}>Imagos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggle, selection.nseLarve && styles.toggleActive]}
                  onPress={() => toggle('nseLarve')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, selection.nseLarve && styles.toggleTextActive]}>Larves</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepsHint}>
              <Text style={styles.stepsHintIcon}>⚡</Text>
              <Text style={styles.stepsHintText}>
                <Text style={styles.stepsHintStrong}>{stepsCount} grille(s)</Text> à remplir selon votre sélection.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, stepsCount === 0 && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={stepsCount === 0 || isSaving}
              activeOpacity={0.85}
            >
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 14 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  content: { flex: 1, paddingHorizontal: 16 },
  hint: { fontSize: 12, lineHeight: 17, color: TEXT_SECONDARY, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 14, marginBottom: 12 },
  cardActive: { borderWidth: 2, borderColor: GREEN },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  italic: { fontStyle: 'italic', fontWeight: '500', color: TEXT_SECONDARY },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggle: { flex: 1, borderRadius: 9, padding: 11, alignItems: 'center', backgroundColor: INACTIVE_BG },
  toggleActive: { backgroundColor: GREEN },
  toggleText: { fontWeight: '700', fontSize: 12.5, color: INACTIVE_TEXT },
  toggleTextActive: { color: '#fff' },
  stepsHint: { marginTop: 4, backgroundColor: '#eaf2ec', borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepsHintIcon: { fontSize: 18 },
  stepsHintText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: GREEN },
  stepsHintStrong: { fontWeight: '700' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
