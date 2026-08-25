import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
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
import { TextInput } from 'react-native-gesture-handler';

import {
  parseEspeceSelection,
  buildGrilles,
  parseGrillesCompletees,
} from '@/lib/prospection-especes';

import {
  capturesMaxFor,
  grilleKeyToString,
  phasesFor,
} from '@/lib/prospection-especes-stades';

import { listStadesGrille } from '@/lib/referentiel-db';
import { retourArriere } from '@/lib/fiche-routing';

import {
  chronoSeconds,
  formatChrono,
} from '@/lib/prospection-review';

import {
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

const ESPECE_LABEL = {
  LMC: 'Locusta',
  NSE: 'Nomadacris',
} as const;

const CATEGORIE_LABEL = {
  imago: 'Imagos',
  larve: 'Larves',
} as const;

type Sexe = 'F' | 'M';

export default function CapturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId, grilleIndex } = useLocalSearchParams<{
    draftId: string;
    grilleIndex: string;
  }>();

  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);

  const store = useProspectionCaptureStore();
  const { grilleOrder, currentGrilleIndex, currentSexe, phasesData, stadesDataF, stadesDataM } = store;

  const [tick, setTick] = useState(0);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('captures');
  const [totalCapturesInput, setTotalCapturesInput] = useState('');
  /** Lecture du vocabulaire en base : distingue « pas encore chargé » de « absent ». */
  const [chargementStades, setChargementStades] = useState(true);
  
  // Ref pour éviter les boucles infinies
  const isInitialized = useRef(false);
  const isHydrated = useRef(false);
  // Ref pour ne réhydrater "totalCapturesInput" qu'au changement effectif de grille
  // (évite d'écraser la saisie en cours de l'utilisateur sur la grille courante)
  const syncedGrilleIndexRef = useRef<number | null>(null);

  // Le brouillon de *cette* fiche est-il en mémoire ? Tant qu'il ne l'est pas, on ne
  // peut rien conclure sur les grilles : afficher « aucune grille à saisir » à ce
  // moment-là accuse à tort l'agent de n'avoir rien sélectionné (#201).
  const brouillonPret = !!draft && draft.id === draftId;

  const requestedIndex = Number(grilleIndex ?? '0');
  const grille = grilleOrder[currentGrilleIndex];
  const isImago = grille?.categorie === 'imago';
  const isLarve = grille?.categorie === 'larve';

  const totalCaptures = Number.parseInt(totalCapturesInput, 10) || 0;

  const totalPhases = Object.values(phasesData).reduce(
    (sum, value) => sum + (Number(value) || 0), 0
  );

  const stadesGrille = grille
    ? (store.stadesParGrille[grilleKeyToString(grille)] ?? { F: [], M: [], larve: [] })
    : { F: [], M: [], larve: [] };

  const stadesFList = isImago ? stadesGrille.F : [];
  const stadesMList = isImago ? stadesGrille.M : [];
  const larvesList = isLarve ? stadesGrille.larve : [];
  const phasesList = grille ? phasesFor(grille.espece, grille.categorie) : [];

  const totalStadesF = stadesFList.reduce(
    (sum, stade) => sum + (Number(stadesDataF[stade]) || 0), 0
  );

  const totalStadesM = stadesMList.reduce(
    (sum, stade) => sum + (Number(stadesDataM[stade]) || 0), 0
  );

  const totalStadesImago = totalStadesF + totalStadesM;

  const totalStadesLarve = larvesList.reduce(
    (sum, stade) => sum + (Number(store.stadesData[stade]) || 0), 0
  );

  const totalStades = isImago ? totalStadesImago : totalStadesLarve;

  // Le nombre de captures est facultatif : une grille laissée vide (0) est cohérente
  // par défaut et ne doit pas bloquer la navigation (cf. extensive-imagos.tsx, même règle).
  const isPhasesConsistent = totalCaptures === 0 || totalPhases === totalCaptures;
  const isStadesConsistent = totalCaptures === 0 || totalStades === totalCaptures;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  // Effet 1: Hydratation initiale - une seule fois
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

  // Effet 2: vocabulaire des stades, puis initialisation des grilles. Les stades
  // viennent du référentiel synchronisé, jamais d'une liste écrite dans l'écran : c'est
  // le backend qui décide quels codes existent (#201).
  //
  // Cet effet ne s'abrège pas quand `grilleOrder` est déjà rempli : l'écran « espèces »
  // appelle `initGrilles` avant de naviguer ici, sans connaître le vocabulaire. Sauter
  // le chargement dans ce cas — le parcours normal — laissait des grilles sans aucun
  // stade, et l'agent croyait sa saisie perdue.
  useEffect(() => {
    if (!draft || draft.id !== draftId || isInitialized.current) return;
    isInitialized.current = true;

    const selection = parseEspeceSelection(draft.especes);
    const grilles = buildGrilles(selection);
    const completed = parseGrillesCompletees(draft.grilles_completees);

    const codesDe = async (
      espece: typeof grilles[number]['espece'],
      categorie: 'imago' | 'larve',
      sexe: 'F' | 'M' | null
    ): Promise<string[]> => {
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
      // Rejoué même si l'écran « espèces » l'a déjà fait : les compteurs par stade se
      // construisent à partir du vocabulaire, qui n'était pas connu à ce moment-là.
      store.initGrilles(grilles, completed, captures);

      // `initGrilles` se positionne sur la première grille non complétée, d'après le
      // brouillon en mémoire — lequel est en retard d'une grille au moment où l'on
      // enchaîne (la complétion vient d'être écrite en base). La route, elle, sait quelle
      // grille est demandée : c'est elle qui tranche, sinon on revient sans cesse sur la
      // première.
      if (requestedIndex >= 0 && requestedIndex < grilles.length) {
        store.goToGrille(requestedIndex, captures);
      }
    };

    setChargementStades(true);
    void chargerStades()
      .catch((error) => {
        isInitialized.current = false;
        signalerChargement(error, { draftId });
      })
      .finally(() => setChargementStades(false));
  }, [draft, draftId, captures, store, requestedIndex, signalerChargement]);

  // Effet 3: Navigation vers la grille demandée - une seule fois
  useEffect(() => {
    if (store.grilleOrder.length > 0 && requestedIndex !== store.currentGrilleIndex) {
      store.goToGrille(requestedIndex, captures);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedIndex, store.grilleOrder.length]);

  // Effet 3bis: Réhydratation du "nombre total de captures" au changement de grille.
  // Ce champ est un state local (non stocké dans le store zustand) : sans cet effet, un
  // retour en arrière (router.replace démonte/remonte l'écran) le remet à '', ce qui masque
  // les phases/stades déjà enregistrés (tout l'affichage est conditionné à totalCaptures > 0)
  // et donne l'impression que les données saisies ont été perdues alors qu'elles sont
  // toujours dans le store (reconstruites par goToGrille depuis les captures sauvegardées).
  useEffect(() => {
    if (syncedGrilleIndexRef.current === currentGrilleIndex) return;
    syncedGrilleIndexRef.current = currentGrilleIndex;
    const existingTotal = Object.values(phasesData).reduce((sum, value) => sum + (Number(value) || 0), 0);
    setTotalCapturesInput(existingTotal > 0 ? String(existingTotal) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGrilleIndex]);

  // Effet 4: Timer de capture - une seule fois
  useEffect(() => {
    if (!draftId || draft?.capture_started_at) return;
    void startCaptureTimer(draftId)
      .then(setDraft)
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, draft?.capture_started_at, setDraft, signalerChargement]);

  // Effet 5: Grille déjà remplie (fiche reprise) — le total est déduit des captures
  // enregistrées, sinon les sections « Phases » et « Stades » restent masquées (total = 0)
  // et la saisie précédente semble perdue (#201).
  // On ne peut pas déduire un total avant de savoir quels stades composent la grille :
  // tant que le vocabulaire n'est pas chargé, `totalStades` vaut 0 pour une grille
  // pourtant remplie. Attendre évite de figer ce 0 et de masquer la saisie.
  const vocabulairePret = stadesFList.length > 0 || larvesList.length > 0;
  const prefilledGrilleRef = useRef<number | null>(null);
  useEffect(() => {
    if (!grille || !vocabulairePret) return;
    if (prefilledGrilleRef.current === currentGrilleIndex) return;
    prefilledGrilleRef.current = currentGrilleIndex;
    setTotalCapturesInput(totalStades > 0 ? String(totalStades) : '');
  }, [grille, vocabulairePret, currentGrilleIndex, totalStades]);

  // Effet 6: Chronomètre
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTotalCapturesChange = (text: string) => {
    setTotalCapturesInput(text);
  };

  const handleSexeChange = (sexe: Sexe) => {
    if (sexe === currentSexe) return;
    store.setSexe(sexe);
  };

  const handleBack = () =>
    retourArriere(router, () => {
      if (currentGrilleIndex > 0) {
        router.replace({
          pathname: '/(prospection)/captures' as any,
          params: { draftId, grilleIndex: String(currentGrilleIndex - 1) },
        });
      } else {
        router.replace({
          pathname: '/(prospection)/species' as any,
          params: { draftId },
        });
      }
    });

  // Écran d'attente : le vocabulaire et le brouillon se lisent en base au montage.
  // Auparavant cet état rendait une page **entièrement vide**, sans même un retour :
  // l'agent croyait l'app figée et n'avait aucune issue.
  if (!grille) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Captures</Text>
          </View>
          <View style={styles.chargementBloc}>
            {chargementStades || !brouillonPret ? (
              <>
                <ActivityIndicator color={GREEN} />
                <Text style={styles.chargementTexte}>Chargement de la grille…</Text>
              </>
            ) : (
              // Chargement terminé sans grille : la sélection d'espèces est vide ou
              // illisible. Un indicateur qui tourne indéfiniment serait un mensonge.
              <Text style={styles.chargementTexte}>
                Aucune grille à saisir — revenez à l’écran précédent pour choisir les
                espèces observées.
              </Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const max = capturesMaxFor(grille.espece, grille.categorie);
  const isLastGrille = currentGrilleIndex === grilleOrder.length - 1;
  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const handleContinue = () => {
    // Le nombre de captures est facultatif : si la grille est laissée vide, on
    // passe directement à la sauvegarde (0 capture) sans bloquer la navigation
    // ni exiger de répartition phases/stades.
    if (totalCaptures > 0) {
      if (!isPhasesConsistent) {
        Alert.alert(
          'Incohérence des phases',
          `Captures : ${totalCaptures}\nPhases : ${totalPhases}\n\nLa somme des phases doit être exactement égale au nombre de captures.`
        );
        return;
      }

      if (isImago && !isStadesConsistent) {
        Alert.alert(
          'Incohérence des stades',
          `Captures : ${totalCaptures}\nStades femelles : ${totalStadesF}\nStades mâles : ${totalStadesM}\nTotal stades : ${totalStadesF} + ${totalStadesM} = ${totalStadesImago}\n\nLa règle est :\nCaptures = Phases = Stades ♀ + Stades ♂`
        );
        return;
      }

      if (isLarve && !isStadesConsistent) {
        Alert.alert(
          'Incohérence des stades larvaires',
          `Captures : ${totalCaptures}\nPhases : ${totalPhases}\nStades larvaires : ${totalStadesLarve}\n\nLa règle est :\nCaptures = Phases = Stades larvaires`
        );
        return;
      }

      if (!isConsistent) {
        Alert.alert('Incohérence', `Captures : ${totalCaptures}\nPhases : ${totalPhases}\nStades : ${totalStades}`);
        return;
      }
    }

    return run(
      async () => {
        const rows: any[] = [];

        if (totalCaptures === 0) {
          // Rien à répartir : la grille est enregistrée comme complétée sans capture.
        } else if (isImago) {
        // Récupérer les phases avec leurs effectifs
        const phasesWithCounts = phasesList
          .map(phase => ({ phase, count: Number(phasesData[phase]) || 0 }))
          .filter(p => p.count > 0);

        if (phasesWithCounts.length === 0) {
          Alert.alert('Erreur', 'Aucune phase n\'a été renseignée.');
          return;
        }

        const totalPhaseCount = phasesWithCounts.reduce((sum, p) => sum + p.count, 0);

        // Fonction pour créer les rows avec répartition des phases
        const createRowsForStade = (stade: string, count: number, sexe: 'F' | 'M') => {
          if (count === 0) return;
          
          let remaining = count;
          for (let i = 0; i < phasesWithCounts.length; i++) {
            const phase = phasesWithCounts[i];
            if (i === phasesWithCounts.length - 1) {
              if (remaining > 0) {
                rows.push({
                  espece: grille.espece,
                  categorie: grille.categorie,
                  sexe: sexe,
                  phase: phase.phase,
                  stade: stade,
                  effectif: remaining,
                });
              }
            } else {
              const proportion = phase.count / totalPhaseCount;
              const allocated = Math.round(count * proportion);
              if (allocated > 0) {
                rows.push({
                  espece: grille.espece,
                  categorie: grille.categorie,
                  sexe: sexe,
                  phase: phase.phase,
                  stade: stade,
                  effectif: allocated,
                });
                remaining -= allocated;
              }
            }
          }
        };

        // Stades femelles
        for (const stade of stadesFList) {
          const count = Number(stadesDataF[stade]) || 0;
          createRowsForStade(stade, count, 'F');
        }

        // Stades mâles
        for (const stade of stadesMList) {
          const count = Number(stadesDataM[stade]) || 0;
          createRowsForStade(stade, count, 'M');
        }
      } else {
        // Larves
        const phasesWithCounts = phasesList
          .map(phase => ({ phase, count: Number(phasesData[phase]) || 0 }))
          .filter(p => p.count > 0);

        if (phasesWithCounts.length === 0) {
          Alert.alert('Erreur', 'Aucune phase n\'a été renseignée.');
          return;
        }

        const totalPhaseCount = phasesWithCounts.reduce((sum, p) => sum + p.count, 0);

        for (const stade of larvesList) {
          const count = Number(store.stadesData[stade]) || 0;
          if (count === 0) continue;

          let remaining = count;
          for (let i = 0; i < phasesWithCounts.length; i++) {
            const phase = phasesWithCounts[i];
            if (i === phasesWithCounts.length - 1) {
              if (remaining > 0) {
                rows.push({
                  espece: grille.espece,
                  categorie: grille.categorie,
                  sexe: null,
                  phase: phase.phase,
                  stade: stade,
                  effectif: remaining,
                });
              }
            } else {
              const proportion = phase.count / totalPhaseCount;
              const allocated = Math.round(count * proportion);
              if (allocated > 0) {
                rows.push({
                  espece: grille.espece,
                  categorie: grille.categorie,
                  sexe: null,
                  phase: phase.phase,
                  stade: stade,
                  effectif: allocated,
                });
                remaining -= allocated;
              }
            }
          }
        }
      }

        if (totalCaptures > 0 && rows.length === 0) {
          // Garde-fou : ne devrait plus se produire (déjà couvert par les contrôles
          // « Aucune phase n'a été renseignée » ci-dessus), conservé par sécurité.
          Alert.alert('Aucune capture', 'Veuillez saisir au moins une capture avant de continuer.');
          return;
        }

        if (rows.length > 0) {
          await saveProspectionCaptures(draftId, grille.espece, grille.categorie, rows);
        }
        await markGrilleCompleted(draftId, grilleKeyToString(grille));
        store.markCurrentGrilleCompleted();
        await refreshCaptures();

        if (isLastGrille) {
          router.push({
            pathname: '/(prospection)/infestation' as any,
            params: { draftId },
          });
        } else {
          const nextGrille = grilleOrder[currentGrilleIndex + 1];
          const nextScreen = nextGrille.categorie === 'imago' ? 'density' : 'captures';
          router.push({
            pathname: `/(prospection)/${nextScreen}` as any,
            params: { draftId, grilleIndex: String(currentGrilleIndex + 1) },
          });
        }
      },
      {
        screen: 'captures',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, grille: grilleKeyToString(grille) },
      }
    );
  };

  const renderSexeToggle = () => {
    if (!isImago) return null;
    return (
      <>
        <View style={styles.sexeRow}>
          <TouchableOpacity
            style={[styles.sexeToggle, currentSexe === 'F' && styles.sexeToggleActive]}
            onPress={() => handleSexeChange('F')}>
            <Text style={[styles.sexeText, currentSexe === 'F' && styles.sexeTextActive]}>♀ Femelles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sexeToggle, currentSexe === 'M' && styles.sexeToggleActive]}
            onPress={() => handleSexeChange('M')}>
            <Text style={[styles.sexeText, currentSexe === 'M' && styles.sexeTextActive]}>♂ Mâles</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sexeHint}>
          {currentSexe === 'F'
            ? `♀ Stades : ${stadesFList.join(', ')}`
            : `♂ Stades : ${stadesMList.join(', ')}`}
        </Text>
      </>
    );
  };

  const renderTotalCaptures = () => {
    return (
      <View style={styles.totalCaptureSection}>
        <Text style={styles.sectionLabel}>📝 1. Nombre total de captures</Text>
        <View style={styles.totalCaptureInputContainer}>
          <TextInput
            value={totalCapturesInput}
            onChangeText={handleTotalCapturesChange}
            keyboardType="number-pad"
            style={styles.totalCaptureInput}
            placeholder="Saisir le nombre de captures"
            placeholderTextColor={TEXT_SECONDARY}
          />
          <Text style={styles.totalCaptureMax}>/ {max}</Text>
        </View>
        {totalCaptures > 0 && (
          <Text style={styles.totalCaptureInfo}>
            {totalCaptures} capture{totalCaptures > 1 ? 's' : ''} à répartir
          </Text>
        )}
      </View>
    );
  };

  const renderPhases = () => {
    if (phasesList.length === 0 || totalCaptures === 0) return null;
    const remaining = totalCaptures - totalPhases;
    return (
      <View style={[styles.tableSection, { marginTop: 0 }]}>
        <Text style={styles.sectionLabel}>📊 2. Phases</Text>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryBarText}>
            Somme des phases :{' '}
            <Text style={[styles.summaryBarValue, totalPhases === totalCaptures ? styles.validValue : styles.invalidValue]}>
              {totalPhases}
            </Text>
            {totalPhases !== totalCaptures && (
              <Text style={styles.summaryBarWarning}>
                {' '}({remaining > 0 ? `reste ${remaining}` : `dépasse de ${Math.abs(remaining)}`})
              </Text>
            )}
          </Text>
        </View>
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
                }}>
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => {
                  if (totalPhases < totalCaptures) {
                    store.incrementPhase(phase);
                  } else {
                    Alert.alert('Limite atteinte', `La somme des phases a déjà atteint ${totalCaptures}.`);
                  }
                }}>
                <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterText}>
            Total phases :{' '}
            <Text style={[styles.tableFooterValue, totalPhases !== totalCaptures && styles.tableFooterValueError]}>
              {totalPhases}
            </Text>
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Une grille sans stades signifie que le référentiel n'est pas synchronisé sur cet
   * appareil. Le dire plutôt que d'afficher un tableau vide : sinon l'agent conclut
   * que sa saisie a disparu (#201).
   */
  const renderReferentielManquant = () =>
    chargementStades ? (
      <View style={styles.chargementLigne}>
        <ActivityIndicator color={GREEN} size="small" />
        <Text style={styles.chargementTexte}>Chargement des stades…</Text>
      </View>
    ) : (
      <View style={styles.referentielManquant}>
        <Text style={styles.referentielManquantText}>
          Stades indisponibles hors ligne — synchronisez les référentiels depuis
          l’écran Synchronisation, puis rouvrez cette grille.
        </Text>
      </View>
    );

  const renderImagoStades = () => {
    if (!isImago || totalCaptures === 0) return null;
    const isFemale = currentSexe === 'F';
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
                  store.updateStadeBySex(currentSexe, stade, val);
                } else {
                  Alert.alert('Limite atteinte', `Le total des stades ${currentSexe === 'F' ? 'féminins' : 'masculins'} ne peut pas dépasser ${totalCaptures}.`);
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
                  if (current > 0) store.decrementStadeBySex(currentSexe, stade);
                }}>
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => {
                  if (currentTotal < totalCaptures) {
                    store.incrementStadeBySex(currentSexe, stade);
                  } else {
                    Alert.alert('Limite atteinte', `Le total des stades ${currentSexe === 'F' ? 'féminins' : 'masculins'} a déjà atteint ${totalCaptures}.`);
                  }
                }}>
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

  const renderLarveStades = () => {
    if (!isLarve || totalCaptures === 0) return null;
    const remaining = totalCaptures - totalStadesLarve;
    return (
      <View style={styles.tableSection}>
        <Text style={styles.sectionLabel}>📊 3. Stades larvaires</Text>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryBarText}>
            Somme des stades :{' '}
            <Text style={[styles.summaryBarValue, totalStadesLarve === totalCaptures ? styles.validValue : styles.invalidValue]}>
              {totalStadesLarve}
            </Text>
            {remaining !== 0 && (
              <Text style={styles.summaryBarWarning}>
                {' '}({remaining > 0 ? `reste ${remaining}` : `dépasse de ${Math.abs(remaining)}`})
              </Text>
            )}
          </Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.tableCellStade]}>Stade</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellValue]}>Effectif</Text>
          <Text style={[styles.tableHeaderCell, styles.tableCellActions]}>Actions</Text>
        </View>
        {larvesList.length === 0 && renderReferentielManquant()}
        {larvesList.map((stade) => (
          <View key={stade} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellStade, styles.tableCellText]}>{stade}</Text>
            <TextInput
              value={String(store.stadesData[stade] || 0)}
              onChangeText={(text) => {
                const val = Number.parseInt(text, 10) || 0;
                const current = store.stadesData[stade] || 0;
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
                  const current = store.stadesData[stade] || 0;
                  if (current > 0) store.decrementStade(stade);
                }}>
                <Text style={styles.smallCounterText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallCounterButton, styles.smallCounterButtonAdd]}
                onPress={() => {
                  if (totalStadesLarve < totalCaptures) {
                    store.incrementStade(stade);
                  } else {
                    Alert.alert('Limite atteinte', `Le total des stades larvaires a déjà atteint ${totalCaptures}.`);
                  }
                }}>
                <Text style={[styles.smallCounterText, styles.smallCounterTextAdd]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterText}>
            Total larves :{' '}
            <Text style={[styles.tableFooterValue, totalStadesLarve !== totalCaptures && styles.tableFooterValueError]}>
              {totalStadesLarve}
            </Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderSummary = () => {
    if (totalCaptures <= 0) return null;
    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>📋 Récapitulatif</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>1. Nombre de captures :</Text>
          <Text style={[styles.summaryValue, styles.summaryValueValid]}>{totalCaptures}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>2. Somme des phases :</Text>
          <Text style={[styles.summaryValue, isPhasesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
            {totalPhases}{isPhasesConsistent ? ' ✅' : ' ❌'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        {isImago ? (
          <>
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
            <View style={styles.ruleBox}>
              <Text style={styles.ruleText}>Règle : Captures = Phases = Stades ♀ + ♂</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>3. Stades larvaires :</Text>
              <Text style={[styles.summaryValue, isStadesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                {totalStadesLarve}{isStadesConsistent ? ' ✅' : ' ❌'}
              </Text>
            </View>
            <View style={styles.ruleBox}>
              <Text style={styles.ruleText}>Règle : Captures = Phases = Stades larvaires</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderValidationMessage = () => {
    if (totalCaptures <= 0) return null;
    if (isConsistent) {
      return (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>✅ COHÉRENT</Text>
          {isImago ? (
            <Text style={styles.successDetail}>
              {totalCaptures} captures = {totalPhases} phases = {totalStadesF} ♀ + {totalStadesM} ♂ = {totalStadesImago} stades
            </Text>
          ) : (
            <Text style={styles.successDetail}>
              {totalCaptures} captures = {totalPhases} phases = {totalStadesLarve} stades larvaires
            </Text>
          )}
        </View>
      );
    }
    return (
      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>⚠️ INCOHÉRENCE</Text>
        {isImago ? (
          <Text style={styles.warningDetail}>
            Captures : {totalCaptures}
            {'\n'}Phases : {totalPhases}
            {'\n'}Stades ♀ : {totalStadesF}
            {'\n'}Stades ♂ : {totalStadesM}
            {'\n'}Total stades : {totalStadesF} + {totalStadesM} = {totalStadesImago}
          </Text>
        ) : (
          <Text style={styles.warningDetail}>
            Captures : {totalCaptures}
            {'\n'}Phases : {totalPhases}
            {'\n'}Stades larvaires : {totalStadesLarve}
          </Text>
        )}
        <Text style={styles.warningHint}>
          {isImago
            ? 'La règle est : Captures = Phases = Stades ♀ + Stades ♂'
            : 'La règle est : Captures = Phases = Stades larvaires'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
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
            {renderTotalCaptures()}
            {renderPhases()}
            {renderSexeToggle()}
            {renderImagoStades()}
            {renderLarveStades()}
            {renderSummary()}
            {renderValidationMessage()}
          </ScrollView>
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            <TouchableOpacity
              style={[styles.continueButton, !isConsistent && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={isSaving || !isConsistent}
              activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>
                {isLastGrille ? 'Infestation  ›' : 'Grille suivante  ›'}
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
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  totalCaptureSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  totalCaptureInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCaptureInput: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },
  totalCaptureMax: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  totalCaptureInfo: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  chargementBloc: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  chargementLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  chargementTexte: { fontSize: 12.5, color: TEXT_SECONDARY, fontWeight: '600' },
  referentielManquant: { padding: 14, backgroundColor: '#fdf3e3', borderRadius: 10, marginTop: 8 },
  referentielManquantText: { fontSize: 12, lineHeight: 17, color: '#8a5a12', fontWeight: '600' },
  tableSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 10, marginBottom: 8 },
  summaryBar: { backgroundColor: '#f8f6f0', borderRadius: 6, padding: 8, marginBottom: 10, alignItems: 'center' },
  summaryBarText: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
  summaryBarSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 },
  summaryBarValue: { fontWeight: '700', fontSize: 15 },
  validValue: { color: GREEN },
  invalidValue: { color: '#dc2626' },
  summaryBarWarning: { color: '#dc2626', fontSize: 12 },
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
  tableFooterValueError: { color: '#dc2626' },
  smallCounterButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  smallCounterButtonAdd: { backgroundColor: GREEN },
  smallCounterText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  smallCounterTextAdd: { color: '#fff' },
  summaryContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: BORDER },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  summaryDivider: { height: 1, backgroundColor: '#f0eee8', marginVertical: 4 },
  summaryLabel: { fontSize: 13, color: TEXT_SECONDARY },
  summaryValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  summaryValueValid: { color: GREEN },
  summaryValueInvalid: { color: '#dc2626' },
  ruleBox: { marginTop: 10, backgroundColor: '#f8f6f0', borderRadius: 7, padding: 8 },
  ruleText: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', fontWeight: '600' },
  warningContainer: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#fca5a5' },
  warningText: { color: '#dc2626', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  warningDetail: { color: '#dc2626', fontSize: 12, textAlign: 'center', marginTop: 5, lineHeight: 18 },
  warningHint: { color: '#dc2626', fontSize: 11, textAlign: 'center', marginTop: 5, fontStyle: 'italic' },
  successContainer: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#86efac' },
  successText: { color: '#15803d', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  successDetail: { color: '#15803d', fontSize: 12, textAlign: 'center', marginTop: 3, lineHeight: 18 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 14, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
