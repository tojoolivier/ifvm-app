import { StyleSheet, Text, View } from 'react-native';
import { Radius, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = { libelle: string; valeur: string; testID?: string };

/** Chiffre clé (temps de vol, nombre de posers…) — maquette `StatTile`. */
export function StatTile({ libelle, valeur, testID }: Props) {
  const c = useUiTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${libelle} : ${valeur}`}
      style={[styles.root, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text style={[UiText.micro, { color: c.fg3 }]}>{libelle}</Text>
      <Text style={[UiText.numericLarge, { color: c.primary }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: UiSpace[2], paddingHorizontal: UiSpace[14], paddingVertical: UiSpace[12], borderRadius: Radius.md, borderWidth: 1 },
});
