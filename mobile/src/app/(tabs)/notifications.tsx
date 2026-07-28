import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient, AuditLogRead } from '@/lib/api-client';
import { getProspection } from '@/lib/prospection-repository';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_LIGHT = '#4CAF50';
const IFVM_GREEN_BG = '#E8F5E9';
const IFVM_BG_LIGHT = '#F0F2F5';
const CARD_BG = '#FFFFFF';
const IFVM_RED = '#E74C3C';
const IFVM_RED_BG = '#FCE4EC';
const IFVM_BLUE = '#2196F3';
const IFVM_ORANGE = '#E67E22';
const HEADER_BG = '#1B5E1B';
const TEXT_BLACK = '#000000';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#757575';

// Types de notifications
type NotificationType = 'validation' | 'verification' | 'rejet' | 'commentaire' | 'creation' | 'modification';

interface Notification {
  id: string;
  ficheId: string;
  type: NotificationType;
  message: string;
  date: string;
  lu: boolean;
  motif?: string;
  action?: string;
  details?: any;
  ficheType?: string;
  auteurId?: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  // Charger les notifications depuis l'API
  const loadNotifications = async () => {
    if (!token || !user) return;
    
    setIsLoading(true);
    try {
      // Récupérer les notifications depuis l'API (audit log)
      const auditLogs = await apiClient.getAuditLog(token, '');
      
      // Transformer les logs en notifications
      const notificationsData = await transformAuditLogsToNotifications(auditLogs);
      
      // Trier par date décroissante
      notificationsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      // En cas d'erreur, charger les notifications locales
      await loadLocalNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les notifications locales (fallback)
  const loadLocalNotifications = async () => {
    try {
      // Récupérer les prospections récentes pour générer des notifications
      const { listRecentProspections } = await import('@/lib/prospection-repository');
      const prospections = await listRecentProspections(10);
      
      const localNotifs: Notification[] = prospections
        .filter(p => p.statut === 'en_attente' || p.statut === 'verifiee' || p.statut === 'validee' || p.statut === 'rejetee')
        .map(p => ({
          id: `local-${p.id}`,
          ficheId: p.id,
          type: getStatusType(p.statut),
          message: getStatusMessage(p.statut, p.n_fiche || p.id),
          date: p.updated_at || p.created_at,
          lu: p.statut_sync === 'synced',
          motif: p.statut === 'rejetee' ? 'Données invalides' : undefined,
        }));
      
      setNotifications(localNotifs);
    } catch (error) {
      console.error('Erreur chargement notifications locales:', error);
      setNotifications([]);
    }
  };

  // Transformer les logs d'audit en notifications
  const transformAuditLogsToNotifications = async (logs: AuditLogRead[]): Promise<Notification[]> => {
    const notifications: Notification[] = [];
    
    for (const log of logs) {
      // Filtrer uniquement les logs pertinents pour les notifications
      const relevantActions = ['soumission', 'verification', 'validation', 'rejet', 'commentaire', 'creation', 'modification'];
      if (!relevantActions.includes(log.action)) continue;
      
      // Récupérer les détails de la fiche
      let ficheId = log.fiche_id;
      let ficheInfo = '';
      
      try {
        // Essayer de récupérer les infos de la fiche
        const prospection = await getProspection(ficheId);
        if (prospection) {
          ficheInfo = prospection.n_fiche || prospection.id.slice(0, 8);
        }
      } catch (error) {
        // Ignorer les erreurs
      }
      
      const type = mapActionToType(log.action);
      const message = buildNotificationMessage(log.action, ficheInfo, log.details);
      
      notifications.push({
        id: log.id,
        ficheId: ficheId,
        type: type,
        message: message,
        date: log.created_at,
        lu: false, // Par défaut, les notifications sont non lues
        motif: log.details?.statut_precedent ? `Ancien statut: ${log.details.statut_precedent}` : undefined,
        action: log.action,
        details: log.details,
        ficheType: log.fiche_type,
        auteurId: log.auteur_id,
      });
    }
    
    return notifications;
  };

  const mapActionToType = (action: string): NotificationType => {
    switch (action) {
      case 'soumission': return 'verification';
      case 'verification': return 'verification';
      case 'validation': return 'validation';
      case 'rejet': return 'rejet';
      case 'commentaire': return 'commentaire';
      case 'creation': return 'creation';
      case 'modification': return 'modification';
      default: return 'commentaire';
    }
  };

  const getStatusType = (statut: string): NotificationType => {
    switch (statut) {
      case 'validee': return 'validation';
      case 'verifiee': return 'verification';
      case 'rejetee': return 'rejet';
      case 'en_attente': return 'verification';
      default: return 'commentaire';
    }
  };

  const getStatusMessage = (statut: string, ficheId: string): string => {
    switch (statut) {
      case 'validee': return `✅ Fiche ${ficheId} validée avec succès`;
      case 'verifiee': return `✅ Fiche ${ficheId} vérifiée`;
      case 'rejetee': return `❌ Fiche ${ficheId} rejetée`;
      case 'en_attente': return `⏳ Fiche ${ficheId} en attente de vérification`;
      default: return `📝 Fiche ${ficheId} modifiée`;
    }
  };

  const buildNotificationMessage = (action: string, ficheInfo: string, details?: any): string => {
    const ficheLabel = ficheInfo || 'Fiche';
    switch (action) {
      case 'soumission': return `📤 ${ficheLabel} soumise pour vérification`;
      case 'verification': return `✅ ${ficheLabel} vérifiée`;
      case 'validation': return `🏆 ${ficheLabel} validée avec succès`;
      case 'rejet': return `❌ ${ficheLabel} rejetée`;
      case 'commentaire': return `💬 Commentaire ajouté sur ${ficheLabel}`;
      case 'creation': return `📝 ${ficheLabel} créée`;
      case 'modification': return `✏️ ${ficheLabel} modifiée`;
      default: return `📢 Nouvelle notification pour ${ficheLabel}`;
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [token, user])
  );

  const handleNotificationPress = async (notification: Notification) => {
    // Marquer comme lue
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, lu: true } : n)
    );
    
    // Naviguer vers la fiche
    router.push({
      pathname: '/(prospection)/fiche-lecture',
      params: { id: notification.ficheId }
    } as any);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, lu: true }))
    );
    
    // Optionnel: Envoyer la requête au serveur pour marquer toutes comme lues
    // Ici nous simulons juste localement
    
    Alert.alert('✅ Succès', 'Toutes les notifications ont été marquées comme lues');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'À l\'instant';
      if (minutes < 60) return `Il y a ${minutes} min`;
      if (hours < 24) return `Il y a ${hours} h`;
      if (days < 7) return `Il y a ${days} j`;
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'rejet': return '❌';
      case 'validation': return '🏆';
      case 'verification': return '✅';
      case 'commentaire': return '💬';
      case 'creation': return '📝';
      case 'modification': return '✏️';
      default: return '📢';
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'rejet': return IFVM_RED;
      case 'validation': return IFVM_GREEN_LIGHT;
      case 'verification': return IFVM_BLUE;
      case 'commentaire': return IFVM_ORANGE;
      case 'creation': return IFVM_GREEN;
      case 'modification': return '#9B59B6';
      default: return IFVM_ORANGE;
    }
  };

  const getNotificationBgColor = (type: NotificationType) => {
    switch (type) {
      case 'rejet': return IFVM_RED_BG;
      case 'validation': return IFVM_GREEN_BG;
      case 'verification': return '#E3F2FD';
      case 'commentaire': return '#FFF3E0';
      case 'creation': return IFVM_GREEN_BG;
      case 'modification': return '#F3E5F5';
      default: return '#FFF3E0';
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.lu).length;
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.lu;
    const icon = getNotificationIcon(item.type);
    const color = getNotificationColor(item.type);
    const bgColor = getNotificationBgColor(item.type);
    const isRejet = item.type === 'rejet';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationIconContainer, { backgroundColor: bgColor }]}>
          <ThemedText style={styles.notificationIcon}>{icon}</ThemedText>
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <ThemedText style={[styles.notificationMessage, isUnread && styles.notificationMessageUnread]}>
              {item.message}
            </ThemedText>
            {isUnread && <View style={styles.unreadBadge} />}
          </View>
          <ThemedText style={styles.notificationDate}>
            {formatDate(item.date)}
          </ThemedText>
          {item.motif && (
            <View style={[styles.motifContainer, { backgroundColor: isRejet ? IFVM_RED_BG : '#F5F5F5' }]}>
              <ThemedText style={[styles.notificationMotif, { color: isRejet ? IFVM_RED : TEXT_DARK }]}>
                {isRejet ? '❌ Motif : ' : '📝 '}{item.motif}
              </ThemedText>
            </View>
          )}
        </View>
        {isUnread && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
      </TouchableOpacity>
    );
  };

  const unreadCount = getUnreadCount();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ThemedText style={styles.backButtonText}>←</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>🔔 Notifications</ThemedText>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                <ThemedText style={styles.markAllRead}>Tout lire</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Compteur */}
      {notifications.length > 0 && (
        <View style={styles.counterContainer}>
          <ThemedText style={styles.counterText}>
            {unreadCount} non lue{unreadCount > 1 ? 's' : ''} · {notifications.length} totale{notifications.length > 1 ? 's' : ''}
          </ThemedText>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[IFVM_GREEN]}
            tintColor={IFVM_GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <ThemedText style={styles.emptyIcon}>🔔</ThemedText>
            </View>
            <ThemedText style={styles.emptyTitle}>Aucune notification</ThemedText>
            <ThemedText style={styles.emptySub}>
              Vous serez notifié lorsque vos fiches seront traitées
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IFVM_BG_LIGHT,
  },
  safeArea: {
    backgroundColor: HEADER_BG,
  },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  markAllRead: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  counterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: IFVM_BG_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  counterText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  notificationUnread: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: IFVM_GREEN_LIGHT + '40',
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  notificationIcon: {
    fontSize: 22,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: TEXT_DARK,
    flex: 1,
    lineHeight: 20,
  },
  notificationMessageUnread: {
    fontWeight: '600',
    color: TEXT_BLACK,
  },
  unreadBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IFVM_GREEN_LIGHT,
    marginLeft: 8,
    flexShrink: 0,
  },
  notificationDate: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  motifContainer: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  notificationMotif: {
    fontSize: 12,
    fontWeight: '500',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
    alignSelf: 'center',
    flexShrink: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IFVM_GREEN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_BLACK,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});