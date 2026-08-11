import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseEspeceSelection, buildGrilles } from '@/lib/prospection-especes';
import { capturesMaxFor, grilleKeyToString } from '@/lib/prospection-especes-stades';
import { chronoSeconds, formatChrono } from '@/lib/prospection-review';
import { markGrilleCompleted, saveProspectionCaptures, startCaptureTimer } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import { TextInput } from 'react-native-gesture-handler';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;
const CATEGORIE_LABEL = { imago: 'Imagos', larve: 'Larves' } as const;

// ==========================================
// CONFIGURATION DES STADES PAR ESPÈCE ET SEXE
// ==========================================
const STADES_CONFIG = {
  imago: {
    LMC: {
      F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'],
      M: ['A1', 'A123', 'A5'],
    },
    NSE: {
      F: ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'],
      M: ['A1', 'A123', 'A5'],
    },
  },
  larve: {
    LMC: ['L1', 'L2', 'L3', 'L4', 'L5'],
    NSE: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  },
};

// ==========================================
// CONFIGURATION DES PHASES PAR ESPÈCE ET CATÉGORIE
// ==========================================
const PHASES_CONFIG = {
  LMC: {
    imago: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    },
    larve: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
    },
  },
  NSE: {
    imago: {
      F: ['solitaire', 'transiens', 'solitario_transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'gregaire'],
    },
    larve: {
      F: ['solitaire', 'transiens', 'gregaire'],
      M: ['solitaire', 'transiens', 'gregaire'],
    },
  },
};

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
  const isImago = grille?.categorie === 'imago';
  const isLarve = grille?.categorie === 'larve';

  // Récupérer les données du store
  const currentSexe = store.currentSexe;
  const stadesData = store.stadesData;
  const phasesData = store.phasesData;
  const totalStades = Object.values(stadesData).reduce((a, b) => a + b, 0);
  const totalPhases = Object.values(phasesData).reduce((a, b) => a + b, 0);
  const totalCapturesCount = totalPhases;
  const isConsistent = totalStades === totalPhases;

  // Obtenir les listes pour l'affichage
  const getStadesList = () => {
    if (!grille) return [];
    if (grille.categorie === 'imago') {
      return STADES_CONFIG.imago[grille.espece]?.[currentSexe] || [];
    } else {
      return STADES_CONFIG.larve[grille.espece] || [];
    }
  };

  const getPhasesList = () => {
    if (!grille) return [];
    const category = grille.categorie as 'imago' | 'larve';
    const sexeKey = grille.categorie === 'imago' ? currentSexe : 'F';
    return PHASES_CONFIG[grille.espece]?.[category]?.[sexeKey] || [];
  };

  const stadesList = getStadesList();
  const phasesList = getPhasesList();

  // ==========================================
  // EFFETS
  // ==========================================
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
  }, [draft, draftId, captures, store]);

  useEffect(() => {
    if (store.grilleOrder.length > 0 && requestedIndex !== store.currentGrilleIndex) {
      store.goToGrille(requestedIndex, captures);
    }
  }, [requestedIndex, store.grilleOrder.length, store, captures]);

  useEffect(() => {
    if (!draftId || draft?.capture_started_at) return;
    startCaptureTimer(draftId).then(setDraft);
  }, [draftId, draft?.capture_started_at, setDraft]);

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

  const max = capturesMaxFor(grille.espece, grille.categorie);
  const isLastGrille = store.currentGrilleIndex === store.grilleOrder.length - 1;
  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const handleBack = () => {
    if (store.currentGrilleIndex > 0) {
      router.replace({
        pathname: '/(prospection)/captures' as any,
        params: { draftId, grilleIndex: String(store.currentGrilleIndex - 1) },
      });
    } else {
      router.replace({ pathname: '/(prospection)/species' as any, params: { draftId } });
    }
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;

    if (!isConsistent) {
      alert(
        `⚠️ Incohérence des données :\n` +
        `Somme des stades = ${totalStades}\n` +
        `Somme des phases = ${totalPhases}\n` +
        `Les deux sommes doivent être égales.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const rows = [];

      if (isImago) {
        for (const phase of phasesList) {
          const count = phasesData[phase] || 0;
          if (count > 0) {
            rows.push({
              espece: grille.espece,
              categorie: grille.categorie,
              sexe: currentSexe,
              phase: phase,
              stade: 'A1',
              effectif: count,
            });
          }
        }
      } else {
        for (const phase of phasesList) {
          const count = phasesData[phase] || 0;
          if (count > 0) {
            rows.push({
              espece: grille.espece,
              categorie: grille.categorie,
              sexe: null,
              phase: phase,
              stade: 'L1',
              effectif: count,
            });
          }
        }
      }

      await saveProspectionCaptures(draftId, grille.espece, grille.categorie, rows);
      await markGrilleCompleted(draftId, grilleKeyToString(grille));
      store.markCurrentGrilleCompleted();
      await refreshCaptures();

      if (isLastGrille) {
        router.push({ pathname: '/(prospection)/infestation' as any, params: { draftId } });
      } else {
        const nextGrille = store.grilleOrder[store.currentGrilleIndex + 1];
        const nextScreen = nextGrille.categorie === 'imago' ? 'density' : 'captures';
        router.replace({
          pathname: `/(prospection)/${nextScreen}` as any,
          params: { draftId, grilleIndex: String(store.currentGrilleIndex + 1) },
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderSexeToggle = () => {
    if (!isImago) return null;

    return (
      <>
        <View style={styles.sexeRow}>
          <TouchableOpacity
            style={[styles.sexeToggle, currentSexe === 'F' && styles.sexeToggleActive]}
            onPress={() => store.setSexe('F')}
            activeOpacity={0.8}
          >
            <Text style={[styles.sexeText, currentSexe === 'F' && styles.sexeTextActive]}>♀ Femelles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sexeToggle, currentSexe === 'M' && styles.sexeToggleActive]}
            onPress={() => store.setSexe('M')}
            activeOpacity={0.8}
          >
            <Text style={[styles.sexeText, currentSexe === 'M' && styles.sexeTextActive]}>♂ Mâles</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sexeHint}>
          {currentSexe === 'F'
            ? '♀ Stades: A1, A2, A3, A3-1/4, A3-1/2, A3-3/4, A3-4/4, A4, A5'
            : '♂ Stades: A1, A123, A5'}
        </Text>
      </>
    );
  };

  const renderPhases = () => {
    if (phasesList.length === 0) return null;

    const label = isImago ? 'Phases imagos' : 'Phases larves';

    return (
      <View style={[styles.tableSection, { marginTop: 16 }]}>
        <Text style={styles.sectionLabel}>📊 {label}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Phase</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
        </View>
        {phasesList.map((phase) => (
          <View key={phase} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>
              {phase.replace('_', ' ')}
            </Text>
            <TextInput
              value={String(phasesData[phase] || 0)}
              onChangeText={(text) => {
                const val = parseInt(text) || 0;
                store.updatePhase(phase, val);
              }}
              keyboardType="number-pad"
              style={[styles.tableCell, styles.tableCellValue, styles.tableInput]}
            />
            <View style={[styles.tableCell, styles.tableCellActions, styles.tableActionsRow]}>
              <TouchableOpacity
                style={styles.smallCounterButton}
                onPress={() => store.decrementPhase(phase)}
              >
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => store.incrementPhase(phase)}
              >
                <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterText}>
            Total phases : <Text style={styles.tableFooterValue}>{totalPhases}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderStades = () => {
    if (stadesList.length === 0) return null;

    const label = isImago ? 'Par stade' : 'Par stade larvaire';
    const isLarveSection = isLarve;

    return (
      <View style={styles.tableSection}>
        <Text style={styles.sectionLabel}>📊 {label}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Stade</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
        </View>
        {stadesList.map((stade) => (
          <View key={stade} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>
              {stade}
            </Text>
            <TextInput
              value={String(stadesData[stade] || 0)}
              onChangeText={(text) => {
                const val = parseInt(text) || 0;
                store.updateStade(stade, val);
              }}
              keyboardType="number-pad"
              style={[styles.tableCell, styles.tableCellValue, styles.tableInput]}
            />
            <View style={[styles.tableCell, styles.tableCellActions, styles.tableActionsRow]}>
              <TouchableOpacity
                style={styles.smallCounterButton}
                onPress={() => store.decrementStade(stade)}
              >
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => store.incrementStade(stade)}
              >
                <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterText}>
            Total {isLarveSection ? 'larves' : 'stades'} :{' '}
            <Text style={styles.tableFooterValue}>{totalStades}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
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
              {totalCapturesCount}
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
          {renderSexeToggle()}
          {renderStades()}
          {renderPhases()}

          <View style={styles.totalCaptureContainer}>
            <Text style={styles.totalCaptureLabel}>📋 Nombre de captures</Text>
            <View style={styles.totalCaptureValueContainer}>
              <Text style={styles.totalCaptureValue}>{totalCapturesCount}</Text>
            </View>
          </View>

          {!isConsistent && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Incohérence : les totaux ne correspondent pas !
              </Text>
              <Text style={styles.warningDetail}>
                Stades: {totalStades}  |  Phases: {totalPhases}
              </Text>
            </View>
          )}

          {isConsistent && totalCapturesCount > 0 && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                ✅ Cohérent : {totalCapturesCount} captures
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !isConsistent && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isSaving || !isConsistent}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>
              {isLastGrille ? 'Infestation  ›' : 'Grille suivante  ›'}
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
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
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
  sexeRow: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: INACTIVE_BG,
    borderRadius: 11,
    padding: 4,
    marginBottom: 11,
  },
  sexeToggle: { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  sexeToggleActive: { backgroundColor: '#fff' },
  sexeText: { fontWeight: '700', fontSize: 13, color: '#9a9484' },
  sexeTextActive: { color: TEXT },
  sexeHint: { fontSize: 10, color: '#9a9484', marginBottom: 9 },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#9a9484',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  tableSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eee8',
  },
  tableCell: {
    fontSize: 14,
    paddingVertical: 4,
  },
  tableCellStade: { flex: 1.2 },
  tableCellValue: { flex: 1, textAlign: 'center' },
  tableCellActions: { flex: 1.2, alignItems: 'center' },
  tableCellText: { fontWeight: '600', color: TEXT },
  tableInput: {
    backgroundColor: '#f8f6f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  tableActionsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  tableFooter: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    alignItems: 'center',
  },
  tableFooterText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  tableFooterValue: {
    fontWeight: '700',
    color: GREEN,
    fontSize: 14,
  },
  smallCounterButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: INACTIVE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCounterButtonAdd: { backgroundColor: GREEN },
  smallCounterText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  smallCounterTextAdd: { color: '#fff' },
  totalCaptureContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  totalCaptureLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalCaptureValueContainer: {
    marginTop: 4,
  },
  totalCaptureValue: {
    color: TEXT,
    fontSize: 32,
    fontWeight: '800',
  },
  warningContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  warningText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  warningDetail: {
    color: '#dc2626',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  successText: {
    color: '#15803d',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  footer: { padding: 16 },
  continueButton: {
    backgroundColor: GREEN,
    borderRadius: 13,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});