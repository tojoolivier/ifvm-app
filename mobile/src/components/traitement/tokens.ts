/**
 * Design tokens pour le module "fiche de traitement" (Lot 2).
 * Transcrits verbatim du hand-off design (voir prompt de l'agent) — raw hex,
 * pas de tokens Tailwind : suit la convention déjà en place dans
 * `src/app/(prospection)/*.tsx` (StyleSheet.create + hex), pas la capacité
 * théorique de NativeWind.
 */
export const traitementColors = {
  vertPrincipal: '#235a36',
  fondApp: '#faf7ef',
  carte: '#fff',
  bordure: '#e7e0cd',
  infoFond: '#eaf2ec',

  texteTitre: '#16201a',
  texteSecondaire: '#6f6a59',
  texteLabel: '#9a9484',
  texteNote: '#7a7259',

  avertissementFond: '#fdf6e7',
  avertissementBordure: '#f0e2bf',
  avertissementTexte: '#8a6d2f',
  attente: '#e89b2b',

  erreurFond: '#fbe9e5',
  erreurBordure: '#f0c4b9',
  erreurTexte: '#a5341c',
  danger: '#c0412b',

  chipInactive: '#efeada',
  chipInactiveAlt: '#faf7ef',
  segmentInactif: '#dcd5c2',

  dashedBordure: '#bdb6a2',
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

export const traitementTypeSizes = {
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
