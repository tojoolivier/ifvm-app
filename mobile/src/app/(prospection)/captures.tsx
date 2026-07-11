import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getProspection,
  listProspectionCaptures,
  markGrilleCompleted,
  DraftProspection,
} from '@/lib/prospection-repository';
import { buildGrilles, parseEspeceSelection } from '@/lib/prospection-especes';
import { buildPlanItems, grilleKey, isPlanComplete, parseGrillesCompletees } from '@/lib/prospection-plan';
import {
  CaptureCounts,
  PHENOTYPES,
  Phenotype,
  Sexe,
  CAPTURES_MAX,
  NSE_CAPTURES_MAX,
  NSE_PHENOTYPES,
  NSE_STADES,
  NsePhenotype,
  chronoSeconds,
  decrementCapture,
  decrementNseCapture,
  dominantNsePhenotype,
  dominantPhenotype,
  ensureCaptureTimerStarted,
  formatChrono,
  incrementCapture,
  incrementNseCapture,
  nseCaptureKey,
  parseCaptureRows,
  parseNseCaptureRows,
  saveCaptureCounts,
  saveNseCaptureCounts,
  stadeForSexeSwitch,
  stadesForSexe,
  totalBySexe,
  totalCaptures,
} from '@/lib/prospection-captures';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

export default function CapturesScreen() {
  const router = useRouter();
  const { draftId, grilleIndex: grilleIndexParam } = useLocalSearchParams<{
    draftId: string;
    grilleIndex?: string;
  }>();
  const grilleIndex = grilleIndexParam ? Number(grilleIndexParam) : 0;

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [sexe, setSexe] = useState<Sexe>('F');
  const [selectedPhenotype, setSelectedPhenotype] = useState<Phenotype | NsePhenotype>('solitaire');
  const [selectedStade, setSelectedStade] = useState<string>(stadesForSexe('F')[0]);
  const [counts, setCounts] = useState<CaptureCounts>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const grilles = useMemo(
    () => (draft ? buildGrilles(parseEspeceSelection(draft.especes)) : []),
    [draft]
  );
  const grille = grilles[grilleIndex];
  const isNse = grille?.espece === 'NSE';

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      if (!row) return;
      const started = await ensureCaptureTimerStarted(row);
      setDraft(started);
    });
  }, [draftId]);

  useEffect(() => {
    if (!draft || !grille) return;
    setSexe('F');
    setSelectedPhenotype(isNse ? NSE_PHENOTYPES[0].value : 'solitaire');
    setSelectedStade(isNse ? NSE_STADES[0] : stadesForSexe('F')[0]);
    listProspectionCaptures(draft.id, grille.espece, grille.categorie).then((rows) => {
      setCounts(isNse ? parseNseCaptureRows(rows) : parseCaptureRows(rows));
    });
  }, [draft, grille, isNse]);

  useEffect(() => {
    if (!draft?.capture_started_at) return;
    const tick = () => setElapsedSeconds(chronoSeconds(draft.capture_started_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [draft?.capture_started_at]);

  const stades = isNse ? NSE_STADES : stadesForSexe(sexe);
  const phenotypeOptions = isNse ? NSE_PHENOTYPES : PHENOTYPES;
  const capturesMax = isNse ? NSE_CAPTURES_MAX : CAPTURES_MAX;
  const total = totalCaptures(counts);
  const totalFemelles = totalBySexe(counts, 'F');
  const totalMales = totalBySexe(counts, 'M');
  const dominant = isNse ? dominantNsePhenotype(counts) : dominantPhenotype(counts);
  const currentCount = isNse
    ? counts[nseCaptureKey(selectedPhenotype as NsePhenotype, selectedStade)] ?? 0
    : counts[`${sexe}|${selectedPhenotype}|${selectedStade}`] ?? 0;

  const handleSexe = (next: Sexe) => {
    setSexe(next);
    setSelectedStade((prev) => stadeForSexeSwitch(prev, next));
  };

  const handleIncrement = (phenotype: Phenotype | NsePhenotype) => {
    setCounts((prev) =>
      isNse
        ? incrementNseCapture(prev, phenotype as NsePhenotype, selectedStade)
        : incrementCapture(prev, sexe, phenotype as Phenotype, selectedStade)
    );
  };

  const handleDecrement = (phenotype: Phenotype | NsePhenotype) => {
    setCounts((prev) =>
      isNse
        ? decrementNseCapture(prev, phenotype as NsePhenotype, selectedStade)
        : decrementCapture(prev, sexe, phenotype as Phenotype, selectedStade)
    );
  };

  const handleContinuer = async () => {
    if (!draft || !grille) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (isNse) {
        await saveNseCaptureCounts(draft.id, counts);
      } else {
        await saveCaptureCounts(draft.id, grille.espece, grille.categorie, counts);
      }
      if (grilles.length <= 1) {
        router.push({ pathname: '/(prospection)/vegetation', params: { draftId: draft.id } });
        return;
      }
      const updated = await markGrilleCompleted(draft.id, grilleKey(grille));
      const items = buildPlanItems(grilles, parseGrillesCompletees(updated.grilles_completees));
      if (isPlanComplete(items)) {
        router.push({ pathname: '/(prospection)/vegetation', params: { draftId: draft.id } });
      } else {
        router.push({ pathname: '/(prospection)/plan', params: { draftId: draft.id } });
      }
    } catch {
      setSaveError('Impossible d’enregistrer les captures localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (grilles.length > 1) {
      router.push({ pathname: '/(prospection)/plan', params: { draftId } });
    } else {
      router.push({ pathname: '/(prospection)/especes', params: { draftId } });
    }
  };

  if (!draft || !grille) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={handleRetour}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Captures — {grille.espece} {grille.categorie === 'imago' ? 'Imagos' : 'Larves'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 3/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <View style={styles.chronoRow}>
            <Text style={styles.chronoLabel}>Chrono</Text>
            <Text style={styles.chronoValue}>{formatChrono(elapsedSeconds)}</Text>
          </View>
          <Text style={styles.chronoMax}>max 30:00</Text>
        </View>

        {isNse ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sexe</Text>
            <Text style={styles.summaryTextSub}>Non requis (pas de distinction ♀/♂ pour Nomadacris)</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sexe</Text>
            <View style={styles.sexeRow}>
              <SexeButton label="Femelles" active={sexe === 'F'} onPress={() => handleSexe('F')} />
              <SexeButton label="Mâles" active={sexe === 'M'} onPress={() => handleSexe('M')} />
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phase</Text>
          <View style={styles.chipsRow}>
            {stades.map((stade) => (
              <TouchableOpacity
                key={stade}
                style={[styles.chip, selectedStade === stade && styles.chipActive]}
                onPress={() => setSelectedStade(stade)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, selectedStade === stade && styles.chipTextActive]}>{stade}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phénotype</Text>
          {phenotypeOptions.map(({ value, label }) => {
            const active = selectedPhenotype === value;
            const count = isNse
              ? counts[nseCaptureKey(value as NsePhenotype, selectedStade)] ?? 0
              : counts[`${sexe}|${value}|${selectedStade}`] ?? 0;
            return (
              <View key={value} style={[styles.phenotypeRow, active && styles.phenotypeRowActive]}>
                <TouchableOpacity style={styles.phenotypeLabelWrap} onPress={() => setSelectedPhenotype(value)}>
                  <Text style={[styles.phenotypeLabel, active && styles.phenotypeLabelActive]}>{label}</Text>
                </TouchableOpacity>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleDecrement(value)}
                    disabled={!active}
                  >
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{count}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleIncrement(value)}
                    disabled={!active || total >= capturesMax}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.summaryText}>
            Total {total}/{capturesMax}
            {isNse ? '' : ` · F ${totalFemelles} · M ${totalMales}`}
          </Text>
          <Text style={styles.summaryText}>
            Phénotype dominant : {dominant ? phenotypeOptions.find((p) => p.value === dominant)?.label : '—'}
          </Text>
          <Text style={styles.summaryTextSub}>Sélection courante : {currentCount}</Text>
        </View>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity style={styles.btnContinuer} onPress={handleContinuer} disabled={isSaving} activeOpacity={0.85}>
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Continuer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SexeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.sexeBtn, active && styles.sexeBtnActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.sexeBtnText, active && styles.sexeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  backLink: { color: '#FFFFFFCC', fontSize: 13, marginBottom: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FFFFFF' },
  progressLabel: { color: '#FFFFFFAA', fontSize: 11, marginTop: 4 },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  chronoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chronoLabel: { color: '#6B7280', fontSize: 13 },
  chronoValue: { color: '#111827', fontSize: 22, fontWeight: '700' },
  chronoMax: { color: '#9CA3AF', fontSize: 11, textAlign: 'right' },
  sexeRow: { flexDirection: 'row', gap: 8 },
  sexeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  sexeBtnActive: { backgroundColor: IFVM_GREEN, borderColor: IFVM_GREEN },
  sexeBtnText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  sexeBtnTextActive: { color: '#FFFFFF' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  chipText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: IFVM_GREEN_DARK },
  phenotypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 6,
  },
  phenotypeRowActive: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  phenotypeLabelWrap: { flex: 1 },
  phenotypeLabel: { color: '#111827', fontSize: 14, fontWeight: '600' },
  phenotypeLabelActive: { color: IFVM_GREEN_DARK },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IFVM_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  counterValue: { color: '#111827', fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  summaryText: { color: '#111827', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  summaryTextSub: { color: '#6B7280', fontSize: 12 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
