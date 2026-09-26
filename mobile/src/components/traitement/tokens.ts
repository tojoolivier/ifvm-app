import { useMemo } from 'react';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

/**
 * Design tokens pour le module "fiche de traitement" (Lot 2).
 * Transcrits verbatim du hand-off design (voir prompt de l'agent) — raw hex,
 * pas de tokens Tailwind : suit la convention déjà en place dans
 * `src/app/(prospection)/*.tsx` (StyleSheet.create + hex), pas la capacité
 * théorique de NativeWind.
 */
export const traitementColors = {
  vertPrincipal: '#1f5b39',
  fondApp: '#f5efe3',
  carte: '#fffdf8',
  bordure: '#d1c2a1',
  infoFond: '#edf5ee',

  texteTitre: '#171d19',
  texteSecondaire: '#2f4339',
  texteLabel: '#4b5e51',
  texteNote: '#5a4d3d',

  avertissementFond: '#fff8ea',
  avertissementBordure: '#e7cc7c',
  avertissementTexte: '#744d13',
  attente: '#d48a1d',

  erreurFond: '#fdf0ed',
  erreurBordure: '#e7a894',
  erreurTexte: '#7b2d1d',
  danger: '#b63a28',

  chipInactive: '#f1e7d6',
  chipInactiveAlt: '#f7f1e8',
  segmentInactif: '#d3c5a7',

  dashedBordure: '#9a8f76',
} as const;

export const traitementFonts = {
  ui: 'Archivo_400Regular',
  uiMedium: 'Archivo_500Medium',
  uiSemiBold: 'Archivo_600SemiBold',
  uiBold: 'Archivo_700Bold',
  uiExtraBold: 'Archivo_800ExtraBold',
  mono: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

export const traitementRadii = {
  chip: 7.5,
  carte: 9.5,
  boutonPrincipal: 13,
  carteAccueil: 14,
} as const;

export const traitementSpacing = {
  gapSmall: 5,
  gapMedium: 6.5,
  gapLarge: 8,
  paddingCarte: 10,
} as const;

/**
 * Base non mise à l'échelle — jamais consommée directement par un écran
 * (`traitementTypeSizes` en gardait l'habitude, retiré : #taille-police-par-
 * utilisateur exige une valeur réactive au réglage courant). Utiliser
 * `useTraitementTypeSizes()` ci-dessous.
 */
const BASE_TRAITEMENT_TYPE_SIZES = {
  // Agrandi de 9 à 12 (demande explicite : les titres de champ des fiches de
  // traitement étaient trop petits/peu visibles, l'écran devait se sentir
  // « bien occupé » plutôt que clairsemé). Ce token est partagé par les
  // libellés de champ ET par du texte accessoire (indices, erreurs, sous-
  // titres de listes) — l'agrandissement profite à l'ensemble, cohérent avec
  // la demande d'une meilleure lisibilité générale sur ce module.
  label: 12,
  corps: 11.5,
  titreEcran: 15,
  valeurDerivee: 17.5,
} as const;

/**
 * Tailles du module « traitement » mises à l'échelle du réglage « Taille de
 * police » courant (#taille-police-par-utilisateur, `hooks/use-font-scale.ts`).
 * Chaque écran qui consommait `traitementTypeSizes` (constante figée à
 * l'import) appelle désormais ce hook, et déplace son `StyleSheet.create`
 * dans le corps du composant (`useMemo(() => StyleSheet.create({...}),
 * [typeSizes])`) pour que le recalcul soit pris en compte sans relancer l'app.
 */
export function useTraitementTypeSizes() {
  const { scale } = useFontScale();
  return useMemo(() => scaleTypeSizes(BASE_TRAITEMENT_TYPE_SIZES, scale), [scale]);
}
