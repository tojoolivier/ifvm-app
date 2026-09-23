import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { DEGATS_OPTIONS, formatHeureLocale } from '@/lib/prospection-fiche-lecture';
import { ENNEMIS_OPTIONS, parseEnnemis, serializeEnnemis } from '@/lib/prospection-observations';
import { ObservationsFormValues } from '@/lib/prospection-observations-schema';
import { ObservationsUpdateInput, updateProspectionObservations } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import { DateField } from '@/components/DateField';
import { SignaturePad } from '@/components/traitement/SignaturePad';

const ORANGE = '#e89b2b';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';
const GREEN = '#235a36';
const AUTO_BG = '#eaf2ec';

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
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('observations');
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const initialEnnemis = parseEnnemis(draft?.ennemis_naturels ?? null);
  const [showAutre, setShowAutre] = useState(initialEnnemis.autre !== '');
  const scrollRef = useRef<ScrollView>(null);
  // Horodatage technique (ISO, fuseau inclus) de l'heure d'observation — la valeur
  // affichée (HH:mm) en est dérivée à l'affichage, jamais stockée séparément.
  const [heureObservationAt, setHeureObservationAt] = useState<string | null>(null);

  // ==========================================
  // SIGNATURE — auto-signature du prospecteur connecté
  // ==========================================
  // Remplace le champ « Photo » (jamais câblé). Le nom vient uniquement du
  // compte connecté — jamais ressaisi, jamais choisi dans une liste — seul le
  // tracé (`SignaturePad`) est capturé ici. Réutilise `signature_visa_nom`/
  // `_horodatage` (migration 0036, colonnes historiquement mortes pour
  // l'Intensif) + `signature_visa_image` (migration 0082). Même mécanique
  // VALIDER/MODIFIER que extensive-observations.tsx, simplifiée à un unique
  // signataire toujours connu (pas de sélection de personne).
  const user = useAuthStore((s) => s.user);
  const prospecteurNom = user ? `${user.prenom} ${user.nom}` : null;
  const [signatureNom, setSignatureNom] = useState<string | null>(draft?.signature_visa_nom ?? null);
  const [signatureHorodatage, setSignatureHorodatage] = useState<string | null>(draft?.signature_visa_horodatage ?? null);
  const [signatureImage, setSignatureImage] = useState<string | null>(draft?.signature_visa_image ?? null);
  // Tracé en cours (avant VALIDER), jamais persisté tant que VALIDER n'a pas
  // été pressé. `resetTick` force le remontage du SignaturePad (non contrôlé)
  // pour repartir d'un tracé vierge après MODIFIER.
  const [pendingPath, setPendingPath] = useState('');
  const [resetTick, setResetTick] = useState(0);
  // Une signature jamais validée est implicitement en édition (`!signatureImage`) ;
  // ce booléen ne sert qu'à rouvrir l'édition d'une signature déjà validée (MODIFIER).
  const [editingSignature, setEditingSignature] = useState(false);
  const enEditionSignature = editingSignature || !signatureImage;

  // Filet de sécurité si cet écran est atteint sans passer par reference.tsx (deep-link,
  // app relancée en plein milieu du parcours) : le store peut ne pas encore porter cette
  // fiche — cf. même garde sur reference.tsx / captures.tsx / veg.tsx.
  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

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
          const updated = await updateProspectionObservations(draftId, buildPayload(value));
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

  /**
   * Construit l'intégralité du payload d'enregistrement à partir des valeurs
   * courantes du formulaire (pluie/dégâts/ennemis/observation) — utilisé aussi
   * bien par « Vérifier & enregistrer » (tous les champs) que par VALIDER (la
   * seule signature, `overridesSignature` fournissant le tracé qui vient
   * d'être capturé sans attendre le prochain rendu, cf. même principe que
   * `buildPayload` sur extensive-observations.tsx).
   */
  const buildPayload = (
    values: Pick<ObservationsFormValues, 'degatsCultures' | 'ennemisSelected' | 'ennemisAutre' | 'observation'> & {
      dernierePluieDate: string;
      intensitePluie: string | null;
    },
    overridesSignature?: { nom: string | null; horodatage: string | null; image: string | null }
  ): ObservationsUpdateInput => ({
    degatsCultures: values.degatsCultures,
    ennemisNaturels: serializeEnnemis(values.ennemisSelected, values.ennemisAutre),
    observations: values.observation || null,
    dernierePluie: values.dernierePluieDate || null,
    intensitePluie: values.intensitePluie || null,
    heureObservationAt,
    signatureVisaNom: overridesSignature ? overridesSignature.nom : signatureNom,
    signatureVisaHorodatage: overridesSignature ? overridesSignature.horodatage : signatureHorodatage,
    signatureVisaImage: overridesSignature ? overridesSignature.image : signatureImage,
  });

  /** VALIDER — capture définitivement le tracé en cours. Persisté immédiatement
   * (SQLite local), pas seulement gardé en state React : fermer l'app avant
   * d'atteindre « Vérifier & enregistrer » ne perd jamais une signature déjà
   * validée (même principe offline-first que extensive-observations.tsx). */
  const handleValiderSignature = () => {
    const trace = pendingPath;
    if (!prospecteurNom || !trace) return; // Précondition déjà imposée par le bouton désactivé.
    const horodatage = new Date().toISOString();
    return run(
      async () => {
        const updated = await updateProspectionObservations(
          draftId,
          buildPayload(form.state.values, { nom: prospecteurNom, horodatage, image: trace })
        );
        setDraft(updated);
        setSignatureNom(prospecteurNom);
        setSignatureHorodatage(horodatage);
        setSignatureImage(trace);
        setEditingSignature(false);
      },
      {
        screen: 'observations',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  /** MODIFIER — repart d'un tracé vierge ; la signature déjà validée n'est
   * remplacée qu'au prochain VALIDER, jamais avant. */
  const handleModifierSignature = () => {
    setPendingPath('');
    setResetTick((tick) => tick + 1);
    setEditingSignature(true);
  };

  // Restaure la pluie, les dégâts, les ennemis naturels et l'observation libre déjà
  // enregistrés pour cette fiche — sans ça, cet écran repartait systématiquement de zéro
  // à chaque remontage (retour arrière, reprise d'un brouillon...), et "Vérifier &
  // enregistrer" écrasait alors les données existantes par des valeurs vides. Ne s'exécute
  // qu'une fois par fiche chargée (`obsHydratedRef`), cf. même garde sur veg.tsx.
  const obsHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || obsHydratedRef.current === draft.id) return;
    obsHydratedRef.current = draft.id;
    void Promise.resolve().then(() => {
      const ennemis = parseEnnemis(draft.ennemis_naturels);
      form.setFieldValue('dernierePluieDate', draft.derniere_pluie ?? '');
      form.setFieldValue('intensitePluie', draft.intensite_pluie ?? null);
      form.setFieldValue('degatsCultures', (draft.degats_cultures as ObservationsFormValues['degatsCultures']) ?? null);
      form.setFieldValue('ennemisSelected', ennemis.selected);
      form.setFieldValue('ennemisAutre', ennemis.autre);
      form.setFieldValue('observation', draft.observations ?? '');
      if (ennemis.autre) setShowAutre(true);
      setSignatureNom(draft.signature_visa_nom ?? null);
      setSignatureHorodatage(draft.signature_visa_horodatage ?? null);
      setSignatureImage(draft.signature_visa_image ?? null);
      setEditingSignature(false);
    });

    // Heure d'observation automatique : une heure déjà enregistrée pour cette fiche
    // est restaurée telle quelle, sans jamais la recalculer simplement parce que
    // l'écran est remonté — seule l'absence de toute heure enregistrée en capture
    // une nouvelle. Horloge de l'appareil, pas un fix GPS (#heure-observation-fiable) :
    // un fix GPS n'apportait rien pour une simple heure et pouvait échouer ou tarder
    // (signal faible, permission refusée...), laissant le champ vide indéfiniment —
    // l'heure système, elle, est toujours disponible immédiatement.
    if (draft.heure_observation_at) {
      void Promise.resolve().then(() => setHeureObservationAt(draft.heure_observation_at));
      return;
    }
    void Promise.resolve().then(() => setHeureObservationAt(new Date().toISOString()));
  }, [draft, draftId, form]);

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
                SECTION : HEURE D'OBSERVATION (GPS)
                ========================================== */}

            <View style={styles.autoCard}>
              <Text style={styles.autoLabel}>🕐 Heure d&apos;observation</Text>
              <Text style={styles.autoValue}>
                {formatHeureLocale(heureObservationAt)}
              </Text>
            </View>

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
                SECTION : SIGNATURE
                ========================================== */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Signature</Text>
              <View style={styles.autoCard}>
                <Text style={styles.autoLabel}>Prospecteur</Text>
                <Text style={styles.autoValue}>{prospecteurNom ?? '—'}</Text>
              </View>

              {enEditionSignature ? (
                <>
                  <SignaturePad
                    key={`signature-visa-${resetTick}`}
                    testID="signature-pad-visa"
                    value={null}
                    onChange={setPendingPath}
                  />
                  <TouchableOpacity
                    style={[styles.signButton, (!prospecteurNom || !pendingPath) && styles.signButtonDisabled]}
                    onPress={handleValiderSignature}
                    disabled={!prospecteurNom || !pendingPath}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.signButtonText}>VALIDER</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <SignaturePad testID="signature-pad-visa" value={signatureImage} onChange={() => {}} readOnly />
                  <Text style={styles.signatureStamp}>Signé à {formatHeureLocale(signatureHorodatage)}</Text>
                  <TouchableOpacity style={styles.modifyButton} onPress={handleModifierSignature} activeOpacity={0.85}>
                    <Text style={styles.modifyButtonText}>MODIFIER</Text>
                  </TouchableOpacity>
                </>
              )}
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

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  cardTitle: 12.5,
  autoLabel: 10,
  autoValue: 16,
  chipText: 11.5,
  textInput: 12,
  fieldLabel: 10,
  errorText: 11,
  continueButtonText: 15,
  signatureStamp: 10,
  signButtonText: 12,
  modifyButtonText: 12,
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardError: { borderColor: '#c0412b', borderWidth: 1.5 },
  cardTitle: { fontSize: typeSizes.cardTitle, fontWeight: '700', color: TEXT, marginBottom: 11 },
  autoCard: { backgroundColor: AUTO_BG, borderRadius: 12, padding: 14, marginBottom: 11 },
  autoLabel: { fontSize: typeSizes.autoLabel, fontWeight: '600', color: GREEN, textTransform: 'uppercase', marginBottom: 4 },
  autoValue: { fontSize: typeSizes.autoValue, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipFlex: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: '#235a36' },
  chipText: { fontSize: typeSizes.chipText, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  textInput: { backgroundColor: '#f6f3e9', borderRadius: 7, padding: 8, fontSize: typeSizes.textInput, fontWeight: '500', color: TEXT, marginTop: 4 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, borderRadius: 7, backgroundColor: '#f6f3e9', paddingHorizontal: 8, paddingVertical: 8, marginTop: 4 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: typeSizes.fieldLabel, fontWeight: '600', color: TEXT_SECONDARY, marginBottom: 4 },
  errorText: { color: '#c0412b', fontSize: typeSizes.errorText, marginBottom: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: ORANGE, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: TEXT, fontWeight: '800', fontSize: typeSizes.continueButtonText },
  // ===== Signature =====
  signatureStamp: { fontSize: typeSizes.signatureStamp, color: TEXT_SECONDARY, fontFamily: 'monospace', marginTop: 6 },
  signButton: { backgroundColor: GREEN, borderRadius: 9, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  signButtonDisabled: { backgroundColor: '#9a9484' },
  signButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.signButtonText },
  modifyButton: { borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  modifyButtonText: { color: TEXT, fontWeight: '800', fontSize: typeSizes.modifyButtonText },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
