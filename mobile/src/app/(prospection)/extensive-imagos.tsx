import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Espece, accouplementOptionsFor } from '@/lib/prospection-especes-stades';
import { getProspectionPopulation, saveProspectionPopulation } from '@/lib/prospection-repository';
import {
  IMAGO_PHASE_ROWS,
  PhaseKey,
  ExtensiveImagoSpeciesData,
  EtatImago,
  TYPE_CIBLE_IMAGO_OPTIONS,
  createEmptySpeciesData,
  speciesDataToPopulationRow,
  populationRowToSpeciesData,
} from '@/lib/prospection-extensive';
import { COMPASS_DIRECTIONS, oppositeDirection } from '@/lib/prospection-infestation-insights';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

type Sexe = 'F' | 'M';

export default function ExtensiveImagosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [species, setSpecies] = useState<Espece>('LMC');
  const [currentSexe, setCurrentSexe] = useState<Sexe>('F');
  
  const [speciesData, setSpeciesData] = useState<Record<Espece, ExtensiveImagoSpeciesData>>({
    LMC: createEmptySpeciesData(),
    NSE: createEmptySpeciesData(),
  });
  
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('extensive-imagos');

  useEffect(() => {
    if (!draftId) return;
    void Promise.all([
      getProspectionPopulation(draftId, 'LMC', 'imago'),
      getProspectionPopulation(draftId, 'NSE', 'imago'),
    ])
      .then(([lmc, nse]) => {
        const lmcData = populationRowToSpeciesData(lmc);
        const nseData = populationRowToSpeciesData(nse);

        setSpeciesData({
          LMC: lmcData,
          NSE: nseData,
        });
      })
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, signalerChargement]);

  const data = speciesData[species];
  
  const totalPhases = data.phases.solitaire + data.phases.transiens + data.phases.solitaroTransiens + data.phases.gregaire;
  
  const totalStadesF = 
    data.stades.femelleA1 + data.stades.femelleA2 + data.stades.femelleA3 + 
    data.stades.femelleA3_1_4 + data.stades.femelleA3_1_2 + data.stades.femelleA3_3_4 + 
    data.stades.femelleA3_4_4 + data.stades.femelleA4 + data.stades.femelleA5;
  
  const totalStadesM = 
    data.stades.maleA1 + data.stades.maleA234 + data.stades.maleA5;
  
  const totalStades = totalStadesF + totalStadesM;

  // ✅ MODIFICATION 1 : Accepter 0 comme cohérent
  const isPhasesConsistent = data.totalCaptures === 0 || data.totalCaptures === totalPhases;
  const isStadesConsistent = data.totalCaptures === 0 || data.totalCaptures === totalStades;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  const updateSpeciesData = (patch: Partial<ExtensiveImagoSpeciesData>) => {
    setSpeciesData((prev) => ({
      ...prev,
      [species]: { ...prev[species], ...patch },
    }));
  };

  const updatePhase = (key: PhaseKey, value: number) => {
    setSpeciesData((prev) => ({
      ...prev,
      [species]: {
        ...prev[species],
        phases: { ...prev[species].phases, [key]: value },
      },
    }));
  };

  const updateStade = (key: keyof ExtensiveImagoSpeciesData['stades'], value: number) => {
    setSpeciesData((prev) => ({
      ...prev,
      [species]: {
        ...prev[species],
        stades: { ...prev[species].stades, [key]: value },
      },
    }));
  };

  /** Même logique que handleEtatChange dans infestation.tsx : le Comportement de
   * l'essaim est entièrement dérivé de l'État, jamais choisi indépendamment — appuyer
   * à nouveau sur l'État actif le désélectionne (et efface la direction, qui n'a de
   * sens qu'en Déplacement). */
  const handleEtatChange = (value: EtatImago) => {
    setSpeciesData((prev) => {
      const current = prev[species];
      const nextEtat = current.etat === value ? null : value;
      return {
        ...prev,
        [species]:
          nextEtat === 'repos'
            ? { ...current, etat: 'repos', comportementEssaim: 'pose', directionDe: '', directionVers: '' }
            : nextEtat === 'deplacement'
              ? { ...current, etat: 'deplacement', comportementEssaim: 'vol' }
              : { ...current, etat: null, comportementEssaim: null, directionDe: '', directionVers: '' },
      };
    });
  };

const handleContinue = () => {
  if (data.totalCaptures > 0) {
    if (!isPhasesConsistent) {
      Alert.alert(
        'Incohérence des phases',
        `Captures : ${data.totalCaptures}\nPhases : ${totalPhases}\n\nLa somme des phases doit être exactement égale au nombre de captures.`
      );
      return;
    }

    if (!isStadesConsistent) {
      Alert.alert(
        'Incohérence des stades',
        `Captures : ${data.totalCaptures}\nStades femelles : ${totalStadesF}\nStades mâles : ${totalStadesM}\nTotal stades : ${totalStadesF} + ${totalStadesM} = ${totalStades}\n\nLa règle est :\nCaptures = Phases = Stades ♀ + Stades ♂`
      );
      return;
    }
  }

  return run(
    async () => {
      await saveProspectionPopulation(draftId, speciesDataToPopulationRow('LMC', speciesData.LMC));
      await saveProspectionPopulation(draftId, speciesDataToPopulationRow('NSE', speciesData.NSE));

      router.push({ pathname: '/(prospection)/extensive-larves' as any, params: { draftId } });
    },
    {
      screen: 'extensive-imagos',
      precondition: !!draftId,
      preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
      context: { draftId, species },
    }
  );
};

  const renderStades = () => {
    const isFemale = currentSexe === 'F';
    const stadesList = isFemale 
      ? ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5']
      : ['A1', 'A234', 'A5'];
    
    const getKey = (stade: string): keyof ExtensiveImagoSpeciesData['stades'] => {
      if (isFemale) {
        return `femelle${stade.replace(/-/g, '_').replace(/\//g, '_')}` as keyof ExtensiveImagoSpeciesData['stades'];
      } else {
        return `male${stade.replace(/-/g, '_').replace(/\//g, '_')}` as keyof ExtensiveImagoSpeciesData['stades'];
      }
    };

    return stadesList.map((stade) => {
      const key = getKey(stade);
      const value = data.stades[key] || 0;
      
      return (
        <View key={stade} style={styles.stadeCounterRow}>
          <Text style={styles.stadeLabel}>{stade}</Text>
          <View style={styles.counterButtons}>
            <TouchableOpacity
              style={[styles.miniButton, value === 0 && styles.miniButtonDisabled]}
              onPress={() => {
                if (value > 0) updateStade(key, value - 1);
              }}
              disabled={value === 0}
            >
              <Text style={styles.miniButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{value}</Text>
            <TouchableOpacity
              style={[styles.miniButton, styles.miniButtonAdd, totalStades >= data.totalCaptures && styles.miniButtonDisabled]}
              onPress={() => {
                if (totalStades < data.totalCaptures) {
                  updateStade(key, value + 1);
                } else {
                  Alert.alert('Limite atteinte', `Le total des stades (${totalStadesF} ♀ + ${totalStadesM} ♂ = ${totalStades}) a déjà atteint ${data.totalCaptures}.`);
                }
              }}
              disabled={totalStades >= data.totalCaptures}
            >
              <Text style={[styles.miniButtonText, styles.miniButtonAddText]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
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
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Imagos</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <View style={styles.speciesRow}>
            {(['LMC', 'NSE'] as Espece[]).map((sp) => {
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

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 30 }}>
            <View style={styles.totalCaptureSection}>
              <Text style={styles.sectionLabel}>📝 Nombre total de captures</Text>
              <View style={styles.totalCaptureInputContainer}>
                <TextInput
                  value={String(data.totalCaptures)}
                  onChangeText={(text) => {
                    const val = Number.parseInt(text, 10);
                    updateSpeciesData({ totalCaptures: isNaN(val) ? 0 : val });
                  }}
                  keyboardType="number-pad"
                  style={styles.totalCaptureInput}
                  placeholder="0"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>
              <Text style={styles.totalCaptureInfo}>
                {data.totalCaptures} capture{data.totalCaptures > 1 ? 's' : ''} à répartir
              </Text>
            </View>

            <View style={styles.phaseSection}>
              <Text style={styles.sectionLabel}>📊 Phases</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {IMAGO_PHASE_ROWS.map(({ key, label }) => {
                  const active = data.activePhase === key;
                  const count = data.phases[key];
                  
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.phaseRow, active && styles.phaseRowActive]}
                      onPress={() => updateSpeciesData({ activePhase: key })}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]}>{label}</Text>
                      {active ? (
                        <View style={styles.counterRow}>
                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => updatePhase(key, Math.max(0, count - 1))}
                          >
                            <Text style={styles.counterButtonText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{count}</Text>
                          <TouchableOpacity
                            style={[styles.counterButton, styles.counterButtonAdd, totalPhases >= data.totalCaptures && styles.counterButtonDisabled]}
                            onPress={() => {
                              if (totalPhases < data.totalCaptures) {
                                updatePhase(key, count + 1);
                              } else {
                                Alert.alert('Limite atteinte', `La somme des phases a déjà atteint ${data.totalCaptures}.`);
                              }
                            }}
                            disabled={totalPhases >= data.totalCaptures}
                          >
                            <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.phaseStaticCount}>{count}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total phases :</Text>
                <Text style={[styles.totalValue, !isPhasesConsistent && styles.errorCount]}>
                  {totalPhases} {isPhasesConsistent ? '✅' : ''}
                </Text>
              </View>
              {!isPhasesConsistent && data.totalCaptures > 0 && (
                <Text style={styles.errorText}>
                  La somme des phases doit être égale au nombre de captures ({data.totalCaptures})
                </Text>
              )}
            </View>

            <View style={styles.stadesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>📊 Stades</Text>
                <Text style={[styles.sectionCount, !isStadesConsistent && styles.errorCount]}>
                  {totalStades}
                </Text>
              </View>
              
              <View style={styles.sexeRow}>
                <TouchableOpacity
                  style={[styles.sexeToggle, currentSexe === 'F' && styles.sexeToggleActive]}
                  onPress={() => setCurrentSexe('F')}
                >
                  <Text style={[styles.sexeText, currentSexe === 'F' && styles.sexeTextActive]}>♀ Femelles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sexeToggle, currentSexe === 'M' && styles.sexeToggleActive]}
                  onPress={() => setCurrentSexe('M')}
                >
                  <Text style={[styles.sexeText, currentSexe === 'M' && styles.sexeTextActive]}>♂ Mâles</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.sexeHint}>
                {currentSexe === 'F'
                  ? '♀ Stades : A1, A2, A3, A3-1/4, A3-1/2, A3-3/4, A3-4/4, A4, A5'
                  : '♂ Stades : A1, A234, A5'}
              </Text>

              <View style={styles.stadesGrid}>
                {renderStades()}
              </View>

              <View style={styles.stadesSummary}>
                <Text style={styles.summaryText}>
                  Femelles: {totalStadesF} | Males: {totalStadesM} | Total: {totalStadesF} + {totalStadesM} = {totalStades}
                </Text>
              </View>
              
              {!isStadesConsistent && data.totalCaptures > 0 && (
                <Text style={styles.errorText}>
                  La somme des stades doit être égale au nombre de captures ({data.totalCaptures})
                </Text>
              )}
            </View>

            <View style={styles.densitySection}>
              <Text style={styles.sectionLabel}>📊 Densités</Text>
              <View style={styles.row}>
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.label}>Population diffuse D/ha</Text>
                  <TextInput
                    value={data.popDiff}
                    onChangeText={(text) => {
                      updateSpeciesData({ popDiff: text });
                    }}
                    keyboardType="decimal-pad"
                    style={styles.inputMono}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                  />
                </View>
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.label}>Population groupée D/m²</Text>
                  <TextInput
                    value={data.popGroup}
                    onChangeText={(text) => {
                      updateSpeciesData({ popGroup: text });
                    }}
                    keyboardType="decimal-pad"
                    style={styles.inputMono}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                  />
                </View>
              </View>
              <Text style={styles.speciesHint}>Données spécifiques à {species}</Text>
            </View>

            {/* Accouplement & Ponte : mêmes options et même fonctionnement que
                accouplement.tsx côté intensif (accouplementOptionsFor), une ligne
                population par espèce déjà indépendante — pas de risque de mélange. */}
            <View style={styles.densitySection}>
              <Text style={styles.sectionLabel}>📊 Accouplement</Text>
              <View style={styles.chipsRow}>
                {accouplementOptionsFor(species).map((option) => {
                  const active = option === data.accouplement;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateSpeciesData({ accouplement: active ? null : option })}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 10 }]}>📊 Ponte</Text>
              <View style={styles.chipsRow}>
                {accouplementOptionsFor(species).map((option) => {
                  const active = option === data.ponte;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateSpeciesData({ ponte: active ? null : option })}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.speciesHint}>Données spécifiques à {species}</Text>
            </View>

            <View style={styles.densitySection}>
              <Text style={styles.sectionLabel}>📊 Interdistance (m)</Text>
              <View style={styles.card}>
                <TextInput
                  value={data.interdistance}
                  onChangeText={(text) => updateSpeciesData({ interdistance: text })}
                  keyboardType="decimal-pad"
                  style={styles.inputMono}
                  placeholder="0"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>
              <Text style={styles.speciesHint}>Données spécifiques à {species}</Text>
            </View>

            <View style={styles.typeSection}>
              <Text style={styles.sectionLabel}>📊 Type de cible</Text>
              <Text style={styles.commonHint}>Données spécifiques à {species}</Text>
              <View style={styles.typeRow}>
                {TYPE_CIBLE_IMAGO_OPTIONS.map((option) => {
                  const active = data.typeCible === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.typeButton, active && styles.typeButtonActive]}
                      onPress={() => updateSpeciesData({ typeCible: option.value })}
                    >
                      <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Direction du déplacement : n'a de sens qu'en État = Déplacement, comme côté
                intensif (infestation.tsx, règle #4) — masquée (et effacée par
                handleEtatChange) tant que l'État n'est pas "Déplacement". */}
            {data.etat === 'deplacement' && (
              <View style={styles.densitySection}>
                <Text style={styles.sectionLabel}>📊 Direction du déplacement</Text>
                <View style={styles.chipsRow}>
                  {COMPASS_DIRECTIONS.map((dir) => {
                    const active = dir.label === data.directionDe;
                    return (
                      <TouchableOpacity
                        key={dir.label}
                        onPress={() =>
                          active
                            ? updateSpeciesData({ directionDe: '', directionVers: '' })
                            : updateSpeciesData({ directionDe: dir.label, directionVers: oppositeDirection(dir.label) })
                        }
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{dir.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.speciesHint}>Données spécifiques à {species}</Text>
              </View>
            )}

            <View style={styles.typeSection}>
              <Text style={styles.sectionLabel}>📊 État</Text>
              <View style={styles.typeRow}>
                {(['repos', 'deplacement'] as EtatImago[]).map((value) => {
                  const active = data.etat === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.typeButton, active && styles.typeButtonActive]}
                      onPress={() => handleEtatChange(value)}
                    >
                      <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>
                        {value === 'repos' ? 'Repos' : 'Déplacement'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.typeSection}>
              <Text style={styles.sectionLabel}>📊 Comportement de l&apos;essaim</Text>
              <Text style={styles.commonHint}>Déterminé automatiquement par l&apos;État</Text>
              <View style={styles.typeRow}>
                {(['vol', 'pose'] as const).map((value) => {
                  const active = data.comportementEssaim === value;
                  return (
                    <View key={value} style={[styles.typeButton, active && styles.typeButtonActive]}>
                      <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>
                        {value === 'vol' ? 'En vol' : 'Posé'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>📋 Récapitulatif - {species}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>1. Nombre de captures :</Text>
                <Text style={[styles.summaryValue, styles.summaryValueValid]}>{data.totalCaptures}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>2. Phases :</Text>
                <Text style={[styles.summaryValue, isPhasesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                  {totalPhases} {isPhasesConsistent ? '✅' : '❌'}
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
                  {totalStadesF} + {totalStadesM} = {totalStades} {isStadesConsistent ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pop. diffuse D/ha :</Text>
                <Text style={styles.summaryValue}>{data.popDiff || '0'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pop. groupée D/m² :</Text>
                <Text style={styles.summaryValue}>{data.popGroup || '0'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Accouplement :</Text>
                <Text style={styles.summaryValue}>{data.accouplement ?? '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ponte :</Text>
                <Text style={styles.summaryValue}>{data.ponte ?? '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Interdistance :</Text>
                <Text style={styles.summaryValue}>{data.interdistance || '0'} m</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type de cible :</Text>
                <Text style={styles.summaryValue}>
                  {TYPE_CIBLE_IMAGO_OPTIONS.find((o) => o.value === data.typeCible)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>État :</Text>
                <Text style={styles.summaryValue}>
                  {data.etat === 'repos' ? 'Repos' : data.etat === 'deplacement' ? 'Déplacement' : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Comportement de l&apos;essaim :</Text>
                <Text style={styles.summaryValue}>
                  {data.comportementEssaim === 'vol' ? 'En vol' : data.comportementEssaim === 'pose' ? 'Posé' : '—'}
                </Text>
              </View>
              {data.etat === 'deplacement' && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Direction :</Text>
                  <Text style={styles.summaryValue}>
                    {data.directionDe ? `${data.directionDe} → ${data.directionVers}` : '—'}
                  </Text>
                </View>
              )}
              <View style={styles.ruleBox}>
                <Text style={styles.ruleText}>Règle : Captures = Phases = Stades ♀ + Stades ♂</Text>
                <Text style={[styles.ruleText, { marginTop: 4, color: TEXT_SECONDARY, fontSize: 10 }]}>
                  {data.totalCaptures === 0 ? '✅ 0 capture : cohérent par défaut' : ''}
                </Text>
              </View>
            </View>

            {isConsistent ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✅ COHÉRENT</Text>
                <Text style={styles.successDetail}>
                  {data.totalCaptures === 0 
                    ? 'Aucune capture enregistrée' 
                    : `${data.totalCaptures} captures = ${totalPhases} phases = ${totalStadesF} ♀ + ${totalStadesM} ♂ = ${totalStades} stades`
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>⚠️ INCOHÉRENCE</Text>
                <Text style={styles.warningDetail}>
                  Captures : {data.totalCaptures}
                  {'\n'}Phases : {totalPhases}
                  {'\n'}Stades ♀ : {totalStadesF}
                  {'\n'}Stades ♂ : {totalStadesM}
                  {'\n'}Total stades : {totalStadesF} + {totalStadesM} = {totalStades}
                </Text>
                <Text style={styles.warningHint}>
                  La règle est : Captures = Phases = Stades ♀ + Stades ♂
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              style={[styles.continueButton, (!isConsistent && data.totalCaptures > 0) && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={isSaving || (!isConsistent && data.totalCaptures > 0)}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>Suivant : Larves ›</Text>
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  speciesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  speciesButton: { flex: 1, textAlign: 'center', borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, marginTop: 4 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  sectionCount: { fontSize: 13, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  errorCount: { color: '#d32f2f' },
  errorText: { fontSize: 11, color: '#d32f2f', marginTop: 4, marginBottom: 4 },
  
  totalCaptureSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  totalCaptureInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCaptureInput: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },
  totalCaptureInfo: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  
  phaseSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 13 },
  phaseRowActive: { borderWidth: 2, borderColor: GREEN, paddingVertical: 6, paddingLeft: 13 },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  phaseLabelActive: { fontWeight: '700', color: TEXT },
  phaseStaticCount: { fontSize: 13, fontWeight: '600', color: TEXT, fontFamily: 'monospace' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORDER },
  totalLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, marginRight: 8 },
  totalValue: { fontSize: 13, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 32, height: 32, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonDisabled: { opacity: 0.4 },
  counterButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 17, fontWeight: '700', color: TEXT, minWidth: 16, textAlign: 'center', fontFamily: 'monospace' },
  
  stadesSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  sexeRow: { flexDirection: 'row', gap: 7, backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 4, marginBottom: 11, marginTop: 4 },
  sexeToggle: { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  sexeToggleActive: { backgroundColor: '#fff' },
  sexeText: { fontWeight: '700', fontSize: 13, color: '#9a9484' },
  sexeTextActive: { color: TEXT },
  sexeHint: { fontSize: 10, color: '#9a9484', marginBottom: 9 },
  stadesGrid: { gap: 6 },
  stadeCounterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  stadeLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  counterButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  miniButtonAdd: { backgroundColor: GREEN },
  miniButtonDisabled: { opacity: 0.4 },
  miniButtonText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  miniButtonAddText: { color: '#fff' },
  stadesSummary: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  summaryText: { fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  
  densitySection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  flex1: { flex: 1 },
  card: { backgroundColor: '#f6f3e9', borderRadius: 9, padding: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484' },
  inputMono: { fontSize: 15, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  speciesHint: { fontSize: 9, color: '#9a9484', marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  
  typeSection: { marginTop: 4, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center' },
  typeButtonActive: { backgroundColor: GREEN },
  typeButtonText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  typeButtonTextActive: { color: '#fff' },
  commonHint: { fontSize: 9, color: '#9a9484', marginBottom: 6, textAlign: 'center', fontStyle: 'italic' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  
  summaryContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: BORDER },
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
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';