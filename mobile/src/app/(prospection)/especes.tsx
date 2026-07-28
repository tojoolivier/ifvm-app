import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import {
  buildGrilles,
  countGrilles,
  hasSelection,
  parseEspeceSelection,
  saveEspeceSelection,
  EspeceSelection,
} from '@/lib/prospection-especes';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

export default function EspecesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selection, setSelection] = useState<EspeceSelection>({
    lmcImago: false,
    lmcLarve: false,
    nseImago: false,
    nseLarve: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) {
      setIsLoading(false);
      return;
    }
    
    const loadDraft = async () => {
      try {
        const row = await getProspection(draftId);
        setDraft(row);
        if (row) {
          setSelection(parseEspeceSelection(row.especes));
        }
      } catch (error) {
        console.error('Erreur lors du chargement du brouillon:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [draftId]);

  const grilleCount = useMemo(() => countGrilles(selection), [selection]);
  const canContinue = hasSelection(selection) && !isSaving;
  
  // Vérifier combien d'espèces sont sélectionnées
  const selectedCount = useMemo(() => {
    const keys = Object.keys(selection) as (keyof EspeceSelection)[];
    return keys.filter(key => selection[key]).length;
  }, [selection]);

  const toggle = (key: keyof EspeceSelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinuer = async () => {
    if (!draft || !hasSelection(selection)) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await saveEspeceSelection(draft.id, selection);
      const grilles = buildGrilles(selection);
      
      if (grilles.length > 1) {
        router.push({ 
          pathname: '/(prospection)/plan', 
          params: { draftId: draft.id } 
        });
      } else {
        router.push({ 
          pathname: '/(prospection)/captures', 
          params: { draftId: draft.id, grilleIndex: '0' } 
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      setSaveError("Impossible d'enregistrer la sélection localement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      pathname: '/(prospection)/reference',
      params: { draftId: draft.id }
    });
  };

  // État de chargement
  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={IFVM_GREEN} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // Pas de brouillon trouvé
  if (!draft) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.errorText}>Brouillon non trouvé</Text>
        <TouchableOpacity 
          style={styles.btnRetour}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.btnRetourText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Espèces observées</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Étape 2/4</Text>
          <Text style={styles.progressCount}>
            {selectedCount > 0 ? `${selectedCount} sélectionnée${selectedCount > 1 ? 's' : ''}` : 'Aucune sélection'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* LMC */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Locusta migratoria capito</Text>
            <Text style={styles.cardSubLabel}>LMC</Text>
          </View>
          <ToggleRow 
            label="Imagos" 
            active={selection.lmcImago} 
            onPress={() => toggle('lmcImago')}
            description="Adultes"
          />
          <ToggleRow 
            label="Larves" 
            active={selection.lmcLarve} 
            onPress={() => toggle('lmcLarve')}
            description="Stades larvaires"
          />
        </View>

        {/* NSE */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Nomadacris septemfasciata</Text>
            <Text style={styles.cardSubLabel}>NSE</Text>
          </View>
          <ToggleRow 
            label="Imagos" 
            active={selection.nseImago} 
            onPress={() => toggle('nseImago')}
            description="Adultes"
          />
          <ToggleRow 
            label="Larves" 
            active={selection.nseLarve} 
            onPress={() => toggle('nseLarve')}
            description="Stades larvaires"
          />
        </View>

        {/* Récapitulatif */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Grilles à remplir</Text>
            <Text style={styles.summaryValue}>{grilleCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sélections</Text>
            <Text style={styles.summaryValue}>{selectedCount}</Text>
          </View>
          {!hasSelection(selection) && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>⚠️ Sélectionnez au moins une espèce pour continuer</Text>
            </View>
          )}
          {hasSelection(selection) && grilleCount === 1 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>💡 Une seule grille à remplir</Text>
            </View>
          )}
          {hasSelection(selection) && grilleCount > 1 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>📋 {grilleCount} grilles à remplir dans le plan de relevé</Text>
            </View>
          )}
        </View>

        {saveError && (
          <View style={styles.errorContainer}>
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

// Composant ToggleRow optimisé
const ToggleRow = ({ 
  label, 
  active, 
  onPress,
  description
}: { 
  label: string; 
  active: boolean; 
  onPress: () => void;
  description?: string;
}) => {
  return (
    <TouchableOpacity
      style={[styles.toggleRow, active && styles.toggleRowActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.toggleLeft}>
        <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
          {label}
        </Text>
        {description && (
          <Text style={styles.toggleDescription}>{description}</Text>
        )}
      </View>
      <View style={[styles.toggleIndicator, active && styles.toggleIndicatorActive]}>
        {active && <View style={styles.toggleIndicatorDot} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
    color: '#FFFFFFAA',
    fontSize: 11,
  },
  content: { 
    flex: 1 
  },
  contentContainer: { 
    padding: 16, 
    paddingBottom: 100 
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    textTransform: 'uppercase' 
  },
  cardSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IFVM_GREEN,
    backgroundColor: IFVM_GREEN_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 6,
  },
  toggleRowActive: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  toggleLeft: {
    flex: 1,
  },
  toggleLabel: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  toggleLabelActive: { 
    color: IFVM_GREEN_DARK 
  },
  toggleDescription: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  toggleIndicator: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIndicatorActive: { 
    backgroundColor: IFVM_GREEN, 
    borderColor: IFVM_GREEN 
  },
  toggleIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  warningText: {
    color: '#92400E',
    fontSize: 12,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  infoText: {
    color: '#0369A1',
    fontSize: 12,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    textAlign: 'center',
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
  btnRetour: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  btnRetourText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});