import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { useAsyncAction } from '@/hooks/use-async-action';
import { DEGATS_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { ENNEMIS_OPTIONS, parseEnnemis, serializeEnnemis } from '@/lib/prospection-observations';
import { ObservationsFormValues } from '@/lib/prospection-observations-schema';
import { updateProspectionObservations } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { DateField } from '@/components/DateField';

const ORANGE = '#e89b2b';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

// ==========================================
// OPTIONS INTENSITE PLUIE
// ==========================================

const INTENSITE_PLUIE_OPTIONS = [
  { value: 'faible', label: 'Faible' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'forte', label: 'Forte' },
] as const;

export default function ObservationsScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const { run, isRunning: isSaving } = useAsyncAction();
  const initialEnnemis = parseEnnemis(draft?.ennemis_naturels ?? null);
  const [showAutre, setShowAutre] = useState(initialEnnemis.autre !== '');
  const scrollRef = useRef<ScrollView>(null);

  const form = useForm({
    defaultValues: {
      dernierePluieDate: draft?.derniere_pluie ?? '',
      intensitePluie: draft?.intensite_pluie ?? null,
      degatsCultures: draft?.degats_cultures ?? null,
      ennemisSelected: initialEnnemis.selected,
      ennemisAutre: initialEnnemis.autre,
      observation: draft?.observations ?? '',
    } as ObservationsFormValues & {
      dernierePluieDate: string;
      intensitePluie: string | null;
    },
    onSubmitInvalid: () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    onSubmit: async ({ value }) => {
      return run(
        async () => {
          // Mettre à jour la prospection avec les champs de pluie
          // Note: ces champs doivent être ajoutés dans la table prospection
          // et dans updateProspectionObservations
          const updated = await updateProspectionObservations(draftId, {
            degatsCultures: value.degatsCultures,
            ennemisNaturels: serializeEnnemis(value.ennemisSelected, value.ennemisAutre),
            observations: value.observation || null,
            dernierePluie: value.dernierePluieDate || null,
            intensitePluie: value.intensitePluie || null,
          });
          setDraft(updated);
          router.push({ pathname: '/(prospection)/review' as any, params: { draftId } });
        },
        {
          screen: 'observations',
          precondition: !!draftId,
          preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
          context: { draftId },
        }
      );
    },
  });

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

          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            {/* ==========================================
                SECTION : DERNIERE PLUIE
                ========================================== */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>🌧️ Dernière pluie</Text>

              <form.Field name="dernierePluieDate">
                {(field) => (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <DateField
                      value={field.state.value || null}
                      onChange={field.handleChange}
                      maximumDate={new Date()}
                      style={styles.dateFieldBox}
                    />
                  </View>
                )}
              </form.Field>

              <form.Field name="intensitePluie">
                {(field) => (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Intensité</Text>
                    <View style={styles.chipsRow}>
                      {INTENSITE_PLUIE_OPTIONS.map((option) => {
                        const active = option.value === field.state.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.chip, styles.chipFlex, active && styles.chipActive]}
                            onPress={() => {
                              field.handleChange(option.value);
                              field.handleBlur();
                            }}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </form.Field>
            </View>

            {/* ==========================================
                SECTION : DEGATS SUR CULTURE
                ========================================== */}

            <form.Field
              name="degatsCultures"
              validators={{
                onChange: ({ value }) => (value ? undefined : 'Dégâts sur culture requis'),
                onBlur: ({ value }) => (value ? undefined : 'Dégâts sur culture requis'),
              }}
            >
              {(field) => {
                const showError = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <View style={[styles.card, showError && styles.cardError]}>
                    <Text style={styles.cardTitle}>Dégâts sur culture</Text>
                    <View style={styles.chipsRow}>
                      {DEGATS_OPTIONS.map((option) => {
                        const active = option.value === field.state.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.chip, styles.chipFlex, active && styles.chipActive]}
                            onPress={() => {
                              field.handleChange(option.value);
                              field.handleBlur();
                            }}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {showError && <Text style={styles.errorText}>{field.state.meta.errors[0]}</Text>}
                  </View>
                );
              }}
            </form.Field>

            {/* ==========================================
                SECTION : ENNEMIS NATURELS
                ========================================== */}

            <form.Field name="ennemisSelected">
              {(field) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Ennemis naturels observés</Text>
                  <View style={styles.chipsRow}>
                    {ENNEMIS_OPTIONS.map((option) => {
                      const active = field.state.value.includes(option);
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() =>
                            field.handleChange(
                              active ? field.state.value.filter((v) => v !== option) : [...field.state.value, option]
                            )
                          }
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.chip, showAutre && styles.chipActive]}
                      onPress={() => setShowAutre((current) => !current)}
                    >
                      <Text style={[styles.chipText, showAutre && styles.chipTextActive]}>+ Autre</Text>
                    </TouchableOpacity>
                  </View>
                  {showAutre && (
                    <form.Field name="ennemisAutre">
                      {(autreField) => (
                        <TextInput
                          value={autreField.state.value}
                          onChangeText={autreField.handleChange}
                          placeholder="préciser…"
                          style={styles.textInput}
                        />
                      )}
                    </form.Field>
                  )}
                </View>
              )}
            </form.Field>

            {/* ==========================================
                SECTION : OBSERVATION LIBRE
                ========================================== */}

            <form.Field name="observation">
              {(field) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Observation libre</Text>
                  <TextInput
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    placeholder="Tout évènement susceptible de compléter les observations…"
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.textArea]}
                  />
                </View>
              )}
            </form.Field>

            {/* ==========================================
                SECTION : PHOTO
                ========================================== */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Photo</Text>
              <TouchableOpacity style={styles.photoSlot} activeOpacity={0.7}>
                <Text style={styles.photoSlotText}>+ Photo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={form.handleSubmit} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Vérifier & enregistrer ✓'}</Text>
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
  scroll: { flex: 1 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardError: { borderColor: '#c0412b', borderWidth: 1.5 },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: TEXT, marginBottom: 11 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipFlex: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: '#235a36' },
  chipText: { fontSize: 11.5, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  textInput: { backgroundColor: '#f6f3e9', borderRadius: 7, padding: 8, fontSize: 12, fontWeight: '500', color: TEXT, marginTop: 4 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, borderRadius: 7, backgroundColor: '#f6f3e9', paddingHorizontal: 8, paddingVertical: 8, marginTop: 4 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: TEXT_SECONDARY, marginBottom: 4 },
  photoSlot: {
    width: 84,
    height: 84,
    borderWidth: 1.5,
    borderColor: '#cfc7ae',
    borderStyle: 'dashed',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotText: { fontSize: 11, fontWeight: '600', color: '#9a9484' },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: ORANGE, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: TEXT, fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
