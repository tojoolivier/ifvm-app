import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text + '80',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <TabIcon name="🏠" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <TabIcon name="🧭" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: string; color: string | import('react-native').ColorValue }) {
  return (
    <span style={{ fontSize: 20, color: color as string }}>
      {name}
    </span>
  );
}
