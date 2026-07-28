import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionPopulation, DraftProspection } from '@/lib/prospection-repository';
import { parseEspeceSelection } from '@/lib/prospection-especes';
import {
  DensitesState,
  EMPTY_DENSITES,
  METHODE_OPTIONS,
  MethodeMesure,
  parseDensites,
  saveDensites,
} from '@/lib/prospection-densites';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

type NextRoute = 'plan' | 'infestation' | 'vegetation' | 'essaim' | 'pullulation';

export default function DensitesScreen() {
  const router = useRouter();
  const { draftId, espece, next } = useLocalSearchParams<{
    draftId: string;
    espece: 'LMC' | 'NSE';
    next: NextRoute;
  }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<DensitesState>(EMPTY_DENSITES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !espece) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const [imago, larve] = await Promise.all([
        getProspectionPopulation(row.id, espece, 'imago'),
        getProspectionPopulation(row.id, espece, 'larve'),
      ]);
      setState(parseDensites(imago, larve));
    });
  }, [draftId, espece]);

  const hasImago = useMemo(() => {
    if (!draft) return false;
    const selection = parseEspeceSelection(draft.especes);
    return espece === 'LMC' ? selection.lmcImago : selection.nseImago;
  }, [draft, espece]);

  const hasLarve = useMemo(() => {
    if (!draft) return false;
    const selection = parseEspeceSelection(draft.especes);
    return espece === 'LMC' ? selection.lmcLarve : selection.nseLarve;
  }, [draft, espece]);

  // Vérifier si au moins une densité est renseignée
  const hasDensite = useMemo(() => {
    return state.diffuseImago !== '' || state.diffuseLarve !== '' || 
           state.groupeeImago !== '' || state.groupeeLarve !== '';
  }, [state]);

  const handleContinuer = async () => {
    if (!draft || !espece) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveDensites(draft.id, espece, state);
      
      if (hasImago) {
        router.push({
          // @ts-ignore
          pathname: '/(prospection)/reproduction',
          params: { draftId: draft.id, espece, next },
        });
      } else {
        const nextRoute = next || 'vegetation';
        router.push({
          // @ts-ignore
          pathname: `/(prospection)/${nextRoute}`,
          params: { draftId: draft.id },
        });
      }
    } catch (error) {
      console.error('Erreur sauvegarde densités:', error);
      setSaveError('Impossible d’enregistrer les densités localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      // @ts-ignore
      pathname: '/(prospection)/captures',
      params: { draftId: draft.id, grilleIndex: '0' }
    });
  };

  if (!draft || !espece) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Densités — {espece}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Étape 3/4</Text>
          {hasDensite && (
            <Text style={styles.progressCount}>✅ Renseigné</Text>
          )}
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Contexte */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Contexte</Text>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Espèce</Text>
            <Text style={styles.contextValue}>{espece}</Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Imagos</Text>
            <Text style={styles.contextValue}>{hasImago ? '✅ Sélectionnées' : '❌ Non sélectionnées'}</Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Larves</Text>
            <Text style={styles.contextValue}>{hasLarve ? '✅ Sélectionnées' : '❌ Non sélectionnées'}</Text>
          </View>
        </View>

        {/* Population diffuse */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Population diffuse (/ha)</Text>
          {hasImago && (
            <DensiteField
              label="Imagos"
              value={state.diffuseImago}
              onChangeText={(v) => setState((prev) => ({ ...prev, diffuseImago: v }))}
            />
          )}
          {hasLarve && (
            <DensiteField
              label="Larves"
              value={state.diffuseLarve}
              onChangeText={(v) => setState((prev) => ({ ...prev, diffuseLarve: v }))}
            />
          )}
          {!hasImago && !hasLarve && (
            <Text style={styles.hintText}>Aucune catégorie sélectionnée pour cette espèce</Text>
          )}
        </View>

        {/* Population groupée */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Population groupée « taches / bandes » (/m²)</Text>
          {hasImago && (
            <DensiteField
              label="Imagos"
              value={state.groupeeImago}
              onChangeText={(v) => setState((prev) => ({ ...prev, groupeeImago: v }))}
            />
          )}
          {hasLarve && (
            <DensiteField
              label="Larves"
              value={state.groupeeLarve}
              onChangeText={(v) => setState((prev) => ({ ...prev, groupeeLarve: v }))}
            />
          )}
        </View>

        {/* Méthode de mesure */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Méthode de mesure</Text>
          <View style={styles.chipsRow}>
            {METHODE_OPTIONS.map((option) => {
              const active = state.methode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ 
                    ...prev, 
                    methode: prev.methode === option.value ? null : option.value as MethodeMesure 
                  }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Résumé */}
        {hasDensite && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Résumé</Text>
            {state.diffuseImago && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diffuse Imagos</Text>
                <Text style={styles.summaryValue}>{state.diffuseImago} /ha</Text>
              </View>
            )}
            {state.diffuseLarve && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diffuse Larves</Text>
                <Text style={styles.summaryValue}>{state.diffuseLarve} /ha</Text>
              </View>
            )}
            {state.groupeeImago && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Groupée Imagos</Text>
                <Text style={styles.summaryValue}>{state.groupeeImago} /m²</Text>
              </View>
            )}
            {state.groupeeLarve && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Groupée Larves</Text>
                <Text style={styles.summaryValue}>{state.groupeeLarve} /m²</Text>
              </View>
            )}
            {state.methode && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Méthode</Text>
                <Text style={styles.summaryValue}>
                  {METHODE_OPTIONS.find(o => o.value === state.methode)?.label}
                </Text>
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
            style={[styles.btn, styles.btnContinuer, isSaving && styles.btnDisabled]} 
            onPress={handleContinuer} 
            disabled={isSaving} 
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

function DensiteField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  const hasValue = value && value !== '';
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, hasValue && styles.fieldInputFilled]}
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
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
  },
  progressCount: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '600',
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
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contextLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  contextValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
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
  fieldInputFilled: {
    borderColor: IFVM_GREEN,
    backgroundColor: IFVM_GREEN_LIGHT,
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
  hintText: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
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
    backgroundColor: '#6B7280',
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
    opacity: 0.6,
  },
});