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

import { Espece, capturesMaxFor, phasesFor, repartirStadeSurPhases } from '@/lib/prospection-especes-stades';
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
  updateProspectionObservations,
} from '@/lib/prospection-repository';
import { parseDensite } from '@/lib/prospection-extensive';
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
type TypeCibleLarve = 'tache_larvaire' | 'bande_larvaire';

interface LarveSpeciesState {
  totalCaptures: string;
  phasesData: Record<string, number>;
  stadesData: Record<string, number>;
  densiteDiffuse: string;
  densiteGroupee: string;
  methode: Methode | null;
}

function emptyLarveSpeciesState(): LarveSpeciesState {
  return { totalCaptures: '', phasesData: {}, stadesData: {}, densiteDiffuse: '', densiteGroupee: '', methode: null };
}

interface SharedLarveInfestation {
  typeCible: TypeCibleLarve | null;
  interdistanceMoy: string;
  surfaceContamineeHa: string;
  deplacement: 'repos' | 'deplacement' | null;
}

function emptySharedLarveInfestation(): SharedLarveInfestation {
  return { typeCible: null, interdistanceMoy: '', surfaceContamineeHa: '', deplacement: null };
}

async function chargerSousEnsembleLarve(draftId: string): Promise<{ typeCible: TypeCibleLarve; row: InfestationRow } | null> {
  for (const typeCible of ['tache_larvaire', 'bande_larvaire'] as TypeCibleLarve[]) {
    const row = await getProspectionInfestation(draftId, typeCible);
    if (row) return { typeCible, row };
  }
  return null;
}

function sharedFromInfestationRow(typeCible: TypeCibleLarve, row: InfestationRow): SharedLarveInfestation {
  return {
    typeCible,
    interdistanceMoy: row.interdistance_moy != null ? String(row.interdistance_moy) : '',
    surfaceContamineeHa: row.surface_contaminee_ha != null ? String(row.surface_contaminee_ha) : '',
    deplacement: (row.comportement as 'repos' | 'deplacement' | null) ?? null,
  };
}

/**
 * Fusionne le sous-ensemble Larves (bande/tache, interdistance, surface contaminée,
 * déplacement) dans la ligne `prospection_infestation` existante — même précaution
 * que côté Imagos : préserver tout ce que seul `infestation.tsx` renseigne.
 *
 * Limite connue : `infestation.tsx` recalcule aujourd'hui `surface_contaminee_ha`
 * uniquement pour les cibles aériennes "dense"/"très dense" (`rowFromForm`, `isTypeCibleDense`)
 * et le remet à `null` pour tache/bande larvaire à chaque sauvegarde depuis cet écran —
 * une valeur saisie ici sera donc effacée si l'agent ressaisit ensuite quoi que ce soit sur
 * cette cible depuis `infestation.tsx`. Signalé, pas corrigé ici (hors périmètre : ce
 * serait modifier la logique métier de `infestation.tsx`).
 */
function mergerLigneInfestationLarve(
  existante: InfestationRow | null,
  typeCible: TypeCibleLarve,
  interdistanceMoy: string,
  surfaceContamineeHa: string,
  deplacement: 'repos' | 'deplacement' | null
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
    interdistance_moy: interdistanceMoy === '' ? null : parseDensite(interdistanceMoy),
    surface_contaminee_ha: surfaceContamineeHa === '' ? null : parseDensite(surfaceContamineeHa),
    comportement: deplacement,
  };
}

export default function IntensiveLarvesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const refreshCaptures = useProspectionWizardStore((s) => s.refreshCaptures);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('intensive-larves');

  const [pret, setPret] = useState(false);
  const [tick, setTick] = useState(0);
  const [speciesChoisie, setSpecies] = useState<Espece>('LMC');
  const [data, setData] = useState<Record<Espece, LarveSpeciesState>>({ LMC: emptyLarveSpeciesState(), NSE: emptyLarveSpeciesState() });
  const [vocab, setVocab] = useState<Record<Espece, string[]>>({ LMC: [], NSE: [] });
  const [shared, setShared] = useState<SharedLarveInfestation>(emptySharedLarveInfestation());
  const [existingInfestationRow, setExistingInfestationRow] = useState<InfestationRow | null>(null);
  const [observation, setObservation] = useState('');

  const especeSelection = draft?.especes ? parseEspeceSelection(draft.especes) : null;
  const hasLmc = especeSelection?.lmcLarve ?? false;
  const hasNse = especeSelection?.nseLarve ?? false;
  const especesDisponibles: Espece[] = [...(hasLmc ? (['LMC'] as const) : []), ...(hasNse ? (['NSE'] as const) : [])];
  // Dérivé plutôt que synchronisé par effet — mêmes raisons qu'`intensive-imagos.tsx`.
  const species: Espece = especesDisponibles.includes(speciesChoisie) ? speciesChoisie : (especesDisponibles[0] ?? speciesChoisie);

  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!draft || draft.id !== draftId || (!hasLmc && !hasNse)) return;
    let actif = true;

    const charger = async () => {
      const especes: Espece[] = [...(hasLmc ? (['LMC'] as const) : []), ...(hasNse ? (['NSE'] as const) : [])];
      const nouveauVocab: Record<Espece, string[]> = { LMC: [], NSE: [] };
      const nouvellesDonnees: Record<Espece, LarveSpeciesState> = { LMC: emptyLarveSpeciesState(), NSE: emptyLarveSpeciesState() };

      for (const espece of especes) {
        const [stades, captures, population] = await Promise.all([
          listStadesGrille(espece, 'larve', null),
          listProspectionCaptures(draftId, espece, 'larve'),
          getProspectionPopulation(draftId, espece, 'larve'),
        ]);
        // `Set` : cf. même dédoublonnage dans `intensive-imagos.tsx` — un code peut être
        // renvoyé plusieurs fois par `listStadesGrille` (ligne générique + spécifique à
        // l'espèce, ou doublon de synchro côté cache local).
        const stadesCodes = Array.from(new Set(stades.map((s) => s.code)));
        nouveauVocab[espece] = stadesCodes;

        const grille = { espece, categorie: 'larve' as const };
        const phasesData = phasesFromCaptures(grille, captures);
        const stadesData = stadesDepuisCaptures(grille, captures, stadesCodes, null);
        const totalStades = Object.values(stadesData).reduce((s, v) => s + v, 0);

        nouvellesDonnees[espece] = {
          totalCaptures: totalStades > 0 ? String(totalStades) : '',
          phasesData,
          stadesData,
          densiteDiffuse: population?.densite_diffuse != null ? String(population.densite_diffuse) : '',
          densiteGroupee: population?.densite_groupee != null ? String(population.densite_groupee) : '',
          methode: (population?.methode as Methode | null) ?? null,
        };
      }

      const sousEnsemble = await chargerSousEnsembleLarve(draftId);

      if (!actif) return;
      setVocab(nouveauVocab);
      setData(nouvellesDonnees);
      if (sousEnsemble) {
        setShared(sharedFromInfestationRow(sousEnsemble.typeCible, sousEnsemble.row));
        setExistingInfestationRow(sousEnsemble.row);
      }
      setObservation(draft.observations ?? '');
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
  const max = capturesMaxFor(species, 'larve');
  const phasesList = phasesFor(species, 'larve');
  const totalPhases = Object.values(current.phasesData).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalStades = currentVocab.reduce((s, st) => s + (current.stadesData[st] || 0), 0);
  const isPhasesConsistent = totalCaptures === 0 || totalPhases === totalCaptures;
  const isStadesConsistent = totalCaptures === 0 || totalStades === totalCaptures;

  const seconds = chronoSeconds(draft?.capture_started_at ?? null);
  void tick;

  const updateCurrent = (patch: Partial<LarveSpeciesState>) => setData((prev) => ({ ...prev, [species]: { ...prev[species], ...patch } }));
  const updatePhase = (phase: string, value: number) =>
    setData((prev) => ({ ...prev, [species]: { ...prev[species], phasesData: { ...prev[species].phasesData, [phase]: Math.max(0, value) } } }));
  const updateStade = (stade: string, value: number) =>
    setData((prev) => ({ ...prev, [species]: { ...prev[species], stadesData: { ...prev[species].stadesData, [stade]: Math.max(0, value) } } }));

  const handleBack = () =>
    retourArriere(router, () => router.replace({ pathname: '/(prospection)/intensive-imagos' as any, params: { draftId } }));

  const buildRows = (espece: Espece, s: LarveSpeciesState): CaptureRow[] => {
    const total = Number.parseInt(s.totalCaptures, 10) || 0;
    if (total === 0) return [];
    const phasesAvecEffectifs = phasesFor(espece, 'larve')
      .map((phase) => ({ phase, count: Number(s.phasesData[phase]) || 0 }))
      .filter((p) => p.count > 0);
    const rows: CaptureRow[] = [];
    for (const stade of vocab[espece]) {
      const count = Number(s.stadesData[stade]) || 0;
      for (const alloc of repartirStadeSurPhases(count, phasesAvecEffectifs)) {
        rows.push({ espece, categorie: 'larve', sexe: null, phase: alloc.phase, stade, effectif: alloc.effectif });
      }
    }
    return rows;
  };

  const handleContinue = () => {
    for (const espece of especesDisponibles) {
      const s = data[espece];
      const total = Number.parseInt(s.totalCaptures, 10) || 0;
      if (total === 0) continue;
      const phases = phasesFor(espece, 'larve').reduce((sum, p) => sum + (Number(s.phasesData[p]) || 0), 0);
      const stades = vocab[espece].reduce((sum, st) => sum + (s.stadesData[st] || 0), 0);
      if (phases !== total || stades !== total) {
        Alert.alert(
          `Incohérence — ${ESPECE_LABEL[espece]}`,
          `Captures : ${total}\nPhases : ${phases}\nStades larvaires : ${stades}\n\nLa règle est : Captures = Phases = Stades larvaires.`
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
            await saveProspectionCaptures(draftId, espece, 'larve', rows);
          }
          await markGrilleCompleted(draftId, `${espece}:larve`);

          await saveProspectionPopulation(draftId, {
            espece,
            categorie: 'larve',
            densite_diffuse: parseDensite(s.densiteDiffuse),
            densite_groupee: parseDensite(s.densiteGroupee),
            methode: s.methode,
            accouplement: null,
            ponte: null,
          });
        }

        if (shared.typeCible) {
          await saveProspectionInfestation(
            draftId,
            shared.typeCible,
            mergerLigneInfestationLarve(existingInfestationRow, shared.typeCible, shared.interdistanceMoy, shared.surfaceContamineeHa, shared.deplacement)
          );
        }

        if (draft && observation !== (draft.observations ?? '')) {
          const updated = await updateProspectionObservations(draftId, {
            degatsCultures: draft.degats_cultures ?? null,
            ennemisNaturels: draft.ennemis_naturels ?? null,
            observations: observation || null,
            dernierePluie: draft.derniere_pluie ?? null,
            intensitePluie: draft.intensite_pluie ?? null,
            heureObservationAt: draft.heure_observation_at ?? null,
          });
          setDraft(updated);
        }

        await refreshCaptures();
        router.push({ pathname: '/(prospection)/infestation' as any, params: { draftId } });
      },
      {
        screen: 'intensive-larves',
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
            <Text style={styles.title}>Larves</Text>
          </View>
          <View style={styles.chargementBloc}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.chargementTexte}>Chargement…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Prospection intensive — Larves</Text>
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
            {/* ===== Bloc 1 — Identification et captures ===== */}
            <Text style={styles.blocTitle}>1 · Identification et captures</Text>
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

                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Stades larvaires</Text>
                  {currentVocab.length === 0 ? (
                    <Text style={styles.referentielManquantText}>
                      Stades indisponibles hors ligne — synchronisez les référentiels puis rouvrez cette fiche.
                    </Text>
                  ) : (
                    currentVocab.map((stade) => {
                      const value = current.stadesData[stade] || 0;
                      return (
                        <View key={stade} style={styles.stadeRow}>
                          <Text style={styles.stadeLabel}>{stade}</Text>
                          <View style={styles.counterRow}>
                            <TouchableOpacity style={styles.miniButton} onPress={() => updateStade(stade, value - 1)}>
                              <Text style={styles.miniButtonText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{value}</Text>
                            <TouchableOpacity
                              style={[styles.miniButton, styles.miniButtonAdd, totalStades >= totalCaptures && styles.miniButtonDisabled]}
                              onPress={() => {
                                if (totalStades < totalCaptures) updateStade(stade, value + 1);
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
                    Total stades : {totalStades} {isStadesConsistent ? '✅' : '❌'}
                  </Text>
                </>
              )}
            </View>

            {/* ===== Bloc 2 — Densité et observation ===== */}
            <Text style={styles.blocTitle}>2 · Densité et observation</Text>
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
                <Text style={styles.commonBannerLabel}>Commun à la fiche</Text>
                <Text style={styles.sectionLabel}>Observation</Text>
                <TextInput
                  value={observation}
                  onChangeText={setObservation}
                  placeholder="Remarques importantes sur les larves observées…"
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />
                <Text style={styles.commonHint}>Repris et complétable sur l&apos;écran Observations, plus loin dans la fiche.</Text>
              </View>
            </View>

            {/* ===== Bloc 3 — Bande larvaire ===== */}
            <Text style={styles.blocTitle}>3 · Bande larvaire</Text>
            <View style={[styles.card, styles.commonBanner]}>
              <Text style={styles.commonBannerLabel}>Commun LMC + NSE</Text>
              <Text style={styles.sectionLabel}>Présence</Text>
              <View style={styles.chipsRow}>
                {(['tache_larvaire', 'bande_larvaire'] as TypeCibleLarve[]).map((value) => {
                  const active = shared.typeCible === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setShared((c) => ({ ...c, typeCible: active ? null : value }))}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {value === 'tache_larvaire' ? 'Tache larvaire' : 'Bande larvaire'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Interdistance moyenne (m)</Text>
              <TextInput
                value={shared.interdistanceMoy}
                onChangeText={(text) => setShared((c) => ({ ...c, interdistanceMoy: text }))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>

            {/* ===== Bloc 4 — Surface et déplacement ===== */}
            <Text style={styles.blocTitle}>4 · Surface et déplacement</Text>
            <View style={[styles.card, styles.commonBanner]}>
              <Text style={styles.commonBannerLabel}>Commun LMC + NSE</Text>
              <Text style={styles.sectionLabel}>Surface contaminée (ha)</Text>
              <TextInput
                value={shared.surfaceContamineeHa}
                onChangeText={(text) => setShared((c) => ({ ...c, surfaceContamineeHa: text }))}
                keyboardType="decimal-pad"
                style={styles.fieldInput}
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
              />

              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Déplacement</Text>
              <View style={styles.chipsRow}>
                {(['repos', 'deplacement'] as const).map((value) => {
                  const active = shared.deplacement === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setShared((c) => ({ ...c, deplacement: active ? null : value }))}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {value === 'repos' ? 'Repos' : 'Déplacement'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ===== Bloc 5 — Récapitulation ===== */}
            <Text style={styles.blocTitle}>5 · Récapitulation larves — LMC / NSE</Text>
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
                      const p = phasesFor(e, 'larve').reduce((s, ph) => s + (data[e].phasesData[ph] || 0), 0);
                      return t === 0 ? '0' : `${p} ${p === t ? '✅' : '❌'}`;
                    },
                  ],
                  [
                    'Stades',
                    (e: Espece) => {
                      if (!especesDisponibles.includes(e)) return '—';
                      return String(vocab[e].reduce((s, st) => s + (data[e].stadesData[st] || 0), 0));
                    },
                  ],
                  ['Densité diffuse', (e: Espece) => (especesDisponibles.includes(e) ? data[e].densiteDiffuse || '—' : '—')],
                  ['Densité groupée', (e: Espece) => (especesDisponibles.includes(e) ? data[e].densiteGroupee || '—' : '—')],
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
                  Bande larvaire :{' '}
                  {shared.typeCible === 'tache_larvaire' ? 'Tache' : shared.typeCible === 'bande_larvaire' ? 'Bande' : '—'}
                </Text>
                <Text style={styles.recapCommonLine}>Interdistance : {shared.interdistanceMoy || '—'} m</Text>
                <Text style={styles.recapCommonLine}>Surface contaminée : {shared.surfaceContamineeHa || '—'} ha</Text>
                <Text style={styles.recapCommonLine}>
                  Déplacement : {shared.deplacement === 'repos' ? 'Repos' : shared.deplacement === 'deplacement' ? 'Déplacement' : '—'}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Infestation ›</Text>
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
  textArea: { marginTop: 4, backgroundColor: '#fff', borderRadius: 9, padding: 9, fontSize: 13, fontWeight: '500', color: TEXT, minHeight: 60, textAlignVertical: 'top' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  commonHint: { fontSize: 9, color: '#9a9484', marginTop: 6, fontStyle: 'italic' },

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
