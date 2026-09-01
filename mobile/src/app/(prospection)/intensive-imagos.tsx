import { useEffect, useState } from 'react';
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

import {
  Espece,
  Sexe,
  capturesMaxFor,
  phasesFor,
  accouplementOptionsFor,
  repartirStadeSurPhases,
} from '@/lib/prospection-especes-stades';
import { phasesFromCaptures, stadesDepuisCaptures } from '@/lib/prospection-capture-store';
import { listStadesGrille } from '@/lib/referentiel-db';
import { parseEspeceSelection } from '@/lib/prospection-especes';
import {
  CaptureRow,
  InfestationRow,
  getProspectionInfestation,
  getProspectionPopulation,
  listProspectionCaptures,
  markGrilleCompleted,
  saveProspectionCaptures,
  saveProspectionInfestation,
  saveProspectionPopulation,
  startCaptureTimer,
} from '@/lib/prospection-repository';
import { TYPE_CIBLE_IMAGO_OPTIONS, TypeCibleImago, parseDensite } from '@/lib/prospection-extensive';
import { chronoSeconds, formatChrono } from '@/lib/prospection-review';
import { retourArriere } from '@/lib/fiche-routing';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';
const COMMON_BG = '#f3ede0';

const ESPECE_LABEL: Record<Espece, string> = { LMC: 'Locusta (LMC)', NSE: 'Nomadacris (NSE)' };

type Methode = 'visuel' | 'comptage_direct';

interface ImagoSpeciesState {
  totalCaptures: string;
  phasesData: Record<string, number>;
  stadesDataF: Record<string, number>;
  stadesDataM: Record<string, number>;
  currentSexe: Sexe;
  densiteDiffuse: string;
  densiteGroupee: string;
  methode: Methode | null;
  accouplement: string | null;
  ponte: string | null;
}

function emptyImagoSpeciesState(): ImagoSpeciesState {
  return {
    totalCaptures: '',
    phasesData: {},
    stadesDataF: {},
    stadesDataM: {},
    currentSexe: 'F',
    densiteDiffuse: '',
    densiteGroupee: '',
    methode: null,
    accouplement: null,
    ponte: null,
  };
}

interface SharedImagoInfestation {
  typeCible: TypeCibleImago | null;
  etat: 'repos' | 'deplacement' | null;
  comportementEssaim: 'vol' | 'pose' | null;
  interdistanceMoy: string;
}

function emptySharedImagoInfestation(): SharedImagoInfestation {
  return { typeCible: null, etat: null, comportementEssaim: null, interdistanceMoy: '' };
}

interface StadeVocab {
  F: string[];
  M: string[];
}

function emptyStadeVocab(): StadeVocab {
  return { F: [], M: [] };
}

/**
 * Un des 3 types de cible aériens (vol_clair/dense/tres_dense) est-il déjà présent en
 * base pour cette fiche ? Recherche la première ligne `prospection_infestation`
 * correspondante — mêmes 3 valeurs qu'`infestation.tsx` (INCOMPATIBLE_GROUPS.imago).
 */
async function chargerSousEnsembleImago(draftId: string): Promise<{
  typeCible: TypeCibleImago;
  row: InfestationRow;
} | null> {
  for (const option of TYPE_CIBLE_IMAGO_OPTIONS) {
    const row = await getProspectionInfestation(draftId, option.value);
    if (row) return { typeCible: option.value, row };
  }
  return null;
}

function sharedFromInfestationRow(typeCible: TypeCibleImago, row: InfestationRow): SharedImagoInfestation {
  return {
    typeCible,
    etat: (row.comportement as 'repos' | 'deplacement' | null) ?? null,
    comportementEssaim: row.essaim_en_vol ? 'vol' : row.essaim_pose ? 'pose' : null,
    interdistanceMoy: row.interdistance_moy != null ? String(row.interdistance_moy) : '',
  };
}

/**
 * Fusionne le sous-ensemble Imagos (type de cible/état/comportement/interdistance)
 * dans la ligne `prospection_infestation` existante — `saveProspectionInfestation`
 * réécrit TOUTES les colonnes, donc préserver le reste (densités min/max/moy, front,
 * classification aérienne...) que seul `infestation.tsx` renseigne est indispensable,
 * sous peine de l'effacer silencieusement (cf. plan, décision 2).
 */
function mergerLigneInfestationImago(
  existante: InfestationRow | null,
  typeCible: TypeCibleImago,
  etat: 'repos' | 'deplacement' | null,
  interdistanceMoy: string
): InfestationRow {
  const base: InfestationRow = existante ?? {
    espece: null,
    type_cible: typeCible,
    taille_min: null,
    taille_max: null,
    taille_moy: null,
    surface_totale: null,
    densite_min: null,
    densite_max: null,
    densite_moy: null,
    interdistance: null,
    comportement: null,
    direction_de: null,
    direction_vers: null,
    vent_de: null,
    vent_vitesse: null,
    pullulation_nb: null,
    taille_long: null,
    taille_large: null,
    taille_epaisseur: null,
    essaim_en_vol: null,
    essaim_pose: null,
    type_essaim: null,
    nb_taches_bandes: null,
    interdistance_m: null,
    interdistance_min: null,
    interdistance_max: null,
    interdistance_moy: null,
    surface_contaminee_ha: null,
    type_larve: null,
    surface_infestee_pourcent: null,
    stade_dominant: null,
    taille_groupe_m2: null,
    front_longueur_m: null,
    front_largeur_m: null,
    densite_max_front: null,
    densite_moy_arriere_front: null,
    heure_observation: null,
    densite_en_vol: null,
    dimension_ha: null,
  };
  return {
    ...base,
    type_cible: typeCible,
    comportement: etat,
    essaim_en_vol: etat === 'deplacement' ? 1 : etat === 'repos' ? 0 : null,
    essaim_pose: etat === 'repos' ? 1 : etat === 'deplacement' ? 0 : null,
    interdistance_moy: interdistanceMoy === '' ? null : parseDensite(interdistanceMoy),
  };
}

export default function IntensiveImagosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('intensive-imagos');

  const [pret, setPret] = useState(false);
  const [tick, setTick] = useState(0);
  const [speciesChoisie, setSpecies] = useState<Espece>('LMC');
  const [data, setData] = useState<Record<Espece, ImagoSpeciesState>>({
    LMC: emptyImagoSpeciesState(),
    NSE: emptyImagoSpeciesState(),
  });
  const [vocab, setVocab] = useState<Record<Espece, StadeVocab>>({ LMC: emptyStadeVocab(), NSE: emptyStadeVocab() });
  const [shared, setShared] = useState<SharedImagoInfestation>(emptySharedImagoInfestation());
  const [existingInfestationRow, setExistingInfestationRow] = useState<InfestationRow | null>(null);

  const especeSelection = draft?.especes ? parseEspeceSelection(draft.especes) : null;
  const hasLmc = especeSelection?.lmcImago ?? false;
  const hasNse = especeSelection?.nseImago ?? false;
  const hasLarves = (especeSelection?.lmcLarve ?? false) || (especeSelection?.nseLarve ?? false);
  const especesDisponibles: Espece[] = [...(hasLmc ? (['LMC'] as const) : []), ...(hasNse ? (['NSE'] as const) : [])];
  // Dérivé plutôt que synchronisé par effet (évite un setState en cascade au montage) :
  // si l'espèce choisie n'est plus disponible (LMC non sélectionné p. ex.), on retombe
  // sur la première espèce réellement sélectionnée.
  const species: Espece = especesDisponibles.includes(speciesChoisie) ? speciesChoisie : (especesDisponibles[0] ?? speciesChoisie);

  // Hydratation du brouillon si l'app a été relancée directement sur cet écran.
  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

  // Chrono de capture — démarré une seule fois par fiche (comme captures.tsx).
  useEffect(() => {
    if (!draftId || draft?.capture_started_at) return;
    void startCaptureTimer(draftId).then(setDraft).catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, draft?.capture_started_at, setDraft, signalerChargement]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Chargement complet : vocabulaire référentiel, captures déjà saisies, densités,
  // sous-ensemble infestation partagé. Une seule fois par fiche.
  useEffect(() => {
    if (!draft || draft.id !== draftId || (!hasLmc && !hasNse)) return;
    let actif = true;

    const charger = async () => {
      const especes: Espece[] = [...(hasLmc ? (['LMC'] as const) : []), ...(hasNse ? (['NSE'] as const) : [])];

      const nouveauVocab: Record<Espece, StadeVocab> = { LMC: emptyStadeVocab(), NSE: emptyStadeVocab() };
      const nouvellesDonnees: Record<Espece, ImagoSpeciesState> = { LMC: emptyImagoSpeciesState(), NSE: emptyImagoSpeciesState() };

      for (const espece of especes) {
        const [stadesF, stadesM, captures, population] = await Promise.all([
          listStadesGrille(espece, 'imago', 'F'),
          listStadesGrille(espece, 'imago', 'M'),
          listProspectionCaptures(draftId, espece, 'imago'),
          getProspectionPopulation(draftId, espece, 'imago'),
        ]);

        // `Set` : un même code peut être décrit par plusieurs lignes du référentiel
        // (une générique `espece = NULL` et une spécifique à l'espèce, ou un doublon de
        // synchro côté cache local) — la requête `listStadesGrille` les renvoie toutes,
        // la grille de saisie n'en veut qu'une par code.
        const stadesFCodes = Array.from(new Set(stadesF.map((s) => s.code)));
        const stadesMCodes = Array.from(new Set(stadesM.map((s) => s.code)));
        nouveauVocab[espece] = { F: stadesFCodes, M: stadesMCodes };

        const grille = { espece, categorie: 'imago' as const };
        const phasesData = phasesFromCaptures(grille, captures);
        const stadesDataF = stadesDepuisCaptures(grille, captures, stadesFCodes, 'F');
        const stadesDataM = stadesDepuisCaptures(grille, captures, stadesMCodes, 'M');
        const totalStades =
          Object.values(stadesDataF).reduce((s, v) => s + v, 0) + Object.values(stadesDataM).reduce((s, v) => s + v, 0);

        nouvellesDonnees[espece] = {
          totalCaptures: totalStades > 0 ? String(totalStades) : '',
          phasesData,
          stadesDataF,
          stadesDataM,
          currentSexe: 'F',
          densiteDiffuse: population?.densite_diffuse != null ? String(population.densite_diffuse) : '',
          densiteGroupee: population?.densite_groupee != null ? String(population.densite_groupee) : '',
          methode: (population?.methode as Methode | null) ?? null,
          accouplement: population?.accouplement ?? null,
          ponte: population?.ponte ?? null,
        };
      }

      const sousEnsemble = await chargerSousEnsembleImago(draftId);

      if (!actif) return;
      setVocab(nouveauVocab);
      setData(nouvellesDonnees);
      if (sousEnsemble) {
        setShared(sharedFromInfestationRow(sousEnsemble.typeCible, sousEnsemble.row));
        setExistingInfestationRow(sousEnsemble.row);
      }
      setPret(true);
    };

    void charger().catch((error) => {
      if (actif) signalerChargement(error, { draftId });
    });

    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draftId, hasLmc, hasNse]);

  const current = data[species];
  const currentVocab = vocab[species];
  const totalCaptures = Number.parseInt(current.totalCaptures, 10) || 0;
  const max = capturesMaxFor(species, 'imago');
  const phasesList = phasesFor(species, 'imago');
  const totalPhases = Object.values(current.phasesData).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalStadesF = currentVocab.F.reduce((s, st) => s + (current.stadesDataF[st] || 0), 0);
  const totalStadesM = currentVocab.M.reduce((s, st) => s + (current.stadesDataM[st] || 0), 0);
  const totalStades = totalStadesF + totalStadesM;
  const isPhasesConsistent = totalCaptures === 0 || totalPhases === totalCaptures;
  const isStadesConsistent = totalCaptures === 0 || totalStades === totalCaptures;

  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const updateCurrent = (patch: Partial<ImagoSpeciesState>) => {
    setData((prev) => ({ ...prev, [species]: { ...prev[species], ...patch } }));
  };

  const updatePhase = (phase: string, value: number) => {
    setData((prev) => ({
      ...prev,
      [species]: { ...prev[species], phasesData: { ...prev[species].phasesData, [phase]: Math.max(0, value) } },
    }));
  };

  const updateStade = (sexe: Sexe, stade: string, value: number) => {
    const safe = Math.max(0, value);
    setData((prev) => ({
      ...prev,
      [species]:
        sexe === 'F'
          ? { ...prev[species], stadesDataF: { ...prev[species].stadesDataF, [stade]: safe } }
          : { ...prev[species], stadesDataM: { ...prev[species].stadesDataM, [stade]: safe } },
    }));
  };

  /** Même dérivation État → Comportement de l'essaim que `accouplement.tsx`/`infestation.tsx`. */
  const handleEtatChange = (value: 'repos' | 'deplacement') => {
    setShared((current) => {
      const nextEtat = current.etat === value ? null : value;
      return {
        ...current,
        etat: nextEtat,
        comportementEssaim: nextEtat === 'repos' ? 'pose' : nextEtat === 'deplacement' ? 'vol' : null,
      };
    });
  };

  const handleBack = () => retourArriere(router, () => router.replace({ pathname: '/(prospection)/species' as any, params: { draftId } }));

  const buildRows = (espece: Espece, s: ImagoSpeciesState): CaptureRow[] => {
    const total = Number.parseInt(s.totalCaptures, 10) || 0;
    if (total === 0) return [];
    const phasesAvecEffectifs = phasesFor(espece, 'imago')
      .map((phase) => ({ phase, count: Number(s.phasesData[phase]) || 0 }))
      .filter((p) => p.count > 0);
    const rows: CaptureRow[] = [];
    for (const stade of vocab[espece].F) {
      const count = Number(s.stadesDataF[stade]) || 0;
      for (const alloc of repartirStadeSurPhases(count, phasesAvecEffectifs)) {
        rows.push({ espece, categorie: 'imago', sexe: 'F', phase: alloc.phase, stade, effectif: alloc.effectif });
      }
    }
    for (const stade of vocab[espece].M) {
      const count = Number(s.stadesDataM[stade]) || 0;
      for (const alloc of repartirStadeSurPhases(count, phasesAvecEffectifs)) {
        rows.push({ espece, categorie: 'imago', sexe: 'M', phase: alloc.phase, stade, effectif: alloc.effectif });
      }
    }
    return rows;
  };

  const handleContinue = () => {
    for (const espece of especesDisponibles) {
      const s = data[espece];
      const total = Number.parseInt(s.totalCaptures, 10) || 0;
      if (total === 0) continue;
      const phases = phasesFor(espece, 'imago').reduce((sum, p) => sum + (Number(s.phasesData[p]) || 0), 0);
      const stadesF = vocab[espece].F.reduce((sum, st) => sum + (s.stadesDataF[st] || 0), 0);
      const stadesM = vocab[espece].M.reduce((sum, st) => sum + (s.stadesDataM[st] || 0), 0);
      if (phases !== total || stadesF + stadesM !== total) {
        Alert.alert(
          `Incohérence — ${ESPECE_LABEL[espece]}`,
          `Captures : ${total}\nPhases : ${phases}\nStades ♀+♂ : ${stadesF + stadesM}\n\nLa règle est : Captures = Phases = Stades ♀ + Stades ♂.`
        );
        return;
      }
      if (s.densiteDiffuse.trim() === '') {
        Alert.alert(`Densité diffuse requise — ${ESPECE_LABEL[espece]}`, 'Veuillez renseigner la densité diffuse (D/ha) pour chaque espèce sélectionnée.');
        return;
      }
    }

    return run(
      async () => {
        for (const espece of especesDisponibles) {
          const s = data[espece];
          const rows = buildRows(espece, s);
          if (rows.length > 0) {
            await saveProspectionCaptures(draftId, espece, 'imago', rows);
          }
          await markGrilleCompleted(draftId, `${espece}:imago`);

          await saveProspectionPopulation(draftId, {
            espece,
            categorie: 'imago',
            densite_diffuse: parseDensite(s.densiteDiffuse),
            densite_groupee: parseDensite(s.densiteGroupee),
            methode: s.methode,
            accouplement: s.accouplement,
            ponte: s.ponte,
          });
        }

        if (shared.typeCible) {
          await saveProspectionInfestation(
            draftId,
            shared.typeCible,
            mergerLigneInfestationImago(existingInfestationRow, shared.typeCible, shared.etat, shared.interdistanceMoy)
          );
        }

        await refreshCaptures();
        router.push({
          pathname: (hasLarves ? '/(prospection)/intensive-larves' : '/(prospection)/infestation') as any,
          params: { draftId },
        });
      },
      {
        screen: 'intensive-imagos',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  if (!pret) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Imagos</Text>
          </View>
          <View style={styles.chargementBloc}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.chargementTexte}>Chargement…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const stadesListPourSexe = current.currentSexe === 'F' ? currentVocab.F : currentVocab.M;
  const stadesDataPourSexe = current.currentSexe === 'F' ? current.stadesDataF : current.stadesDataM;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Prospection intensive — Imagos</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabelPrimary}>Total capturé · {ESPECE_LABEL[species]}</Text>
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

          {especesDisponibles.length > 1 && (
            <View style={styles.speciesRow}>
              {especesDisponibles.map((sp) => {
                const active = sp === species;
                return (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.speciesButton, active && styles.speciesButtonActive]}
                    onPress={() => setSpecies(sp)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.speciesButtonText, active && styles.speciesButtonTextActive]}>{sp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}>
            {/* ===== Bloc 1 — Identification de la capture ===== */}
            <Text style={styles.blocTitle}>1 · Identification de la capture</Text>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Nombre total de captures</Text>
              <TextInput
                value={current.totalCaptures}
                onChangeText={(text) => updateCurrent({ totalCaptures: text })}
                keyboardType="number-pad"
                style={styles.totalCaptureInput}
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
              />

              {totalCaptures > 0 && (
                <>
                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Phases</Text>
                  {phasesList.map((phase) => {
                    const count = current.phasesData[phase] || 0;
                    return (
                      <View key={phase} style={styles.phaseRow}>
                        <Text style={styles.phaseLabel}>{phase.replace(/_/g, ' ')}</Text>
                        <View style={styles.counterRow}>
                          <TouchableOpacity style={styles.counterButton} onPress={() => updatePhase(phase, count - 1)}>
                            <Text style={styles.counterButtonText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{count}</Text>
                          <TouchableOpacity
                            style={[styles.counterButton, styles.counterButtonAdd, totalPhases >= totalCaptures && styles.counterButtonDisabled]}
                            onPress={() => {
                              if (totalPhases < totalCaptures) updatePhase(phase, count + 1);
                              else Alert.alert('Limite atteinte', `La somme des phases a déjà atteint ${totalCaptures}.`);
                            }}
                          >
                            <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  <Text style={[styles.totalLine, !isPhasesConsistent && styles.totalLineError]}>
                    Total phases : {totalPhases} {isPhasesConsistent ? '✅' : '❌'}
                  </Text>

                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Stades</Text>
                  <View style={styles.sexeRow}>
                    {(['F', 'M'] as Sexe[]).map((sexe) => (
                      <TouchableOpacity
                        key={sexe}
                        style={[styles.sexeToggle, current.currentSexe === sexe && styles.sexeToggleActive]}
                        onPress={() => updateCurrent({ currentSexe: sexe })}
                      >
                        <Text style={[styles.sexeText, current.currentSexe === sexe && styles.sexeTextActive]}>
                          {sexe === 'F' ? '♀ Femelles' : '♂ Mâles'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {stadesListPourSexe.length === 0 ? (
                    <Text style={styles.referentielManquantText}>
                      Stades indisponibles hors ligne — synchronisez les référentiels puis rouvrez cette fiche.
                    </Text>
                  ) : (
                    stadesListPourSexe.map((stade) => {
                      const value = stadesDataPourSexe[stade] || 0;
                      return (
                        <View key={stade} style={styles.stadeRow}>
                          <Text style={styles.stadeLabel}>{stade}</Text>
                          <View style={styles.counterRow}>
                            <TouchableOpacity
                              style={styles.miniButton}
                              onPress={() => updateStade(current.currentSexe, stade, value - 1)}
                            >
                              <Text style={styles.miniButtonText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{value}</Text>
                            <TouchableOpacity
                              style={[styles.miniButton, styles.miniButtonAdd, totalStades >= totalCaptures && styles.miniButtonDisabled]}
                              onPress={() => {
                                if (totalStades < totalCaptures) updateStade(current.currentSexe, stade, value + 1);
                                else Alert.alert('Limite atteinte', `Le total des stades a déjà atteint ${totalCaptures}.`);
                              }}
                            >
                              <Text style={[styles.miniButtonText, styles.miniButtonAddText]}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                  <Text style={[styles.totalLine, !isStadesConsistent && styles.totalLineError]}>
                    Total stades : {totalStadesF} ♀ + {totalStadesM} ♂ = {totalStades} {isStadesConsistent ? '✅' : '❌'}
                  </Text>
                </>
              )}
            </View>

            {/* ===== Bloc 2 — Densité et caractérisation ===== */}
            <Text style={styles.blocTitle}>2 · Densité et caractérisation</Text>
            <View style={styles.card}>
              <View style={styles.fieldsRow}>
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, styles.requiredLabel]}>Densité diffuse (D/ha) *</Text>
                  <TextInput
                    value={current.densiteDiffuse}
                    onChangeText={(text) => updateCurrent({ densiteDiffuse: text })}
                    keyboardType="decimal-pad"
                    style={styles.fieldInput}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Densité groupée (/m²)</Text>
                  <TextInput
                    value={current.densiteGroupee}
                    onChangeText={(text) => updateCurrent({ densiteGroupee: text })}
                    keyboardType="decimal-pad"
                    style={styles.fieldInput}
                  />
                </View>
              </View>

              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Méthode</Text>
              <View style={styles.chipsRow}>
                {(['visuel', 'comptage_direct'] as Methode[]).map((option) => {
                  const active = option === current.methode;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateCurrent({ methode: active ? null : option })}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {option === 'visuel' ? 'Visuel' : 'Comptage direct'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.commonBanner}>
                <Text style={styles.commonBannerLabel}>Commun LMC + NSE</Text>
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Type de cible</Text>
                <View style={styles.chipsRow}>
                  {TYPE_CIBLE_IMAGO_OPTIONS.map((option) => {
                    const active = option.value === shared.typeCible;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setShared((c) => ({ ...c, typeCible: active ? null : option.value }))}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>État</Text>
                <View style={styles.chipsRow}>
                  {(['repos', 'deplacement'] as const).map((value) => {
                    const active = shared.etat === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => handleEtatChange(value)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {value === 'repos' ? 'Repos' : 'Déplacement'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Comportement de l&apos;essaim</Text>
                <Text style={styles.commonHint}>Déterminé automatiquement par l&apos;État</Text>
                <View style={styles.chipsRow}>
                  {(['vol', 'pose'] as const).map((value) => {
                    const active = shared.comportementEssaim === value;
                    return (
                      <View key={value} style={[styles.chip, active && styles.chipActive]}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {value === 'vol' ? 'En vol' : 'Posé'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ===== Bloc 3 — Reproduction ===== */}
            <Text style={styles.blocTitle}>3 · Reproduction</Text>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Accouplement</Text>
              <View style={styles.chipsRow}>
                {accouplementOptionsFor(species).map((option) => {
                  const active = option === current.accouplement;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateCurrent({ accouplement: active ? null : option })}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Ponte</Text>
              <View style={styles.chipsRow}>
                {accouplementOptionsFor(species).map((option) => {
                  const active = option === current.ponte;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateCurrent({ ponte: active ? null : option })}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ===== Bloc 4 — Organisation spatiale ===== */}
            <Text style={styles.blocTitle}>4 · Organisation spatiale</Text>
            <View style={[styles.card, styles.commonBanner]}>
              <Text style={styles.commonBannerLabel}>Commun LMC + NSE</Text>
              <Text style={styles.sectionLabel}>Interdistance moyenne (m)</Text>
              <TextInput
                value={shared.interdistanceMoy}
                onChangeText={(text) => setShared((c) => ({ ...c, interdistanceMoy: text }))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>

            {/* ===== Bloc 5 — Récapitulation ===== */}
            <Text style={styles.blocTitle}>5 · Récapitulation imagos — LMC / NSE</Text>
            <View style={styles.card}>
              <View style={styles.recapHeaderRow}>
                <Text style={[styles.recapCell, styles.recapLabelCell]} />
                <Text style={[styles.recapCell, styles.recapHeaderText]}>LMC</Text>
                <Text style={[styles.recapCell, styles.recapHeaderText]}>NSE</Text>
              </View>
              {(
                [
                  ['Captures', (e: Espece) => (especesDisponibles.includes(e) ? String(Number.parseInt(data[e].totalCaptures, 10) || 0) : '—')],
                  [
                    'Phases',
                    (e: Espece) => {
                      if (!especesDisponibles.includes(e)) return '—';
                      const t = Number.parseInt(data[e].totalCaptures, 10) || 0;
                      const p = phasesFor(e, 'imago').reduce((s, ph) => s + (data[e].phasesData[ph] || 0), 0);
                      return t === 0 ? '0' : `${p} ${p === t ? '✅' : '❌'}`;
                    },
                  ],
                  [
                    'Stades ♀+♂',
                    (e: Espece) => {
                      if (!especesDisponibles.includes(e)) return '—';
                      const f = vocab[e].F.reduce((s, st) => s + (data[e].stadesDataF[st] || 0), 0);
                      const m = vocab[e].M.reduce((s, st) => s + (data[e].stadesDataM[st] || 0), 0);
                      return `${f}+${m}=${f + m}`;
                    },
                  ],
                  ['Densité diffuse', (e: Espece) => (especesDisponibles.includes(e) ? data[e].densiteDiffuse || '—' : '—')],
                  ['Densité groupée', (e: Espece) => (especesDisponibles.includes(e) ? data[e].densiteGroupee || '—' : '—')],
                  ['Accouplement', (e: Espece) => (especesDisponibles.includes(e) ? data[e].accouplement ?? '—' : '—')],
                  ['Ponte', (e: Espece) => (especesDisponibles.includes(e) ? data[e].ponte ?? '—' : '—')],
                ] as [string, (e: Espece) => string][]
              ).map(([label, getValue]) => (
                <View key={label} style={styles.recapRow}>
                  <Text style={[styles.recapCell, styles.recapLabelCell, styles.recapLabelText]}>{label}</Text>
                  <Text style={[styles.recapCell, styles.recapValueText]}>{getValue('LMC')}</Text>
                  <Text style={[styles.recapCell, styles.recapValueText]}>{getValue('NSE')}</Text>
                </View>
              ))}

              <View style={styles.commonBanner}>
                <Text style={styles.commonBannerLabel}>Valeurs communes LMC + NSE</Text>
                <Text style={styles.recapCommonLine}>
                  Type de cible : {TYPE_CIBLE_IMAGO_OPTIONS.find((o) => o.value === shared.typeCible)?.label ?? '—'}
                </Text>
                <Text style={styles.recapCommonLine}>
                  État : {shared.etat === 'repos' ? 'Repos' : shared.etat === 'deplacement' ? 'Déplacement' : '—'}
                </Text>
                <Text style={styles.recapCommonLine}>
                  Comportement de l&apos;essaim :{' '}
                  {shared.comportementEssaim === 'vol' ? 'En vol' : shared.comportementEssaim === 'pose' ? 'Posé' : '—'}
                </Text>
                <Text style={styles.recapCommonLine}>Interdistance : {shared.interdistanceMoy || '—'} m</Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>{hasLarves ? 'Suivant : Larves ›' : 'Infestation ›'}</Text>
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
  chargementBloc: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  chargementTexte: { fontSize: 12.5, color: TEXT_SECONDARY, fontWeight: '600' },

  statsRow: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', gap: 9 },
  statCardPrimary: { flex: 1, backgroundColor: GREEN, borderRadius: 12, padding: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 10 },
  statLabelPrimary: { color: '#ffffffcc', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabel: { color: '#9a9484', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValuePrimary: { color: '#fff', fontWeight: '700', fontSize: 20 },
  statValue: { color: TEXT, fontWeight: '700', fontSize: 20 },
  statValueMax: { fontSize: 12, color: '#ffffffb3' },
  statValueMaxDim: { fontSize: 11, color: '#bdb6a2' },

  speciesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  speciesButton: { flex: 1, textAlign: 'center', borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  blocTitle: { fontSize: 11.5, fontWeight: '800', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 13, marginBottom: 14 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabelSpaced: { marginTop: 12 },

  totalCaptureInput: { marginTop: 6, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },

  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textTransform: 'capitalize' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterButton: { width: 30, height: 30, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonDisabled: { opacity: 0.4 },
  counterButtonText: { fontSize: 16, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 16, fontWeight: '700', color: TEXT, minWidth: 20, textAlign: 'center', fontFamily: 'monospace' },
  totalLine: { marginTop: 8, fontSize: 12, fontWeight: '700', color: GREEN, textAlign: 'right' },
  totalLineError: { color: '#dc2626' },

  sexeRow: { flexDirection: 'row', gap: 7, backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 4, marginBottom: 8, marginTop: 6 },
  sexeToggle: { flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  sexeToggleActive: { backgroundColor: '#fff' },
  sexeText: { fontWeight: '700', fontSize: 12.5, color: '#9a9484' },
  sexeTextActive: { color: TEXT },
  stadeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  stadeLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  miniButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  miniButtonAdd: { backgroundColor: GREEN },
  miniButtonDisabled: { opacity: 0.4 },
  miniButtonText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  miniButtonAddText: { color: '#fff' },
  referentielManquantText: { fontSize: 12, lineHeight: 17, color: '#8a5a12', backgroundColor: '#fdf3e3', borderRadius: 8, padding: 10 },

  fieldsRow: { flexDirection: 'row', gap: 9 },
  field: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 9, padding: 9 },
  fieldLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 3 },
  requiredLabel: { color: '#c0412b' },
  fieldInput: { fontSize: 16, fontWeight: '700', color: TEXT, padding: 0, backgroundColor: '#f8f6f0', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 9, marginTop: 4 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  commonHint: { fontSize: 9, color: '#9a9484', marginTop: 4, fontStyle: 'italic' },

  commonBanner: { marginTop: 14, backgroundColor: COMMON_BG, borderRadius: 10, padding: 11 },
  commonBannerLabel: { fontSize: 9, fontWeight: '800', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },

  recapHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 6, marginBottom: 4 },
  recapRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0eee8', alignItems: 'center' },
  recapCell: { flex: 1, textAlign: 'center' },
  recapLabelCell: { flex: 1.3, textAlign: 'left' },
  recapLabelText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  recapHeaderText: { fontSize: 11, fontWeight: '800', color: GREEN, textTransform: 'uppercase' },
  recapValueText: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  recapCommonLine: { fontSize: 12, color: TEXT, marginBottom: 3 },

  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
