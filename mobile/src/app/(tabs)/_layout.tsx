import { Tabs, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { UserRole } from '@/lib/api-client';
const IFVM_GREEN = '#1B5E1B';

const ROLE_TABS: Record<UserRole, string[]> = {
  prospecteur: ['index', 'fiches'],
  chef_equipe: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  agent_encadreur: ['index', 'prospection', 'sync', 'profile'],
  pilote: ['index', 'prospection', 'sync', 'profile'],
  mecanicien: ['index', 'sync', 'profile'],
  chef_de_base: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  admin: ['index', 'prospection', 'fiches', 'supervision', 'sync', 'profile'],
};

const TAB_CONFIG: Record<string, { title: string; icon: string }> = {
  index: { title: 'Accueil', icon: '⌂' },
  prospection: { title: 'Prospection', icon: '🗺️' },
  fiches: { title: 'Mes fiches', icon: '≡' },
  supervision: { title: 'Supervision', icon: '👁️' },
  sync: { title: 'Sync', icon: '🔄' },
  profile: { title: 'Profil', icon: '👤' },
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
          title: TAB_CONFIG.index.title,
          tabBarIcon: ({ color }) => <TabIcon name="⌂" color={color as string} size={22} />,
          href: allowedTabs.includes('index') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="prospection"
        options={{
          title: TAB_CONFIG.prospection.title,
          tabBarIcon: ({ color }) => <TabIcon name="🗺️" color={color as string} />,
          href: allowedTabs.includes('prospection') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="fiches"
        options={{
          title: TAB_CONFIG.fiches.title,
          tabBarIcon: ({ color }) => <TabIcon name="≡" color={color as string} size={24} />,
          href: allowedTabs.includes('fiches') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="supervision"
        options={{
          title: TAB_CONFIG.supervision.title,
          tabBarIcon: ({ color }) => <TabIcon name="👁️" color={color as string} />,
          href: allowedTabs.includes('supervision') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: TAB_CONFIG.sync.title,
          tabBarIcon: ({ color }) => <TabIcon name="🔄" color={color as string} />,
          href: allowedTabs.includes('sync') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: TAB_CONFIG.profile.title,
          tabBarIcon: ({ color }) => <TabIcon name="👤" color={color as string} />,
          href: allowedTabs.includes('profile') ? undefined : null,
        }}
      />
    </Tabs>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProspecteurTabBar(props: any) {
  const { state, descriptors, navigation, router } = props as {
    state: { index: number; routes: Array<{ key: string; name: string }> };
    descriptors: Record<string, { options: Record<string, unknown> }>;
    navigation: { emit: (e: Record<string, unknown>) => { defaultPrevented: boolean }; navigate: (n: string) => void };
    router: ReturnType<typeof useRouter>;
  };

  const visibleRoutes = state.routes.filter(
    (r) => descriptors[r.key]?.options?.href !== null
  );

  return (
    <View style={styles.prospecteurBar}>
      {visibleRoutes.map((route, i) => {
        const isFocused = state.routes[state.index]?.name === route.name;
        const config = TAB_CONFIG[route.name];
        const showFAB = i === 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <View
            key={route.key}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }}
          >
            <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <Text style={[styles.tabIconText, { color: isFocused ? IFVM_GREEN : '#9CA3AF' }]}>
                {config?.icon}
              </Text>
              <Text style={[styles.tabLabel, { color: isFocused ? IFVM_GREEN : '#9CA3AF' }]}>
                {config?.title}
              </Text>
            </TouchableOpacity>

            {showFAB && (
              <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/(tabs)/prospection')}
                activeOpacity={0.85}
              >
                <Text style={styles.fabIcon}>+</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

function TabIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  return <Text style={{ fontSize: size, color }}>{name}</Text>;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  prospecteurBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconText: {
    fontSize: 20,
    marginBottom: 2,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: IFVM_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    shadowColor: IFVM_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
});
