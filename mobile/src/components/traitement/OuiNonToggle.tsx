import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, useTraitementTypeSizes } from './tokens';

interface ToggleOption {
  label: string;
  selected: boolean;
  onPress: () => void;
}

interface OuiNonToggleProps {
  options: [ToggleOption, ToggleOption];
  disabled?: boolean;
}

/**
 * Bascule binaire (Non/Oui) pleine largeur en un seul bloc — un unique pavé
 * arrondi coupé en deux, pas deux `Chip` séparées par un espace (maquette
 * fournie explicitement, écran Impacts & risque). Générique : accepte deux
 * options quelconques (label/selected/onPress), la logique de sélection —
 * y compris les cas tri-état (ex. AXES_RISQUE, valeur non encore renseignée
 * → aucune des deux sélectionnée) — reste entièrement du côté de l'appelant.
 */
export function OuiNonToggle({ options, disabled }: OuiNonToggleProps) {
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.label}
          accessibilityRole="button"
          accessibilityState={{ selected: option.selected, disabled }}
          disabled={disabled}
          onPress={option.onPress}
          style={[
            styles.segment,
            index === 0 ? styles.segmentLeft : styles.segmentRight,
            option.selected && styles.segmentSelected,
            disabled && styles.segmentDisabled,
          ]}
        >
          <Text style={[styles.label, option.selected && styles.labelSelected]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      minHeight: 48,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: traitementColors.chipInactive,
    },
    segment: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // `overflow: hidden` sur le conteneur suffit à découper les coins visibles
    // en pilule unique — pas besoin de rayon par segment.
    segmentLeft: {},
    segmentRight: {},
    segmentSelected: { backgroundColor: traitementColors.vertPrincipal },
    segmentDisabled: { opacity: 0.5 },
    label: {
      fontFamily: traitementFonts.uiSemiBold,
      fontSize: typeSizes.corps + 2,
      color: traitementColors.texteSecondaire,
    },
    labelSelected: { color: '#fff' },
  });
}
