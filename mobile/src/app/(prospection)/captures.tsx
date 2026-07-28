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
import {
  buildPlanItems,
  grilleKey,
  isEspeceComplete,
  isPlanComplete,
  parseGrillesCompletees,
} from '@/lib/prospection-plan';
import {
  CaptureCounts,
  PHENOTYPES,
  Phenotype,
  Sexe,
  CAPTURES_MAX,
  LMC_LARVE_CAPTURES_MAX,
  LMC_LARVE_STADES,
  NSE_CAPTURES_MAX,
  NSE_LARVE_CAPTURES_MAX,
  NSE_LARVE_STADES,
  NSE_PHENOTYPES,
  NSE_STADES,
  NsePhenotype,
  chronoSeconds,
  decrementCapture,
  decrementLarveCapture,
  decrementNseCapture,
  dominantLarvePhenotype,
  dominantNsePhenotype,
  dominantPhenotype,
  ensureCaptureTimerStarted,
  formatChrono,
  incrementCapture,
  incrementLarveCapture,
  incrementNseCapture,
  larveCaptureKey,
  parseCaptureRows,
  parseLarveCaptureRows,
  parseNseCaptureRows,
  saveCaptureCounts,
  saveLarveCaptureCounts,
  saveNseCaptureCounts,
  stadeForSexeSwitch,
  stadesForSexe,
  totalBySexe,
  totalCaptures,
} from '@/lib/prospection-captures';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

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
  const isImagoNse = grille?.espece === 'NSE' && grille?.categorie === 'imago';
  const isLarve = grille?.categorie === 'larve';
  const sansSexe = isImagoNse || isLarve;

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      if (!row) return;
      const started = await ensureCaptureTimerStarted(row);
      setDraft(started);
    });
  }, [draftId]);

  const larveStades = grille?.espece === 'LMC' ? LMC_LARVE_STADES : NSE_LARVE_STADES;
  const larvePhenotypeOptions = grille?.espece === 'NSE' ? NSE_PHENOTYPES : PHENOTYPES;
  const larveCapturesMax = grille?.espece === 'LMC' ? LMC_LARVE_CAPTURES_MAX : NSE_LARVE_CAPTURES_MAX;

  useEffect(() => {
    if (!draft || !grille) return;
    setSexe('F');
    setSelectedPhenotype(
      isImagoNse ? NSE_PHENOTYPES[0].value : isLarve ? larvePhenotypeOptions[0].value : 'solitaire'
    );
    setSelectedStade(isImagoNse ? NSE_STADES[0] : isLarve ? larveStades[0] : stadesForSexe('F')[0]);
    listProspectionCaptures(draft.id, grille.espece, grille.categorie).then((rows) => {
      setCounts(
        isImagoNse ? parseNseCaptureRows(rows) : isLarve ? parseLarveCaptureRows(rows) : parseCaptureRows(rows)
      );
    });
  }, [draft, grille, isImagoNse, isLarve, larvePhenotypeOptions, larveStades]);

  useEffect(() => {
    if (!draft?.capture_started_at) return;
    const tick = () => setElapsedSeconds(chronoSeconds(draft.capture_started_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [draft?.capture_started_at]);

  const stades = isImagoNse ? NSE_STADES : isLarve ? larveStades : stadesForSexe(sexe);
  const phenotypeOptions = isImagoNse ? NSE_PHENOTYPES : isLarve ? larvePhenotypeOptions : PHENOTYPES;
  const capturesMax = isImagoNse ? NSE_CAPTURES_MAX : isLarve ? larveCapturesMax : CAPTURES_MAX;
  const total = totalCaptures(counts);
  const totalFemelles = totalBySexe(counts, 'F');
  const totalMales = totalBySexe(counts, 'M');
  const dominant = isImagoNse
    ? dominantNsePhenotype(counts)
    : isLarve
    ? (dominantLarvePhenotype(counts) as Phenotype | NsePhenotype | null)
    : dominantPhenotype(counts);
  const currentCount = sansSexe
    ? counts[larveCaptureKey(selectedPhenotype, selectedStade)] ?? 0
    : counts[`${sexe}|${selectedPhenotype}|${selectedStade}`] ?? 0;

  const progress = total > 0 ? Math.round((total / capturesMax) * 100) : 0;

  const handleSexe = (next: Sexe) => {
    setSexe(next);
    setSelectedStade((prev) => stadeForSexeSwitch(prev, next));
  };

  const handleIncrement = (phenotype: Phenotype | NsePhenotype) => {
    setCounts((prev) =>
      isImagoNse
        ? incrementNseCapture(prev, phenotype as NsePhenotype, selectedStade)
        : isLarve
        ? incrementLarveCapture(prev, phenotype, selectedStade, capturesMax)
        : incrementCapture(prev, sexe, phenotype as Phenotype, selectedStade)
    );
  };

  const handleDecrement = (phenotype: Phenotype | NsePhenotype) => {
    setCounts((prev) =>
      isImagoNse
        ? decrementNseCapture(prev, phenotype as NsePhenotype, selectedStade)
        : isLarve
        ? decrementLarveCapture(prev, phenotype, selectedStade)
        : decrementCapture(prev, sexe, phenotype as Phenotype, selectedStade)
    );
  };

  const handleContinuer = async () => {
    if (!draft || !grille) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (isImagoNse) {
        await saveNseCaptureCounts(draft.id, counts);
      } else if (isLarve) {
        await saveLarveCaptureCounts(draft.id, grille.espece, counts);
      } else {
        await saveCaptureCounts(draft.id, grille.espece, grille.categorie, counts);
      }
      let completed: Set<string>;
      if (grilles.length <= 1) {
        completed = new Set([grilleKey(grille)]);
      } else {
        const updated = await markGrilleCompleted(draft.id, grilleKey(grille));
        completed = parseGrillesCompletees(updated.grilles_completees);
      }

      const items = buildPlanItems(grilles, completed);
      const hasInfestation = (draft.surf_infestee ?? 0) > 0;
      const next = isPlanComplete(items) ? (hasInfestation ? 'infestation' : 'vegetation') : 'plan';

      if (isEspeceComplete(grilles, completed, grille.espece)) {
        router.push({
          pathname: '/(prospection)/densites',
          params: { draftId: draft.id, espece: grille.espece, next },
        });
        return;
      }

      router.push({ 
        // @ts-ignore
        pathname: `/(prospection)/${next}`, 
        params: { draftId: draft.id } 
      });
    } catch (error) {
      console.error('Erreur sauvegarde captures:', error);
      setSaveError('Impossible d’enregistrer les captures localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    if (grilles.length > 1) {
      router.push({ 
        pathname: '/(prospection)/plan', 
        params: { draftId: draft.id } 
      });
    } else {
      router.push({ 
        pathname: '/(prospection)/especes', 
        params: { draftId: draft.id } 
      });
    }
  };

  if (!draft || !grille) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>
          Captures — {grille.espece} {grille.categorie === 'imago' ? 'Imagos' : 'Larves'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Étape 3/4</Text>
          <Text style={styles.progressCount}>{total}/{capturesMax}</Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Chrono */}
        <View style={styles.card}>
          <View style={styles.chronoRow}>
            <Text style={styles.chronoLabel}>⏱ Chrono</Text>
            <Text style={[styles.chronoValue, elapsedSeconds > 1500 && styles.chronoWarning]}>
              {formatChrono(elapsedSeconds)}
            </Text>
          </View>
          <Text style={styles.chronoMax}>max 30:00</Text>
        </View>

        {/* Sexe */}
        {sansSexe ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sexe</Text>
            <Text style={styles.summaryTextSub}>Non requis (pas de distinction ♀/♂)</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sexe</Text>
            <View style={styles.sexeRow}>
              <SexeButton label="Femelles ♀" active={sexe === 'F'} onPress={() => handleSexe('F')} />
              <SexeButton label="Mâles ♂" active={sexe === 'M'} onPress={() => handleSexe('M')} />
            </View>
          </View>
        )}

        {/* Stades (Phase) */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stade</Text>
          <View style={styles.chipsRow}>
            {stades.map((stade) => (
              <TouchableOpacity
                key={stade}
                style={[styles.chip, selectedStade === stade && styles.chipActive]}
                onPress={() => setSelectedStade(stade)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, selectedStade === stade && styles.chipTextActive]}>
                  {stade}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Phénotypes */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phénotype</Text>
          {phenotypeOptions.map(({ value, label }) => {
            const active = selectedPhenotype === value;
            const count = sansSexe
              ? counts[larveCaptureKey(value, selectedStade)] ?? 0
              : counts[`${sexe}|${value}|${selectedStade}`] ?? 0;
            return (
              <View key={value} style={[styles.phenotypeRow, active && styles.phenotypeRowActive]}>
                <TouchableOpacity 
                  style={styles.phenotypeLabelWrap} 
                  onPress={() => setSelectedPhenotype(value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.phenotypeLabel, active && styles.phenotypeLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, !active && styles.counterBtnDisabled]}
                    onPress={() => handleDecrement(value)}
                    disabled={!active || count <= 0}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.counterValue, active && styles.counterValueActive]}>
                    {count}
                  </Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, (!active || total >= capturesMax) && styles.counterBtnDisabled]}
                    onPress={() => handleIncrement(value)}
                    disabled={!active || total >= capturesMax}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Résumé */}
        <View style={styles.card}>
          <Text style={styles.summaryText}>
            Total {total}/{capturesMax}
            {sansSexe ? '' : ` · ♀ ${totalFemelles} · ♂ ${totalMales}`}
          </Text>
          <Text style={styles.summaryText}>
            Phénotype dominant : {dominant ? phenotypeOptions.find((p) => p.value === dominant)?.label : '—'}
          </Text>
          <Text style={styles.summaryTextSub}>Sélection courante : {currentCount}</Text>
          {total >= capturesMax && (
            <View style={styles.maxBox}>
              <Text style={styles.maxText}>✅ Maximum atteint</Text>
            </View>
          )}
        </View>

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {/* Boutons en bas - même taille */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner, isSaving && styles.btnDisabled]}
            onPress={handleRetour}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btn, styles.btnContinuer, isSaving && styles.btnDisabled]} 
            onPress={handleContinuer} 
            disabled={isSaving} 
            activeOpacity={0.85}
          >
            <Text style={styles.btnContinuerText}>
              {isSaving ? '⏳ Enregistrement…' : 'Continuer →'}
            </Text>
          </TouchableOpacity>
        </View>
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
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  header: { 
    backgroundColor: IFVM_GREEN_DARK, 
    paddingHorizontal: 16, 
    paddingBottom: 14 
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 10 
  },
  progressTrack: { 
    height: 4, 
    backgroundColor: '#FFFFFF33', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: 4, 
    backgroundColor: '#FFFFFF' 
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
  },
  progressCount: {
    color: '#FFFFFFAA',
    fontSize: 11,
  },
  content: { 
    flex: 1 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase' 
  },
  chronoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  chronoLabel: { 
    color: '#6B7280', 
    fontSize: 13 
  },
  chronoValue: { 
    color: '#111827', 
    fontSize: 22, 
    fontWeight: '700' 
  },
  chronoWarning: {
    color: '#DC2626',
  },
  chronoMax: { 
    color: '#9CA3AF', 
    fontSize: 11, 
    textAlign: 'right' 
  },
  sexeRow: { 
    flexDirection: 'row', 
    gap: 8 
  },
  sexeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  sexeBtnActive: { 
    backgroundColor: IFVM_GREEN, 
    borderColor: IFVM_GREEN 
  },
  sexeBtnText: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  sexeBtnTextActive: { 
    color: '#FFFFFF' 
  },
  chipsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  chipActive: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  chipText: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  chipTextActive: { 
    color: IFVM_GREEN_DARK 
  },
  phenotypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginTop: 6,
  },
  phenotypeRowActive: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  phenotypeLabelWrap: { 
    flex: 1 
  },
  phenotypeLabel: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  phenotypeLabelActive: { 
    color: IFVM_GREEN_DARK 
  },
  counterControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IFVM_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.4,
  },
  counterBtnText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700', 
    lineHeight: 18 
  },
  counterValue: { 
    color: '#6B7280', 
    fontSize: 15, 
    fontWeight: '700', 
    minWidth: 24, 
    textAlign: 'center' 
  },
  counterValueActive: {
    color: IFVM_GREEN_DARK,
  },
  summaryText: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 4 
  },
  summaryTextSub: { 
    color: '#6B7280', 
    fontSize: 12 
  },
  maxBox: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  maxText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  btnContinuer: { 
    backgroundColor: IFVM_GREEN,
  },
  btnRetourner: {
    backgroundColor: '#6B7280',
  },
  btnRetournerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnContinuerText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  btnDisabled: {
    opacity: 0.6,
  },
});