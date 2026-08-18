import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Espece, stadesFor } from '@/lib/prospection-especes-stades';
import { getProspectionPopulation, saveProspectionPopulation } from '@/lib/prospection-repository';
import {
  DEPLACEMENT_OPTIONS,
  PHASE_ROWS,
  PhaseKey,
  ExtensiveLarveState,
  emptyExtensiveLarveState,
  larveStateToPopulationRow,
  populationRowToLarveState,
  createEmptyLarveSpeciesData,
  ExtensiveLarveSpeciesData,
  larveSpeciesDataToPopulationRow,
  populationRowToLarveSpeciesData,
  extractCommonLarveData,
  totalLarvePhases,
  totalLarveStades,
  isLarveDataConsistent,
} from '@/lib/prospection-extensive';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';
const AMBER = '#e89b2b';

export default function ExtensiveLarvesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [species, setSpecies] = useState<Espece>('LMC');
  
  // Données par espèce
  const [speciesData, setSpeciesData] = useState<Record<Espece, ExtensiveLarveSpeciesData>>({
    LMC: createEmptyLarveSpeciesData('LMC'),
    NSE: createEmptyLarveSpeciesData('NSE'),
  });
  
  // Données communes (TL, BL, interdist, deplacement)
  const [tl, setTl] = useState(false);
  const [bl, setBl] = useState(false);
  const [interdist, setInterdist] = useState('');
  const [deplacement, setDeplacement] = useState('repos');
  
  const [isSaving, setIsSaving] = useState(false);

  // Chargement des données existantes
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const [lmc, nse] = await Promise.all([
        getProspectionPopulation(draftId, 'LMC', 'larve'),
        getProspectionPopulation(draftId, 'NSE', 'larve'),
      ]);
      
      // Conversion des données chargées
      const lmcData = populationRowToLarveSpeciesData('LMC', lmc);
      const nseData = populationRowToLarveSpeciesData('NSE', nse);
      
      setSpeciesData({
        LMC: lmcData,
        NSE: nseData,
      });

      // Charger les données communes depuis l'une des espèces (elles sont identiques)
      const commonData = extractCommonLarveData(lmc || nse);
      setTl(commonData.tl);
      setBl(commonData.bl);
      setInterdist(commonData.interdist);
      setDeplacement(commonData.deplacement);
    })();
  }, [draftId]);

  const data = speciesData[species];
  const stadesList = stadesFor(species, 'larve', null);
  
  // Calcul des totaux
  const totalPhases = totalLarvePhases(data);
  const totalStades = totalLarveStades(data);

  // Vérification des égalités - MODIFIÉ : accepte 0
  const isPhasesConsistent = data.totalCaptures === totalPhases;
  const isStadesConsistent = totalStades === data.totalCaptures;
  const isConsistent = isPhasesConsistent && isStadesConsistent;

  // Mise à jour des données par espèce
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

  const updateStade = (stade: string, value: number) => {
    setSpeciesData((prev) => ({
      ...prev,
      [species]: {
        ...prev[species],
        stades: { ...prev[species].stades, [stade]: value },
      },
    }));
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;

    // MODIFIÉ : accepte 0, donc plus de vérification > 0
    // On vérifie juste la cohérence
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

    setIsSaving(true);
    try {
      // Données communes
      const commonData = { tl, bl, interdist, deplacement };
      
      // Sauvegarder les données pour LMC et NSE
      await Promise.all([
        saveProspectionPopulation(draftId, larveSpeciesDataToPopulationRow('LMC', speciesData.LMC, commonData)),
        saveProspectionPopulation(draftId, larveSpeciesDataToPopulationRow('NSE', speciesData.NSE, commonData)),
      ]);
      router.push({ pathname: '/(prospection)/extensive-observations' as any, params: { draftId } });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde des données.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
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

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
          {/* 1. Nombre total de captures */}
          <View style={styles.totalCaptureSection}>
            <Text style={styles.sectionLabel}>📝 Nombre total de captures</Text>
            <View style={styles.totalCaptureInputContainer}>
              <TextInput
                value={String(data.totalCaptures)}
                onChangeText={(text) => {
                  const val = Number.parseInt(text, 10);
                  // Si la valeur est NaN (champ vide), on met 0
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

          {/* 2. Phases - Bloc réutilisé de imagos */}
          <View style={styles.phaseSection}>
            <Text style={styles.sectionLabel}>📊 Phases</Text>
            <View style={{ gap: 6, marginBottom: 8 }}>
              {PHASE_ROWS.map(({ key, label }) => {
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
            {!isPhasesConsistent && (
              <Text style={styles.errorText}>
                La somme des phases doit être égale au nombre de captures ({data.totalCaptures})
              </Text>
            )}
          </View>

          {/* 3. Stades larvaires */}
          <View style={styles.stadesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>📊 Stades larvaires</Text>
              <Text style={[styles.sectionCount, !isStadesConsistent && styles.errorCount]}>
                {totalStades}
              </Text>
            </View>
            
            <View style={styles.stadesGrid}>
              {stadesList.map((stade) => {
                const count = data.stades[stade] || 0;
                return (
                  <View key={stade} style={styles.stadeRow}>
                    <Text style={styles.stadeLabel}>{stade}</Text>
                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => {
                          if (count > 0) updateStade(stade, count - 1);
                        }}
                        disabled={count === 0}
                      >
                        <Text style={styles.counterButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{count}</Text>
                      <TouchableOpacity
                        style={[styles.counterButton, styles.counterButtonAdd, totalStades >= data.totalCaptures && styles.counterButtonDisabled]}
                        onPress={() => {
                          if (totalStades < data.totalCaptures) {
                            updateStade(stade, count + 1);
                          } else {
                            Alert.alert('Limite atteinte', `Le total des stades a déjà atteint ${data.totalCaptures}.`);
                          }
                        }}
                        disabled={totalStades >= data.totalCaptures}
                      >
                        <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.stadesSummary}>
              <Text style={styles.summaryText}>
                Total stades : {totalStades}
              </Text>
            </View>
            
            {!isStadesConsistent && (
              <Text style={styles.errorText}>
                La somme des stades doit être égale au nombre de captures ({data.totalCaptures})
              </Text>
            )}
          </View>

          {/* 4. Données communes : TL, BL, Interdist, Déplacement */}
          <View style={styles.commonSection}>
            <Text style={styles.sectionLabel}>📊 Observations communes</Text>
            
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.markCard, tl && styles.markCardActive]}
                onPress={() => setTl(!tl)}
                activeOpacity={0.85}
              >
                <Text style={styles.markLabel}>TL</Text>
                <Text style={[styles.markValue, tl && styles.markValueActive]}>{tl ? '✓' : '—'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.markCard, bl && styles.markCardActive]}
                onPress={() => setBl(!bl)}
                activeOpacity={0.85}
              >
                <Text style={styles.markLabel}>BL</Text>
                <Text style={[styles.markValue, bl && styles.markValueActive]}>{bl ? '✓' : '—'}</Text>
              </TouchableOpacity>
              <View style={[styles.card, { flex: 1.4 }]}>
                <Text style={styles.label}>Interdist. m</Text>
                <TextInput
                  value={interdist}
                  onChangeText={setInterdist}
                  keyboardType="decimal-pad"
                  style={styles.inputMono}
                  placeholder="0"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Déplacement</Text>
            <View style={[styles.chipsRow, { marginBottom: 16 }]}>
              {DEPLACEMENT_OPTIONS.map((option) => {
                const active = option.value === deplacement;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={{ flex: 1 }}
                    onPress={() => setDeplacement(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Récapitulatif */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>📋 Récapitulatif</Text>
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
              <Text style={styles.summaryLabel}>3. Stades larvaires :</Text>
              <Text style={[styles.summaryValue, isStadesConsistent ? styles.summaryValueValid : styles.summaryValueInvalid]}>
                {totalStades} {isStadesConsistent ? '✅' : '❌'}
              </Text>
            </View>
            <View style={styles.ruleBox}>
              <Text style={styles.ruleText}>Règle : Captures = Phases = Stades</Text>
            </View>
          </View>

          {/* Message de validation */}
          {isConsistent ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✅ COHÉRENT</Text>
              <Text style={styles.successDetail}>
                {data.totalCaptures} captures = {totalPhases} phases = {totalStades} stades
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

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.continueButton, (!isConsistent) && styles.continueButtonDisabled]} 
            onPress={handleContinue} 
            disabled={isSaving || !isConsistent} 
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Suivant : Observations ›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  speciesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  speciesButton: { flex: 1, borderRadius: 10, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  speciesButtonActive: { backgroundColor: GREEN, borderWidth: 0 },
  speciesButtonText: { fontSize: 13, fontWeight: '800', color: TEXT_SECONDARY },
  speciesButtonTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  
  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, marginTop: 4 },
  sectionLabel: { fontSize: 9.5, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginTop: 4 },
  sectionCount: { fontSize: 13, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  errorCount: { color: '#d32f2f' },
  errorText: { fontSize: 11, color: '#d32f2f', marginTop: 4, marginBottom: 4 },
  
  // Total Captures
  totalCaptureSection: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  totalCaptureInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCaptureInput: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '700', color: TEXT },
  totalCaptureInfo: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  
  // Phases - Bloc réutilisé de imagos
  phaseSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 13 },
  phaseRowActive: { borderWidth: 2, borderColor: GREEN, paddingVertical: 6, paddingLeft: 13 },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  phaseLabelActive: { fontWeight: '700', color: TEXT },
  phaseStaticCount: { fontSize: 13, fontWeight: '600', color: TEXT, fontFamily: 'monospace' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORDER },
  totalLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, marginRight: 8 },
  totalValue: { fontSize: 13, fontWeight: '700', color: GREEN, fontFamily: 'monospace' },
  
  // Stades
  stadesSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  stadesGrid: { gap: 6 },
  stadeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  stadeLabel: { fontSize: 13, fontWeight: '500', color: TEXT },
  stadesSummary: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  summaryText: { fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  
  // Données communes
  commonSection: { marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  markCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 9, padding: 8, alignItems: 'center' },
  markCardActive: { backgroundColor: '#f6f3e9', borderWidth: 0 },
  markLabel: { fontSize: 9, fontWeight: '500', color: '#9a9484' },
  markValue: { fontSize: 13, fontWeight: '700', color: '#bdb6a2' },
  markValueActive: { color: TEXT },
  card: { backgroundColor: '#f6f3e9', borderRadius: 9, padding: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484' },
  inputMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, overflow: 'hidden', textAlign: 'center' },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  
  // Counter
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  counterButton: { width: 32, height: 32, borderRadius: 9, backgroundColor: INACTIVE_BG, alignItems: 'center', justifyContent: 'center' },
  counterButtonAdd: { backgroundColor: GREEN },
  counterButtonDisabled: { opacity: 0.4 },
  counterButtonText: { fontSize: 17, fontWeight: '700', color: TEXT_SECONDARY },
  counterButtonAddText: { color: '#fff' },
  counterValue: { fontSize: 17, fontWeight: '700', color: TEXT, minWidth: 16, textAlign: 'center', fontFamily: 'monospace' },
  
  // Summary
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
  
  // Messages de validation
  warningContainer: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#fca5a5' },
  warningText: { color: '#dc2626', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  warningDetail: { color: '#dc2626', fontSize: 12, textAlign: 'center', marginTop: 5, lineHeight: 18 },
  warningHint: { color: '#dc2626', fontSize: 11, textAlign: 'center', marginTop: 5, fontStyle: 'italic' },
  successContainer: { backgroundColor: '#dcfce7', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#86efac' },
  successText: { color: '#15803d', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  successDetail: { color: '#15803d', fontSize: 12, textAlign: 'center', marginTop: 3, lineHeight: 18 },
  
  // Footer
  footer: { padding: 16 },
  continueButton: { backgroundColor: AMBER, borderRadius: 13, padding: 14, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: TEXT, fontWeight: '800', fontSize: 14 },
});