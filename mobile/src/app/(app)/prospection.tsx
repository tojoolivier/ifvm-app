import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { useAuthStore } from '@/lib/auth-store';
import {
  loadAccueilData,
  loadValidatedProspections,
  startNewProspection,
  AccueilViewModel,
} from '@/lib/prospection-accueil';
import { DraftProspection } from '@/lib/prospection-repository';
import { ProspectionRead } from '@/lib/api-client';

const IFVM_GREEN_DARK = '#163F16';
const IFVM_ORANGE = '#E67E22';

const EMPTY_DATA: AccueilViewModel = { unsyncedCount: 0, activeDraft: null, recent: [], validated: [] };

type BadgeKind = 'a_synchro' | 'synchro' | 'validee';

interface FicheListItem {
  id: string;
  title: string;
  nFiche: string | null;
  date: string;
  badge: BadgeKind;
  onPress?: () => void;
}

const BADGE_LABEL: Record<BadgeKind, string> = {
  a_synchro: 'À SYNCHRO',
  synchro: 'SYNCHRO ✓',
  validee: 'VALIDÉE ✓',
};

export default function ProspectionScreen() {
  const router = useRouter();
  const { justSaved } = useLocalSearchParams<{ justSaved?: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AccueilViewModel>(EMPTY_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const refresh = useCallback(() => {
    loadAccueilData().then(setData);
    if (user && token) {
      loadValidatedProspections(token, user.id).then((validated) =>
        setData((current) => ({ ...current, validated }))
      );
    }
    Network.getNetworkStateAsync().then((state) =>
      setIsOffline(!(state.isConnected && state.isInternetReachable))
    );
  }, [user, token]);

  useFocusEffect(refresh);

  useEffect(() => {
    if (justSaved !== '1') return;
    router.setParams({ justSaved: undefined });
    const showTimeout = setTimeout(() => setShowSavedToast(true), 0);
    const hideTimeout = setTimeout(() => setShowSavedToast(false), 3000);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [justSaved, router]);

  const resumeDraft = (draft: DraftProspection) => {
    router.push({ pathname: '/(prospection)/reference', params: { draftId: draft.id } });
  };

  const openFicheLecture = (prospection: ProspectionRead) => {
    router.push({ pathname: '/(prospection)/fiche-lecture', params: { id: prospection.id } });
  };

  const items = useMemo<FicheListItem[]>(() => {
    const draftItems: FicheListItem[] = data.recent.map((item) => ({
      id: item.id,
      title: item.station_id ?? 'Localité inconnue',
      nFiche: item.n_fiche,
      date: item.date_prospection,
      badge: item.statut_sync === 'synced' ? 'synchro' : 'a_synchro',
      onPress: () => resumeDraft(item),
    }));
    const validatedItems: FicheListItem[] = data.validated.map((item) => ({
      id: item.id,
      title: item.station_id ?? 'Localité inconnue',
      nFiche: item.n_fiche,
      date: item.date_prospection,
      badge: 'validee',
      onPress: () => openFicheLecture(item),
    }));
    return [...draftItems, ...validatedItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.recent, data.validated]);

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
          {isOffline && (
            <View style={styles.offlineRow}>
              <Text style={styles.offlineText}>⚠ Hors-ligne</Text>
            </View>
          )}
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Image
                source={require('../../../assets/images/logo-ifvm.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Mes prospections</Text>
              {/* TODO: remplacer par le vrai poste avancé une fois exposé sur le profil utilisateur */}
              <Text style={styles.headerSub}>
                {user?.nom} {user?.prenom?.charAt(0)}. · Poste avancé
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {showSavedToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Fiche enregistrée hors-ligne</Text>
          </View>
        )}

        {data.unsyncedCount > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>☁</Text>
            <Text style={styles.bannerText}>
              <Text style={styles.bannerTextStrong}>{data.unsyncedCount} fiche{data.unsyncedCount > 1 ? 's' : ''}</Text>
              {' '}en attente de synchronisation
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
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Aucune fiche de prospection pour le moment.</Text>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={item.onPress}
                activeOpacity={0.85}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    N°{item.nFiche ?? '—'} · {item.date}
                  </Text>
                </View>
                <View style={[styles.badge, item.badge === 'a_synchro' ? styles.badgeAmber : styles.badgeGreen]}>
                  <Text style={[styles.badgeText, item.badge === 'a_synchro' ? styles.badgeTextAmber : styles.badgeTextGreen]}>
                    {BADGE_LABEL[item.badge]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 22 },
  offlineRow: { paddingTop: 8 },
  offlineText: { color: '#FFD27A', fontSize: 12, fontWeight: '700' },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  logo: { width: 40, height: 40, borderRadius: 8 },
  headerTextContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#FFFFFFAA', fontSize: 12, marginTop: 1 },
  content: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 14,
    marginTop: -22,
    marginBottom: 16,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { flex: 1, color: '#8A5A00', fontSize: 13 },
  bannerTextStrong: { fontWeight: '700' },
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeAmber: { backgroundColor: '#FEF3C7' },
  badgeGreen: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextAmber: { color: '#92400E' },
  badgeTextGreen: { color: '#15803d' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  footer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  btnNouvelle: {
    backgroundColor: IFVM_ORANGE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnNouvelleText: { color: '#3D2200', fontSize: 15, fontWeight: '700' },
});
