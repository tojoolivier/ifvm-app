import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import {
  loadAccueilData,
  loadValidatedProspections,
  startNewProspection,
  AccueilViewModel,
} from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';
import { ProspectionRead } from '@/lib/api-client';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, recent: [], validated: [] };

export default function ProspectionScreen() {
  const router = useRouter();
  const { justSaved, synced } = useLocalSearchParams<{ justSaved?: string; synced?: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([
      loadAccueilData().then(setData),
      user && token ? loadValidatedProspections(token, user.id) : Promise.resolve([])
    ])
      .then(([, validated]) => {
        if (validated) {
          setData((current) => ({ ...current, validated }));
        }
        setError(null);
      })
      .catch((err) => {
        console.error('Erreur refresh:', err);
        setError('Impossible de charger les données');
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [user, token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {};
    }, [refresh])
  );

  useEffect(() => {
    if (justSaved === '1') {
      setShowSavedToast(true);
      router.setParams({ justSaved: undefined });
      const timeout = setTimeout(() => setShowSavedToast(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [justSaved, router]);

  useEffect(() => {
    if (synced === '0') {
      setShowSavedToast(true);
      router.setParams({ synced: undefined });
      const timeout = setTimeout(() => setShowSavedToast(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [synced, router]);

  const resumeDraft = (draft: DraftProspection) => {
    router.push({ pathname: '/(prospection)/reference', params: { draftId: draft.id } });
  };

  const openFicheLecture = (prospection: ProspectionRead) => {
    router.push({ pathname: '/(prospection)/fiche-lecture', params: { id: prospection.id } });
  };

  const handleNewProspection = async () => {
    if (!user || !token) return;
    setIsCreating(true);
    setError(null);
    try {
      const draft = await startNewProspection({ token, prospecteurId: user.id });
      refresh();
      resumeDraft(draft);
    } catch (err) {
      setError('Impossible de démarrer une nouvelle fiche (campagne introuvable ou hors-ligne).');
      console.error('Erreur nouvelle prospection:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.headerTitle}>📋 Prospection</Text>
          <Text style={styles.headerSub}>
            {user ? `${user.prenom} ${user.nom}` : 'Prospecteur'}
          </Text>
        </SafeAreaView>
      </View>

      {/* Toast */}
      {showSavedToast && (
        <View style={styles.toast}>
          <Text style={styles.toastIcon}>✅</Text>
          <Text style={styles.toastText}>
            {synced === '0' ? 'Fiche enregistrée localement (hors-ligne)' : 'Fiche enregistrée !'}
          </Text>
        </View>
      )}

      {/* Contenu principal */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[IFVM_GREEN]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Bannière synchronisation */}
        {data.unsyncedCount > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>📤</Text>
            <Text style={styles.bannerText}>
              {data.unsyncedCount} fiche{data.unsyncedCount > 1 ? 's' : ''} en attente de synchronisation
            </Text>
          </View>
        )}

        {/* Brouillon actif */}
        {data.activeDraft && (
          <TouchableOpacity
            style={styles.draftCard}
            onPress={() => resumeDraft(data.activeDraft as DraftProspection)}
            activeOpacity={0.85}
          >
            <View style={styles.draftHeader}>
              <Text style={styles.draftLabel}>📝 Brouillon en cours</Text>
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>Reprendre →</Text>
              </View>
            </View>
            <Text style={styles.draftTitle}>
              {data.activeDraft.station_id ?? '📍 Localité inconnue'}
            </Text>
            <Text style={styles.draftSub}>
              {formatDate(data.activeDraft.date_prospection)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Fiches récentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📂 Fiches récentes</Text>
          {data.recent.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Aucune fiche de prospection</Text>
            </View>
          ) : (
            data.recent.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>
                    {item.station_id ?? '📍 Localité'}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(item.date_prospection)}</Text>
                </View>
                <View style={styles.cardRight}>
                  <View style={[
                    styles.cardStatusBadge,
                    item.statut_sync === 'synced' ? styles.cardStatusSynced : styles.cardStatusPending
                  ]}>
                    <Text style={[
                      styles.cardStatusText,
                      item.statut_sync === 'synced' ? styles.cardStatusTextSynced : styles.cardStatusTextPending
                    ]}>
                      {item.statut_sync === 'synced' ? '☁️' : '📱'}
                    </Text>
                  </View>
                  <Text style={styles.cardStatut}>
                    {item.statut === 'brouillon' ? '📝' :
                     item.statut === 'en_attente' ? '⏳' :
                     item.statut === 'verifiee' ? '✅' :
                     item.statut === 'validee' ? '🎯' :
                     item.statut === 'rejetee' ? '❌' : '📄'}
                  </Text>
                </View>
              </View>
            ))
          )}
          {data.recent.length > 5 && (
            <TouchableOpacity style={styles.seeMore}>
              <Text style={styles.seeMoreText}>Voir toutes les fiches →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Fiches validées */}
        {data.validated.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Fiches validées</Text>
            {data.validated.slice(0, 3).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, styles.cardValidated]}
                onPress={() => openFicheLecture(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>
                    {item.n_fiche ?? 'Fiche'}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(item.date_prospection)}</Text>
                </View>
                <Text style={styles.cardStatutValide}>📖 Lire</Text>
              </TouchableOpacity>
            ))}
            {data.validated.length > 3 && (
              <TouchableOpacity style={styles.seeMore}>
                <Text style={styles.seeMoreText}>
                  + {data.validated.length - 3} autre{data.validated.length - 3 > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Espace pour le bouton fixe */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bouton fixe en bas */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnNouvelle, isCreating && styles.btnDisabled]}
          onPress={handleNewProspection}
          disabled={isCreating}
          activeOpacity={0.85}
        >
          <Text style={styles.btnNouvelleText}>
            {isCreating ? '⏳ Création…' : '➕ Nouvelle prospection'}
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 14, 
    paddingTop: 8 
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 20, 
    fontWeight: '700' 
  },
  headerSub: { 
    color: '#FFFFFFAA', 
    fontSize: 13, 
    marginTop: 2 
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#6EE7B7',
  },
  toastIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  toastText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  content: { 
    flex: 1 
  },
  contentContainer: { 
    padding: 16,
    paddingBottom: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  bannerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  bannerText: { 
    color: '#92400E', 
    fontSize: 13, 
    fontWeight: '600',
    flex: 1,
  },
  draftCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  draftLabel: { 
    color: '#15803d', 
    fontSize: 13, 
    fontWeight: '700' 
  },
  draftBadge: {
    backgroundColor: IFVM_GREEN,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  draftBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  draftTitle: { 
    color: '#111827', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  draftSub: { 
    color: '#6B7280', 
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#374151', 
    marginBottom: 10 
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: { 
    color: '#6B7280', 
    fontSize: 14, 
    textAlign: 'center' 
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardValidated: {
    borderLeftWidth: 3,
    borderLeftColor: IFVM_GREEN,
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#111827' 
  },
  cardDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  cardStatut: { 
    fontSize: 16,
    marginLeft: 4,
  },
  cardStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardStatusSynced: {
    backgroundColor: '#D1FAE5',
  },
  cardStatusPending: {
    backgroundColor: '#FEF3C7',
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardStatusTextSynced: {
    color: '#065F46',
  },
  cardStatusTextPending: {
    color: '#92400E',
  },
  cardStatutValide: { 
    fontSize: 12, 
    color: IFVM_GREEN, 
    fontWeight: '700' 
  },
  seeMore: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  seeMoreText: {
    color: IFVM_GREEN,
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
  bottomSpacer: {
    height: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  btnNouvelle: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { 
    opacity: 0.6 
  },
  btnNouvelleText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700' 
  },
});