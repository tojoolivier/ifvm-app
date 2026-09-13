import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Espece, capturesMaxFor, grilleKeyToString, phasesFor } from '@/lib/prospection-especes-stades';
import { parseEspeceSelection, buildGrilles, parseGrillesCompletees } from '@/lib/prospection-especes';
import { parseDensite } from '@/lib/prospection-extensive';
import { listStadesGrille } from '@/lib/referentiel-db';
import { retourArriere } from '@/lib/fiche-routing';
import { chronoSeconds, formatChrono } from '@/lib/prospection-review';
import {
  PopulationRow,
  getProspectionPopulation,
  saveProspectionPopulation,
  markGrilleCompleted,
  saveProspectionCaptures,
} from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore, StadesGrille } from '@/lib/prospection-capture-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;

function emptyLarvePopulation(espece: Espece): PopulationRow {
  return {
    espece,
    categorie: 'larve',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
    interdistance: null,
    tache_larvaire: null,
    bande_larvaire: null,
    deplacement: null,
  };
}

/**
 * C-Larves : fusionne density.tsx + captures.tsx (fiche intensive, grilles
 * larve) en un seul écran, LMC et NSE présentés par onglet d'espèce — même
 * modèle que intensive-imagos.tsx/extensive-larves.tsx. Surface contaminée
 * volontairement exclue (seul champ d'extensive-larves.tsx non repris ici).
 */
export default function IntensiveLarvesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);

  const store = useProspectionCaptureStore();
  const { grilleOrder, currentGrilleIndex, phasesData, stadesData } = store;

  const [tick, setTick] = useState(0);
  const [chargementStades, setChargementStades] = useState(true);
  const [populations, setPopulations] = useState<Partial<Record<Espece, PopulationRow>>>({});
  const [populationsLoaded, setPopulationsLoaded] = useState(false);
  const [totalCapturesInput, setTotalCapturesInput] = useState('');
  const [showDensiteDiffuseError, setShowDensiteDiffuseError] = useState(false);
  const [showDensiteGroupeeError, setShowDensiteGroupeeError] = useState(false);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('intensive-larves');

  const isInitialized = useRef(false);
  const isHydrated = useRef(false);
  const syncedGrilleIndexRef = useRef<number | null>(null);

  const brouillonPret = !!draft && draft.id === draftId;

  useEffect(() => {
    if (!draftId || isHydrated.current) return;
    const hydrate = async () => {
      if (draft?.id !== draftId) {
        await hydrateFromDraft(draftId);
      }
      isHydrated.current = true;
    };
    void hydrate().catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

  useEffect(() => {
    if (!draft || draft.id !== draftId || isInitialized.current) return;
    isInitialized.current = true;

    const selection = parseEspeceSelection(draft.especes);
    const grilles = buildGrilles(selection);
    const completed = parseGrillesCompletees(draft.grilles_completees);

    const codesDe = async (espece: Espece, categorie: 'imago' | 'larve', sexe: 'F' | 'M' | null): Promise<string[]> => {
      const stades = await listStadesGrille(espece, categorie, sexe);
      return stades.map((s) => s.code);
    };

    const chargerStades = async () => {
      const parGrille: Record<string, StadesGrille> = {};
      for (const g of grilles) {
        const stades: StadesGrille = { F: [], M: [], larve: [] };
        if (g.categorie === 'imago') {
          stades.F = await codesDe(g.espece, 'imago', 'F');
          stades.M = await codesDe(g.espece, 'imago', 'M');
        } else {
          stades.larve = await codesDe(g.espece, 'larve', null);
        }
        parGrille[grilleKeyToString(g)] = stades;
      }
      store.setStadesParGrille(parGrille);
      store.initGrilles(grilles, completed, captures);

      const firstLarveIndex = grilles.findIndex((g) => g.categorie === 'larve');
      if (firstLarveIndex >= 0) {
        store.goToGrille(firstLarveIndex, captures);
      }
    };

    setChargementStades(true);
    void chargerStades()
      .catch((error) => {
        isInitialized.current = false;
        signalerChargement(error, { draftId });
      })
      .finally(() => setChargementStades(false));
  }, [draft, draftId, captures, store, signalerChargement]);

  useEffect(() => {
    if (!draftId) return;
    void Promise.all([
      getProspectionPopulation(draftId, 'LMC', 'larve'),
      getProspectionPopulation(draftId, 'NSE', 'larve'),
    ])
      .then(([lmc, nse]) => {
        setPopulations({
          LMC: lmc ?? emptyLarvePopulation('LMC'),
          NSE: nse ?? emptyLarvePopulation('NSE'),
        });
      })
      .catch((error) => signalerChargement(error, { draftId }))
      .finally(() => setPopulationsLoaded(true));
  }, [draftId, signalerChargement]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const grille = grilleOrder[currentGrilleIndex];
  const stadesGrille = grille ? (store.stadesParGrille[grilleKeyToString(grille)] ?? { F: [], M: [], larve: [] }) : { F: [], M: [], larve: [] };
  const larvesList = stadesGrille.larve;
  const phasesList = grille ? phasesFor(grille.espece, grille.categorie) : [];

  const totalStadesLarve = larvesList.reduce((sum, stade) => sum + (Number(stadesData[stade]) || 0), 0);
  const totalPhases = Object.values(phasesData).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalCaptures = Number.parseInt(totalCapturesInput, 10) || 0;

  const isPhasesConsistent = totalCaptures === 0 || totalPhases === totalCaptures;
  const isStadesConsistent = totalCaptures === 0 || totalStadesLarve === totalCaptures;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  const vocabulairePret = larvesList.length > 0;

  useEffect(() => {
    if (!grille || !vocabulairePret) return;
    if (syncedGrilleIndexRef.current === currentGrilleIndex) return;
    syncedGrilleIndexRef.current = currentGrilleIndex;
    setTotalCapturesInput(totalStadesLarve > 0 ? String(totalStadesLarve) : '');
    setShowDensiteDiffuseError(false);
    setShowDensiteGroupeeError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGrilleIndex, vocabulairePret]);

  const isLoading = !brouillonPret || chargementStades || !populationsLoaded || !grille;

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Larves</Text>
          </View>
          <View style={styles.chargementBloc}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.chargementTexte}>Chargement de la grille…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const species = grille.espece;
  const population = populations[species] ?? emptyLarvePopulation(species);
  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const setPopulationField = <K extends keyof PopulationRow>(field: K, value: PopulationRow[K]) => {
    setPopulations((prev) => ({
      ...prev,
      [species]: { ...(prev[species] ?? emptyLarvePopulation(species)), [field]: value },
    }));
  };

  const larveIndices = grilleOrder.map((g, index) => ({ g, index })).filter(({ g }) => g.categorie === 'larve');
  const isLastLarveTab = larveIndices[larveIndices.length - 1]?.index === currentGrilleIndex;

  const commitCurrentGrille = async (): Promise<boolean> => {
    if (population.densite_diffuse == null) {
      setShowDensiteDiffuseError(true);
      Alert.alert('Densité diffuse requise', 'Veuillez renseigner la densité diffuse (ind./ha).');
      return false;
    }
    if (population.densite_groupee == null) {
      setShowDensiteGroupeeError(true);
      Alert.alert('Densité groupée requise', 'La densité groupée (ind./m²) est obligatoire.');
      return false;
    }

    if (totalCaptures > 0) {
      if (!isPhasesConsistent) {
        Alert.alert(
          'Incohérence des phases',
          `Captures : ${totalCaptures}\nPhases : ${totalPhases}\n\nLa somme des phases doit être exactement égale au nombre de captures.`
        );
        return false;
      }
      if (!isStadesConsistent) {
        Alert.alert(
          'Incohérence des stades larvaires',
          `Captures : ${totalCaptures}\nPhases : ${totalPhases}\nStades larvaires : ${totalStadesLarve}\n\nLa règle est :\nCaptures = Phases = Stades larvaires`
        );
        return false;
      }
    }

    await saveProspectionPopulation(draftId, population);

    const rows: { espece: Espece; categorie: 'larve'; sexe: null; phase: string; stade: string; effectif: number }[] = [];
    if (totalCaptures > 0) {
      const phasesWithCounts = phasesList.map((phase) => ({ phase, count: Number(phasesData[phase]) || 0 })).filter((p) => p.count > 0);
      if (phasesWithCounts.length === 0) {
        Alert.alert('Erreur', "Aucune phase n'a été renseignée.");
        return false;
      }
      const totalPhaseCount = phasesWithCounts.reduce((sum, p) => sum + p.count, 0);

      for (const stade of larvesList) {
        const count = Number(stadesData[stade]) || 0;
        if (count === 0) continue;
        let remaining = count;
        for (let i = 0; i < phasesWithCounts.length; i++) {
          const phase = phasesWithCounts[i];
          if (i === phasesWithCounts.length - 1) {
            if (remaining > 0) rows.push({ espece: grille.espece, categorie: 'larve', sexe: null, phase: phase.phase, stade, effectif: remaining });
          } else {
            const proportion = phase.count / totalPhaseCount;
            const allocated = Math.round(count * proportion);
            if (allocated > 0) {
              rows.push({ espece: grille.espece, categorie: 'larve', sexe: null, phase: phase.phase, stade, effectif: allocated });
              remaining -= allocated;
            }
          }
        }
      }

      if (rows.length === 0) {
        Alert.alert('Aucune capture', 'Veuillez saisir au moins une capture avant de continuer.');
        return false;
      }
    }

    if (rows.length > 0) {
      await saveProspectionCaptures(draftId, grille.espece, grille.categorie, rows);
    }
    await markGrilleCompleted(draftId, grilleKeyToString(grille));
    store.markCurrentGrilleCompleted();
    await refreshCaptures();
    return true;
  };

  const switchToSpecies = (targetEspece: Espece) => {
    if (targetEspece === species) return;
    const target = larveIndices.find(({ g }) => g.espece === targetEspece);
    if (!target) return;
    void run(
      async () => {
        const ok = await commitCurrentGrille();
        if (!ok) return;
        store.goToGrille(target.index, captures);
      },
      {
        screen: 'intensive-larves',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, from: species, to: targetEspece },
      }
    );
  };

  const handleBack = () =>
    retourArriere(router, () => {
      router.replace(`/(prospection)/species?draftId=${draftId}`);
    });

  const handleContinue = () =>
    run(
      async () => {
        const ok = await commitCurrentGrille();
        if (!ok) return;
        router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
      },
      {
        screen: 'intensive-larves',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, espece: species },
      }
    );

  const max = capturesMaxFor(species, 'larve');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Larves</Text>
          </View>

          {larveIndices.length > 1 && (
            <View style={styles.speciesRow}>
              {larveIndices.map(({ g }) => {
                const active = g.espece === species;
                return (
                  <TouchableOpacity
                    key={g.espece}
                    style={[styles.speciesButton, active && styles.speciesButtonActive]}
                    onPress={() => switchToSpecies(g.espece)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.speciesButtonText, active && styles.speciesButtonTextActive]}>{g.espece}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabelPrimary}>{ESPECE_LABEL[species]} · total capturé</Text>
              <Text style={styles.statValuePrimary}>
                {totalCaptures}
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

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <View style={styles.totalCaptureSection}>
              <Text style={styles.sectionLabel}>📝 1. Nombre total de captures</Text>
              <View style={styles.totalCaptureInputContainer}>
                <TextInput
                  value={totalCapturesInput}
                  onChangeText={setTotalCapturesInput}
                  keyboardType="number-pad"
                  style={styles.totalCaptureInput}
                  placeholder="Saisir le nombre de captures"
                  placeholderTextColor={TEXT_SECONDARY}
                />
                <Text style={styles.totalCaptureMax}>/ {max}</Text>
              </View>
            </View>

            {phasesList.length > 0 && totalCaptures > 0 && (
              <View style={[styles.tableSection, { marginTop: 0 }]}>
                <Text style={styles.sectionLabel}>📊 2. Phases</Text>
                <View style={styles.summaryBar}>
                  <Text style={styles.summaryBarText}>
                    Somme des phases :{' '}
                    <Text style={[styles.summaryBarValue, totalPhases === totalCaptures ? styles.validValue : styles.invalidValue]}>
                      {totalPhases}
                    </Text>
                  </Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Phase</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
                </View>
                {phasesList.map((phase) => (
                  <View key={phase} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>{phase.replace('_', ' ')}</Text>
                    <TextInput
                      value={String(phasesData[phase] || 0)}
                      onChangeText={(text) => {
                        const val = Number.parseInt(text, 10) || 0;
                        const current = phasesData[phase] || 0;
                        const newTotal = totalPhases - current + val;
                        if (newTotal <= totalCaptures) {
                          store.updatePhase(phase, val);
                        } else {
                          Alert.alert('Limite atteinte', `Le total des phases ne peut pas dépasser ${totalCaptures} captures.`);
                        }
                      }}
                      keyboardType="number-pad"
                      style={[styles.tableCell, styles.tableCellValue, styles.tableInput]}
                    />
                    <View style={[styles.tableCell, styles.tableCellActions, styles.tableActionsRow]}>
                      <TouchableOpacity
                        style={styles.smallCounterButton}
                        onPress={() => {
                          const current = phasesData[phase] || 0;
                          if (current > 0) store.decrementPhase(phase);
                        }}
                      >
                        <Text style={styles.smallCounterText}>−</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                        onPress={() => {
                          if (totalPhases < totalCaptures) store.incrementPhase(phase);
                          else Alert.alert('Limite atteinte', `La somme des phases a déjà atteint ${totalCaptures}.`);
                        }}
                      >
                        <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {totalCaptures > 0 && (
              <View style={styles.tableSection}>
                <Text style={styles.sectionLabel}>📊 3. Stades larvaires</Text>
                <View style={styles.summaryBar}>
                  <Text style={styles.summaryBarText}>
                    Somme des stades :{' '}
                    <Text style={[styles.summaryBarValue, totalStadesLarve === totalCaptures ? styles.validValue : styles.invalidValue]}>
                      {totalStadesLarve}
                    </Text>
                  </Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Stade</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
                </View>
                {larvesList.length === 0 && (
                  <View style={styles.referentielManquant}>
                    <Text style={styles.referentielManquantText}>
                      Stades indisponibles hors ligne — synchronisez les référentiels depuis l’écran Synchronisation, puis rouvrez cette grille.
                    </Text>
                  </View>
                )}
                {larvesList.map((stade) => (
                  <View key={stade} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>{stade}</Text>
                    <TextInput
                      value={String(stadesData[stade] || 0)}
                      onChangeText={(text) => {
                        const val = Number.parseInt(text, 10) || 0;
                        const current = stadesData[stade] || 0;
                        const newTotal = totalStadesLarve - current + val;
                        if (newTotal <= totalCaptures) {
                          store.updateStade(stade, val);
                        } else {
                          Alert.alert('Limite atteinte', `Le total des stades larvaires ne peut pas dépasser ${totalCaptures}.`);
                        }
                      }}
                      keyboardType="number-pad"
                      style={[styles.tableCell, styles.tableCellValue, styles.tableInput]}
                    />
                    <View style={[styles.tableCell, styles.tableCellActions, styles.tableActionsRow]}>
                      <TouchableOpacity
                        style={styles.smallCounterButton}
                        onPress={() => {
                          const current = stadesData[stade] || 0;
                          if (current > 0) store.decrementStade(stade);
                        }}
                      >
                        <Text style={styles.smallCounterText}>−</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                        onPress={() => {
                          if (totalStadesLarve < totalCaptures) store.incrementStade(stade);
                          else Alert.alert('Limite atteinte', `Le total des stades larvaires a déjà atteint ${totalCaptures}.`);
                        }}
                      >
                        <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.fieldsRow}>
              <View style={[styles.field, showDensiteDiffuseError && population.densite_diffuse == null && styles.fieldError]}>
                <Text style={[styles.fieldLabel, styles.requiredLabel]}>Densité diffuse (ind./ha) *</Text>
                <TextInput
                  testID="densite-diffuse-input"
                  value={population.densite_diffuse != null ? String(population.densite_diffuse) : ''}
                  onChangeText={(text) => setPopulationField('densite_diffuse', parseDensite(text))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
              <View style={[styles.field, showDensiteGroupeeError && population.densite_groupee == null && styles.fieldError]}>
                <Text style={[styles.fieldLabel, styles.requiredLabel]}>Densité groupée (ind./m²) *</Text>
                <TextInput
                  testID="densite-groupee-input"
                  value={population.densite_groupee != null ? String(population.densite_groupee) : ''}
                  onChangeText={(text) => setPopulationField('densite_groupee', parseDensite(text))}
                  keyboardType="decimal-pad"
                  style={styles.fieldInput}
                />
              </View>
            </View>
            {showDensiteDiffuseError && population.densite_diffuse == null && (
              <Text style={styles.errorText}>Veuillez renseigner la densité diffuse (ind./ha).</Text>
            )}
            {showDensiteGroupeeError && population.densite_groupee == null && (
              <Text style={styles.errorText}>La densité groupée (ind./m²) est obligatoire.</Text>
            )}

            <Text style={styles.sectionLabel}>Méthode</Text>
            <View style={styles.chipsRow}>
              {(['comptage_direct'] as const).map((option) => {
                const active = option === population.methode;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setPopulationField('methode', active ? null : option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>Comptage direct</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Interdistance (m)</Text>
            <View style={styles.field}>
              <TextInput
                testID="interdistance-input"
                value={population.interdistance != null ? String(population.interdistance) : ''}
                onChangeText={(text) => setPopulationField('interdistance', parseDensite(text))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Tache larvaire</Text>
              <TouchableOpacity
                style={[styles.toggleButton, population.tache_larvaire && styles.toggleButtonActive]}
                onPress={() => setPopulationField('tache_larvaire', !population.tache_larvaire)}
              >
                <Text style={[styles.toggleText, population.tache_larvaire && styles.toggleTextActive]}>
                  {population.tache_larvaire ? 'Oui' : 'Non'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Bande larvaire</Text>
              <TouchableOpacity
                style={[styles.toggleButton, population.bande_larvaire && styles.toggleButtonActive]}
                onPress={() => setPopulationField('bande_larvaire', !population.bande_larvaire)}
              >
                <Text style={[styles.toggleText, population.bande_larvaire && styles.toggleTextActive]}>
                  {population.bande_larvaire ? 'Oui' : 'Non'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Déplacement</Text>
            <View style={styles.chipsRow}>
              {(['repos', 'perchee'] as const).map((option) => {
                const active = population.deplacement === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setPopulationField('deplacement', option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option === 'repos' ? 'Repos' : 'Perchée'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {totalCaptures > 0 && (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>📋 Récapitulatif — {ESPECE_LABEL[species]}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Captures :</Text>
                  <Text style={styles.summaryValue}>{totalCaptures}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phases :</Text>
                  <Text style={[styles.summaryValue, isPhasesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                    {totalPhases}{isPhasesConsistent ? ' ✅' : ' ❌'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stades larvaires :</Text>
                  <Text style={[styles.summaryValue, isStadesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                    {totalStadesLarve}{isStadesConsistent ? ' ✅' : ' ❌'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              style={[styles.continueButton, !isConsistent && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={isSaving || !isConsistent}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{isLastLarveTab ? 'Végétation & Sol  ›' : 'Suivant  ›'}</Text>
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  speciesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  speciesButton: { flex: 1, borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },
  statsRow: { marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', gap: 9 },
  statCardPrimary: { flex: 1, backgroundColor: GREEN, borderRadius: 12, padding: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 10 },
  statLabelPrimary: { color: '#ffffffcc', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabel: { color: '#9a9484', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValuePrimary: { color: '#fff', fontWeight: '700', fontSize: 19 },
  statValue: { color: TEXT, fontWeight: '700', fontSize: 21 },
  statValueMax: { fontSize: 12, color: '#ffffffb3' },
  statValueMaxDim: { fontSize: 11, color: '#bdb6a2' },
  scroll: { flex: 1 },
  chargementBloc: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  chargementTexte: { fontSize: 12.5, color: TEXT_SECONDARY, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
  totalCaptureSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  totalCaptureInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCaptureInput: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },
  totalCaptureMax: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  tableSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 10, marginBottom: 8 },
  summaryBar: { backgroundColor: '#f8f6f0', borderRadius: 6, padding: 8, marginBottom: 10, alignItems: 'center' },
  summaryBarText: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
  summaryBarValue: { fontWeight: '700', fontSize: 15 },
  validValue: { color: GREEN },
  invalidValue: { color: '#dc2626' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 6, marginBottom: 6 },
  tableHeaderCell: { fontSize: 10, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  tableCell: { fontSize: 14, paddingVertical: 4 },
  tableCellStade: { flex: 1.2 },
  tableCellValue: { flex: 1, textAlign: 'center' },
  tableCellActions: { flex: 1.2, alignItems: 'center' },
  tableCellText: { fontWeight: '600', color: TEXT },
  tableInput: { backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center', fontSize: 16, fontWeight: '700', color: TEXT },
  tableActionsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  smallCounterButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  smallCounterButtonAdd: { backgroundColor: GREEN },
  smallCounterText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  smallCounterTextAdd: { color: '#fff' },
  referentielManquant: { padding: 14, backgroundColor: '#fdf3e3', borderRadius: 10, marginTop: 8 },
  referentielManquantText: { fontSize: 12, lineHeight: 17, color: '#8a5a12', fontWeight: '600' },
  fieldsRow: { flexDirection: 'row', gap: 9, marginBottom: 4 },
  field: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, marginBottom: 8 },
  fieldError: { borderColor: '#c0412b', borderWidth: 1.5 },
  fieldLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 2 },
  requiredLabel: { color: '#c0412b' },
  fieldInput: { fontSize: 16, fontWeight: '700', color: TEXT, padding: 0 },
  errorText: { color: '#c0412b', fontSize: 11, marginTop: -2, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  toggleLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  toggleButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: INACTIVE_BG },
  toggleButtonActive: { backgroundColor: GREEN },
  toggleText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  toggleTextActive: { color: '#fff' },
  summaryContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: BORDER },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  summaryLabel: { fontSize: 13, color: TEXT_SECONDARY },
  summaryValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  summaryValueValid: { color: GREEN },
  summaryValueInvalid: { color: '#dc2626' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
