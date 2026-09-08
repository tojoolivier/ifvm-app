/**
 * Centre de notifications (mobile) — in-app, pas de push natif à ce stade.
 *
 * Dérivé de `audit_log` côté serveur (GET /prospections/notifications) : un
 * prospecteur n'y voit que les transitions de statut sur SES fiches
 * (vérification/validation/rejet, motif compris pour un rejet) — jamais la
 * création, qu'il vient de faire lui-même.
 *
 * « Vu » se marque à la sortie de l'écran, pas à l'entrée : sinon la
 * distinction visuelle nouveau/déjà-vu disparaîtrait avant même que l'agent
 * ait pu la voir.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { useNotifications, type Notification } from '@/hooks/use-notifications';

const JETONS = {
  primary: '#235a36',
  background: '#faf7ef',
  surface: '#FFFFFF',
  border: '#e7e0cd',
  foreground: '#16201a',
  foregroundSecondary: '#3a3a30',
  foregroundTertiary: '#6f6a59',
  foregroundWeak: '#9a9484',
} as const;

const ACTION_INFO: Record<string, { titre: string; bg: string; fg: string }> = {
  creation: { titre: 'Nouvelle fiche', bg: '#eaf0f7', fg: '#31567f' },
  verification: { titre: 'Fiche vérifiée', bg: '#eaf0f7', fg: '#31567f' },
  validation: { titre: 'Fiche validée', bg: '#eaf2ec', fg: '#235a36' },
  rejet: { titre: 'Fiche rejetée', bg: '#fbe9e7', fg: '#c0412b' },
};

function formatQuand(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function NotificationRow({ notification }: { notification: Notification }) {
  const info = ACTION_INFO[notification.action] ?? {
    titre: notification.action,
    bg: '#f4efe2',
    fg: '#6f6a59',
  };
  const motif =
    notification.action === 'rejet' && notification.details && typeof notification.details === 'object'
      ? (notification.details as Record<string, unknown>).commentaire
      : null;

  return (
    <View style={[styles.row, !notification.lu && styles.rowNonLue]}>
      {!notification.lu && <View style={styles.pointNonLu} />}
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={[styles.badge, { backgroundColor: info.bg }]}>
            <Text style={[styles.badgeText, { color: info.fg }]}>{info.titre}</Text>
          </View>
          <Text style={styles.quand}>{formatQuand(notification.created_at)}</Text>
        </View>
        <Text style={styles.fiche}>
          Fiche {notification.n_fiche ?? '—'}
          {notification.auteur_nom ? ` · ${notification.auteur_nom}` : ''}
        </Text>
        {typeof motif === 'string' && motif && (
          <Text style={styles.motif}>Motif : {motif}</Text>
        )}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { items, chargement, rafraichir, marquerVues } = useNotifications(token);

  // Marqué vu à la sortie, pas à l'entrée : sinon la distinction visuelle
  // nouveau/déjà-vu disparaîtrait avant même que l'agent ait pu la voir.
  useEffect(() => {
    return () => {
      void marquerVues();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={rafraichir} />}
      >
        {items.length === 0 ? (
          <Text style={styles.vide}>Aucune notification pour l’instant.</Text>
        ) : (
          items.map((n) => <NotificationRow key={n.id} notification={n} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JETONS.background },
  header: { backgroundColor: JETONS.primary, paddingHorizontal: 16, paddingBottom: 14 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: JETONS.surface, fontSize: 22, fontWeight: '300', lineHeight: 26, marginTop: -2 },
  headerTitle: { color: JETONS.surface, fontSize: 19, fontWeight: '800', marginLeft: 12 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  vide: { textAlign: 'center', marginTop: 40, color: JETONS.foregroundWeak, fontSize: 13 },
  row: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: JETONS.surface,
    borderWidth: 1,
    borderColor: JETONS.border,
    borderRadius: 10,
    padding: 12,
  },
  rowNonLue: { borderColor: JETONS.primary },
  pointNonLu: { width: 8, height: 8, borderRadius: 4, backgroundColor: JETONS.primary, marginTop: 5 },
  rowContent: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  quand: { fontSize: 10.5, color: JETONS.foregroundWeak, fontFamily: 'monospace' },
  fiche: { fontSize: 12.5, fontWeight: '600', color: JETONS.foreground },
  motif: { fontSize: 12, color: JETONS.foregroundSecondary, fontStyle: 'italic' },
});
