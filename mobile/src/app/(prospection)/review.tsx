import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { DEGATS_OPTIONS, HUMIDITE_OPTIONS, TEXTURE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { buildRecapitulatif, enregistrerEtSynchroniser } from '@/lib/prospection-review';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

function buildVegetationSummary(vegetation: string | null, sol: string | null, degatsCultures: string | null): string {
  const veg = vegetation ? JSON.parse(vegetation) : {};
  const solParsed = sol ? JSON.parse(sol) : {};
  const parts: string[] = [];
  if (typeof veg.recouvrement_herbeux === 'number') {
    parts.push(`Strate herbeuse ${veg.recouvrement_herbeux}%`);
  }
  if (solParsed.humidite) {
    parts.push(`Humidité ${HUMIDITE_OPTIONS.find((o) => o.value === solParsed.humidite)?.label ?? solParsed.humidite}`);
  }
  if (solParsed.texture) {
    parts.push(`Texture ${TEXTURE_OPTIONS.find((o) => o.value === solParsed.texture)?.label ?? solParsed.texture}`);
  }
  if (degatsCultures) {
    parts.push(`Dégâts culture ${DEGATS_OPTIONS.find((o) => o.value === degatsCultures)?.label ?? degatsCultures}`);
  }
  return parts.join(' · ') || '—';
}

export default function ReviewScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const resetWizard = useProspectionWizardStore((s) => s.reset);
  const resetCaptureLoop = useProspectionCaptureStore((s) => s.reset);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recap = useMemo(() => {
    if (!draft) return null;
    return buildRecapitulatif(draft, captures, buildVegetationSummary(draft.vegetation, draft.sol, draft.degats_cultures));
  }, [draft, captures]);

  if (!draft || !recap) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const handleSave = async () => {
    if (!token || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await enregistrerEtSynchroniser(draft, captures, token);
      resetWizard();
      resetCaptureLoop();
      router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } });
    } catch {
      setError("Impossible d'enregistrer la fiche pour le moment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Fiche — récapitulatif</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.headerCard}>
            <Text style={styles.headerCardLabel}>Fiche {recap.nFiche}</Text>
            <Text style={styles.headerCardTitle}>{recap.dateProspection}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Captures (calcul auto)</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{recap.totalCaptures}</Text>
                <Text style={styles.statLabel}>total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{recap.totalFemelles}</Text>
                <Text style={styles.statLabel}>♀ fem.</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{recap.totalMales}</Text>
                <Text style={styles.statLabel}>♂ mâl.</Text>
              </View>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Phénotype dominant</Text>
              <Text style={styles.summaryLineValueRed}>{recap.phenotypeDominantLabel}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Temps de capture</Text>
              <Text style={styles.summaryLineValue}>{recap.dureeSession} min</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Végétation & sol</Text>
            <Text style={styles.paragraph}>{recap.vegetationSummary}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Référence</Text>
            <Text style={styles.paragraph}>
              Surf. prospectée <Text style={styles.paragraphStrong}>{recap.surfProspectee ?? '—'} ha</Text> · station{' '}
              <Text style={styles.paragraphStrong}>{recap.surfStation ?? '—'} ha</Text> · GPS{' '}
              <Text style={styles.mono}>
                {recap.latitude?.toFixed(4) ?? '—'}, {recap.longitude?.toFixed(4) ?? '—'}
              </Text>
            </Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer (hors-ligne) ✓'}
            </Text>
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
  headerCard: { backgroundColor: GREEN, borderRadius: 13, padding: 16, marginBottom: 11 },
  headerCardLabel: { color: '#ffffffcc', fontSize: 11 },
  headerCardTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: TEXT, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  statBox: { flex: 1, backgroundColor: '#f6f3e9', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: GREEN },
  statLabel: { fontSize: 9, color: '#9a9484' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#f1ede1' },
  summaryLineLabel: { fontSize: 12, color: '#5c5848' },
  summaryLineValue: { fontSize: 12, fontWeight: '600', color: TEXT },
  summaryLineValueRed: { fontSize: 12, fontWeight: '700', color: '#c0412b' },
  paragraph: { fontSize: 12, lineHeight: 20, color: '#5c5848' },
  paragraphStrong: { color: TEXT, fontWeight: '600' },
  mono: { fontFamily: 'monospace' },
  errorText: { color: '#c0412b', fontSize: 12, textAlign: 'center', marginTop: 6 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
