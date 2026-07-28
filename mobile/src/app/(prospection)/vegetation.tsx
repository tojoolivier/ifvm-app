import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, PanResponder, LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, DraftProspection, updateProspectionVegetation } from '@/lib/prospection-repository';
import {
  DEFAULT_VEGETATION_SOL,
  DEGATS_OPTIONS,
  DegatsCultures,
  HUMIDITE_OPTIONS,
  Humidite,
  PHENOLOGIE_OPTIONS,
  Phenologie,
  STRATES_DETAILLABLES,
  STRATE_KEYS,
  STRATE_LABELS,
  StrateKey,
  TEXTURE_OPTIONS,
  Texture,
  VegetationSolState,
  clampRecouvrement,
  isVegetationSolComplete,
  parseVegetationSol,
  saveVegetationSol,
  totalRecouvrement,
} from '@/lib/prospection-vegetation';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<VegetationSolState>(DEFAULT_VEGETATION_SOL);
  const [expanded, setExpanded] = useState<StrateKey | null>(null);
  
  // Champs généraux de la migration 0005
  const [verdissement, setVerdissement] = useState<string>('');
  const [hauteurStrate, setHauteurStrate] = useState<string>('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then((row) => {
      setDraft(row);
      if (row) {
        setState(parseVegetationSol(row.vegetation, row.sol, row.degats_cultures));
        setVerdissement(row.verdissement?.toString() ?? '');
        setHauteurStrate(row.hauteur_strate?.toString() ?? '');
      }
    });
  }, [draftId]);

  const canContinue = isVegetationSolComplete(state) && !isSaving;
  const backRoute = (draft?.surf_infestee ?? 0) > 0 ? 'infestation-comportement' : 'captures';
  const total = totalRecouvrement(state.strates);
  const totalOk = total === 100;

  const updateStrate = (key: StrateKey, patch: Partial<{ recouvrement: number; phenologie: Phenologie; hauteur: number | null }>) => {
    setState((prev) => ({
      ...prev,
      strates: { ...prev.strates, [key]: { ...prev.strates[key], ...patch } },
    }));
  };

  const handleVerifierEtEnregistrer = async () => {
    if (!draft || !isVegetationSolComplete(state)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Sauvegarder d'abord la végétation/sol
      await saveVegetationSol(draft.id, state);
      
      // Puis sauvegarder les champs généraux
      await updateProspectionVegetation(draft.id, {
        vegetation: JSON.stringify({ strates: state.strates }),
        sol: JSON.stringify({ humidite: state.humidite, texture: state.texture }),
        degatsCultures: state.degatsCultures,
        verdissement: verdissement ? parseFloat(verdissement.replace(',', '.')) : null,
        hauteurStrate: hauteurStrate ? parseFloat(hauteurStrate.replace(',', '.')) : null,
      });
      
      router.push({ 
        pathname: '/(prospection)/recapitulatif', 
        params: { draftId: draft.id } 
      });
    } catch (error) {
      console.error('Erreur sauvegarde végétation:', error);
      setSaveError('Impossible d’enregistrer la végétation & sol localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      // @ts-ignore
      pathname: `/(prospection)/${backRoute}`,
      params: { draftId: draft.id }
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Végétation & sol</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Recouvrement des strates */}
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.cardLabel}>Recouvrement des strates</Text>
            <Text style={[styles.totalValue, totalOk ? styles.totalValueOk : styles.totalValueError]}>
              {total}% / 100%
            </Text>
          </View>
          {!totalOk && (
            <Text style={styles.errorText}>Le total des recouvrements doit atteindre 100%.</Text>
          )}
        </View>

        {/* Strates */}
        {STRATE_KEYS.map((key) => {
          const detail = state.strates[key];
          const isDetaillable = STRATES_DETAILLABLES.includes(key);
          const isExpanded = expanded === key;
          return (
            <View key={key} style={styles.card}>
              <TouchableOpacity
                onPress={() => isDetaillable && setExpanded(isExpanded ? null : key)}
                activeOpacity={isDetaillable ? 0.7 : 1}
                style={styles.strateHeader}
              >
                <Text style={styles.cardLabel}>{STRATE_LABELS[key]}</Text>
                {isDetaillable && <Text style={styles.expandToggle}>{isExpanded ? '▲' : '▼'}</Text>}
              </TouchableOpacity>
              <RecouvrementSlider
                value={detail.recouvrement}
                onChange={(v) => updateStrate(key, { recouvrement: v })}
              />

              {isDetaillable && isExpanded && (
                <View style={styles.strateDetail}>
                  <Text style={styles.detailLabel}>Phénologie</Text>
                  <View style={styles.chipsRow}>
                    {PHENOLOGIE_OPTIONS.map((option) => {
                      const active = detail.phenologie === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => updateStrate(key, { phenologie: option.value })}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.detailLabel}>Hauteur (m)</Text>
                  <TextInput
                    style={styles.hauteurInput}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    value={detail.hauteur !== null ? String(detail.hauteur) : ''}
                    onChangeText={(text) => {
                      const parsed = parseFloat(text.replace(',', '.'));
                      updateStrate(key, { hauteur: Number.isFinite(parsed) ? parsed : null });
                    }}
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* Champs généraux - Migration 0005 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Végétation générale</Text>
          
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Verdissement (%)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="decimal-pad"
              placeholder="0.0"
              value={verdissement}
              onChangeText={setVerdissement}
            />
          </View>
          
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Hauteur strate (m)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="decimal-pad"
              placeholder="0.0"
              value={hauteurStrate}
              onChangeText={setHauteurStrate}
            />
          </View>
        </View>

        {/* Humidité du sol */}
        <SingleChoiceCard<Humidite>
          label="Humidité du sol"
          options={HUMIDITE_OPTIONS}
          selected={state.humidite}
          onSelect={(humidite) => setState((prev) => ({ ...prev, humidite }))}
        />

        {/* Texture du sol */}
        <SingleChoiceCard<Texture>
          label="Texture du sol"
          options={TEXTURE_OPTIONS}
          selected={state.texture}
          onSelect={(texture) => setState((prev) => ({ ...prev, texture }))}
        />

        {/* Dégâts sur culture */}
        <SingleChoiceCard<DegatsCultures>
          label="Dégâts sur culture"
          options={DEGATS_OPTIONS}
          selected={state.degatsCultures}
          onSelect={(degatsCultures) => setState((prev) => ({ ...prev, degatsCultures }))}
        />

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {/* Boutons en bas - même taille */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner, isSaving && styles.btnDisabled]}
            onPress={handleRetour}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnContinuer, !canContinue && styles.btnDisabled]}
            onPress={handleVerifierEtEnregistrer}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.btnContinuerText}>
              {isSaving ? '⏳ Enregistrement…' : '✅ Enregistrer'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function RecouvrementSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackWidthRef = useRef(1);

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width || 1;
  };

  const updateFromLocationX = (locationX: number) => {
    const percent = (locationX / trackWidthRef.current) * 100;
    onChange(clampRecouvrement(percent));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromLocationX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => updateFromLocationX(evt.nativeEvent.locationX),
    })
  ).current;

  return (
    <View>
      <View style={styles.sliderTrack} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={styles.sliderTrackBackground} />
        <View style={[styles.sliderFill, { width: `${value}%` }]} />
        <View style={[styles.sliderThumb, { left: `${value}%` }]} />
      </View>
      <Text style={styles.sliderValue}>{value}%</Text>
    </View>
  );
}

function SingleChoiceCard<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.chipsRow}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(option.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  header: { 
    backgroundColor: IFVM_GREEN_DARK, 
    paddingHorizontal: 16, 
    paddingBottom: 14 
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 10 
  },
  progressTrack: { 
    height: 4, 
    backgroundColor: '#FFFFFF33', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: 4, 
    backgroundColor: '#FFFFFF' 
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
    marginTop: 4 
  },
  content: { 
    flex: 1 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12 
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase' 
  },
  totalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  totalValue: { 
    fontSize: 13, 
    fontWeight: '700' 
  },
  totalValueOk: { 
    color: IFVM_GREEN 
  },
  totalValueError: { 
    color: '#dc2626' 
  },
  strateHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  expandToggle: { 
    fontSize: 12, 
    color: '#6B7280' 
  },
  strateDetail: { 
    marginTop: 10, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#E5E7EB' 
  },
  detailLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginTop: 8, 
    marginBottom: 6, 
    textTransform: 'uppercase' 
  },
  hauteurInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  sliderTrack: {
    height: 32,
    justifyContent: 'center',
  },
  sliderTrackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: IFVM_GREEN,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: IFVM_GREEN,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sliderValue: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600', 
    marginTop: 4, 
    textAlign: 'right' 
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    textAlign: 'right',
    color: '#111827',
    fontSize: 13,
    backgroundColor: '#FFFFFF',
  },
  chipsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  chipText: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  chipTextActive: { 
    color: IFVM_GREEN_DARK 
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  btnContinuer: { 
    backgroundColor: IFVM_GREEN,
  },
  btnRetourner: {
    backgroundColor: '#6B7280', // Gris pour le retour
  },
  btnRetournerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnContinuerText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  btnDisabled: { 
    opacity: 0.5 
  },
});