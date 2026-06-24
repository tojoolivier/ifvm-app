import { Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { Colors, type ThemeColor } from '@/constants/theme';
import { UserRole } from '@/lib/api-client';

const ROLE_TABS: Record<UserRole, string[]> = {
  prospecteur: ['index', 'prospection', 'sync', 'profile'],
  chef_equipe: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  agent_encadreur: ['index', 'prospection', 'sync', 'profile'],
  pilote: ['index', 'prospection', 'sync', 'profile'],
  mecanicien: ['index', 'sync', 'profile'],
  chef_de_base: ['index', 'fiches', 'supervision', 'sync', 'profile'],
  admin: ['index', 'prospection', 'fiches', 'supervision', 'sync', 'profile'],
};

const TAB_CONFIG: Record<string, { title: string; icon: string }> = {
  index: { title: 'Dashboard', icon: '📊' },
  prospection: { title: 'Prospection', icon: '🗺️' },
  fiches: { title: 'Fiches', icon: '📋' },
  supervision: { title: 'Supervision', icon: '👁️' },
  sync: { title: 'Sync', icon: '🔄' },
  profile: { title: 'Profil', icon: '👤' },
};

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'prospecteur';
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.prospecteur;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text + '80',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_CONFIG.index.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.index.icon} color={color} />
          ),
          href: allowedTabs.includes('index') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="prospection"
        options={{
          title: TAB_CONFIG.prospection.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.prospection.icon} color={color} />
          ),
          href: allowedTabs.includes('prospection') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="fiches"
        options={{
          title: TAB_CONFIG.fiches.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.fiches.icon} color={color} />
          ),
          href: allowedTabs.includes('fiches') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="supervision"
        options={{
          title: TAB_CONFIG.supervision.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.supervision.icon} color={color} />
          ),
          href: allowedTabs.includes('supervision') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: TAB_CONFIG.sync.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.sync.icon} color={color} />
          ),
          href: allowedTabs.includes('sync') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: TAB_CONFIG.profile.title,
          tabBarIcon: ({ color }) => (
            <TabIcon name={TAB_CONFIG.profile.icon} color={color} />
          ),
          href: allowedTabs.includes('profile') ? undefined : null,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: string; color: string | import('react-native').ColorValue }) {
  return (
    <Text style={{ fontSize: 20, color: color as string }}>
      {name}
    </Text>
  );
}
