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

import { Espece, accouplementOptionsFor, capturesMaxFor, grilleKeyToString, phasesFor } from '@/lib/prospection-especes-stades';
import { parseEspeceSelection, buildGrilles, parseGrillesCompletees } from '@/lib/prospection-especes';
import { parseDensite, parseSelectionMultiple, TYPE_CIBLE_IMAGO_OPTIONS, TypeCibleImago, EtatImago } from '@/lib/prospection-extensive';
import { COMPASS_DIRECTIONS, oppositeDirection } from '@/lib/prospection-infestation-insights';
import { listStadesGrille } from '@/lib/referentiel-db';
import { retourArriere } from '@/lib/fiche-routing';
import {
  PopulationRow,
  getProspectionPopulation,
  saveProspectionPopulation,
  markGrilleCompleted,
  saveProspectionCaptures,
  startCaptureTimer,
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

type Sexe = 'F' | 'M';

function emptyImagoPopulation(espece: Espece): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
    interdistance: null,
    type_cible: null,
    direction_de: null,
    direction_vers: null,
    etat: null,
    essaim_en_vol: null,
    essaim_pose: null,
  };
}

function parseTypeCible(raw: string | null | undefined): TypeCibleImago[] {
  return parseSelectionMultiple(raw) as TypeCibleImago[];
}

/**
 * B-Imagos : fusionne density.tsx + accouplement.tsx + captures.tsx (fiche
 * intensive, grilles imago) en un seul écran, LMC et NSE présentés par onglet
 * d'espèce — même modèle que extensive-imagos.tsx, mais en conservant les
 * mécanismes propres à l'Intensif : table de captures par (espèce, stade,
 * phase, sexe) (`prospection_capture`, pas les compteurs scalaires de
 * l'Extensif), vocabulaire des stades lu dans le référentiel synchronisé
 * (`listStadesGrille`), et le chronomètre des 30 minutes réglementaires.
 */
export default function IntensiveImagosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);

  const store = useProspectionCaptureStore();
  const { grilleOrder, currentGrilleIndex, currentSexe, phasesData, stadesDataF, stadesDataM } = store;

  const [chargementStades, setChargementStades] = useState(true);
  const [populations, setPopulations] = useState<Partial<Record<Espece, PopulationRow>>>({});
  const [populationsLoaded, setPopulationsLoaded] = useState(false);
  const [totalCapturesInput, setTotalCapturesInput] = useState('');
  const [showDensiteDiffuseError, setShowDensiteDiffuseError] = useState(false);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('intensive-imagos');

  const isInitialized = useRef(false);
  const isHydrated = useRef(false);
  const syncedGrilleIndexRef = useRef<number | null>(null);
  const prefilledGrilleRef = useRef<number | null>(null);

  const brouillonPret = !!draft && draft.id === draftId;

  // Effet 1 : hydratation du brouillon si l'app a été relancée directement ici.
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

  // Effet 2 : vocabulaire des stades (référentiel synchronisé) + grilles.
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

      const firstImagoIndex = grilles.findIndex((g) => g.categorie === 'imago');
      if (firstImagoIndex >= 0) {
        store.goToGrille(firstImagoIndex, captures);
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

  // Effet 3 : chargement des lignes population déjà enregistrées (LMC + NSE imago).
  useEffect(() => {
    if (!draftId) return;
    void Promise.all([
      getProspectionPopulation(draftId, 'LMC', 'imago'),
      getProspectionPopulation(draftId, 'NSE', 'imago'),
    ])
      .then(([lmc, nse]) => {
        setPopulations({
          LMC: lmc ?? emptyImagoPopulation('LMC'),
          NSE: nse ?? emptyImagoPopulation('NSE'),
        });
      })
      .catch((error) => signalerChargement(error, { draftId }))
      .finally(() => setPopulationsLoaded(true));
  }, [draftId, signalerChargement]);

  // Effet 4 : chronomètre de capture (démarré une seule fois pour toute la fiche).
  useEffect(() => {
    if (!draftId || draft?.capture_started_at) return;
    void startCaptureTimer(draftId)
      .then(setDraft)
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, draft?.capture_started_at, setDraft, signalerChargement]);

  const grille = grilleOrder[currentGrilleIndex];
  const stadesGrille = grille ? (store.stadesParGrille[grilleKeyToString(grille)] ?? { F: [], M: [], larve: [] }) : { F: [], M: [], larve: [] };
  const stadesFList = stadesGrille.F;
  const stadesMList = stadesGrille.M;
  const phasesList = grille ? phasesFor(grille.espece, grille.categorie) : [];

  const totalStadesF = stadesFList.reduce((sum, stade) => sum + (Number(stadesDataF[stade]) || 0), 0);
  const totalStadesM = stadesMList.reduce((sum, stade) => sum + (Number(stadesDataM[stade]) || 0), 0);
  const totalStadesImago = totalStadesF + totalStadesM;
  const totalPhases = Object.values(phasesData).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalCaptures = Number.parseInt(totalCapturesInput, 10) || 0;

  const isPhasesConsistent = totalCaptures === 0 || totalPhases === totalCaptures;
  const isStadesConsistent = totalCaptures === 0 || totalStadesImago === totalCaptures;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  const vocabulairePret = stadesFList.length > 0 || stadesMList.length > 0;

  // Réhydrate "nombre total de captures" au changement d'onglet/grille — sinon le
  // champ reste à '' et masque phases/stades déjà enregistrés (même garde que
  // captures.tsx, cf. commentaire historique de cet écran).
  useEffect(() => {
    if (!grille || !vocabulairePret) return;
    if (syncedGrilleIndexRef.current === currentGrilleIndex) return;
    syncedGrilleIndexRef.current = currentGrilleIndex;
    prefilledGrilleRef.current = currentGrilleIndex;
    const existingTotal = totalStadesF + totalStadesM;
    setTotalCapturesInput(existingTotal > 0 ? String(existingTotal) : '');
    setShowDensiteDiffuseError(false);
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
            <Text style={styles.title}>Imagos</Text>
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
  const population = populations[species] ?? emptyImagoPopulation(species);
  const typeCible = parseTypeCible(population.type_cible);

  const setPopulationField = <K extends keyof PopulationRow>(field: K, value: PopulationRow[K]) => {
    setPopulations((prev) => ({
      ...prev,
      [species]: { ...(prev[species] ?? emptyImagoPopulation(species)), [field]: value },
    }));
  };

  const setTypeCibleValue = (values: TypeCibleImago[]) => {
    setPopulationField('type_cible', JSON.stringify(values));
  };

  const patchPopulation = (patch: Partial<PopulationRow>) => {
    setPopulations((prev) => ({
      ...prev,
      [species]: { ...(prev[species] ?? emptyImagoPopulation(species)), ...patch },
    }));
  };

  /** Même logique que handleEtatChange dans extensive-imagos.tsx (et
   * infestation.tsx, règle #4) : le Comportement de l'essaim est entièrement
   * dérivé de l'État, jamais choisi indépendamment — appuyer à nouveau sur
   * l'État actif le désélectionne (et efface la direction, qui n'a de sens
   * qu'en Déplacement). */
  const handleEtatChange = (value: EtatImago) => {
    const nextEtat = population.etat === value ? null : value;
    patchPopulation(
      nextEtat === 'repos'
        ? { etat: 'repos', essaim_en_vol: false, essaim_pose: true, direction_de: null, direction_vers: null }
        : nextEtat === 'deplacement'
          ? { etat: 'deplacement', essaim_en_vol: true, essaim_pose: false }
          : { etat: null, essaim_en_vol: null, essaim_pose: null, direction_de: null, direction_vers: null }
    );
  };

  const imagoIndices = grilleOrder
    .map((g, index) => ({ g, index }))
    .filter(({ g }) => g.categorie === 'imago');
  const hasLarveGrilles = grilleOrder.some((g) => g.categorie === 'larve');
  const isLastImagoTab = imagoIndices[imagoIndices.length - 1]?.index === currentGrilleIndex;

  /** Valide et persiste la grille (espèce imago) actuellement affichée — captures
   * (table `prospection_capture`) + ligne population (densités, accouplement,
   * ponte, interdistance, type de cible). Retourne false sans rien enregistrer si
   * une règle bloquante échoue (mêmes règles qu'auparavant réparties entre
   * density.tsx/captures.tsx). */
  const commitCurrentGrille = async (): Promise<boolean> => {
    if (population.densite_diffuse == null) {
      setShowDensiteDiffuseError(true);
      Alert.alert('Densité diffuse requise', 'Veuillez renseigner la densité diffuse (ind./ha).');
      return false;
    }
    // Densité groupée : redevenue facultative (demande explicite) — plus de
    // blocage ici, cf. backend prospection_schemas.py (#densite-groupee-obligatoire).

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
          'Incohérence des stades',
          `Captures : ${totalCaptures}\nStades femelles : ${totalStadesF}\nStades mâles : ${totalStadesM}\nTotal stades : ${totalStadesF} + ${totalStadesM} = ${totalStadesImago}\n\nLa règle est :\nCaptures = Phases = Stades ♀ + Stades ♂`
        );
        return false;
      }
    }

    await saveProspectionPopulation(draftId, population);

    const rows: { espece: Espece; categorie: 'imago'; sexe: Sexe; phase: string; stade: string; effectif: number }[] = [];
    if (totalCaptures > 0) {
      const phasesWithCounts = phasesList.map((phase) => ({ phase, count: Number(phasesData[phase]) || 0 })).filter((p) => p.count > 0);
      if (phasesWithCounts.length === 0) {
        Alert.alert('Erreur', "Aucune phase n'a été renseignée.");
        return false;
      }
      const totalPhaseCount = phasesWithCounts.reduce((sum, p) => sum + p.count, 0);

      const createRowsForStade = (stade: string, count: number, sexe: Sexe) => {
        if (count === 0) return;
        let remaining = count;
        for (let i = 0; i < phasesWithCounts.length; i++) {
          const phase = phasesWithCounts[i];
          if (i === phasesWithCounts.length - 1) {
            if (remaining > 0) rows.push({ espece: grille.espece, categorie: 'imago', sexe, phase: phase.phase, stade, effectif: remaining });
          } else {
            const proportion = phase.count / totalPhaseCount;
            const allocated = Math.round(count * proportion);
            if (allocated > 0) {
              rows.push({ espece: grille.espece, categorie: 'imago', sexe, phase: phase.phase, stade, effectif: allocated });
              remaining -= allocated;
            }
          }
        }
      };

      for (const stade of stadesFList) createRowsForStade(stade, Number(stadesDataF[stade]) || 0, 'F');
      for (const stade of stadesMList) createRowsForStade(stade, Number(stadesDataM[stade]) || 0, 'M');

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
    const target = imagoIndices.find(({ g }) => g.espece === targetEspece);
    if (!target) return;
    void run(
      async () => {
        const ok = await commitCurrentGrille();
        if (!ok) return;
        store.goToGrille(target.index, captures);
      },
      {
        screen: 'intensive-imagos',
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
        const next = hasLarveGrilles ? '/(prospection)/intensive-larves' : '/(prospection)/veg';
        router.push({ pathname: next as any, params: { draftId } });
      },
      {
        screen: 'intensive-imagos',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, espece: species },
      }
    );

  const renderReferentielManquant = () => (
    <View style={styles.referentielManquant}>
      <Text style={styles.referentielManquantText}>
        Stades indisponibles hors ligne — synchronisez les référentiels depuis l’écran Synchronisation, puis rouvrez cette grille.
      </Text>
    </View>
  );

  const renderStadesTable = (isFemale: boolean) => {
    const stadesList = isFemale ? stadesFList : stadesMList;
    const data = isFemale ? stadesDataF : stadesDataM;
    const currentTotal = isFemale ? totalStadesF : totalStadesM;
    return (
      <View style={styles.tableSection}>
        <Text style={styles.sectionLabel}>📊 3. Stades {isFemale ? '♀ Femelles' : '♂ Mâles'}</Text>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryBarText}>
            Total {isFemale ? '♀' : '♂'} : <Text style={styles.summaryBarValue}>{currentTotal}</Text>
          </Text>
          <Text style={styles.summaryBarSub}>
            Total stades : {totalStadesF} + {totalStadesM} = {totalStadesImago} / {totalCaptures}
          </Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Stade</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
        </View>
        {stadesList.length === 0 && renderReferentielManquant()}
        {stadesList.map((stade) => (
          <View key={stade} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>{stade}</Text>
            <TextInput
              value={String(data[stade] || 0)}
              onChangeText={(text) => {
                const val = Number.parseInt(text, 10) || 0;
                const current = data[stade] || 0;
                const newTotal = currentTotal - current + val;
                if (newTotal <= totalCaptures) {
                  store.updateStadeBySex(isFemale ? 'F' : 'M', stade, val);
                } else {
                  Alert.alert('Limite atteinte', `Le total des stades ${isFemale ? 'féminins' : 'masculins'} ne peut pas dépasser ${totalCaptures}.`);
                }
              }}
              keyboardType="number-pad"
              style={[styles.tableCell, styles.tableCellValue, styles.tableInput]}
            />
            <View style={[styles.tableCell, styles.tableCellActions, styles.tableActionsRow]}>
              <TouchableOpacity
                style={styles.smallCounterButton}
                onPress={() => {
                  const current = data[stade] || 0;
                  if (current > 0) store.decrementStadeBySex(isFemale ? 'F' : 'M', stade);
                }}
              >
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => {
                  if (currentTotal < totalCaptures) {
                    store.incrementStadeBySex(isFemale ? 'F' : 'M', stade);
                  } else {
                    Alert.alert('Limite atteinte', `Le total des stades ${isFemale ? 'féminins' : 'masculins'} a déjà atteint ${totalCaptures}.`);
                  }
                }}
              >
                <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterText}>
            Total {isFemale ? '♀' : '♂'} : <Text style={styles.tableFooterValue}>{currentTotal}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const max = capturesMaxFor(species, 'imago');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Imagos</Text>
          </View>

          {imagoIndices.length > 1 && (
            <View style={styles.speciesRow}>
              {imagoIndices.map(({ g }) => {
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
              <>
                <View style={styles.sexeRow}>
                  <TouchableOpacity
                    style={[styles.sexeToggle, currentSexe === 'F' && styles.sexeToggleActive]}
                    onPress={() => store.setSexe('F')}
                  >
                    <Text style={[styles.sexeText, currentSexe === 'F' && styles.sexeTextActive]}>♀ Femelles</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sexeToggle, currentSexe === 'M' && styles.sexeToggleActive]}
                    onPress={() => store.setSexe('M')}
                  >
                    <Text style={[styles.sexeText, currentSexe === 'M' && styles.sexeTextActive]}>♂ Mâles</Text>
                  </TouchableOpacity>
                </View>
                {renderStadesTable(currentSexe === 'F')}
              </>
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
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Densité groupée (ind./m²)</Text>
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

            <Text style={styles.sectionLabel}>Accouplement</Text>
            <View style={styles.chipsRow}>
              {accouplementOptionsFor(species).map((option) => {
                const active = option === population.accouplement;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setPopulationField('accouplement', active ? null : option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Ponte</Text>
            <View style={styles.chipsRow}>
              {accouplementOptionsFor(species).map((option) => {
                const active = option === population.ponte;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setPopulationField('ponte', active ? null : option)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
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

            <Text style={styles.sectionLabel}>Type de cible</Text>
            <View style={styles.chipsRow}>
              {TYPE_CIBLE_IMAGO_OPTIONS.map((option) => {
                const active = typeCible.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setTypeCibleValue(active ? typeCible.filter((v) => v !== option.value) : [...typeCible, option.value])}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Direction du déplacement : n'a de sens qu'en État = Déplacement, comme
                côté Extensif (extensive-imagos.tsx) et Infestation intensive — masquée
                (et effacée par handleEtatChange) tant que l'État n'est pas "Déplacement". */}
            {population.etat === 'deplacement' && (
              <>
                <Text style={styles.sectionLabel}>Direction du déplacement</Text>
                <View style={styles.chipsRow}>
                  {COMPASS_DIRECTIONS.map((dir) => {
                    const active = dir.label === population.direction_de;
                    return (
                      <TouchableOpacity
                        key={dir.label}
                        onPress={() =>
                          active
                            ? patchPopulation({ direction_de: null, direction_vers: null })
                            : patchPopulation({ direction_de: dir.label, direction_vers: oppositeDirection(dir.label) })
                        }
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{dir.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>État</Text>
            <View style={styles.chipsRow}>
              {(['repos', 'deplacement'] as EtatImago[]).map((value) => {
                const active = population.etat === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => handleEtatChange(value)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {value === 'repos' ? 'Repos' : 'Déplacement'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Comportement de l&apos;essaim</Text>
            <View style={styles.chipsRow}>
              {(['vol', 'pose'] as const).map((value) => {
                const active = value === 'vol' ? !!population.essaim_en_vol : !!population.essaim_pose;
                return (
                  <View key={value} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {value === 'vol' ? 'En vol' : 'Posé'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>📋 Récapitulatif — {ESPECE_LABEL[species]}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>1. Nombre de captures :</Text>
                <Text style={[styles.summaryValue, styles.summaryValueValid]}>{totalCaptures}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>2. Phases :</Text>
                <Text style={[styles.summaryValue, isPhasesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                  {totalPhases}{isPhasesConsistent ? ' ✅' : ' ❌'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>3a. Stades ♀ :</Text>
                <Text style={styles.summaryValue}>{totalStadesF}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>3b. Stades ♂ :</Text>
                <Text style={styles.summaryValue}>{totalStadesM}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total stades :</Text>
                <Text style={[styles.summaryValue, isStadesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                  {totalStadesF} + {totalStadesM} = {totalStadesImago}{isStadesConsistent ? ' ✅' : ' ❌'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Densité diffuse :</Text>
                <Text style={styles.summaryValue}>
                  {population.densite_diffuse != null ? population.densite_diffuse : '—'} ind./ha
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Densité groupée :</Text>
                <Text style={styles.summaryValue}>
                  {population.densite_groupee != null ? population.densite_groupee : '—'} ind./m²
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Accouplement :</Text>
                <Text style={styles.summaryValue}>{population.accouplement ?? '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ponte :</Text>
                <Text style={styles.summaryValue}>{population.ponte ?? '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Interdistance :</Text>
                <Text style={styles.summaryValue}>{population.interdistance != null ? population.interdistance : '—'} m</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type de cible :</Text>
                <Text style={styles.summaryValue}>
                  {typeCible.length > 0
                    ? typeCible.map((v) => TYPE_CIBLE_IMAGO_OPTIONS.find((o) => o.value === v)?.label).join(', ')
                    : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>État :</Text>
                <Text style={styles.summaryValue}>
                  {population.etat === 'repos' ? 'Repos' : population.etat === 'deplacement' ? 'Déplacement' : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Comportement de l&apos;essaim :</Text>
                <Text style={styles.summaryValue}>
                  {population.essaim_en_vol ? 'En vol' : population.essaim_pose ? 'Posé' : '—'}
                </Text>
              </View>
              {population.etat === 'deplacement' && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Direction :</Text>
                  <Text style={styles.summaryValue}>
                    {population.direction_de ? `${population.direction_de} → ${population.direction_vers}` : '—'}
                  </Text>
                </View>
              )}
              <View style={styles.ruleBox}>
                <Text style={styles.ruleText}>Règle bloquante : Captures = Phases</Text>
                <Text style={[styles.ruleText, { marginTop: 4, color: TEXT_SECONDARY, fontSize: 10 }]}>
                  {totalCaptures === 0
                    ? '✅ 0 capture : cohérent par défaut'
                    : 'Stades ♀ + ♂ : aide à la saisie, informatif.'}
                </Text>
              </View>
            </View>

            {isConsistent ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✅ COHÉRENT</Text>
                <Text style={styles.successDetail}>
                  {totalCaptures === 0
                    ? 'Aucune capture enregistrée'
                    : `${totalCaptures} captures = ${totalPhases} phases = ${totalStadesF} ♀ + ${totalStadesM} ♂ = ${totalStadesImago} stades`}
                </Text>
              </View>
            ) : (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>⚠️ INCOHÉRENCE</Text>
                <Text style={styles.warningDetail}>
                  Captures : {totalCaptures}
                  {'\n'}Phases : {totalPhases}
                  {'\n'}Stades ♀ : {totalStadesF}
                  {'\n'}Stades ♂ : {totalStadesM}
                  {'\n'}Total stades : {totalStadesF} + {totalStadesM} = {totalStadesImago}
                </Text>
                <Text style={styles.warningHint}>La règle est : Captures = Phases = Stades ♀ + Stades ♂</Text>
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
              <Text style={styles.continueButtonText}>
                {isLastImagoTab ? (hasLarveGrilles ? 'Larves  ›' : 'Végétation & Sol  ›') : 'Suivant  ›'}
              </Text>
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
  statLabelPrimary: { color: '#ffffffcc', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValuePrimary: { color: '#fff', fontWeight: '700', fontSize: 19 },
  statValueMax: { fontSize: 12, color: '#ffffffb3' },
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
  summaryBarSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 },
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
  tableFooter: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: BORDER, alignItems: 'center' },
  tableFooterText: { fontSize: 12, color: TEXT_SECONDARY },
  tableFooterValue: { fontWeight: '700', color: GREEN, fontSize: 14 },
  smallCounterButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  smallCounterButtonAdd: { backgroundColor: GREEN },
  smallCounterText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  smallCounterTextAdd: { color: '#fff' },
  referentielManquant: { padding: 14, backgroundColor: '#fdf3e3', borderRadius: 10, marginTop: 8 },
  referentielManquantText: { fontSize: 12, lineHeight: 17, color: '#8a5a12', fontWeight: '600' },
  sexeRow: { flexDirection: 'row', gap: 7, backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 4, marginBottom: 11 },
  sexeToggle: { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  sexeToggleActive: { backgroundColor: '#fff' },
  sexeText: { fontWeight: '700', fontSize: 13, color: '#9a9484' },
  sexeTextActive: { color: TEXT },
  fieldsRow: { flexDirection: 'row', gap: 9, marginBottom: 4 },
  field: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, marginBottom: 8 },
  fieldError: { borderColor: '#c0412b', borderWidth: 1.5 },
  // #lisibilite-terrain : libellé agrandi et assombri (au lieu de 9.5px gris clair,
  // difficile à lire en plein soleil) — même niveau de lisibilité que sectionLabel.
  fieldLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 3 },
  requiredLabel: { color: '#c0412b' },
  fieldInput: { fontSize: 18, fontWeight: '700', color: TEXT, padding: 0 },
  errorText: { color: '#c0412b', fontSize: 11, marginTop: -2, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  summaryContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: BORDER },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  summaryLabel: { fontSize: 13, color: TEXT_SECONDARY },
  summaryValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  summaryValueValid: { color: GREEN },
  summaryValueInvalid: { color: '#dc2626' },
  summaryDivider: { height: 1, backgroundColor: '#f0eee8', marginVertical: 4 },
  ruleBox: { marginTop: 10, backgroundColor: '#f8f6f0', borderRadius: 7, padding: 8 },
  ruleText: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', fontWeight: '600' },
  successContainer: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#86efac' },
  successText: { color: '#15803d', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  successDetail: { color: '#15803d', fontSize: 12, textAlign: 'center', marginTop: 3, lineHeight: 18 },
  warningContainer: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#fca5a5' },
  warningText: { color: '#dc2626', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  warningDetail: { color: '#dc2626', fontSize: 12, textAlign: 'center', marginTop: 5, lineHeight: 18 },
  warningHint: { color: '#dc2626', fontSize: 11, textAlign: 'center', marginTop: 5, fontStyle: 'italic' },
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
