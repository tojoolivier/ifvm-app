import { View, StyleSheet } from 'react-native';
import { traitementColors } from './tokens';

export const PROGRESS_SEGMENTS = ['Références', 'Cibles', 'Traitement', 'Moyens', 'Impacts', 'Signatures'] as const;

interface ProgressBarProps {
  /** Index (0-based) du segment courant parmi PROGRESS_SEGMENTS ; -1 masque la progression (Sélection/Récapitulatif). */
  currentIndex: number;
}

/** Barre de progression à 6 segments — n'apparaît que sur les écrans A à F. */
export function ProgressBar({ currentIndex }: ProgressBarProps) {
  return (
    <View style={styles.row} accessibilityLabel={`Étape ${currentIndex + 1} sur ${PROGRESS_SEGMENTS.length} : ${PROGRESS_SEGMENTS[currentIndex] ?? ''}`}>
      {PROGRESS_SEGMENTS.map((label, index) => (
        <View key={label} style={[styles.segment, index <= currentIndex && styles.segmentActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: traitementColors.segmentInactif },
  segmentActive: { backgroundColor: traitementColors.vertPrincipal },
});
