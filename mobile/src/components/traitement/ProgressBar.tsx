import { View, Text, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementTypeSizes } from './tokens';

export const PROGRESS_SEGMENTS = ['Références', 'Cibles', 'Traitement', 'Moyens', 'Impacts', 'Signatures'] as const;

interface ProgressBarProps {
  /** Index (0-based) du segment courant parmi PROGRESS_SEGMENTS ; -1 masque la progression (Sélection/Récapitulatif). */
  currentIndex: number;
}

/** Barre de progression à 6 segments — n'apparaît que sur les écrans A à F. */
export function ProgressBar({ currentIndex }: ProgressBarProps) {
  return (
    <View style={styles.row}>
      {PROGRESS_SEGMENTS.map((label, index) => (
        <View key={label} style={styles.segmentWrapper}>
          <View style={[styles.segment, index <= currentIndex && styles.segmentActive]} />
          <Text style={[styles.label, index === currentIndex && styles.labelActive]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  segmentWrapper: { flex: 1, alignItems: 'center', gap: 4 },
  segment: { height: 3, width: '100%', borderRadius: 2, backgroundColor: traitementColors.segmentInactif },
  segmentActive: { backgroundColor: traitementColors.vertPrincipal },
  label: {
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.label,
    color: traitementColors.texteLabel,
  },
  labelActive: {
    fontFamily: traitementFonts.uiSemiBold,
    color: traitementColors.vertPrincipal,
  },
});
