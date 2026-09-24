import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/lib/auth-store';
import { UserRole } from '@/lib/api-client';
import { useThemeStore } from '@/lib/theme-store';

const ROLE_TABS: Record<UserRole, string[]> = {
  prospecteur: ['/', 'prospection', 'sync', 'profile'],
  chef_equipe: ['/', 'fiches', 'supervision', 'sync', 'profile'],
  agent_encadreur: ['/', 'prospection', 'sync', 'profile'],
  pilote: ['/', 'prospection', 'sync', 'profile'],
  mecanicien: ['/', 'sync', 'profile'],
  chef_de_base: ['/', 'fiches', 'supervision', 'sync', 'profile'],
  admin: ['/', 'prospection', 'fiches', 'supervision', 'sync', 'profile'],
};

const TAB_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  prospection: 'Prospection',
  fiches: 'Fiches',
  supervision: 'Supervision',
  sync: 'Sync',
  profile: 'Profil',
};

export default function AppTabs() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'prospecteur';
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.prospecteur;

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {allowedTabs.map((href) => (
            <TabTrigger key={href} name={href} href={href === '/' ? '/' : `/${href}` as any} asChild>
              <TabButton>{TAB_LABELS[href] ?? href}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const mode = useThemeStore((state) => state.mode);
  const colors = Colors[mode];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          IFVM Mobile
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
