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

export default function EspecesScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [isLoading, setIsLoading] = useState(!!draftId);
  const [selection, setSelection] = useState<EspeceSelection>({
    lmcImago: false,
    lmcLarve: false,
    nseImago: false,
    nseLarve: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;

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
        >
          <Text style={styles.btnRetourText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.push({ 
            pathname: '/(prospection)/reference', 
            params: { draftId } 
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.backLink}>‹ Référence & position</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Espèces observées</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 2/4</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Locusta migratoria capito (LMC)</Text>
          <ToggleRow 
            label="Imagos" 
            active={selection.lmcImago} 
            onPress={() => toggle('lmcImago')} 
          />
          <ToggleRow 
            label="Larves" 
            active={selection.lmcLarve} 
            onPress={() => toggle('lmcLarve')} 
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Nomadacris septemfasciata (NSE)</Text>
          <ToggleRow 
            label="Imagos" 
            active={selection.nseImago} 
            onPress={() => toggle('nseImago')} 
          />
          <ToggleRow 
            label="Larves" 
            active={selection.nseLarve} 
            onPress={() => toggle('nseLarve')} 
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.grilleCount}>
            {grilleCount} grille{grilleCount > 1 ? 's' : ''} à remplir
          </Text>
          {!hasSelection(selection) && (
            <Text style={styles.hintText}>
              Sélectionnez au moins une espèce pour continuer
            </Text>
          )}
        </View>

        {saveError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnContinuer, !canContinue && styles.btnDisabled]}
          onPress={handleContinuer}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>
            {isSaving ? 'Enregistrement…' : 'Continuer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Composant ToggleRow optimisé avec memo
const ToggleRow = ({ label, active, onPress }: { 
  label: string; 
  active: boolean; 
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[styles.toggleRow, active && styles.toggleRowActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
        {label}
      </Text>
      <View style={[styles.toggleIndicator, active && styles.toggleIndicatorActive]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  centered: {
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
  backLink: { 
    color: '#FFFFFFCC', 
    fontSize: 13, 
    marginBottom: 6 
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
    paddingBottom: 100 
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
    backgroundColor: '#E8F3E8', 
    borderColor: IFVM_GREEN 
  },
  toggleLabel: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  toggleLabelActive: { 
    color: IFVM_GREEN_DARK 
  },
  toggleIndicator: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#D1D5DB' 
  },
  toggleIndicatorActive: { 
    backgroundColor: IFVM_GREEN, 
    borderColor: IFVM_GREEN 
  },
  grilleCount: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600', 
    textAlign: 'center' 
  },
  hintText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { 
    color: '#dc2626', 
    fontSize: 13,
    textAlign: 'center',
  },
  btnContinuer: { 
    backgroundColor: IFVM_GREEN, 
    borderRadius: 10, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 4 
  },
  btnDisabled: { 
    opacity: 0.5 
  },
  btnContinuerText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
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