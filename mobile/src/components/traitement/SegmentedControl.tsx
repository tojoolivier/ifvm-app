import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from './tokens';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Si vrai, un ré-appui sur le segment sélectionné le désélectionne (ex: mode de traitement). */
  deselectable?: boolean;
}

/** Contrôle segmenté plein-largeur (2-3 options) — type/mode de traitement. */
export function SegmentedControl<T extends string>({ options, value, onChange, deselectable }: SegmentedControlProps<T>) {
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
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

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    segment: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: traitementRadii.chip,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      backgroundColor: traitementColors.carte,
    },
    segmentSelected: { backgroundColor: traitementColors.vertPrincipal, borderColor: traitementColors.vertPrincipal },
    label: {
      fontFamily: traitementFonts.uiSemiBold,
      fontSize: typeSizes.corps,
      color: traitementColors.texteSecondaire,
      // Un libellé plus long ("Couvertures totales") passe sur deux lignes dans
      // un segment `flex: 1` partagé à trois — sans `textAlign`, ces lignes
      // restent calées à gauche de leur bloc de texte pendant que "Barrières"/
      // "Irrégulier", tenant sur une seule ligne, semblaient déjà centrés (leur
      // bloc épouse le texte). Centrage explicite, valable quelle que soit la
      // longueur du libellé.
      textAlign: 'center',
    },
    labelSelected: { color: '#fff' },
  });
}
