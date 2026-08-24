import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { useAsyncAction } from '@/hooks/use-async-action';
import {
  HUMIDITE_OPTIONS,
  Humidite,
  ORPAD_STAGES,
  parseVegetationSol,
  STRATE_KEYS,
  STRATE_LABELS,
  StrateKey,
  TEXTURE_OPTIONS,
  defaultStrateDetail,
} from '@/lib/prospection-fiche-lecture';
import { updateProspectionVegetation } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { StrateFormValues, VegetationFormValues } from '@/lib/prospection-vegetation-schema';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

// ==========================================
// HELPER : Arrondir au multiple de 5 le plus proche
// ==========================================

function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

function clampTo5(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, roundTo5(value)));
}

function emptyStrateForm(): StrateFormValues {
  return defaultStrateDetail();
}

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const { run, isRunning: isSaving } = useAsyncAction();
  const [expandedStrate, setExpandedStrate] = useState<StrateKey | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [strates, setStrates] = useState<Record<StrateKey, StrateFormValues>>(() => {
    if (draft?.vegetation) {
      return parseVegetationSol(draft.vegetation, null, null).strates;
    }
    return STRATE_KEYS.reduce((acc, key) => {
      acc[key] = emptyStrateForm();
      return acc;
    }, {} as Record<StrateKey, StrateFormValues>);
  });

  // ==========================================
  // SOL : humidité + texture, déjà enregistrés le cas échéant (fiche reprise)
  // ==========================================

  const savedSol = draft?.sol
    ? (JSON.parse(draft.sol) as { humidite?: Humidite | null; texture?: string[] | null })
    : null;

  // ==========================================
  // TEXTURE : sélection multiple
  // ==========================================

  const [selectedTextures, setSelectedTextures] = useState<string[]>(savedSol?.texture ?? []);

  const toggleTexture = (value: string) => {
    setSelectedTextures((current) =>
      current.includes(value) ? current.filter((t) => t !== value) : [...current, value]
    );
  };

  const form = useForm({
    defaultValues: {
      humidite: savedSol?.humidite ?? null,
      texture: null,
    } as VegetationFormValues,
    onSubmitInvalid: () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    },
    onSubmit: async ({ value }) => {
      run(
        async () => {
          const updated = await updateProspectionVegetation(draftId, {
            vegetation: JSON.stringify({ strates }),
            sol: JSON.stringify({
              humidite: value.humidite,
              texture: selectedTextures.length > 0 ? selectedTextures : null,
            }),
          });
          setDraft(updated);
          router.push({ pathname: '/(prospection)/observations' as any, params: { draftId } });
        },
        {
          screen: 'veg',
          precondition: !!draftId,
          preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
          context: { draftId },
        }
      );
    },
  });

  const setStrateField = <K extends keyof StrateFormValues>(key: StrateKey, field: K, value: StrateFormValues[K]) => {
    // Arrondir les pourcentages à 5
    let processedValue = value;
    if (typeof value === 'number' && ['recouvrement', 'surfRel', 'verdissement', 'repousse', 'solNu'].includes(field)) {
      const min = field === 'recouvrement' ? 0 : 0;
      const max = field === 'recouvrement' ? 100 : 100;
      processedValue = clampTo5(value, min, max) as StrateFormValues[K];
    }
    setStrates((current) => ({ ...current, [key]: { ...current[key], [field]: processedValue } }));
  };

  const toggleOrpad = (key: StrateKey, stage: string) => {
    const current = strates[key].orpad;
    const next = current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage];
    setStrateField(key, 'orpad', next);
  };

  // ==========================================
  // STEPPER : incrément/décrément par pas de 5
  // ==========================================

  const handleRecouvrementChange = (key: StrateKey, delta: number) => {
    const current = strates[key].recouvrement;
    const newValue = clampTo5(current + delta, 0, 100);
    setStrateField(key, 'recouvrement', newValue);
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
            <Text style={styles.title}>Strates</Text>
          </View>

          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.hint}>Recouvrement total ≥ 100%. Touchez une strate pour la détailler.</Text>

            {STRATE_KEYS.map((key) => {
              const strate = strates[key];
              const expanded = key === expandedStrate;
              return (
                <View key={key} style={[styles.strateCard, expanded && styles.strateCardExpanded]}>
                  <TouchableOpacity onPress={() => setExpandedStrate(expanded ? null : key)} activeOpacity={0.7}>
                    <View style={styles.strateHeaderRow}>
                      <Text style={[styles.strateLabel, expanded && styles.strateLabelExpanded]}>
                        {STRATE_LABELS[key]}
                        {expanded ? ' ▾' : ''}
                      </Text>
                      <Text style={styles.stratePct}>{strate.recouvrement}%</Text>
                    </View>
                    <View style={styles.recBarTrack}>
                      <View style={[styles.recBarFill, { width: `${strate.recouvrement}%` as const }]} />
                    </View>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.strateDetail}>
                      <View style={styles.fieldsRow}>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>Surf. rel. %</Text>
                          <TextInput
                            value={strate.surfRel != null ? String(strate.surfRel) : ''}
                            onChangeText={(v) => {
                              const val = v === '' ? null : Number(v);
                              if (val !== null && !isNaN(val)) {
                                setStrateField(key, 'surfRel', clampTo5(val, 0, 100));
                              } else {
                                setStrateField(key, 'surfRel', null);
                              }
                            }}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                          <Text style={styles.stepHint}>par pas de 5%</Text>
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>H. moy (m)</Text>
                          <TextInput
                            value={strate.hMoy != null ? String(strate.hMoy) : ''}
                            onChangeText={(v) => setStrateField(key, 'hMoy', v === '' ? null : Number(v))}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                        </View>
                      </View>

                      <View style={styles.recouvrementRow}>
                        <Text style={styles.recouvrementLabel}>Recouvrement</Text>
                        <Text style={styles.recouvrementValue}>{strate.recouvrement}%</Text>
                      </View>
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={styles.stepperButton}
                          onPress={() => handleRecouvrementChange(key, -5)}
                        >
                          <Text style={styles.stepperButtonText}>−</Text>
                        </TouchableOpacity>
                        <View style={styles.recBarTrack}>
                          <View style={[styles.recBarFill, { width: `${strate.recouvrement}%` as const }]} />
                        </View>
                        <TouchableOpacity
                          style={[styles.stepperButton, styles.stepperButtonAdd]}
                          onPress={() => handleRecouvrementChange(key, 5)}
                        >
                          <Text style={[styles.stepperButtonText, styles.stepperButtonAddText]}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.stepHint}>par pas de 5%</Text>

                      <View style={styles.fieldsRow}>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>% Verdissement</Text>
                          <TextInput
                            value={strate.verdissement != null ? String(strate.verdissement) : ''}
                            onChangeText={(v) => {
                              const val = v === '' ? null : Number(v);
                              if (val !== null && !isNaN(val)) {
                                setStrateField(key, 'verdissement', clampTo5(val, 0, 100));
                              } else {
                                setStrateField(key, 'verdissement', null);
                              }
                            }}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                          <Text style={styles.stepHint}>par pas de 5%</Text>
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>% Repousse</Text>
                          <TextInput
                            value={strate.repousse != null ? String(strate.repousse) : ''}
                            onChangeText={(v) => {
                              const val = v === '' ? null : Number(v);
                              if (val !== null && !isNaN(val)) {
                                setStrateField(key, 'repousse', clampTo5(val, 0, 100));
                              } else {
                                setStrateField(key, 'repousse', null);
                              }
                            }}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                          <Text style={styles.stepHint}>par pas de 5%</Text>
                        </View>
                      </View>

                      <Text style={styles.smallLabel}>Stade ORPAD</Text>
                      <View style={styles.chipsRow}>
                        {ORPAD_STAGES.map((stage) => {
                          const active = strate.orpad.includes(stage);
                          return (
                            <TouchableOpacity
                              key={stage}
                              onPress={() => toggleOrpad(key, stage)}
                              style={[styles.smallChip, active && styles.smallChipActive]}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{stage}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={styles.fieldLabel}>Sol nu %</Text>
                      <TextInput
                        value={strate.solNu != null ? String(strate.solNu) : ''}
                        onChangeText={(v) => {
                          const val = v === '' ? null : Number(v);
                          if (val !== null && !isNaN(val)) {
                            setStrateField(key, 'solNu', clampTo5(val, 0, 100));
                          } else {
                            setStrateField(key, 'solNu', null);
                          }
                        }}
                        keyboardType="decimal-pad"
                        style={styles.fieldInput}
                      />
                      <Text style={styles.stepHint}>par pas de 5%</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <form.Field
              name="humidite"
              validators={{
                onChange: ({ value }) => (value ? undefined : 'Humidité du sol requise'),
                onBlur: ({ value }) => (value ? undefined : 'Humidité du sol requise'),
              }}
            >
              {(field) => {
                const showError = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <View style={[styles.card, showError && styles.cardError]}>
                    <Text style={styles.cardTitle}>Humidité du sol</Text>
                    <View style={styles.chipsRow}>
                      {HUMIDITE_OPTIONS.map((option) => {
                        const active = option.value === field.state.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.smallChip, active && styles.smallChipActive]}
                            onPress={() => {
                              field.handleChange(option.value);
                              field.handleBlur();
                            }}
                          >
                            <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {showError && <Text style={styles.errorText}>{field.state.meta.errors[0]}</Text>}
                  </View>
                );
              }}
            </form.Field>

            <form.Field
              name="texture"
              validators={{
                onChange: ({ value }) => (selectedTextures.length > 0 ? undefined : 'Texture du sol requise'),
                onBlur: ({ value }) => (selectedTextures.length > 0 ? undefined : 'Texture du sol requise'),
              }}
            >
              {(field) => {
                const showError = field.state.meta.isTouched && selectedTextures.length === 0;
                return (
                  <View style={[styles.card, showError && styles.cardError]}>
                    <Text style={styles.cardTitle}>Texture du sol (sélection multiple)</Text>
                    <Text style={styles.hintSmall}>Touchez pour sélectionner/désélectionner</Text>
                    <View style={styles.chipsRow}>
                      {TEXTURE_OPTIONS.map((option) => {
                        const active = selectedTextures.includes(option.value);
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.smallChip, active && styles.smallChipActive]}
                            onPress={() => {
                              toggleTexture(option.value);
                              field.handleBlur();
                            }}
                          >
                            <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>
                              {option.label}
                              {active && ' ✓'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {selectedTextures.length > 0 && (
                      <Text style={styles.selectionInfo}>
                        {selectedTextures.length} texture{selectedTextures.length > 1 ? 's' : ''} sélectionnée{selectedTextures.length > 1 ? 's' : ''}
                      </Text>
                    )}
                    {showError && <Text style={styles.errorText}>Veuillez sélectionner au moins une texture</Text>}
                  </View>
                );
              }}
            </form.Field>
          </ScrollView>

          <Text style={styles.totalRec}>
            Total recouvrement : {STRATE_KEYS.reduce((sum, key) => sum + strates[key].recouvrement, 0)}%
          </Text>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={form.handleSubmit} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
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
  hint: { fontSize: 10.5, lineHeight: 15, color: '#9a9484', marginBottom: 14 },
  hintSmall: { fontSize: 9.5, color: '#9a9484', marginBottom: 8, fontStyle: 'italic' },
  stepHint: { fontSize: 8.5, color: '#9a9484', marginTop: 2, fontStyle: 'italic' },
  selectionInfo: { fontSize: 11, color: GREEN, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  strateCard: { marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 11, padding: 13 },
  strateCardExpanded: { borderWidth: 2, borderColor: GREEN },
  strateHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  strateLabel: { fontSize: 12.5, fontWeight: '600', color: TEXT },
  strateLabelExpanded: { fontWeight: '700' },
  stratePct: { fontSize: 12, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  strateDetail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1ede1' },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  smallLabel: { fontSize: 8.5, color: '#9a9484', marginBottom: 5 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardError: { borderColor: '#c0412b', borderWidth: 1.5 },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: TEXT, marginBottom: 11 },
  fieldsRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 8.5, color: '#9a9484', marginBottom: 2 },
  fieldInput: { backgroundColor: '#f6f3e9', borderRadius: 6, padding: 7, fontSize: 12, fontWeight: '600', color: TEXT },
  recouvrementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recouvrementLabel: { fontSize: 10.5, color: '#5c5848' },
  recouvrementValue: { fontSize: 12, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  stepperButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  stepperButtonAdd: { backgroundColor: GREEN },
  stepperButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  stepperButtonAddText: { color: '#fff' },
  recBarTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#f1ede1', overflow: 'hidden' },
  recBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  smallChip: { paddingHorizontal: 4, paddingVertical: 9, borderRadius: 8, backgroundColor: INACTIVE_BG, flexGrow: 1, alignItems: 'center', minWidth: 60 },
  smallChipActive: { backgroundColor: GREEN },
  smallChipText: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  smallChipTextActive: { fontWeight: '700', color: '#fff' },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  totalRec: { textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#9a9484', letterSpacing: 0.3, paddingVertical: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
