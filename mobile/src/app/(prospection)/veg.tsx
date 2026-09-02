import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import {
  HUMIDITE_OPTIONS,
  Humidite,
  ORPAD_STAGES,
  parseVegetationSol,
  STRATE_KEYS,
  STRATE_LABELS,
  StrateKey,
  TEXTURE_OPTIONS,
  computeSurfaceRepartitionTotal,
  defaultStrateDetail,
  isSurfaceRepartitionValide,
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

// Champs de saisie décimale libre de la strate (Surf. rel. %, H. moy, % Verdissement,
// % Repousse) : contrairement au Recouvrement (stepper dédié par pas de 5), on
// conserve la valeur réellement saisie — seule la borne [min, max] est appliquée
// pour les champs qui sont des pourcentages (H. moy n'en a aucune).
function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Saisie francophone : la virgule est le séparateur décimal attendu par l'utilisateur,
// mais JS/JSON n'utilisent que le point en interne — conversion aux deux frontières
// (affichage → virgule, parsing → point), la valeur stockée reste un `number` standard.
function parseDecimalInput(raw: string): number | null {
  if (raw === '') return null;
  const val = Number(raw.replace(',', '.'));
  return isNaN(val) ? null : val;
}

function formatDecimalDisplay(value: number | null): string {
  return value != null ? String(value).replace('.', ',') : '';
}

/** Les quatre champs décimaux libres d'une strate — tous `number | null` dans StrateFormValues. */
type DecimalFieldKey = 'surfRel' | 'hMoy' | 'verdissement' | 'repousse';

function emptyStrateForm(): StrateFormValues {
  return defaultStrateDetail();
}

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('veg');

  // Filet de sécurité si cet écran est atteint sans passer par reference.tsx (deep-link,
  // app relancée en plein milieu du parcours) : le store peut ne pas encore porter cette
  // fiche — cf. même garde sur reference.tsx / captures.tsx.
  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);
  const [expandedStrate, setExpandedStrate] = useState<StrateKey | null>(null);
  // Texte brut en cours de saisie pour les 4 champs décimaux libres de chaque strate
  // (Surf. rel. %, H. moy, % Verdissement, % Repousse) — permet de taper un séparateur
  // décimal ou un zéro de fin ("25,", "25,10") sans que le champ ne se reformate à
  // chaque frappe (cf. `strate.xxx != null ? String(strate.xxx) : ''` sinon).
  const [decimalDrafts, setDecimalDrafts] = useState<
    Partial<Record<StrateKey, Partial<Record<DecimalFieldKey, string>>>>
  >({});
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
  // SOL : humidité + texture + sol nu, déjà enregistrés le cas échéant (fiche reprise)
  // ==========================================

  const savedSol = draft?.sol
    ? (JSON.parse(draft.sol) as { humidite?: Humidite | null; texture?: string[] | null; solNu?: number | null })
    : null;

  // Sol nu (%) — au niveau de la station, pas par strate (issue #278) : avec `surfRel`
  // des 6 strates, partitionne 100% de la surface de la station prospectée.
  const [solNu, setSolNu] = useState<number | null>(savedSol?.solNu ?? null);
  const [solNuDraft, setSolNuDraft] = useState<string | undefined>(undefined);
  // N'affiche l'erreur de répartition qu'après une tentative de "Continuer" — comme
  // humidité/texture, pas dès la première frappe sur une strate.
  const [repartitionTouched, setRepartitionTouched] = useState(false);

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
      // Sol nu + surfRel des 6 strates doivent totaliser 100% de la surface de la
      // station (issue #278) — vérifié à la soumission, comme humidité/texture, pas
      // en direct à chaque frappe (les valeurs intermédiaires n'ont pas à être justes).
      if (!isSurfaceRepartitionValide({ strates, solNu })) {
        setRepartitionTouched(true);
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      return run(
        async () => {
          const updated = await updateProspectionVegetation(draftId, {
            vegetation: JSON.stringify({ strates }),
            sol: JSON.stringify({
              humidite: value.humidite,
              texture: selectedTextures.length > 0 ? selectedTextures : null,
              solNu,
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

  // Restaure les strates, l'humidité et la (les) texture(s) déjà enregistrées pour cette
  // fiche — sans ça, cet écran repartait systématiquement de zéro à chaque remontage
  // (retour arrière, reprise d'un brouillon...), et "Continuer" écrasait alors les
  // données existantes par des valeurs vides. Ne s'exécute qu'une fois par fiche chargée
  // (`vegHydratedRef`) pour ne pas effacer une saisie en cours si `draft` est republié
  // entre-temps par un autre écran (cf. `setDraft` après chaque sauvegarde).
  const vegHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || vegHydratedRef.current === draft.id) return;
    vegHydratedRef.current = draft.id;
    const parsed = parseVegetationSol(draft.vegetation, draft.sol, draft.degats_cultures);
    setStrates(parsed.strates);
    setSolNu(parsed.solNu);
    setSelectedTextures(parsed.texture);
    form.setFieldValue('humidite', parsed.humidite);
  }, [draft, draftId, form]);

  const setStrateField = <K extends keyof StrateFormValues>(key: StrateKey, field: K, value: StrateFormValues[K]) => {
    // Recouvrement reste par pas de 5 (stepper dédié, cf. handleRecouvrementChange). Les
    // trois autres pourcentages (surfRel, verdissement, repousse) sont des saisies libres
    // décimales, seulement bornées à [0, 100] — H. moy n'a aucune contrainte connue.
    let processedValue = value;
    if (typeof value === 'number' && field === 'recouvrement') {
      processedValue = clampTo5(value, 0, 100) as StrateFormValues[K];
    } else if (typeof value === 'number' && ['surfRel', 'verdissement', 'repousse'].includes(field as string)) {
      processedValue = clampPercent(value, 0, 100) as StrateFormValues[K];
    }
    setStrates((current) => ({ ...current, [key]: { ...current[key], [field]: processedValue } }));
  };

  const toggleOrpad = (key: StrateKey, stage: string) => {
    const current = strates[key].orpad;
    const next = current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage];
    setStrateField(key, 'orpad', next);
  };

  // ==========================================
  // SAISIE DÉCIMALE LIBRE : Surf. rel. %, H. moy, % Verdissement, % Repousse
  // ==========================================

  const getDecimalDraft = (key: StrateKey, field: DecimalFieldKey): string | undefined => decimalDrafts[key]?.[field];

  const setDecimalDraft = (key: StrateKey, field: DecimalFieldKey, text: string) => {
    setDecimalDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: text } }));
  };

  const clearDecimalDraft = (key: StrateKey, field: DecimalFieldKey) => {
    setDecimalDrafts((current) => {
      if (current[key]?.[field] === undefined) return current;
      const nextStrate = { ...current[key] };
      delete nextStrate[field];
      return { ...current, [key]: nextStrate };
    });
  };

  const clearDecimalDraftsForStrate = (key: StrateKey) => {
    setDecimalDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  // Accepte "," et ".", tolère la saisie intermédiaire ("25," / "25.") sans la figer tant
  // qu'elle n'est pas exploitable, et applique la borne [min, max] une fois convertie —
  // sans borne (H. moy), la valeur décimale saisie est conservée telle quelle.
  const handleDecimalChange = (key: StrateKey, field: DecimalFieldKey, raw: string, bounds?: { min: number; max: number }) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setDecimalDraft(key, field, raw);
    if (raw === '') {
      setStrateField(key, field, null);
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    setStrateField(key, field, bounds ? clampPercent(val, bounds.min, bounds.max) : val);
  };

  const handleDecimalBlur = (key: StrateKey, field: DecimalFieldKey) => {
    // Resynchronise l'affichage sur la valeur numérique canonique (bornée si applicable,
    // décimales conservées, virgule) une fois la saisie terminée.
    clearDecimalDraft(key, field);
  };

  // Sol nu (%), au niveau de la station — même patron que les champs décimaux libres
  // d'une strate (handleDecimalChange/Blur), mais un seul champ, pas par strate.
  const handleSolNuChange = (raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setSolNuDraft(raw);
    if (raw === '') {
      setSolNu(null);
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    setSolNu(clampPercent(val, 0, 100));
  };

  const handleSolNuBlur = () => {
    setSolNuDraft(undefined);
  };

  // ==========================================
  // STEPPER : incrément/décrément par pas de 5
  // ==========================================

  const handleRecouvrementChange = (key: StrateKey, delta: number) => {
    const current = strates[key].recouvrement;
    const newValue = clampTo5(current + delta, 0, 100);
    setStrateField(key, 'recouvrement', newValue);
  };

  const repartitionTotal = computeSurfaceRepartitionTotal({ strates, solNu });
  const repartitionValide = isSurfaceRepartitionValide({ strates, solNu });
  // Affichage à une décimale : évite les artefacts flottants (86.99999999999999).
  const repartitionTotalDisplay = Math.round(repartitionTotal * 10) / 10;

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

            <View style={[styles.card, repartitionTouched && !repartitionValide && styles.cardError]}>
              <Text style={styles.cardTitle}>Sol nu</Text>
              <Text style={styles.hintSmall}>
                Au niveau de la station, indépendant des strates et cultures ci-dessous :
                avec leur surface relative, doit totaliser 100% de la station prospectée.
              </Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Sol nu %</Text>
                <TextInput
                  value={solNuDraft ?? formatDecimalDisplay(solNu)}
                  onChangeText={handleSolNuChange}
                  onBlur={handleSolNuBlur}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
              <Text style={styles.totalRepartition}>
                Total répartition (sol nu + strates) : {repartitionTotalDisplay}%
              </Text>
              {repartitionTouched && !repartitionValide && (
                <Text style={styles.errorText}>
                  La somme sol nu + surface relative des 6 strates doit égaler 100%
                  (actuellement {repartitionTotalDisplay}%).
                </Text>
              )}
            </View>

            {STRATE_KEYS.map((key) => {
              const strate = strates[key];
              const expanded = key === expandedStrate;
              return (
                <View key={key} style={[styles.strateCard, expanded && styles.strateCardExpanded]}>
                  <TouchableOpacity
                    onPress={() => {
                      setExpandedStrate(expanded ? null : key);
                      if (expanded) {
                        // Repli de la strate : on abandonne un éventuel texte intermédiaire
                        // ("25,") pour resynchroniser l'affichage sur la valeur numérique.
                        clearDecimalDraftsForStrate(key);
                      }
                    }}
                    activeOpacity={0.7}
                  >
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
                            value={getDecimalDraft(key, 'surfRel') ?? formatDecimalDisplay(strate.surfRel)}
                            onChangeText={(v) => handleDecimalChange(key, 'surfRel', v, { min: 0, max: 100 })}
                            onBlur={() => handleDecimalBlur(key, 'surfRel')}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>H. moy (m)</Text>
                          <TextInput
                            value={getDecimalDraft(key, 'hMoy') ?? formatDecimalDisplay(strate.hMoy)}
                            onChangeText={(v) => handleDecimalChange(key, 'hMoy', v)}
                            onBlur={() => handleDecimalBlur(key, 'hMoy')}
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
                            value={getDecimalDraft(key, 'verdissement') ?? formatDecimalDisplay(strate.verdissement)}
                            onChangeText={(v) => handleDecimalChange(key, 'verdissement', v, { min: 0, max: 100 })}
                            onBlur={() => handleDecimalBlur(key, 'verdissement')}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>% Repousse</Text>
                          <TextInput
                            value={getDecimalDraft(key, 'repousse') ?? formatDecimalDisplay(strate.repousse)}
                            onChangeText={(v) => handleDecimalChange(key, 'repousse', v, { min: 0, max: 100 })}
                            onBlur={() => handleDecimalBlur(key, 'repousse')}
                            keyboardType="decimal-pad"
                            style={styles.fieldInput}
                          />
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
  totalRepartition: { fontSize: 11, fontWeight: '600', color: GREEN, marginTop: 6 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
