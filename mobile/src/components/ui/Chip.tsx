import { Pressable, StyleSheet, Text } from 'react-native';
import { InterFonts, Radius, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  label: string;
  /** État On (sélectionnée) ou Off. */
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Puce de sélection (choix unique ou multiple) — maquette `Chip` On / Off. */
export function Chip({ label, selected, onPress, disabled, testID }: Props) {
  const c = useUiTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.borderField,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[UiText.bodyMedium, { color: selected ? c.onPrimary : c.fg2, fontFamily: InterFonts.medium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
