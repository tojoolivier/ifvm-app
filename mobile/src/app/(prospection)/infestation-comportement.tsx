import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionInfestation, DraftProspection } from '@/lib/prospection-repository';
import {
  COMPORTEMENT_OPTIONS,
  Comportement,
  DIRECTION_OPTIONS,
  Direction,
  EMPTY_INFESTATION_COMPORTEMENT,
  InfestationComportementState,
  parseInfestationComportement,
  saveInfestationComportement,
  TYPE_CIBLE_OPTIONS,
} from '@/lib/prospection-infestation';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

type NextRoute = 'plan' | 'vegetation' | 'essaim' | 'pullulation';

export default function InfestationComportementScreen() {
  const router = useRouter();
  const { draftId, next } = useLocalSearchParams<{ draftId: string; next: NextRoute }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<InfestationComportementState>(EMPTY_INFESTATION_COMPORTEMENT);
  const [typeCible, setTypeCible] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const infestation = await getProspectionInfestation(row.id);
      setState(parseInfestationComportement(infestation));
      setTypeCible(infestation?.type_cible ?? null);
    });
  }, [draftId]);

  const handleContinuer = async () => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveInfestationComportement(draft.id, state);
      
      const nextRoute = next ?? 'vegetation';
      router.push({
        // @ts-ignore
        pathname: `/(prospection)/${nextRoute}`,
        params: { draftId: draft.id }
      });
    } catch (error) {
      console.error('Erreur sauvegarde comportement:', error);
      setSaveError('Impossible d’enregistrer le comportement localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      // @ts-ignore
      pathname: '/(prospection)/infestation',
      params: { draftId: draft.id, next }
    });
  };

  const hasDescription = typeCible !== null;

  if (!draft) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Infestation — Comportement</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '90%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 4/4</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Contexte - Description déjà saisie */}
        {hasDescription && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Description saisie</Text>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Type de cible</Text>
              <Text style={styles.contextValue}>
                {TYPE_CIBLE_OPTIONS.find(o => o.value === typeCible)?.label || typeCible}
              </Text>
            </View>
          </View>
        )}

        {!hasDescription && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Aucune description d'infestation saisie. Revenir en arrière pour compléter.
            </Text>
          </View>
        )}

        {/* État */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>État</Text>
          <View style={styles.chipsRow}>
            {COMPORTEMENT_OPTIONS.map((option) => {
              const active = state.comportement === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, comportement: option.value as Comportement }))}
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

        {/* Direction du déplacement */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Direction du déplacement</Text>
          <View style={styles.chipsRow}>
            {DIRECTION_OPTIONS.map((option) => {
              const active = state.directionVers === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, directionVers: option.value as Direction }))}
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

        {/* Vent — direction */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vent — direction</Text>
          <View style={styles.chipsRow}>
            {DIRECTION_OPTIONS.map((option) => {
              const active = state.ventDe === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setState((prev) => ({ ...prev, ventDe: option.value as Direction }))}
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

        {/* Vent — vitesse */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vent — vitesse (km/h)</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Vitesse</Text>
            <TextInput
              style={styles.fieldInput}
              value={state.ventVitesse}
              onChangeText={(v) => setState((prev) => ({ ...prev, ventVitesse: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Résumé des sélections */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Résumé</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>État</Text>
            <Text style={styles.summaryValue}>
              {state.comportement 
                ? COMPORTEMENT_OPTIONS.find(o => o.value === state.comportement)?.label 
                : 'Non renseigné'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Direction</Text>
            <Text style={styles.summaryValue}>
              {state.directionVers || 'Non renseignée'}
            </Text>
          </View>
          {state.ventDe && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vent</Text>
              <Text style={styles.summaryValue}>
                {state.ventDe} {state.ventVitesse ? `• ${state.ventVitesse} km/h` : ''}
              </Text>
            </View>
          )}
        </View>

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
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
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
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
    textAlign: 'center',
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