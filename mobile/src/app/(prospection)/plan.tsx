import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import { buildGrilles, parseEspeceSelection } from '@/lib/prospection-especes';
import {
  buildPlanItems,
  countTerminees,
  grilleLabel,
  isPlanComplete,
  parseGrillesCompletees,
  PlanItem,
  isEspeceComplete,
} from '@/lib/prospection-plan';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

export default function PlanScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    loadDraft();
  }, [draftId]);

  const loadDraft = async () => {
    setRefreshing(true);
    try {
      const row = await getProspection(draftId);
      setDraft(row);
    } catch (error) {
      console.error('Erreur chargement brouillon:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const grilles = useMemo(
    () => (draft ? buildGrilles(parseEspeceSelection(draft.especes)) : []),
    [draft]
  );
  
  const items: PlanItem[] = useMemo(
    () => buildPlanItems(grilles, parseGrillesCompletees(draft?.grilles_completees ?? null)),
    [grilles, draft]
  );
  
  const done = countTerminees(items);
  const complete = isPlanComplete(items);
  const progress = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  // Vérifier si chaque espèce est complète
  const lmcComplete = draft ? isEspeceComplete(grilles, parseGrillesCompletees(draft.grilles_completees), 'LMC') : false;
  const nseComplete = draft ? isEspeceComplete(grilles, parseGrillesCompletees(draft.grilles_completees), 'NSE') : false;

  const handleItemPress = (item: PlanItem) => {
    if (!draft) return;
    router.push({
      pathname: '/(prospection)/captures',
      params: { draftId: draft.id, grilleIndex: String(item.index) },
    });
  };

  const handleSuivant = () => {
    if (!draft || !complete) return;
    
    // Déterminer la prochaine étape en fonction des données
    const hasInfestation = (draft.surf_infestee ?? 0) > 0;
    const nextRoute = hasInfestation ? 'infestation' : 'vegetation';
    
    router.push({
      // @ts-ignore
      pathname: `/(prospection)/${nextRoute}`,
      params: { draftId: draft.id }
    });
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      pathname: '/(prospection)/especes',
      params: { draftId: draft.id }
    });
  };

  if (!draft) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Plan de relevé</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>
            {done}/{items.length} grille{done > 1 ? 's' : ''}
          </Text>
          <Text style={styles.progressLabel}>{progress}%</Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Résumé par espèce */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Progression par espèce</Text>
          <View style={styles.speciesRow}>
            <View style={styles.speciesItem}>
              <Text style={styles.speciesLabel}>LMC</Text>
              <View style={[styles.speciesBadge, lmcComplete ? styles.speciesComplete : styles.speciesPending]}>
                <Text style={styles.speciesBadgeText}>
                  {lmcComplete ? '✓ Complète' : '⏳ En cours'}
                </Text>
              </View>
            </View>
            <View style={styles.speciesItem}>
              <Text style={styles.speciesLabel}>NSE</Text>
              <View style={[styles.speciesBadge, nseComplete ? styles.speciesComplete : styles.speciesPending]}>
                <Text style={styles.speciesBadgeText}>
                  {nseComplete ? '✓ Complète' : '⏳ En cours'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Liste des grilles */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Grilles à remplir</Text>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Aucune grille sélectionnée</Text>
              <TouchableOpacity 
                style={styles.emptyStateBtn}
                onPress={handleRetour}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyStateBtnText}>Retour aux espèces</Text>
              </TouchableOpacity>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={`${item.grille.espece}-${item.grille.categorie}`}
                style={[styles.grilleRow, item.statut === 'terminee' && styles.grilleRowDone]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.85}
              >
                <View style={styles.grilleLeft}>
                  <View style={[
                    styles.grilleIcon,
                    item.statut === 'terminee' ? styles.grilleIconDone : styles.grilleIconPending
                  ]}>
                    <Text style={styles.grilleIconText}>
                      {item.statut === 'terminee' ? '✓' : '•'}
                    </Text>
                  </View>
                  <Text style={styles.grilleLabel}>{grilleLabel(item.grille)}</Text>
                </View>
                <Text style={[
                  styles.grilleStatut, 
                  item.statut === 'terminee' ? styles.grilleStatutDone : styles.grilleStatutPending
                ]}>
                  {item.statut === 'terminee' ? 'Terminée' : 'À faire'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Boutons en bas - même taille */}
        {items.length > 0 && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.btn, styles.btnRetourner, !complete && styles.btnDisabled]}
              onPress={handleRetour}
              disabled={!complete}
              activeOpacity={0.85}
            >
              <Text style={styles.btnRetournerText}>← Retour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnContinuer, !complete && styles.btnDisabled]}
              onPress={handleSuivant}
              disabled={!complete}
              activeOpacity={0.85}
            >
              <Text style={styles.btnContinuerText}>
                {complete ? 'Continuer →' : `⏳ ${done}/${items.length}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
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
  speciesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  speciesItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  speciesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  speciesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  speciesComplete: {
    backgroundColor: '#D1FAE5',
  },
  speciesPending: {
    backgroundColor: '#FEF3C7',
  },
  speciesBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  emptyStateBtn: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyStateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  grilleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  grilleRowDone: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  grilleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  grilleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grilleIconDone: {
    backgroundColor: IFVM_GREEN,
  },
  grilleIconPending: {
    backgroundColor: '#E5E7EB',
  },
  grilleIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  grilleLabel: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  grilleStatut: { 
    fontSize: 13, 
    fontWeight: '600' 
  },
  grilleStatutDone: { 
    color: IFVM_GREEN_DARK 
  },
  grilleStatutPending: { 
    color: '#6B7280' 
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