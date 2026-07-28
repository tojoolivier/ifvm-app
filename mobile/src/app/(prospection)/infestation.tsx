import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionInfestation, DraftProspection } from '@/lib/prospection-repository';
import {
  EMPTY_INFESTATION_DESCRIPTION,
  InfestationDescriptionState,
  TYPE_CIBLE_OPTIONS,
  TypeCible,
  isInfestationDescriptionComplete,
  parseInfestationDescription,
  saveInfestationDescription,
} from '@/lib/prospection-infestation';
import { parseEspeceSelection } from '@/lib/prospection-especes';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

const ESPECE_OPTIONS = [
  { value: 'LMC', label: 'LMC' },
  { value: 'NSE', label: 'NSE' },
];

type NextRoute = 'plan' | 'vegetation' | 'essaim' | 'pullulation';

export default function InfestationDescriptionScreen() {
  const router = useRouter();
  const { draftId, next } = useLocalSearchParams<{ draftId: string; next: NextRoute }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<InfestationDescriptionState>(EMPTY_INFESTATION_DESCRIPTION);
  const [selectedEspece, setSelectedEspece] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const infestation = await getProspectionInfestation(row.id);
      const parsed = parseInfestationDescription(infestation);
      setState(parsed);
      setSelectedEspece(infestation?.espece ?? null);
    });
  }, [draftId]);

  const canContinue = isInfestationDescriptionComplete(state) && !isSaving;

  const handleContinuer = async () => {
    if (!draft || !isInfestationDescriptionComplete(state)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveInfestationDescription(draft.id, state, selectedEspece || undefined);
      
      // Déterminer la prochaine étape
      const nextRoute = next || 'vegetation';
      router.push({
        // @ts-ignore
        pathname: `/(prospection)/infestation-comportement`,
        params: { draftId: draft.id, next: nextRoute },
      });
    } catch (error) {
      console.error('Erreur sauvegarde infestation:', error);
      setSaveError('Impossible d’enregistrer la description localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    // Déterminer d'où on vient
    const hasInfestation = (draft.surf_infestee ?? 0) > 0;
    const backRoute = hasInfestation ? 'plan' : 'vegetation';
    router.push({
      // @ts-ignore
      pathname: `/(prospection)/${backRoute}`,
      params: { draftId: draft.id }
    });
  };

  // Vérifier quelles espèces sont sélectionnées
  const availableEspeces = (() => {
    if (!draft) return [];
    const selection = parseEspeceSelection(draft.especes);
    const result = [];
    if (selection.lmcImago || selection.lmcLarve) result.push('LMC');
    if (selection.nseImago || selection.nseLarve) result.push('NSE');
    return result;
  })();

  const hasEspecesSelectionnees = availableEspeces.length > 0;

  if (!draft) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Infestation — Description</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '85%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Espèce concernée */}
        {hasEspecesSelectionnees && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Espèce concernée</Text>
            <View style={styles.chipsRow}>
              {ESPECE_OPTIONS
                .filter(opt => availableEspeces.includes(opt.value))
                .map((option) => {
                  const active = selectedEspece === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedEspece(active ? null : option.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
            {!selectedEspece && (
              <Text style={styles.hintText}>
                💡 Sélectionnez une espèce si l'infestation est spécifique
              </Text>
            )}
          </View>
        )}

        {/* Type de cible */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type de cible *</Text>
          <View style={styles.chipsRow}>
            {TYPE_CIBLE_OPTIONS.map((option) => {
              const active = state.typeCible === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, typeCible: option.value as TypeCible }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!state.typeCible && (
            <Text style={styles.requiredHint}>* Obligatoire</Text>
          )}
        </View>

        {/* Taille */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Taille (m)</Text>
          <View style={styles.tailleRow}>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Min</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.tailleMin}
                onChangeText={(v) => setState((p) => ({ ...p, tailleMin: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Max</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.tailleMax}
                onChangeText={(v) => setState((p) => ({ ...p, tailleMax: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Moy</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.tailleMoy}
                onChangeText={(v) => setState((p) => ({ ...p, tailleMoy: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Surface totale */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Surface totale (ha)</Text>
          <NumberField 
            label="Surface" 
            value={state.surfaceTot} 
            onChangeText={(v) => setState((p) => ({ ...p, surfaceTot: v }))} 
          />
        </View>

        {/* Densité */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Densité (/m²)</Text>
          <View style={styles.tailleRow}>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Min</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.densiteMin}
                onChangeText={(v) => setState((p) => ({ ...p, densiteMin: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Max</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.densiteMax}
                onChangeText={(v) => setState((p) => ({ ...p, densiteMax: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.tailleField}>
              <Text style={styles.tailleLabel}>Moy</Text>
              <TextInput
                style={styles.tailleInput}
                value={state.densiteMoy}
                onChangeText={(v) => setState((p) => ({ ...p, densiteMoy: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Interdistance */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Interdistance (m)</Text>
          <NumberField
            label="Moyenne"
            value={state.interdistance}
            onChangeText={(v) => setState((p) => ({ ...p, interdistance: v }))}
          />
        </View>

        {/* Résumé */}
        {state.typeCible && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Résumé</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>
                {TYPE_CIBLE_OPTIONS.find(o => o.value === state.typeCible)?.label}
              </Text>
            </View>
            {selectedEspece && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Espèce</Text>
                <Text style={styles.summaryValue}>{selectedEspece}</Text>
              </View>
            )}
            {state.surfaceTot && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Surface</Text>
                <Text style={styles.summaryValue}>{state.surfaceTot} ha</Text>
              </View>
            )}
          </View>
        )}

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
            onPress={handleContinuer}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.btnContinuerText}>
              {isSaving ? '⏳ Enregistrement…' : 'Continuer →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
      />
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
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase' 
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
  hintText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  requiredHint: {
    color: '#DC2626',
    fontSize: 11,
    marginTop: 6,
  },
  fieldRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 6 
  },
  rowLabel: { 
    color: '#6B7280', 
    fontSize: 13 
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
    backgroundColor: '#FFFFFF',
  },
  tailleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tailleField: {
    flex: 1,
  },
  tailleLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginBottom: 4,
  },
  tailleInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  summaryValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
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