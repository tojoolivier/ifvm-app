import { View, StyleSheet } from 'react-native';
import { traitementColors } from './tokens';

// « Traitement » (traitement.tsx à l'origine) devient « Équipe » — personnes, aéronef
// et rattachement (base principale/stand/base secondaire) — et un nouveau segment
// « Traitement » s'insère juste après (rotations.tsx : pesticides, rotations,
// opérations) — aérien seulement, puisque les rotations n'ont pas d'équivalent côté
// terrestre (produits utilisés restés sur l'écran Équipe). #equipe-slide-aerien. Les
// deux flux ont donc un nombre d'étapes différent (7 vs 6) : deux listes séparées
// plutôt qu'une seule masquant/affichant un segment selon le type.
export const PROGRESS_SEGMENTS_AERIEN = [
  'Références',
  'Cibles',
  'Équipe',
  'Traitement',
  'Moyens',
  'Impacts',
  'Signatures',
] as const;

export const PROGRESS_SEGMENTS_TERRESTRE = [
  'Références',
  'Cibles',
  'Équipe',
  'Moyens',
  'Impacts',
  'Signatures',
] as const;

type Segments = readonly string[];

interface ProgressBarProps {
  /** Index (0-based) du segment courant parmi `segments` ; -1 masque la progression (Sélection/Récapitulatif). */
  currentIndex: number;
  /** PROGRESS_SEGMENTS_AERIEN par défaut : au pire un segment « Rotations » en trop
   * tant que le type n'est pas encore choisi (références.tsx), jamais un index qui
   * pointe hors liste. */
  segments?: Segments;
}

/** Barre de progression à 6 ou 7 segments selon le type de traitement — n'apparaît
 * que sur les écrans A à F/G. */
export function ProgressBar({ currentIndex, segments = PROGRESS_SEGMENTS_AERIEN }: ProgressBarProps) {
  return (
    <View style={styles.row} accessibilityLabel={`Étape ${currentIndex + 1} sur ${segments.length} : ${segments[currentIndex] ?? ''}`}>
      {segments.map((label, index) => (
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
