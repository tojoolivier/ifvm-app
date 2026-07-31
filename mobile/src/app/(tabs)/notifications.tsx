import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/storage';

// ============================================
// CONSTANTES - PALETTE CLAIRE
// ============================================

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

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => loadNotifications(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleNotificationPress = async (notification: any) => {
    await markNotificationAsRead(notification.id);
    router.push({
      pathname: '/(tabs)/fiches/[id]',
      params: { id: notification.ficheId }
    } as any);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    await loadNotifications();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
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
    return date.toLocaleDateString('fr-FR');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'rejet':
        return '❌';
      case 'validation':
        return '🏆';
      case 'verification':
        return '✅';
      case 'sync_reminder':
        return '📡';
      case 'sync_available':
        return '📶';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'rejet':
        return IFVM_RED;
      case 'validation':
        return IFVM_GREEN_LIGHT;
      case 'verification':
        return IFVM_BLUE;
      case 'sync_reminder':
        return IFVM_ORANGE;
      case 'sync_available':
        return IFVM_BLUE;
      default:
        return IFVM_ORANGE;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'rejet':
        return IFVM_RED_BG;
      case 'validation':
        return IFVM_GREEN_BG;
      case 'verification':
        return '#E3F2FD';
      case 'sync_reminder':
        return '#FFF3E0';
      case 'sync_available':
        return '#E3F2FD';
      default:
        return '#FFF3E0';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
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
            {notifications.some(n => !n.lu) && (
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
            {notifications.filter(n => !n.lu).length} non lue(s) · {notifications.length} totale(s)
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
// STYLES - FOND CLAIR
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