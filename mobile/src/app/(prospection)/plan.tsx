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
} from '@/lib/prospection-plan';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

export default function PlanScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [draft, setDraft] = useState<DraftProspection | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(setDraft);
  }, [draftId]);

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

  const handleItemPress = (item: PlanItem) => {
    if (!draft) return;
    router.push({
      pathname: '/(prospection)/captures',
      params: { draftId: draft.id, grilleIndex: String(item.index) },
    });
  };

  const handleSuivant = () => {
    if (!draft || !complete) return;
    router.push({ pathname: '/(prospection)/vegetation', params: { draftId: draft.id } });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(prospection)/especes', params: { draftId } })}>
          <Text style={styles.backLink}>‹ Espèces observées</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan de relevé</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 3/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.counterText}>
            {done}/{items.length} grille{items.length > 1 ? 's' : ''} terminée{done > 1 ? 's' : ''}
          </Text>
        </View>

        {items.map((item) => (
          <TouchableOpacity
            key={`${item.grille.espece}-${item.grille.categorie}`}
            style={[styles.grilleRow, item.statut === 'terminee' && styles.grilleRowDone]}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.grilleLabel}>{grilleLabel(item.grille)}</Text>
            <Text style={[styles.grilleStatut, item.statut === 'terminee' && styles.grilleStatutDone]}>
              {item.statut === 'terminee' ? 'Terminée ✓' : 'À faire'}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.btnContinuer, !complete && styles.btnDisabled]}
          onPress={handleSuivant}
          disabled={!complete}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>Continuer vers Végétation & sol</Text>
        </TouchableOpacity>
      </ScrollView>
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
  counterText: { color: '#111827', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  grilleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 10,
  },
  grilleRowDone: { backgroundColor: '#E8F3E8', borderColor: IFVM_GREEN },
  grilleLabel: { color: '#111827', fontSize: 14, fontWeight: '600' },
  grilleStatut: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  grilleStatutDone: { color: IFVM_GREEN_DARK },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
