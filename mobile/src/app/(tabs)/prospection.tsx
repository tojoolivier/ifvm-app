import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import {
  loadAccueilData,
  startNewProspection,
  AccueilViewModel,
} from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, recent: [] };

export default function ProspectionScreen() {
  const router = useRouter();
  const { justSaved } = useLocalSearchParams<{ justSaved?: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const refresh = useCallback(() => {
    loadAccueilData().then(setData);
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    if (justSaved !== '1') return;
    setShowSavedToast(true);
    router.setParams({ justSaved: undefined });
    const timeout = setTimeout(() => setShowSavedToast(false), 3000);
    return () => clearTimeout(timeout);
  }, [justSaved, router]);

  const resumeDraft = (draft: DraftProspection) => {
    router.push({ pathname: '/(prospection)/reference', params: { draftId: draft.id } });
  };

  const handleNewProspection = async () => {
    if (!user || !token) return;
    setIsCreating(true);
    setError(null);
    try {
      const draft = await startNewProspection({ token, prospecteurId: user.id });
      refresh();
      resumeDraft(draft);
    } catch {
      setError('Impossible de démarrer une nouvelle fiche (campagne introuvable ou hors-ligne).');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.headerTitle}>Prospection</Text>
          <Text style={styles.headerSub}>Fiches hors-ligne du prospecteur</Text>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {showSavedToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Fiche enregistrée hors-ligne</Text>
          </View>
        )}

        {data.unsyncedCount > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {data.unsyncedCount} fiche{data.unsyncedCount > 1 ? 's' : ''} en attente de synchronisation
            </Text>
          </View>
        )}

        {data.activeDraft && (
          <TouchableOpacity
            style={styles.draftCard}
            onPress={() => resumeDraft(data.activeDraft as DraftProspection)}
            activeOpacity={0.85}
          >
            <Text style={styles.draftLabel}>Reprendre le brouillon</Text>
            <Text style={styles.draftTitle}>
              {data.activeDraft.station_id ?? 'Localité inconnue'} · {data.activeDraft.date_prospection}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.list}>
          {data.recent.length === 0 ? (
            <Text style={styles.emptyText}>Aucune fiche de prospection pour le moment.</Text>
          ) : (
            data.recent.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.date_prospection}</Text>
                <Text style={styles.cardStatut}>
                  {item.statut_sync === 'synced' ? 'Synchronisé' : 'À synchroniser'}
                </Text>
              </View>
            ))
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btnNouvelle, isCreating && styles.btnDisabled]}
          onPress={handleNewProspection}
          disabled={isCreating}
          activeOpacity={0.85}
        >
          <Text style={styles.btnNouvelleText}>
            {isCreating ? 'Création…' : '+ Nouvelle prospection'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#FFFFFFAA', fontSize: 12, marginTop: 1 },
  content: { flex: 1 },
  banner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  toast: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  toastText: { color: '#15803d', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  draftCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  draftLabel: { color: '#15803d', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  draftTitle: { color: '#111827', fontSize: 14, fontWeight: '600' },
  list: { gap: 8, marginBottom: 20 },
  emptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardStatut: { fontSize: 12, color: '#6B7280' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btnNouvelle: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnNouvelleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
