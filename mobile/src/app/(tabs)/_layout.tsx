import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
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

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const role = user?.role ?? 'prospecteur';
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.prospecteur;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomBar {...props} router={router} role={role} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', href: allowedTabs.includes('index') ? undefined : null }} />
      <Tabs.Screen name="prospection" options={{ title: 'Prospection', href: allowedTabs.includes('prospection') ? undefined : null }} />
      <Tabs.Screen name="fiches" options={{ title: 'Mes fiches', href: allowedTabs.includes('fiches') ? undefined : null }} />
      <Tabs.Screen name="supervision" options={{ title: 'Supervision', href: allowedTabs.includes('supervision') ? undefined : null }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync', href: allowedTabs.includes('sync') ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', href: allowedTabs.includes('profile') ? undefined : null }} />
    </Tabs>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BottomBar(props: any) {
  const { state, navigation, router, role } = props as {
    state: { index: number; routes: Array<{ key: string; name: string }> };
    navigation: { emit: (e: Record<string, unknown>) => { defaultPrevented: boolean }; navigate: (n: string) => void };
    router: ReturnType<typeof useRouter>;
    role: UserRole;
  };

  const active = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (active !== name && !ev.defaultPrevented) navigation.navigate(name);
  };

  // Prospecteur : 3 éléments fixes — Accueil | FAB | Mes fiches
  if (role === 'prospecteur') {
    return (
      <View style={styles.bar}>
        <TabBtn label="Accueil" active={active === 'index'} onPress={() => go('index')}>
          <IconHome active={active === 'index'} />
        </TabBtn>

        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/prospection')} activeOpacity={0.85}>
          <Text style={styles.fabPlus}>+</Text>
        </TouchableOpacity>

        <TabBtn label="Mes fiches" active={active === 'fiches'} onPress={() => go('fiches')}>
          <IconMenu active={active === 'fiches'} />
        </TabBtn>
      </View>
    );
  }

  // Autres rôles : onglets standards affichés dynamiquement
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.prospecteur;
  const visibleRoutes = state.routes.filter((r) => allowedTabs.includes(r.name));

  return (
    <View style={styles.barMulti}>
      {visibleRoutes.map((route) => {
        const isActive = active === route.name;
        return (
          <TabBtn key={route.key} label={route.name} active={isActive} onPress={() => go(route.name)}>
            <Text style={{ fontSize: 18, color: isActive ? IFVM_GREEN : '#9CA3AF' }}>●</Text>
          </TabBtn>
        );
      })}
    </View>
  );
}

function TabBtn({
  label, active, onPress, children,
}: {
  label: string; active: boolean; onPress: () => void; children: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      {children}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconHome({ active }: { active: boolean }) {
  const color = active ? IFVM_GREEN : '#9CA3AF';
  return (
    <View style={{ width: 24, height: 22, alignItems: 'center', marginBottom: 3 }}>
      {/* Toit */}
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 9,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color,
        marginBottom: 0,
      }} />
      {/* Corps */}
      <View style={{ width: 16, height: 10, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

function IconMenu({ active }: { active: boolean }) {
  const color = active ? IFVM_GREEN : '#9CA3AF';
  return (
    <View style={{ gap: 3.5, marginBottom: 4, alignItems: 'center' }}>
      <View style={{ width: 20, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 20, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 20, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  barMulti: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: IFVM_GREEN,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IFVM_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    marginHorizontal: 8,
  },
  fabPlus: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
    marginTop: -2,
  },
});
