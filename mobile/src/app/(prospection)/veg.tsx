import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import {
  HUMIDITE_OPTIONS,
  ORPAD_STAGES,
  STRATE_KEYS,
  STRATE_LABELS,
  StrateKey,
  TEXTURE_OPTIONS,
  defaultStrateDetail,
} from '@/lib/prospection-fiche-lecture';
import { updateProspectionVegetation } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { StrateFormValues, VegetationFormValues, vegetationSchema } from '@/lib/prospection-vegetation-schema';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

function emptyStrateForm(): StrateFormValues {
  return defaultStrateDetail();
}

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStrate, setSelectedStrate] = useState<StrateKey>('herbeuse');
  const [strates, setStrates] = useState<Record<StrateKey, StrateFormValues>>(() =>
    STRATE_KEYS.reduce((acc, key) => {
      acc[key] = emptyStrateForm();
      return acc;
    }, {} as Record<StrateKey, StrateFormValues>)
  );

  const form = useForm({
    defaultValues: {
      strate: strates[selectedStrate],
      humidite: null,
      texture: null,
    } as VegetationFormValues,
    onSubmit: async ({ value }) => {
      if (!draftId) return;
      const payload: VegetationFormValues = { ...value, strate: strates[selectedStrate] };
      try {
        await vegetationSchema.validate(payload, { abortEarly: false });
      } catch (validationError: any) {
        const errors: Record<string, string> = {};
        for (const err of validationError.inner ?? []) {
          if (err.path) errors[err.path] = err.message;
        }
        setFormErrors(errors);
        return;
      }
      setFormErrors({});
      setIsSaving(true);
      try {
        const updated = await updateProspectionVegetation(draftId, {
          vegetation: JSON.stringify({ strates: { ...strates, [selectedStrate]: payload.strate } }),
          sol: JSON.stringify({ humidite: payload.humidite, texture: payload.texture }),
        });
        setDraft(updated);
        router.push({ pathname: '/(prospection)/observations' as any, params: { draftId } });
      } finally {
        setIsSaving(false);
      }
    },
  });

  const setStrateField = <K extends keyof StrateFormValues>(field: K, value: StrateFormValues[K]) => {
    setStrates((current) => ({ ...current, [selectedStrate]: { ...current[selectedStrate], [field]: value } }));
  };

  const toggleOrpad = (stage: string) => {
    const current = strates[selectedStrate].orpad;
    const next = current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage];
    setStrateField('orpad', next);
  };

  const currentStrate = strates[selectedStrate];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Végétation & sol</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionLabel}>Strate</Text>
          <View style={styles.chipsRow}>
            {STRATE_KEYS.map((key) => {
              const active = key === selectedStrate;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSelectedStrate(key)}
                  style={[styles.strateChip, active && styles.strateChipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.strateChipText, active && styles.strateChipTextActive]}>{STRATE_LABELS[key]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{STRATE_LABELS[selectedStrate]}</Text>

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Surf. rel. %</Text>
                <TextInput
                  value={currentStrate.surfRel != null ? String(currentStrate.surfRel) : ''}
                  onChangeText={(v) => setStrateField('surfRel', v === '' ? null : Number(v))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>H. moy (m)</Text>
                <TextInput
                  value={currentStrate.hMoy != null ? String(currentStrate.hMoy) : ''}
                  onChangeText={(v) => setStrateField('hMoy', v === '' ? null : Number(v))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <View style={styles.recouvrementRow}>
              <Text style={styles.recouvrementLabel}>Recouvrement</Text>
              <Text style={styles.recouvrementValue}>{currentStrate.recouvrement}%</Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setStrateField('recouvrement', Math.max(0, currentStrate.recouvrement - 10))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.recBarTrack}>
                <View style={[styles.recBarFill, { width: `${currentStrate.recouvrement}%` as const }]} />
              </View>
              <TouchableOpacity
                style={[styles.stepperButton, styles.stepperButtonAdd]}
                onPress={() => setStrateField('recouvrement', Math.min(100, currentStrate.recouvrement + 10))}
              >
                <Text style={[styles.stepperButtonText, styles.stepperButtonAddText]}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>% Verdissement</Text>
                <TextInput
                  value={currentStrate.verdissement != null ? String(currentStrate.verdissement) : ''}
                  onChangeText={(v) => setStrateField('verdissement', v === '' ? null : Number(v))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>% Repousse</Text>
                <TextInput
                  value={currentStrate.repousse != null ? String(currentStrate.repousse) : ''}
                  onChangeText={(v) => setStrateField('repousse', v === '' ? null : Number(v))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <Text style={styles.smallLabel}>Stade ORPAD</Text>
            <View style={styles.chipsRow}>
              {ORPAD_STAGES.map((stage) => {
                const active = currentStrate.orpad.includes(stage);
                return (
                  <TouchableOpacity
                    key={stage}
                    onPress={() => toggleOrpad(stage)}
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
              value={currentStrate.solNu != null ? String(currentStrate.solNu) : ''}
              onChangeText={(v) => setStrateField('solNu', v === '' ? null : Number(v))}
              keyboardType="decimal-pad"
              style={styles.fieldInput}
            />
          </View>

          <form.Field name="humidite">
            {(field) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Humidité du sol</Text>
                <View style={styles.chipsRow}>
                  {HUMIDITE_OPTIONS.map((option) => {
                    const active = option.value === field.state.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.smallChip, active && styles.smallChipActive]}
                        onPress={() => field.handleChange(option.value)}
                      >
                        <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </form.Field>

          <form.Field name="texture">
            {(field) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Texture du sol</Text>
                <View style={styles.chipsRow}>
                  {TEXTURE_OPTIONS.map((option) => {
                    const active = option.value === field.state.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.smallChip, active && styles.smallChipActive]}
                        onPress={() => field.handleChange(option.value)}
                      >
                        <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </form.Field>

          {Object.values(formErrors).map((message) => (
            <Text key={message} style={styles.errorText}>
              {message}
            </Text>
          ))}
        </ScrollView>

        <Text style={styles.totalRec}>
          Total recouvrement : {STRATE_KEYS.reduce((sum, key) => sum + strates[key].recouvrement, 0)}%
        </Text>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={form.handleSubmit} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
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
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  smallLabel: { fontSize: 8.5, color: '#9a9484', marginBottom: 5 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: TEXT, marginBottom: 11 },
  fieldsRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 8.5, color: '#9a9484', marginBottom: 2 },
  fieldInput: { backgroundColor: '#f6f3e9', borderRadius: 6, padding: 7, fontSize: 12, fontWeight: '600', color: TEXT },
  recouvrementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recouvrementLabel: { fontSize: 10.5, color: '#5c5848' },
  recouvrementValue: { fontSize: 12, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  stepperButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  stepperButtonAdd: { backgroundColor: GREEN },
  stepperButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  stepperButtonAddText: { color: '#fff' },
  recBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: INACTIVE_BG, overflow: 'hidden' },
  recBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  strateChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  strateChipActive: { backgroundColor: GREEN },
  strateChipText: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  strateChipTextActive: { fontWeight: '700', color: '#fff' },
  smallChip: { paddingHorizontal: 4, paddingVertical: 9, borderRadius: 8, backgroundColor: INACTIVE_BG, flexGrow: 1, alignItems: 'center', minWidth: 60 },
  smallChipFlex: { flex: 1 },
  smallChipActive: { backgroundColor: GREEN },
  smallChipText: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  smallChipTextActive: { fontWeight: '700', color: '#fff' },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  totalRec: { textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#9a9484', letterSpacing: 0.3, paddingVertical: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
