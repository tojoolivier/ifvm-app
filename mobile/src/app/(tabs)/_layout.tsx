import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

const IFVM_GREEN = '#1B5E1B';

// Définir un type pour les icônes
type TabIconMap = {
  [key: string]: string;
};

const ICONS: TabIconMap = {
  index: '🏠',
  prospection: '📝',
  fiches: '📋',
  notifications: '🔔',
  sync: '🔄',
  profile: '👤',
};

const LABELS: TabIconMap = {
  index: 'Accueil',
  prospection: 'Prospection',
  fiches: 'Mes fiches',
  notifications: 'Notifications',
  sync: 'Sync',
  profile: 'Profil',
};

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomBar {...props} router={router} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', href: undefined }} />
      <Tabs.Screen name="prospection" options={{ title: 'Prospection', href: undefined }} />
      <Tabs.Screen name="fiches" options={{ title: 'Mes fiches', href: undefined }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', href: undefined }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync', href: undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', href: undefined }} />
    </Tabs>
  );
}

function BottomBar(props: any) {
  const { state, navigation } = props;
  const active = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route) return;
    const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (active !== name && !ev.defaultPrevented) navigation.navigate(name);
  };

  const tabs = ['index', 'prospection', 'fiches', 'notifications', 'sync', 'profile'];

  return (
    <View style={styles.bar}>
      {tabs.map((name) => {
        const isActive = active === name;
        const icon = ICONS[name] || '●';
        const label = LABELS[name] || name;
        return (
          <TouchableOpacity
            key={name}
            style={styles.tabItem}
            onPress={() => go(name)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
              {icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.6,
    marginBottom: 2,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: IFVM_GREEN,
    fontWeight: '700',
  },
});