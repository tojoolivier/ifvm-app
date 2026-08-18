/**
 * Design tokens partagés entre les écrans "Mes fiches" ((app)/fiches.tsx) et
 * "Mes prospections" ((app)/prospection.tsx) — évite la redéfinition des
 * mêmes couleurs dans chaque écran (cf. traitement/tokens.ts pour le même
 * principe côté module traitement).
 */
export const FICHES_GREEN = '#1B5E1B';
export const FICHES_GREEN_DARK = '#163F16';
export const FICHES_GREEN_LIGHT = '#E8F3E8';
export const FICHES_ORANGE = '#E67E22';
export const FICHES_BG = '#F3F4F6';
export const FICHES_CARD_BG = '#FFFFFF';
export const FICHES_TEXT_DARK = '#1A1A1A';
export const FICHES_TEXT_SECONDARY = '#757575';

export interface BadgeStyle {
  label: string;
  icon?: string;
  color: string;
  bg: string;
}

/** Badges de statut — couvre à la fois le pipeline de validation backend (#16) et le statut de synchronisation local. */
export const STATUT_BADGE_CONFIG: Record<string, BadgeStyle> = {
  brouillon: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  a_synchro: { label: 'À SYNCHRO', color: '#92400E', bg: '#FEF3C7' },
  synchro: { label: 'SYNCHRO ✓', color: '#15803D', bg: '#DCFCE7' },
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
  verifiee: { label: 'Vérifiée', color: '#2563EB', bg: '#DBEAFE' },
  validee: { label: 'Validée', color: '#15803D', bg: '#DCFCE7' },
  rejetee: { label: 'Rejetée', color: '#DC2626', bg: '#FEE2E2' },
};

/** Badges de type de fiche (catégorie de premier niveau). */
export const TYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  PROSPECTION: { label: 'PRO', icon: '🔍', color: '#2563EB', bg: '#DBEAFE' },
  CRT: { label: 'CRT', icon: '💊', color: '#7C3AED', bg: '#EDE9FE' },
  METEO: { label: 'MET', icon: '🌤️', color: '#F59E0B', bg: '#FEF3C7' },
};

/** Badges de sous-type de prospection (intensive / extensive / validation). */
export const PROSPECTION_SUBTYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  intensive: { label: 'INT', icon: '🌿', color: '#1D4ED8', bg: '#DBEAFE' },
  extensive: { label: 'EXT', icon: '🗒️', color: '#7C3AED', bg: '#EDE9FE' },
  validation: { label: 'VAL', icon: '☑️', color: '#B45309', bg: '#FEF3C7' },
};

/** Badges de sous-type de traitement (aérien / terrestre). */
export const TRAITEMENT_SUBTYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  AERIEN: { label: 'AÉRIEN', icon: '🚁', color: '#0891B2', bg: '#CFFAFE' },
  TERRESTRE: { label: 'TERRESTRE', icon: '🚜', color: '#166534', bg: '#DCFCE7' },
};
