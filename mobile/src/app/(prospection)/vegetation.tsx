import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, PanResponder, LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
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

export default function VegetationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<VegetationSolState>(DEFAULT_VEGETATION_SOL);
  const [expanded, setExpanded] = useState<StrateKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then((row) => {
      setDraft(row);
      if (row) setState(parseVegetationSol(row.vegetation, row.sol, row.degats_cultures));
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
      await saveVegetationSol(draft.id, state);
      router.push({ pathname: '/(prospection)/recapitulatif', params: { draftId: draft.id } });
    } catch {
      setSaveError('Impossible d’enregistrer la végétation & sol localement');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push({ pathname: `/(prospection)/${backRoute}`, params: { draftId } })}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Végétation & sol</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
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

        <SingleChoiceCard<Humidite>
          label="Humidité du sol"
          options={HUMIDITE_OPTIONS}
          selected={state.humidite}
          onSelect={(humidite) => setState((prev) => ({ ...prev, humidite }))}
        />

        <SingleChoiceCard<Texture>
          label="Texture du sol"
          options={TEXTURE_OPTIONS}
          selected={state.texture}
          onSelect={(texture) => setState((prev) => ({ ...prev, texture }))}
        />

        <SingleChoiceCard<DegatsCultures>
          label="Dégâts sur culture"
          options={DEGATS_OPTIONS}
          selected={state.degatsCultures}
          onSelect={(degatsCultures) => setState((prev) => ({ ...prev, degatsCultures }))}
        />

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.btnContinuer, !canContinue && styles.btnDisabled]}
          onPress={handleVerifierEtEnregistrer}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Vérifier & enregistrer'}</Text>
        </TouchableOpacity>
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
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  backLink: { color: '#FFFFFFCC', fontSize: 13, marginBottom: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FFFFFF' },
  progressLabel: { color: '#FFFFFFAA', fontSize: 11, marginTop: 4 },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalValue: { fontSize: 13, fontWeight: '700' },
  totalValueOk: { color: IFVM_GREEN },
  totalValueError: { color: '#dc2626' },
  strateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expandToggle: { fontSize: 12, color: '#6B7280' },
  strateDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginTop: 8, marginBottom: 6, textTransform: 'uppercase' },
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
  sliderValue: { color: '#111827', fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'right' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  chipText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: IFVM_GREEN_DARK },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
