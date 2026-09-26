import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, UiBorder, UiSpace } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string };

/** Carte : surface, bordure et rayon `radius/md` de la maquette. */
export function Card({ children, style, testID }: Props) {
  const c = useUiTheme();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: UiSpace[16], borderRadius: Radius.md, borderWidth: UiBorder.hairline, gap: UiSpace[12] },
});
