import { Pressable, StyleSheet, Text } from 'react-native';
import { InterFonts, Radius, UiBorder, UiOpacity, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  label: string;
  /** État On (sélectionnée) ou Off. */
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Variante des filtres « phases / stades vus » (maquette K1) : texte 13, padding 10 × 6, sans hauteur fixe. */
  compact?: boolean;
  /** Marge horizontale réduite, pour les rangées de puces à largeur égale (`flex: 1`) où le libellé serait tronqué. */
  serre?: boolean;
  testID?: string;
};

/** Puce de sélection (choix unique ou multiple) — maquette `Chip` On / Off. */
export function Chip({ label, selected, onPress, disabled, compact, serre, testID }: Props) {
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
        compact && styles.compacte,
        serre && styles.serre,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.borderField,
          opacity: disabled ? UiOpacity.disabled : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={!compact}
        minimumFontScale={0.8}
        style={[compact ? UiText.captionMedium : UiText.bodyMedium, { color: selected ? c.onPrimary : c.fg2, fontFamily: InterFonts.medium }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: UiSize.chip,
    paddingHorizontal: UiSpace[16],
    borderRadius: Radius.full,
    borderWidth: UiBorder.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serre: { paddingHorizontal: UiSpace[4] },
  compacte: { height: undefined, paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[6] },
});
