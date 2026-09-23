import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { updateProspectionSignalement } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { DateField } from '@/components/DateField';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { logger } from '@/lib/logger';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/** Signalement = un rapport externe (citoyen, agent local, autorité) qui déclenche cette prospection de vérification.
 * Il n'existe pas encore de liste de signalements côté serveur (cf. ADR-006) : saisie manuelle en attendant. */
export default function ExtensiveSignalementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);

  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  const canContinue = source.trim().length > 0 && description.trim().length > 0;

  // #brouillon-des-le-debut : le brouillon existe dès l'arrivée sur cet écran,
  // avant même que l'agent ait tapé quoi que ce soit — pour ne jamais perdre
  // une saisie commencée s'il quitte l'écran ou ferme l'application avant
  // « Continuer » (même garde-fou que `chooseIntensive` sur type-chooser.tsx,
  // qui crée déjà son brouillon immédiatement).
  const creationLanceeRef = useRef(false);
  useEffect(() => {
    if (creationLanceeRef.current || !user || !token) return;
    creationLanceeRef.current = true;
    let cancelled = false;
    void startNewProspection({ token, prospecteurId: user.id, typeProspection: 'validation' })
      .then(async (draft) => {
        if (cancelled) return;
        setDraftId(draft.id);
        await hydrateFromDraft(draft.id);
      })
      .catch((error) => {
        // Réessayable : un prochain rendu (ex. reconnexion) relance la création.
        creationLanceeRef.current = false;
        logger.failure('extensive-signalement.creationBrouillon.failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user, token, hydrateFromDraft]);

  // #brouillon-progressif : sauvegarde des trois champs à chaque modification,
  // une fois le brouillon créé — léger débounce pour ne pas écrire à chaque
  // frappe sur la Description (multiligne).
  useEffect(() => {
    if (!draftId) return;
    const timer = setTimeout(() => {
      void updateProspectionSignalement(draftId, {
        signalementSource: source.trim() || null,
        signalementDate: date.trim() || null,
        signalementDescription: description.trim() || null,
      }).catch((error) => logger.ignore(error, 'Sauvegarde progressive du signalement impossible'));
    }, 400);
    return () => clearTimeout(timer);
  }, [draftId, source, date, description]);

  const startValidation = () =>
    run(
      async () => {
        await updateProspectionSignalement(draftId!, {
          signalementSource: source.trim(),
          signalementDate: date.trim() || null,
          signalementDescription: description.trim(),
        });
        router.replace({ pathname: '/(prospection)/extensive-mode-chooser' as any, params: { draftId: draftId! } });
      },
      {
        screen: 'extensive-signalement',
        precondition: !!draftId && canContinue,
        preconditionMessage: !draftId
          ? 'Brouillon en cours de création — patientez un instant.'
          : 'Renseignez la source et la description avant de continuer.',
        context: { draftId },
      }
    );

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
            <Text style={styles.title}>Vérifier un signalement</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.hint}>
              Renseignez le signalement reçu (SMS, appel, agent local) avant de vous rendre sur place.
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>Source</Text>
              <TextInput
                value={source}
                onChangeText={setSource}
                placeholder="Ex. Rasoanaivo (habitant)"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Date du signalement</Text>
              <DateField
                value={date || null}
                onChange={setDate}
                maximumDate={new Date()}
                style={styles.dateFieldBox}
                textStyle={styles.input}
                placeholderStyle={[styles.input, { color: TEXT_SECONDARY }]}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ce qui a été signalé"
                placeholderTextColor={TEXT_SECONDARY}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
              onPress={startValidation}
              disabled={!canContinue || !draftId || isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>
                {!draftId ? 'Initialisation…' : isSaving ? 'Enregistrement…' : 'Continuer : Type de prospection ›'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  hint: 11.5,
  label: 9,
  input: 13,
  continueButtonText: 15,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: typeSizes.back, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: typeSizes.title, fontWeight: '700', color: TEXT },
  scroll: { flex: 1 },
  hint: { fontSize: typeSizes.hint, lineHeight: 16, color: TEXT_SECONDARY, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 10 },
  label: { fontSize: typeSizes.label, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 4 },
  input: { fontSize: typeSizes.input, fontWeight: '600', color: TEXT, padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.continueButtonText },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
