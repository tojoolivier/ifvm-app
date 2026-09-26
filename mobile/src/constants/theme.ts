/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171d19',
    background: '#f5efe3',
    backgroundElement: '#f9f4ec',
    backgroundSelected: '#e9dfc4',
    textSecondary: '#2f4339',
    screen: '#F0F2F5',
    card: '#FFFFFF',
    border: '#F0F0F0',
    inputBg: '#F5F5F5',
    inputBorder: '#E0E0E0',
    chipBg: '#F0F2F5',
    title: '#1A237E',
    muted: '#757575',
    faint: '#9E9E9E',
    greenSoft: '#E8F5E9',
    dangerBorder: '#FCE4EC',
    switchTrackOff: '#D1D5DB',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    success: '#15803D',
    successBg: '#DCFCE7',
    successBorder: '#86EFAC',
    warn: '#8A6D2F',
    warnBg: '#FDF6E7',
    warnBorder: '#F0E2BF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    screen: '#0B0C0E',
    card: '#1A1C1F',
    border: '#2E3135',
    inputBg: '#25272B',
    inputBorder: '#3A3E44',
    chipBg: '#2E3135',
    title: '#C5CAE9',
    muted: '#B0B4BA',
    faint: '#8A8F96',
    greenSoft: '#1E3A22',
    dangerBorder: '#5A2A33',
    switchTrackOff: '#4B5058',
    danger: '#F87171',
    dangerBg: '#3A1D22',
    success: '#4ADE80',
    successBg: '#1E3A22',
    successBorder: '#2F6B3F',
    warn: '#FBBF24',
    warnBg: '#3A3020',
    warnBorder: '#5A4A2A',
  },
} as const;

/** Palette du thème courant (clair ou sombre) — passée aux fabriques `createStyles`. */
export type ThemePalette = (typeof Colors)[keyof typeof Colors];

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Jetons du socle UI de la réécriture (#721) — variables du fichier Figma
 * « Prototype — Prospection » (`color/*`, `radius/*`). Mêmes valeurs que les
 * `colors` de `DESIGN.md` (source de référence pour le clair) ; le sombre
 * est dérivé ici. Les composants de `components/ui/` ne lisent que ceci.
 */
export const UiColors = {
  light: {
    primary: '#235a36',
    onPrimary: '#ffffff',
    /** Tuile / pastille translucide posée sur un fond `primary` (carte « Position GPS »). */
    onPrimaryTile: 'rgba(255, 255, 255, 0.12)',
    onPrimaryPill: 'rgba(255, 255, 255, 0.16)',
    surface: '#ffffff',
    surfaceMuted: '#f4efe2',
    border: '#e7e0cd',
    borderField: '#e0d9c4',
    fg: '#16201a',
    fg2: '#3a3a30',
    fg3: '#6f6a59',
    fgWeak: '#9a9484',
    amber: '#e89b2b',
    greenBg: '#eaf2ec',
    /** Barre d'imbrication des surfaces (maquette `strate/herbeuse`). */
    strateHerbeuse: '#6aa84f',
    /** Pastilles et barre de la végétation intensive : sol nu, arbustive (maquette 02b), les autres teintes sont provisoires. */
    strateSolNu: '#c9c1ab',
    strateArbustive: '#3f7d4f',
    strateArboree: '#2c5e3f',
    strateBuissonneuse: '#8fb573',
    strateCulturesSeches: '#d9b64f',
    strateCulturesHygro: '#4f9bb0',
    greenBorder: '#cfe0d4',
    infoText: '#3a5c43',
    warnText: '#8a6d2f',
    warnBg: '#fdf6e7',
    warnBorder: '#f0e2bf',
    dangerText: '#a5341c',
    /** Part infestée de la barre des surfaces (maquette `color/danger`). */
    danger: '#c0412b',
    dangerBg: '#fbe9e5',
    dangerBorder: '#f0c4b9',
    overlay: 'rgba(22, 32, 26, 0.45)',
  },
  dark: {
    primary: '#4ea36b',
    onPrimary: '#0b1a10',
    onPrimaryTile: 'rgba(11, 26, 16, 0.12)',
    onPrimaryPill: 'rgba(11, 26, 16, 0.16)',
    surface: '#1a1c1f',
    surfaceMuted: '#25272b',
    border: '#2e3135',
    borderField: '#3a3e44',
    fg: '#f3f1ea',
    fg2: '#d8d5c9',
    fg3: '#b0b4ba',
    fgWeak: '#8a8f96',
    amber: '#f0b34f',
    greenBg: '#1e3a22',
    strateHerbeuse: '#6aa84f',
    /** Pastilles et barre de la végétation intensive : sol nu, arbustive (maquette 02b), les autres teintes sont provisoires. */
    strateSolNu: '#c9c1ab',
    strateArbustive: '#3f7d4f',
    strateArboree: '#2c5e3f',
    strateBuissonneuse: '#8fb573',
    strateCulturesSeches: '#d9b64f',
    strateCulturesHygro: '#4f9bb0',
    greenBorder: '#2f6b3f',
    infoText: '#a9d6b8',
    warnText: '#fbbf24',
    warnBg: '#3a3020',
    warnBorder: '#5a4a2a',
    dangerText: '#f87171',
    danger: '#c0412b',
    dangerBg: '#3a1d22',
    dangerBorder: '#5a2a33',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type UiPalette = (typeof UiColors)[keyof typeof UiColors];

/** Rayons Figma : `radius/sm` (champs), `radius/md` (boutons, cartes), `radius/full` (puces). */
export const Radius = { sm: 8, md: 12, lg: 16, panel: 10, sheet: 18, full: 999 } as const;

/** Espacements du socle UI — la clé est la valeur en px de la maquette (`UiSpace[12]` = 12). */
export const UiSpace = { 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16, 32: 32 } as const;

/** Épaisseurs de bordure : filet (cartes, bandeaux) et champ/puce/bouton secondaire. */
export const UiBorder = { hairline: 1, field: 1.5 } as const;

/** Opacités d'état : composant désactivé, bouton de pas en butée. */
export const UiOpacity = { disabled: 0.5, limit: 0.4 } as const;

/** Hauteurs et tailles fixes des composants de la maquette. */
export const UiSize = {
  chip: 40,
  stepperButton: 40,
  stepperValueMin: 64,
  field: 48,
  button: 54,
  pastille: 28,
  progressSegment: 4,
  surfaceBar: 10,
  /** Pastille ronde d'une ligne « détectée » et son icône ; point de légende des surfaces. */
  pastilleLigne: 36,
  iconeLigne: 18,
  iconeTitre: 20,
  pointLegende: 8,
  /** Végétation intensive : barre empilée de la répartition et pastille de couleur d'une strate. */
  barreRepartition: 14,
  pastilleStrate: 12,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
  timelineTrait: 2,
  hitSlop: 10,
} as const;

/** IBM Plex Mono chargée par `lib/fonts.ts` — n° de fiche (chasse fixe). */
export const MonoFonts = { medium: 'IBMPlexMono_500Medium' } as const;

/** Polices Inter chargées par `lib/fonts.ts`. */
export const InterFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Styles de texte Figma (Body Medium, Numeric, Caption, Button, Heading, Micro, Eyebrow…). */
export const UiText = {
  bodyMedium: { fontFamily: InterFonts.medium, fontSize: 15, lineHeight: 20 },
  subheading: { fontFamily: InterFonts.semiBold, fontSize: 15, lineHeight: 20 },
  numeric: { fontFamily: InterFonts.semiBold, fontSize: 20, lineHeight: 24 },
  numericLarge: { fontFamily: InterFonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  caption: { fontFamily: InterFonts.regular, fontSize: 13, lineHeight: 17 },
  captionMedium: { fontFamily: InterFonts.medium, fontSize: 13, lineHeight: 17 },
  button: { fontFamily: InterFonts.semiBold, fontSize: 16, lineHeight: 20 },
  heading: { fontFamily: InterFonts.semiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  micro: { fontFamily: InterFonts.medium, fontSize: 11, lineHeight: 13 },
  eyebrow: {
    fontFamily: InterFonts.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} as const;
