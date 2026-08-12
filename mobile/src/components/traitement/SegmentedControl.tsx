import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from './tokens';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Si vrai, un ré-appui sur le segment sélectionné le désélectionne (ex: mode de traitement). */
  deselectable?: boolean;
}

/** Contrôle segmenté plein-largeur (2-3 options) — type/mode de traitement. */
export function SegmentedControl<T extends string>({ options, value, onChange, deselectable }: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(selected && deselectable ? null : option.value)}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, backgroundColor: traitementColors.chipInactiveAlt, borderRadius: traitementRadii.chip, padding: 3 },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: traitementRadii.chip - 1,
  },
  segmentSelected: { backgroundColor: traitementColors.vertPrincipal },
  label: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteSecondaire,
  },
  labelSelected: { color: '#fff' },
});
