import { Tabs, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { UserRole } from '@/lib/api-client';

const IFVM_GREEN = '#1B5E1B';
const IFVM_BG = '#162016';

const ROLE_TABS: Record<UserRole, string[]> = {
  prospecteur: ['index', 'fiches'],
  chef_equipe: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  agent_encadreur: ['index', 'prospection', 'sync', 'profile'],
  pilote: ['index', 'prospection', 'sync', 'profile'],
  mecanicien: ['index', 'sync', 'profile'],
  chef_de_base: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  admin: ['index', 'prospection', 'fiches', 'supervision', 'sync', 'profile'],
};

const TAB_CONFIG: Record<string, { title: string }> = {
  index: { title: 'Accueil' },
  fiches: { title: 'Mes fiches' },
  prospection: { title: 'Prospection' },
  supervision: { title: 'Supervision' },
  sync: { title: 'Sync' },
  profile: { title: 'Profil' },
};

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const role = user?.role ?? 'prospecteur';
  const isProspecteur = role === 'prospecteur';
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.prospecteur;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: IFVM_GREEN,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: styles.tabLabel,
      }}
      tabBar={isProspecteur ? (props) => <ProspecteurTabBar {...props} router={router} /> : undefined}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          href: allowedTabs.includes('index') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="prospection"
        options={{
          title: 'Prospection',
          href: allowedTabs.includes('prospection') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="fiches"
        options={{
          title: 'Mes fiches',
          href: allowedTabs.includes('fiches') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="supervision"
        options={{
          title: 'Supervision',
          href: allowedTabs.includes('supervision') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          href: allowedTabs.includes('sync') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          href: allowedTabs.includes('profile') ? undefined : null,
        }}
      />
    </Tabs>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProspecteurTabBar(props: any) {
  const { state, navigation, router } = props as {
    state: { index: number; routes: Array<{ key: string; name: string }> };
    navigation: { emit: (e: Record<string, unknown>) => { defaultPrevented: boolean }; navigate: (n: string) => void };
    router: ReturnType<typeof useRouter>;
  };

  const activeRoute = state.routes[state.index]?.name;

  const navigate = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const isFocused = activeRoute === routeName;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(routeName);
  };

  return (
    <View style={styles.bar}>
      {/* Accueil */}
      <TouchableOpacity style={styles.tabItem} onPress={() => navigate('index')} activeOpacity={0.7}>
        <HomeIcon active={activeRoute === 'index'} />
        <Text style={[styles.tabLabel, activeRoute === 'index' && styles.tabLabelActive]}>
          Accueil
        </Text>
      </TouchableOpacity>

      {/* FAB central */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/prospection')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Mes fiches */}
      <TouchableOpacity style={styles.tabItem} onPress={() => navigate('fiches')} activeOpacity={0.7}>
        <FichesIcon active={activeRoute === 'fiches'} />
        <Text style={[styles.tabLabel, activeRoute === 'fiches' && styles.tabLabelActive]}>
          Mes fiches
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  const color = active ? IFVM_GREEN : '#9CA3AF';
  return (
    <Text style={{ fontSize: 20, color, lineHeight: 24, marginBottom: 2 }}>
      ⌂
    </Text>
  );
}

function FichesIcon({ active }: { active: boolean }) {
  const color = active ? IFVM_GREEN : '#9CA3AF';
  return (
    <View style={{ gap: 3, marginBottom: 4, alignItems: 'center' }}>
      <View style={{ width: 18, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 18, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 18, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: IFVM_BG,
    borderTopWidth: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: IFVM_GREEN,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IFVM_BG,
    paddingBottom: 24,
    paddingTop: 10,
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A3D2A',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IFVM_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '300',
  },
});
