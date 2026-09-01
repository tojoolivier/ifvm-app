import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';

const GREEN = '#235a36';
const BLUE = '#31567f';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

type ModeExtensif = 'terrestre' | 'aerien';

/**
 * Choix du mode de la fiche extensive, avant toute saisie — le mode terrestre
 * charge la fiche extensive exactement comme avant (aucun champ aérien affiché,
 * aucune donnée aérienne créée) ; le mode aérien ajoute le bloc équipe/aéronef et
 * les opérations de vol sur le slide Références (cf. extensive-reference.tsx).
 */
export default function ExtensiveModeChooserScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const { run, isRunning: isCreating } = useAsyncAction();
  const [mode, setMode] = useState<ModeExtensif | null>(null);

  const handleContinue = () =>
    run(
      async () => {
        const draft = await startNewProspection({
          token: token!,
          prospecteurId: user!.id,
          typeProspection: 'extensive',
          modeExtensif: mode,
        });
        await hydrateFromDraft(draft.id);
        router.replace({ pathname: '/(prospection)/extensive-reference' as any, params: { draftId: draft.id } });
      },
      {
        screen: 'extensive-mode-chooser',
        precondition: !!user && !!token && !!mode,
        preconditionMessage: mode
          ? 'Session expirée — reconnectez-vous pour créer une fiche.'
          : 'Choisissez un mode de prospection avant de continuer.',
        context: { typeProspection: 'extensive', mode },
      }
    );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Type de prospection</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.hint}>Choisissez comment cette prospection extensive a été réalisée.</Text>

          <TouchableOpacity
            style={[styles.card, mode === 'terrestre' && styles.cardActiveGreen]}
            onPress={() => setMode('terrestre')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🟢</Text>
            <Text style={styles.cardTitle}>Prospection Terrestre</Text>
            <Text style={styles.cardSubtitle}>Prospection réalisée au sol.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, mode === 'aerien' && styles.cardActiveBlue]}
            onPress={() => setMode('aerien')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🔵</Text>
            <Text style={styles.cardTitle}>Prospection Aérienne</Text>
            <Text style={styles.cardSubtitle}>Prospection réalisée à partir d&apos;un aéronef.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !mode && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!mode || isCreating}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{isCreating ? 'Création…' : 'Continuer'}</Text>
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
  content: { flex: 1, paddingHorizontal: 16 },
  hint: { fontSize: 12, lineHeight: 17, color: TEXT_SECONDARY, marginBottom: 14 },
  card: { borderRadius: 14, padding: 17, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: BORDER },
  cardActiveGreen: { borderColor: GREEN, borderWidth: 2, backgroundColor: '#eaf2ec' },
  cardActiveBlue: { borderColor: BLUE, borderWidth: 2, backgroundColor: '#eaf0f7' },
  cardIcon: { fontSize: 18, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  cardSubtitle: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginTop: 4 },
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
