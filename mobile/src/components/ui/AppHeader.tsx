import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconRetour } from './icons';

type Props = { titre: string; sousTitre?: string; onBack?: () => void; testID?: string };

/** En-tête simple des écrans hors wizard (aérien, journal) — maquette `AppHeader`. */
export function AppHeader({ titre, sousTitre, onBack, testID }: Props) {
  const c = useUiTheme();
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack} hitSlop={10}>
          <IconRetour color={c.fg} />
        </Pressable>
      ) : null}
      <View style={styles.textes}>
        <Text accessibilityRole="header" style={[UiText.heading, { color: c.fg }]}>
          {titre}
        </Text>
        {sousTitre ? <Text style={[UiText.caption, { color: c.fg3 }]}>{sousTitre}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  textes: { flex: 1, gap: 2 },
});
