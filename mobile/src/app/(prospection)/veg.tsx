import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { DEGATS_OPTIONS, HUMIDITE_OPTIONS, TEXTURE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { updateProspectionVegetation } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { vegetationSchema, VegetationFormValues } from '@/lib/prospection-vegetation-schema';

const GREEN = '#235a36';
const ORANGE = '#e89b2b';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    defaultValues: {
      recouvrement: 70,
      humidite: null,
      texture: null,
      degatsCultures: null,
    } as VegetationFormValues,
    onSubmit: async ({ value }) => {
      if (!draftId) return;
      try {
        await vegetationSchema.validate(value, { abortEarly: false });
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
          vegetation: JSON.stringify({ recouvrement_herbeux: value.recouvrement }),
          sol: JSON.stringify({ humidite: value.humidite, texture: value.texture }),
          degatsCultures: value.degatsCultures,
        });
        setDraft(updated);
        router.push({ pathname: '/(prospection)/review' as any, params: { draftId } });
      } finally {
        setIsSaving(false);
      }
    },
  });

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
          <form.Field name="recouvrement">
            {(field) => (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Strate herbeuse</Text>
                  <Text style={styles.recValue}>{field.state.value}%</Text>
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => field.handleChange(Math.max(0, field.state.value - 10))}
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.recBarTrack}>
                    <View style={[styles.recBarFill, { width: `${field.state.value}%` }]} />
                  </View>
                  <TouchableOpacity
                    style={[styles.stepperButton, styles.stepperButtonAdd]}
                    onPress={() => field.handleChange(Math.min(100, field.state.value + 10))}
                  >
                    <Text style={[styles.stepperButtonText, styles.stepperButtonAddText]}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hintText}>Recouvrement — touchez − / + pour ajuster</Text>
              </View>
            )}
          </form.Field>

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

          <form.Field name="degatsCultures">
            {(field) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dégâts sur culture</Text>
                <View style={styles.chipsRow}>
                  {DEGATS_OPTIONS.map((option) => {
                    const active = option.value === field.state.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.smallChip, styles.smallChipFlex, active && styles.smallChipActive]}
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

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={form.handleSubmit} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Vérifier & enregistrer ✓'}</Text>
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 10 },
  recValue: { fontSize: 12, fontWeight: '700', color: GREEN },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  stepperButtonAdd: { backgroundColor: GREEN },
  stepperButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  stepperButtonAddText: { color: '#fff' },
  recBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: INACTIVE_BG, overflow: 'hidden' },
  recBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 4 },
  hintText: { fontSize: 9.5, color: '#9a9484', marginTop: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallChip: { paddingHorizontal: 4, paddingVertical: 9, borderRadius: 8, backgroundColor: INACTIVE_BG, flexGrow: 1, alignItems: 'center', minWidth: 60 },
  smallChipFlex: { flex: 1 },
  smallChipActive: { backgroundColor: GREEN },
  smallChipText: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  smallChipTextActive: { fontWeight: '700', color: '#fff' },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: ORANGE, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: TEXT, fontWeight: '800', fontSize: 15 },
});
