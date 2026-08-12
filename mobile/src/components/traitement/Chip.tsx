import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from './tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Chip de sélection (rôles, produits, zones, familles...) — cible tactile ≥44px. */
export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: traitementRadii.chip,
    backgroundColor: traitementColors.chipInactive,
  },
  chipSelected: {
    backgroundColor: traitementColors.vertPrincipal,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: traitementFonts.uiMedium,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteSecondaire,
  },
  labelSelected: {
    color: '#fff',
  },
});
