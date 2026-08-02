import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseEspeceSelection, buildGrilles } from '@/lib/prospection-especes';
import { CAPTURES_MAX, PHENOTYPES, Phenotype, grilleKeyToString, stadesFor } from '@/lib/prospection-especes-stades';
import { chronoSeconds, formatChrono } from '@/lib/prospection-review';
import { markGrilleCompleted, saveProspectionCaptures, startCaptureTimer } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import {
  captureKey,
  countsToRows,
  dominantPhenotype,
  totalBySexe,
  totalCaptures,
  useProspectionCaptureStore,
} from '@/lib/prospection-capture-store';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;
const CATEGORIE_LABEL = { imago: 'Imagos', larve: 'Larves' } as const;

function parseGrillesCompletees(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CapturesScreen() {
  const router = useRouter();
  const { draftId, grilleIndex } = useLocalSearchParams<{ draftId: string; grilleIndex: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);

  const store = useProspectionCaptureStore();
  const [tick, setTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const requestedIndex = Number(grilleIndex ?? '0');
  const grille = store.grilleOrder[store.currentGrilleIndex];

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      if (draft?.id !== draftId) {
        await hydrateFromDraft(draftId);
      }
    })();
  }, [draftId, draft?.id, hydrateFromDraft]);

  useEffect(() => {
    if (!draft || draft.id !== draftId) return;
    if (store.grilleOrder.length === 0) {
      const selection = parseEspeceSelection(draft.especes);
      const grilles = buildGrilles(selection);
      const completed = parseGrillesCompletees(draft.grilles_completees);
      store.initGrilles(grilles, completed, captures);
    }
  }, [draft, draftId, captures]);

  useEffect(() => {
    if (store.grilleOrder.length > 0 && requestedIndex !== store.currentGrilleIndex) {
      store.goToGrille(requestedIndex, captures);
    }
  }, [requestedIndex, store.grilleOrder.length]);

  useEffect(() => {
    if (!draftId || draft?.capture_started_at) return;
    startCaptureTimer(draftId).then(setDraft);
  }, [draftId, draft?.capture_started_at]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!grille) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const hasSexeToggle = grille.espece === 'LMC' && grille.categorie === 'imago';
  const stades = stadesFor(grille.espece, grille.categorie, store.sexe);
  const total = totalCaptures(store.counts);
  const max = CAPTURES_MAX[grille.espece];
  const dominant = dominantPhenotype(store.counts);
  const isLastGrille = store.currentGrilleIndex === store.grilleOrder.length - 1;
  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const handleContinue = async () => {
    if (!draftId || isSaving) return;
    setIsSaving(true);
    try {
      const rows = countsToRows(grille.espece, grille.categorie, store.counts);
      await saveProspectionCaptures(draftId, grille.espece, grille.categorie, rows);
      await markGrilleCompleted(draftId, grilleKeyToString(grille));
      store.markCurrentGrilleCompleted();
      await refreshCaptures();
      if (isLastGrille) {
        router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
      } else {
        router.replace({
          pathname: '/(prospection)/captures' as any,
          params: { draftId, grilleIndex: String(store.currentGrilleIndex + 1) },
        });
      }
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
          <Text style={styles.title}>
            Captures · {ESPECE_LABEL[grille.espece]} — {CATEGORIE_LABEL[grille.categorie]}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCardPrimary}>
            <Text style={styles.statLabelPrimary}>Total capturé</Text>
            <Text style={styles.statValuePrimary}>
              {total}
              <Text style={styles.statValueMax}> / {max}</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Chrono</Text>
            <Text style={styles.statValue}>
              {formatChrono(seconds)}
              <Text style={styles.statValueMaxDim}>/30</Text>
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          {hasSexeToggle && (
            <>
              <View style={styles.sexeRow}>
                <TouchableOpacity
                  style={[styles.sexeToggle, store.sexe === 'F' && styles.sexeToggleActive]}
                  onPress={() => store.setSexe('F')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sexeText, store.sexe === 'F' && styles.sexeTextActive]}>♀ Femelles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sexeToggle, store.sexe === 'M' && styles.sexeToggleActive]}
                  onPress={() => store.setSexe('M')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sexeText, store.sexe === 'M' && styles.sexeTextActive]}>♂ Mâles</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sexeHint}>
                {store.sexe === 'F' ? '♀ détaillé par stade (A1→A5 + sous-stades A3)' : '♂ simplifié : A1 / A234 (fusionné) / A5'}
              </Text>
            </>
          )}

          <Text style={styles.sectionLabel}>Phase</Text>
          <View style={styles.chipsRow}>
            {stades.map((stade) => {
              const active = stade === store.currentStade;
              return (
                <TouchableOpacity
                  key={stade}
                  onPress={() => store.setStade(stade)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{stade}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Phénotype — touchez puis ＋ / −</Text>
          <View style={styles.phenoList}>
            {PHENOTYPES.map((pheno) => {
              const active = pheno.value === store.currentPhenotype;
              const count = store.currentStade
                ? store.counts[captureKey(store.sexe, pheno.value as Phenotype, store.currentStade)] ?? 0
                : 0;
              return (
                <TouchableOpacity
                  key={pheno.value}
                  onPress={() => store.setPhenotype(pheno.value as Phenotype)}
                  style={[styles.phenoRow, active && styles.phenoRowActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.phenoLabel, active && styles.phenoLabelActive]}>{pheno.label}</Text>
                  {active ? (
                    <View style={styles.counterRow}>
                      <TouchableOpacity style={styles.counterButton} onPress={store.decrement}>
                        <Text style={styles.counterButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{count}</Text>
                      <TouchableOpacity style={[styles.counterButton, styles.counterButtonAdd]} onPress={store.increment}>
                        <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.phenoCount}>{count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {hasSexeToggle && `♀ ${totalBySexe(store.counts, 'F')} · ♂ ${totalBySexe(store.counts, 'M')} · `}
              phénotype dominant :{' '}
              <Text style={styles.summaryBold}>
                {dominant ? PHENOTYPES.find((p) => p.value === dominant)?.label : '—'}
              </Text>
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>{isLastGrille ? 'Végétation  ›' : 'Grille suivante  ›'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 14, fontWeight: '700', color: TEXT },
  statsRow: { marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', gap: 9 },
  statCardPrimary: { flex: 1, backgroundColor: GREEN, borderRadius: 12, padding: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 10 },
  statLabelPrimary: { color: '#ffffffcc', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabel: { color: '#9a9484', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValuePrimary: { color: '#fff', fontWeight: '700', fontSize: 21 },
  statValue: { color: TEXT, fontWeight: '700', fontSize: 21 },
  statValueMax: { fontSize: 12, color: '#ffffffb3' },
  statValueMaxDim: { fontSize: 11, color: '#bdb6a2' },
  scroll: { flex: 1 },
  sexeRow: { flexDirection: 'row', gap: 7, backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 4, marginBottom: 11 },
  sexeToggle: { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  sexeToggleActive: { backgroundColor: '#fff' },
  sexeText: { fontWeight: '700', fontSize: 13, color: '#9a9484' },
  sexeTextActive: { color: TEXT },
  sexeHint: { fontSize: 10, color: '#9a9484', marginBottom: 9 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  phenoList: { gap: 6, paddingBottom: 6 },
  phenoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, padding: 12 },
  phenoRowActive: { borderWidth: 2, borderColor: GREEN, paddingVertical: 6, paddingLeft: 13, paddingRight: 8 },
  phenoLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  phenoLabelActive: { fontWeight: '700', color: TEXT },
  phenoCount: { fontSize: 14, fontWeight: '600', color: '#bdb6a2' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 36, height: 36, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonText: { fontSize: 19, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 18, fontWeight: '700', color: TEXT, minWidth: 20, textAlign: 'center' },
  summary: { marginTop: 4, backgroundColor: '#eaf2ec', borderRadius: 9, padding: 10 },
  summaryText: { fontSize: 10.5, color: GREEN },
  summaryBold: { fontWeight: '700' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 14, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
