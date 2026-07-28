import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, getProspectionPopulation, DraftProspection } from '@/lib/prospection-repository';
import {
  EMPTY_REPRODUCTION,
  INTENSITE_OPTIONS,
  Intensite,
  ReproductionState,
  parseReproduction,
  saveReproduction,
} from '@/lib/prospection-densites';
import { parseEspeceSelection } from '@/lib/prospection-especes';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

// Type simplifié pour les routes
type NextRoute = 'infestation' | 'plan' | 'vegetation' | 'essaim' | 'pullulation';

export default function ReproductionScreen() {
  const router = useRouter();
  const { draftId, espece, next } = useLocalSearchParams<{
    draftId: string;
    espece: 'LMC' | 'NSE';
    next: NextRoute;
  }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [state, setState] = useState<ReproductionState>(EMPTY_REPRODUCTION);
  const [densiteDiffuse, setDensiteDiffuse] = useState<number | null>(null);
  const [densiteGroupee, setDensiteGroupee] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !espece) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (!row) return;
      const imago = await getProspectionPopulation(row.id, espece, 'imago');
      setState(parseReproduction(imago));
      setDensiteDiffuse(imago?.densite_diffuse ?? null);
      setDensiteGroupee(imago?.densite_groupee ?? null);
    });
  }, [draftId, espece]);

  const handleContinuer = async () => {
    if (!draft || !espece) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveReproduction(draft.id, espece, state);
      
      const nextRoute = next || 'vegetation';
      
      router.push({
        // @ts-ignore
        pathname: `/(prospection)/${nextRoute}`,
        params: { draftId: draft.id }
      });
    } catch (error) {
      console.error('Erreur sauvegarde reproduction:', error);
      setSaveError('Impossible d’enregistrer l’accouplement/ponte localement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      // @ts-ignore
      pathname: '/(prospection)/densites',
      params: { draftId: draft.id, espece, next }
    });
  };

  const hasSelection = state.accouplement !== null || state.ponte !== null;

  const hasImago = (() => {
    if (!draft || !espece) return false;
    const selection = parseEspeceSelection(draft.especes);
    return espece === 'LMC' ? selection.lmcImago : selection.nseImago;
  })();

  if (!draft || !espece) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Accouplement / Ponte — {espece}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '80%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 3/4</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte de contexte - Densités déjà saisies */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Densités saisies</Text>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Diffuse /ha</Text>
            <Text style={styles.contextValue}>
              {densiteDiffuse !== null ? densiteDiffuse.toFixed(2) : '—'}
            </Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Groupée /m²</Text>
            <Text style={styles.contextValue}>
              {densiteGroupee !== null ? densiteGroupee.toFixed(2) : '—'}
            </Text>
          </View>
          {!hasImago && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Aucune imago sélectionnée pour {espece}
              </Text>
            </View>
          )}
        </View>

        {/* Accouplement */}
        <IntensiteCard
          label="Accouplement"
          description="Niveau d'accouplement observé"
          selected={state.accouplement}
          onSelect={(accouplement) => setState((prev) => ({ ...prev, accouplement }))}
        />

        {/* Ponte */}
        <IntensiteCard
          label="Ponte"
          description="Niveau de ponte observé"
          selected={state.ponte}
          onSelect={(ponte) => setState((prev) => ({ ...prev, ponte }))}
        />

        {/* Résumé des sélections */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Résumé</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Accouplement</Text>
            <Text style={styles.summaryValue}>
              {state.accouplement 
                ? INTENSITE_OPTIONS.find(o => o.value === state.accouplement)?.label 
                : 'Non renseigné'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ponte</Text>
            <Text style={styles.summaryValue}>
              {state.ponte 
                ? INTENSITE_OPTIONS.find(o => o.value === state.ponte)?.label 
                : 'Non renseigné'}
            </Text>
          </View>
          {!hasSelection && (
            <Text style={styles.hintText}>
              💡 Au moins une information est recommandée
            </Text>
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

function IntensiteCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: Intensite | null;
  onSelect: (value: Intensite) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      {description && (
        <Text style={styles.cardDescription}>{description}</Text>
      )}
      <View style={styles.chipsRow}>
        {INTENSITE_OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(option.value)}
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
  cardDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
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
    minWidth: 60,
    alignItems: 'center',
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
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  warningText: {
    color: '#92400E',
    fontSize: 12,
    textAlign: 'center',
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