import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TYPE_CIBLE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { InfestationRow, listAllProspectionInfestations, saveProspectionInfestation } from '@/lib/prospection-repository';
import {
  COMPASS_DIRECTIONS,
  comportementInsight,
  densityInsight,
  oppositeDirection,
} from '@/lib/prospection-infestation-insights';
import { useAsyncAction } from '@/hooks/use-async-action';
import {
  TAILLE_GROUPE_SEUIL_BANDE_M2,
  validateComportementDirection,
  validateInfestationFormation,
} from '@/lib/prospection-validation';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#f6f3e9';
const TARGET_ACTIVE = '#c0412b';

// Groupes incompatibles
const INCOMPATIBLE_GROUPS = {
  larve: ['tache_larvaire', 'bande_larvaire'],
  imago: ['vol_clair', 'essaim'],
};

interface FormationForm {
  tailleMin: string;
  tailleMax: string;
  tailleMoy: string;
  surfTot: string;
  densMin: string;
  densMax: string;
  densMoy: string;
  interdistanceMin: string;
  interdistanceMax: string;
  interdistanceMoy: string;
  comportement: 'repos' | 'deplacement' | null;
  ventDe: string;
  ventVers: string;
  ventVitesse: string;
  stadeDominant: 'l1_l3' | 'l4_l5' | null;
  tailleGroupeM2: string;
  frontLongueurM: string;
  frontLargeurM: string;
  densiteMaxFront: string;
  densiteMoyArriereFront: string;
}

function emptyFormation(): FormationForm {
  return {
    tailleMin: '',
    tailleMax: '',
    tailleMoy: '',
    surfTot: '',
    densMin: '',
    densMax: '',
    densMoy: '',
    interdistanceMin: '',
    interdistanceMax: '',
    interdistanceMoy: '',
    comportement: null,
    ventDe: '',
    ventVers: '',
    ventVitesse: '',
    stadeDominant: null,
    tailleGroupeM2: '',
    frontLongueurM: '',
    frontLargeurM: '',
    densiteMaxFront: '',
    densiteMoyArriereFront: '',
  };
}

function formFromRow(row: InfestationRow | undefined): FormationForm {
  if (!row) return emptyFormation();
  return {
    tailleMin: row.taille_min != null ? String(row.taille_min) : '',
    tailleMax: row.taille_max != null ? String(row.taille_max) : '',
    tailleMoy: row.taille_moy != null ? String(row.taille_moy) : '',
    surfTot: row.surface_tot != null ? String(row.surface_tot) : '',
    densMin: row.densite_min != null ? String(row.densite_min) : '',
    densMax: row.densite_max != null ? String(row.densite_max) : '',
    densMoy: row.densite_moy != null ? String(row.densite_moy) : '',
    interdistanceMin: row.interdistance_min != null ? String(row.interdistance_min) : '',
    interdistanceMax: row.interdistance_max != null ? String(row.interdistance_max) : '',
    interdistanceMoy: row.interdistance_moy != null ? String(row.interdistance_moy) : '',
    comportement: (row.comportement as 'repos' | 'deplacement' | null) ?? null,
    ventDe: row.vent_de ?? row.direction_de ?? '',
    ventVers: row.direction_vers ?? '',
    ventVitesse: row.vent_vitesse != null ? String(row.vent_vitesse) : '',
    stadeDominant: (row.stade_dominant as 'l1_l3' | 'l4_l5' | null) ?? null,
    tailleGroupeM2: row.taille_groupe_m2 != null ? String(row.taille_groupe_m2) : '',
    frontLongueurM: row.front_longueur_m != null ? String(row.front_longueur_m) : '',
    frontLargeurM: row.front_largeur_m != null ? String(row.front_largeur_m) : '',
    densiteMaxFront: row.densite_max_front != null ? String(row.densite_max_front) : '',
    densiteMoyArriereFront: row.densite_moy_arriere_front != null ? String(row.densite_moy_arriere_front) : '',
  };
}

function numOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

function rowFromForm(typeCible: string, form: FormationForm): InfestationRow {
  return {
    espece: null,
    type_cible: typeCible,
    taille_min: numOrNull(form.tailleMin),
    taille_max: numOrNull(form.tailleMax),
    taille_moy: numOrNull(form.tailleMoy),
    surface_tot: numOrNull(form.surfTot),
    densite_min: numOrNull(form.densMin),
    densite_max: numOrNull(form.densMax),
    densite_moy: numOrNull(form.densMoy),
    interdistance: null,
    interdistance_min: numOrNull(form.interdistanceMin),
    interdistance_max: numOrNull(form.interdistanceMax),
    interdistance_moy: numOrNull(form.interdistanceMoy),
    comportement: form.comportement,
    direction_de: form.ventDe || null,
    direction_vers: form.ventVers || null,
    vent_de: form.ventDe || null,
    vent_vitesse: numOrNull(form.ventVitesse),
    pullulation_nb: null,
    taille_long: null,
    taille_large: null,
    taille_epaisseur: null,
    essaim_en_vol: null,
    essaim_pose: null,
    type_essaim: null,
    nb_taches_bandes: null,
    interdistance_m: null,
    surface_contaminee_ha: null,
    type_larve: null,
    surf_infestee_pourcent: null,
    stade_dominant: form.stadeDominant,
    taille_groupe_m2: numOrNull(form.tailleGroupeM2),
    front_longueur_m: numOrNull(form.frontLongueurM),
    front_largeur_m: numOrNull(form.frontLargeurM),
    densite_max_front: numOrNull(form.densiteMaxFront),
    densite_moy_arriere_front: numOrNull(form.densiteMoyArriereFront),
  };
}

function isFilled(form: FormationForm): boolean {
  return form.surfTot !== '' || form.densMoy !== '';
}

type Tab = 'desc' | 'comport';

export default function InfestationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [forms, setForms] = useState<Record<string, FormationForm> | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('desc');
  const { run, isRunning: isSaving } = useAsyncAction();

  useEffect(() => {
    if (!draftId) return;
    listAllProspectionInfestations(draftId).then((rows) => {
      const byType = new Map(rows.map((row) => [row.type_cible, row]));
      const next: Record<string, FormationForm> = {};
      const selected: string[] = [];
      for (const option of TYPE_CIBLE_OPTIONS) {
        next[option.value] = formFromRow(byType.get(option.value));
        if (byType.has(option.value)) {
          selected.push(option.value);
        }
      }
      // Taille du groupe ≥ 1000 m² déjà en base : "tache" n'est plus une cible valide.
      const size = numOrNull(next.tache_larvaire?.tailleGroupeM2 ?? '') ?? 0;
      if (size >= TAILLE_GROUPE_SEUIL_BANDE_M2 && selected.includes('tache_larvaire') && !selected.includes('bande_larvaire')) {
        next.bande_larvaire = next.tache_larvaire;
        next.tache_larvaire = emptyFormation();
        selected[selected.indexOf('tache_larvaire')] = 'bande_larvaire';
      }
      setForms(next);
      setSelectedTargets(selected);
    });
  }, [draftId]);

  if (!forms) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const currentTarget = selectedTargets.length > 0 ? selectedTargets[0] : TYPE_CIBLE_OPTIONS[0].value;
  const form = forms[currentTarget];
  const targetLabel = TYPE_CIBLE_OPTIONS.find((o) => o.value === currentTarget)?.label ?? currentTarget;

  // Taille du groupe ≥ 1000 m² : "tache" n'est plus une cible valide, seul "bande" reste sélectionnable
  const tacheDisabledBySize =
    (numOrNull(forms.tache_larvaire?.tailleGroupeM2 ?? '') ?? 0) >= TAILLE_GROUPE_SEUIL_BANDE_M2;

  const setField = <K extends keyof FormationForm>(field: K, value: FormationForm[K]) => {
    setForms((current) => (current ? { ...current, [currentTarget]: { ...current[currentTarget], [field]: value } } : current));

    if (
      field === 'tailleGroupeM2' &&
      currentTarget === 'tache_larvaire' &&
      (numOrNull(value as string) ?? 0) >= TAILLE_GROUPE_SEUIL_BANDE_M2 &&
      !selectedTargets.includes('bande_larvaire')
    ) {
      setSelectedTargets((current) => current.map((t) => (t === 'tache_larvaire' ? 'bande_larvaire' : t)));
      setForms((current) =>
        current
          ? { ...current, bande_larvaire: { ...current.tache_larvaire, tailleGroupeM2: value as string }, tache_larvaire: emptyFormation() }
          : current
      );
    }
  };

  const descInsight = densityInsight(numOrNull(form.densMoy));
  const comportInsight = comportementInsight(form.comportement, form.ventVers || null, numOrNull(form.ventVitesse));
  const windTarget = COMPASS_DIRECTIONS.find((d) => d.label === form.ventVers);
  const windAngle = windTarget ? windTarget.deg : 0;
  const windLabel = form.ventDe && form.ventVers ? `${form.ventDe} → ${form.ventVers}` : '—';

  // ==========================================
  // LOGIQUE DE SELECTION
  // ==========================================

  const handleTargetSelect = (value: string) => {
    const isSelected = selectedTargets.includes(value);

    if (value === 'tache_larvaire' && !isSelected && tacheDisabledBySize) {
      Alert.alert(
        'Taille ≥ 1000 m²',
        'Un groupe de cette taille est une bande, pas une tache. Sélectionnez "Bande larvaire".'
      );
      return;
    }

    // Si déjà sélectionné, on le désélectionne
    if (isSelected) {
      setSelectedTargets(selectedTargets.filter((t) => t !== value));
      return;
    }

    // Si on a déjà 2 types sélectionnés, on ne peut pas en ajouter un 3ème
    if (selectedTargets.length >= 2) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez sélectionner que 2 types de cible maximum.');
      return;
    }

    // Vérifier les incompatibilités
    let incompatibleFound = false;
    let incompatibleTarget = '';

    // Vérifier si le nouveau type est incompatible avec un type déjà sélectionné
    for (const group of Object.values(INCOMPATIBLE_GROUPS)) {
      if (group.includes(value)) {
        // Vérifier si un autre type du même groupe est déjà sélectionné
        for (const selected of selectedTargets) {
          if (group.includes(selected) && selected !== value) {
            incompatibleFound = true;
            incompatibleTarget = selected;
            break;
          }
        }
        break;
      }
    }

    if (incompatibleFound) {
      // Remplacer l'ancien par le nouveau
      setSelectedTargets(
        selectedTargets.map((t) => (t === incompatibleTarget ? value : t))
      );
      // Réinitialiser le formulaire de l'ancien type
      setForms((current) => current ? { ...current, [incompatibleTarget]: emptyFormation() } : current);
    } else {
      // Ajouter le nouveau type
      setSelectedTargets([...selectedTargets, value]);
    }
  };

  const persistAll = async () => {
    // Ne sauvegarder que les types sélectionnés
    for (const target of selectedTargets) {
      const f = forms[target];
      if (!isFilled(f)) continue;
      await saveProspectionInfestation(draftId, target, rowFromForm(target, f));
    }
  };

  const handleFooterPress = () => {
    if (selectedTargets.length === 0) {
      Alert.alert('Sélection requise', 'Veuillez sélectionner au moins un type de cible.');
      return;
    }
    if (tab === 'desc') {
      setTab('comport');
      return;
    }

    const blocages: string[] = [];
    const avertissements: string[] = [];
    for (const target of selectedTargets) {
      const f = forms[target];
      if (!isFilled(f)) continue;
      const result = validateInfestationFormation({
        densMin: numOrNull(f.densMin),
        densMax: numOrNull(f.densMax),
        ventVitesse: numOrNull(f.ventVitesse),
      });
      blocages.push(...result.blocages);
      avertissements.push(...result.avertissements);

      const directionResult = validateComportementDirection({
        typeCible: target,
        comportement: f.comportement,
        directionRenseignee: !!(f.ventDe && f.ventVers),
      });
      blocages.push(...directionResult.blocages);
      avertissements.push(...directionResult.avertissements);
    }
    if (blocages.length > 0) {
      Alert.alert('Saisie incohérente', blocages.join('\n'));
      return;
    }
    if (avertissements.length > 0) {
      Alert.alert('À vérifier', avertissements.join('\n'));
    }

    run(
      async () => {
        await persistAll();
        router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
      },
      {
        screen: 'infestation',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  const renderTargetChips = () => {
    return TYPE_CIBLE_OPTIONS.map((option) => {
      const isSelected = selectedTargets.includes(option.value);
      // Vérifier si ce type est incompatible avec un autre sélectionné
      let isIncompatible = false;
      for (const group of Object.values(INCOMPATIBLE_GROUPS)) {
        if (group.includes(option.value)) {
          for (const selected of selectedTargets) {
            if (group.includes(selected) && selected !== option.value) {
              isIncompatible = true;
              break;
            }
          }
          break;
        }
      }
      const isDisabled = option.value === 'tache_larvaire' && !isSelected && tacheDisabledBySize;

      return (
        <TouchableOpacity
          key={option.value}
          onPress={() => handleTargetSelect(option.value)}
          disabled={isDisabled}
          style={[
            styles.targetChip,
            isSelected && styles.targetChipActive,
            isIncompatible && styles.targetChipIncompatible,
            isDisabled && styles.targetChipIncompatible,
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.targetChipText, isSelected && styles.targetChipTextActive]}>
            {option.label}
          </Text>
          {isSelected && <Text style={styles.targetChipCheck}>✓</Text>}
          {isIncompatible && <Text style={styles.targetChipIncompatibleText}>⛔</Text>}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => (tab === 'comport' ? setTab('desc') : router.back())} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {tab === 'desc' ? 'Infestation' : `Comportement · ${targetLabel}`}
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          {tab === 'desc' && (
            <>
              <View style={styles.toggleTrack}>
                <TouchableOpacity onPress={() => setTab('desc')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                  <Text style={[styles.toggleSegment, tab === 'desc' && styles.toggleSegmentActive]}>Description</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('comport')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                  <Text style={styles.toggleSegment}>Comportement</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Type de cible</Text>
              
              <View style={styles.targetRow}>
                {renderTargetChips()}
              </View>

              <View style={styles.selectionInfo}>
                <Text style={styles.selectionInfoText}>
                  {selectedTargets.length === 0 
                    ? 'Aucun type sélectionné' 
                    : `${selectedTargets.length} type${selectedTargets.length > 1 ? 's' : ''} sélectionné${selectedTargets.length > 1 ? 's' : ''}`
                  }
                </Text>
              </View>
            </>
          )}

          {tab === 'desc' && selectedTargets.length > 0 && (
            <View style={styles.card}>
              <View style={styles.row2NoMargin}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Taille (en m)</Text>
                  <TextInput
                    value={form.tailleMoy}
                    onChangeText={(v) => setField('tailleMoy', v)}
                    keyboardType="decimal-pad"
                    style={styles.infoBoxInput}
                  />
                </View>
                <View style={[styles.infoBox, styles.infoBoxHighlighted]}>
                  <Text style={styles.infoBoxLabel}>Surface totale</Text>
                  <View style={styles.infoBoxInputRow}>
                    <TextInput
                      value={form.surfTot}
                      onChangeText={(v) => setField('surfTot', v)}
                      keyboardType="decimal-pad"
                      style={styles.infoBoxInput}
                    />
                    <Text style={styles.infoBoxUnit}>ha</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Densité (/m²)</Text>
              <View style={styles.row3}>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>min</Text>
                  <TextInput
                    value={form.densMin}
                    onChangeText={(v) => setField('densMin', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>max</Text>
                  <TextInput
                    value={form.densMax}
                    onChangeText={(v) => setField('densMax', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={[styles.box, styles.boxEmphasis]}>
                  <Text style={[styles.boxCaption, styles.boxCaptionEmphasis]}>moy</Text>
                  <TextInput
                    value={form.densMoy}
                    onChangeText={(v) => setField('densMoy', v)}
                    keyboardType="decimal-pad"
                    style={[styles.boxValue, styles.boxValueEmphasis]}
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Interdistance (m)</Text>
              <View style={styles.row3}>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>min</Text>
                  <TextInput
                    value={form.interdistanceMin}
                    onChangeText={(v) => setField('interdistanceMin', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>max</Text>
                  <TextInput
                    value={form.interdistanceMax}
                    onChangeText={(v) => setField('interdistanceMax', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>moy</Text>
                  <TextInput
                    value={form.interdistanceMoy}
                    onChangeText={(v) => setField('interdistanceMoy', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
              </View>

              {(currentTarget === 'tache_larvaire' || currentTarget === 'bande_larvaire') && (
                <>
                  <Text style={styles.fieldGroupLabel}>Stade dominant</Text>
                  <View style={styles.row2}>
                    {(['l1_l3', 'l4_l5'] as const).map((value) => {
                      const active = form.stadeDominant === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setField('stadeDominant', value)}
                          style={[styles.chip, active && styles.chipActive]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {value === 'l1_l3' ? 'L1-L3' : 'L4-L5'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.row2NoMargin}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Taille du groupe</Text>
                      <View style={styles.infoBoxInputRow}>
                        <TextInput
                          value={form.tailleGroupeM2}
                          onChangeText={(v) => setField('tailleGroupeM2', v)}
                          keyboardType="decimal-pad"
                          style={styles.infoBoxInput}
                        />
                        <Text style={styles.infoBoxUnit}>m²</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              {currentTarget === 'bande_larvaire' && (
                <>
                  <Text style={styles.sectionLabel}>Dimensions du front (m)</Text>
                  <View style={styles.row3}>
                    <View style={styles.box}>
                      <Text style={styles.boxCaption}>longueur</Text>
                      <TextInput
                        value={form.frontLongueurM}
                        onChangeText={(v) => setField('frontLongueurM', v)}
                        keyboardType="decimal-pad"
                        style={styles.boxValue}
                      />
                    </View>
                    <View style={styles.box}>
                      <Text style={styles.boxCaption}>largeur</Text>
                      <TextInput
                        value={form.frontLargeurM}
                        onChangeText={(v) => setField('frontLargeurM', v)}
                        keyboardType="decimal-pad"
                        style={styles.boxValue}
                      />
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>Densité au front (/m²)</Text>
                  <View style={styles.row3}>
                    <View style={styles.box}>
                      <Text style={styles.boxCaption}>max</Text>
                      <TextInput
                        value={form.densiteMaxFront}
                        onChangeText={(v) => setField('densiteMaxFront', v)}
                        keyboardType="decimal-pad"
                        style={styles.boxValue}
                      />
                    </View>
                    <View style={styles.box}>
                      <Text style={styles.boxCaption}>moy arrière</Text>
                      <TextInput
                        value={form.densiteMoyArriereFront}
                        onChangeText={(v) => setField('densiteMoyArriereFront', v)}
                        keyboardType="decimal-pad"
                        style={styles.boxValue}
                      />
                    </View>
                  </View>
                </>
              )}

              {descInsight && (
                <View style={styles.insightCallout}>
                  <Text style={styles.insightText}>{descInsight}</Text>
                </View>
              )}
            </View>
          )}

          {tab === 'comport' && selectedTargets.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.fieldGroupLabel}>État</Text>
              <View style={styles.row2}>
                {(['repos', 'deplacement'] as const).map((value) => {
                  const active = form.comportement === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setField('comportement', value)}
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

              <Text style={styles.fieldGroupLabel}>Direction du déplacement</Text>
              <View style={styles.compassCard}>
                <View style={styles.compassCircle}>
                  <Text style={[styles.compassCardinal, styles.compassCardinalN]}>N</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalS]}>S</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalO]}>O</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalE]}>E</Text>
                  <View style={[styles.compassArrow, { transform: [{ rotate: `${windAngle}deg` }] }]} />
                  <View style={styles.compassArrowDot} />
                </View>
                <View style={styles.compassChips}>
                  {COMPASS_DIRECTIONS.map((dir) => {
                    const active = dir.label === form.ventDe;
                    return (
                      <TouchableOpacity
                        key={dir.label}
                        onPress={() => {
                          setField('ventDe', dir.label);
                          setField('ventVers', oppositeDirection(dir.label));
                        }}
                        style={[styles.compassChip, active && styles.compassChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.compassChipText, active && styles.compassChipTextActive]}>{dir.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Vent</Text>
                <View style={styles.row2NoMargin}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Direction</Text>
                    <Text style={styles.infoBoxValue}>{windLabel}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Vitesse</Text>
                    <View style={styles.infoBoxInputRow}>
                      <TextInput
                        value={form.ventVitesse}
                        onChangeText={(v) => setField('ventVitesse', v)}
                        keyboardType="decimal-pad"
                        style={styles.infoBoxInput}
                      />
                      <Text style={styles.infoBoxUnit}>km/h</Text>
                    </View>
                  </View>
                </View>
              </View>

              {comportInsight && (
                <View style={styles.insightCallout}>
                  <Text style={styles.insightText}>{comportInsight}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.continueButton, selectedTargets.length === 0 && styles.continueButtonDisabled]} 
            onPress={handleFooterPress} 
            disabled={isSaving || selectedTargets.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>
              {tab === 'desc' ? 'Comportement  ›' : 'Continuer  ›'}
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 16, fontWeight: '800', color: TEXT },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 7 },
  hintText: { fontSize: 11, color: TEXT_SECONDARY, fontStyle: 'italic', marginBottom: 10 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  targetChip: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  targetChipActive: { backgroundColor: TARGET_ACTIVE, borderColor: TARGET_ACTIVE },
  targetChipIncompatible: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', opacity: 0.6 },
  targetChipIncompatibleText: { fontSize: 12 },
  targetChipText: { fontSize: 13, fontWeight: '700', color: TEXT },
  targetChipTextActive: { fontWeight: '800', color: '#fff' },
  targetChipCheck: { fontSize: 14, color: '#fff', fontWeight: '700' },
  selectionInfo: { alignItems: 'center', marginBottom: 12 },
  selectionInfoText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  toggleTrack: { flexDirection: 'row', backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 3, gap: 3, marginBottom: 14 },
  toggleSegmentTouchable: { flex: 1 },
  toggleSegment: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    color: '#9a9484',
  },
  toggleSegmentActive: { backgroundColor: '#fff', color: TEXT },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 10 },
  fieldGroupLabel: { fontSize: 10, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7, marginTop: 12 },
  row3: { flexDirection: 'row', gap: 7 },
  row2: { flexDirection: 'row', gap: 7, marginTop: 7 },
  row2NoMargin: { flexDirection: 'row', gap: 7 },
  box: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 9, minHeight: 62 },
  boxCaption: { fontSize: 10.5, fontWeight: '500', color: '#9a9484', marginBottom: 3 },
  boxCaptionEmphasis: { color: 'rgba(255,255,255,0.75)' },
  boxValue: { fontSize: 17, fontWeight: '700', color: TEXT, padding: 0 },
  boxValueEmphasis: { color: '#fff' },
  boxEmphasis: { backgroundColor: GREEN, borderColor: GREEN },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12.5, fontWeight: '700', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '800', color: '#fff' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 15, paddingVertical: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  insightCallout: { backgroundColor: '#fbeae6', borderRadius: 10, padding: 11, marginTop: 10 },
  insightText: { fontSize: 11.5, lineHeight: 16, fontWeight: '500', color: '#a8422c' },
  compassCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginTop: 7 },
  compassCircle: { width: 150, height: 150, alignSelf: 'center', borderWidth: 2, borderColor: BORDER, borderRadius: 75, marginBottom: 8 },
  compassCardinal: { position: 'absolute', fontSize: 10.5, fontWeight: '700', color: '#9a9484' },
  compassCardinalN: { top: 4, left: '50%', marginLeft: -5 },
  compassCardinalS: { bottom: 4, left: '50%', marginLeft: -5 },
  compassCardinalO: { left: 7, top: '50%', marginTop: -7 },
  compassCardinalE: { right: 7, top: '50%', marginTop: -7 },
  compassArrow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 2.5,
    height: 52,
    backgroundColor: TARGET_ACTIVE,
    marginLeft: -1.25,
    marginTop: -52,
    transformOrigin: 'bottom center',
  } as any,
  compassArrowDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: -4.5,
    marginTop: -4.5,
    backgroundColor: TARGET_ACTIVE,
  },
  compassChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  compassChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, backgroundColor: INACTIVE_BG },
  compassChipActive: { backgroundColor: TARGET_ACTIVE },
  compassChipText: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY },
  compassChipTextActive: { fontWeight: '800', color: '#fff' },
  infoBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 9, minHeight: 62 },
  infoBoxHighlighted: { borderWidth: 2, borderColor: GREEN },
  infoBoxLabel: { fontSize: 10.5, fontWeight: '500', color: '#9a9484', marginBottom: 3 },
  infoBoxValue: { fontSize: 15, fontWeight: '700', color: TEXT },
  infoBoxInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  infoBoxInput: { flex: 1, fontSize: 17, fontWeight: '700', color: TEXT, padding: 0 },
  infoBoxUnit: { fontSize: 10.5, fontWeight: '600', color: '#9a9484' },
});