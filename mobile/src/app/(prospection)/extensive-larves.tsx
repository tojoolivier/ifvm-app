import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Espece } from '@/lib/prospection-especes-stades';
import { getProspectionPopulation, saveProspectionPopulation } from '@/lib/prospection-repository';
import {
  LARVE_PHASE_ROWS,
  PhaseKey,
  ExtensiveLarveSpeciesData,
  createEmptyLarveSpeciesData,
  larveSpeciesDataToPopulationRow,
  populationRowToLarveSpeciesData,
  extractCommonLarveData,
} from '@/lib/prospection-extensive';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

export default function ExtensiveLarvesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [species, setSpecies] = useState<Espece>('LMC');
  
  const [speciesData, setSpeciesData] = useState<Record<Espece, ExtensiveLarveSpeciesData>>({
    LMC: createEmptyLarveSpeciesData('LMC'),
    NSE: createEmptyLarveSpeciesData('NSE'),
  });
  
  // Données communes
  const [tacheLarvaire, setTacheLarvaire] = useState(false);
  const [bandeLarvaire, setBandeLarvaire] = useState(false);
  const [interdist, setInterdist] = useState('');
  const [deplacement, setDeplacement] = useState('repos');
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const [lmc, nse] = await Promise.all([
        getProspectionPopulation(draftId, 'LMC', 'larve'),
        getProspectionPopulation(draftId, 'NSE', 'larve'),
      ]);
      
      const lmcData = populationRowToLarveSpeciesData('LMC', lmc);
      const nseData = populationRowToLarveSpeciesData('NSE', nse);
      
      setSpeciesData({
        LMC: lmcData,
        NSE: nseData,
      });

      const commonData = extractCommonLarveData(lmc || nse);
      setTacheLarvaire(commonData.tl);
      setBandeLarvaire(commonData.bl);
      setInterdist(commonData.interdist);
      setDeplacement(commonData.deplacement);
    })();
  }, [draftId]);

  const data = speciesData[species];
  
  const totalPhases = data.phases.solitaire + data.phases.transiens + data.phases.gregaire;
  const totalStades = Object.values(data.stades).reduce((sum, val) => sum + val, 0);

  const isPhasesConsistent = data.totalCaptures === 0 || data.totalCaptures === totalPhases;
  const isStadesConsistent = data.totalCaptures === 0 || data.totalCaptures === totalStades;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  const updateSpeciesData = (patch: Partial<ExtensiveLarveSpeciesData>) => {
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

  const updateStade = (stadeKey: string, value: number) => {
    setSpeciesData((prev) => ({
      ...prev,
      [species]: {
        ...prev[species],
        stades: { ...prev[species].stades, [stadeKey]: value },
      },
    }));
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;

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
          `Captures : ${data.totalCaptures}\nStades : ${totalStades}\n\nLa somme des stades doit être exactement égale au nombre de captures.`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const commonData = { tl: tacheLarvaire, bl: bandeLarvaire, interdist, deplacement };
      
      await Promise.all([
        saveProspectionPopulation(draftId, larveSpeciesDataToPopulationRow('LMC', speciesData.LMC, commonData)),
        saveProspectionPopulation(draftId, larveSpeciesDataToPopulationRow('NSE', speciesData.NSE, commonData)),
      ]);
      
      router.push({ pathname: '/(prospection)/extensive-recap' as any, params: { draftId } });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde des données.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStadesList = () => {
    if (species === 'LMC') {
      return ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];
    } else {
      return ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
    }
  };

  const stadesList = getStadesList();

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
            <Text style={styles.title}>Larves</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
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
                {LARVE_PHASE_ROWS.map(({ key, label }) => {
                  const count = data.phases[key];
                  
                  return (
                    <View key={key} style={styles.phaseRow}>
                      <Text style={styles.phaseLabel}>{label}</Text>
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
                    </View>
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
              <Text style={styles.sectionLabel}>📊 Stades</Text>
              <View style={styles.stadesGrid}>
                {stadesList.map((stade) => {
                  const value = data.stades[stade] || 0;
                  return (
                    <View key={stade} style={styles.stadeRow}>
                      <Text style={styles.stadeLabel}>{stade}</Text>
                      <View style={styles.counterButtons}>
                        <TouchableOpacity
                          style={[styles.miniButton, value === 0 && styles.miniButtonDisabled]}
                          onPress={() => {
                            if (value > 0) updateStade(stade, value - 1);
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
                              updateStade(stade, value + 1);
                            } else {
                              Alert.alert('Limite atteinte', `Le total des stades a déjà atteint ${data.totalCaptures}.`);
                            }
                          }}
                          disabled={totalStades >= data.totalCaptures}
                        >
                          <Text style={[styles.miniButtonText, styles.miniButtonAddText]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total stades :</Text>
                <Text style={[styles.totalValue, !isStadesConsistent && styles.errorCount]}>
                  {totalStades} {isStadesConsistent ? '✅' : ''}
                </Text>
              </View>
              {!isStadesConsistent && data.totalCaptures > 0 && (
                <Text style={styles.errorText}>
                  La somme des stades doit être égale au nombre de captures ({data.totalCaptures})
                </Text>
              )}
            </View>

            <View style={styles.observationsSection}>
              <Text style={styles.sectionLabel}>📊 Observations</Text>
              
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Tache larvaire</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, tacheLarvaire && styles.toggleButtonActive]}
                  onPress={() => setTacheLarvaire(!tacheLarvaire)}
                >
                  <Text style={[styles.toggleText, tacheLarvaire && styles.toggleTextActive]}>
                    {tacheLarvaire ? 'Oui' : 'Non'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Bande larvaire</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, bandeLarvaire && styles.toggleButtonActive]}
                  onPress={() => setBandeLarvaire(!bandeLarvaire)}
                >
                  <Text style={[styles.toggleText, bandeLarvaire && styles.toggleTextActive]}>
                    {bandeLarvaire ? 'Oui' : 'Non'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Interdistance (m)</Text>
                <TextInput
                  value={interdist}
                  onChangeText={setInterdist}
                  keyboardType="decimal-pad"
                  style={styles.inputField}
                  placeholder="0"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Déplacement</Text>
                <View style={styles.deplacementRow}>
                  {['repos', 'perchee'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.deplacementButton, deplacement === option && styles.deplacementButtonActive]}
                      onPress={() => setDeplacement(option)}
                    >
                      <Text style={[styles.deplacementText, deplacement === option && styles.deplacementTextActive]}>
                        {option === 'repos' ? 'Repos' : 'Perchée'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>3. Stades :</Text>
                <Text style={[styles.summaryValue, isStadesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                  {totalStades} {isStadesConsistent ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.ruleBox}>
                <Text style={styles.ruleText}>Règle : Captures = Phases = Stades</Text>
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
                    : `${data.totalCaptures} captures = ${totalPhases} phases = ${totalStades} stades`
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>⚠️ INCOHÉRENCE</Text>
                <Text style={styles.warningDetail}>
                  Captures : {data.totalCaptures}
                  {'\n'}Phases : {totalPhases}
                  {'\n'}Stades : {totalStades}
                </Text>
                <Text style={styles.warningHint}>
                  La règle est : Captures = Phases = Stades
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
              <Text style={styles.continueButtonText}>Suivant : Récap ›</Text>
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
  
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  errorCount: { color: '#d32f2f' },
  errorText: { fontSize: 11, color: '#d32f2f', marginTop: 4, marginBottom: 4 },
  
  totalCaptureSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  totalCaptureInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCaptureInput: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },
  totalCaptureInfo: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  
  phaseSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 13 },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
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
  stadesGrid: { gap: 6 },
  stadeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  stadeLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  counterButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniButton: { width: 28, height: 28, borderRadius: 6, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  miniButtonAdd: { backgroundColor: GREEN },
  miniButtonDisabled: { opacity: 0.4 },
  miniButtonText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  miniButtonAddText: { color: '#fff' },
  
  observationsSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  toggleLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  toggleButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: INACTIVE_BG },
  toggleButtonActive: { backgroundColor: GREEN },
  toggleText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  toggleTextActive: { color: '#fff' },
  inputRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  inputLabel: { fontSize: 13, fontWeight: '500', color: TEXT, marginBottom: 4 },
  inputField: { backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: TEXT },
  deplacementRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  deplacementButton: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: INACTIVE_BG, alignItems: 'center' },
  deplacementButtonActive: { backgroundColor: GREEN },
  deplacementText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  deplacementTextActive: { color: '#fff' },
  
  summaryContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: BORDER },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
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

export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';