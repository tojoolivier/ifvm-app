/**
 * Design tokens partagés entre les écrans "Mes fiches" ((app)/fiches.tsx) et
 * "Mes prospections" ((app)/prospection.tsx) — évite la redéfinition des
 * mêmes couleurs dans chaque écran (cf. traitement/tokens.ts pour le même
 * principe côté module traitement).
 */
import type { AppIconName } from '@/components/ui/AppIcon';

// Maquette « Mes fiches · Liste » : vert de marque, tinte verte et fond crème du DESIGN.md.
export const FICHES_GREEN = '#235A36';
export const FICHES_GREEN_DARK = '#235A36';
export const FICHES_GREEN_LIGHT = '#EAF2EC';
export const FICHES_ORANGE = '#E67E22';
export const FICHES_BG = '#FAF7EF';
export const FICHES_CARD_BG = '#FFFFFF';
export const FICHES_TEXT_DARK = '#1A1A1A';
export const FICHES_TEXT_SECONDARY = '#757575';

export interface BadgeStyle {
  label: string;
  icon?: string;
  /** Icône vectorielle de la maquette « Mes fiches · Liste » ; prime sur `icon` (emoji). */
  iconName?: AppIconName;
  color: string;
  bg: string;
}

/** Badges de statut — couvre à la fois le pipeline de validation backend (#16) et le statut de synchronisation local. */
export const STATUT_BADGE_CONFIG: Record<string, BadgeStyle> = {
  brouillon: { label: 'Brouillon', color: '#7C7C7C', bg: '#EFEADA' },
  a_synchro: { label: 'À SYNCHRO', color: '#92400E', bg: '#FEF3C7' },
  // Distinct de `a_synchro` : le serveur a refusé la fiche (422/400…), la
  // renvoyer à l'identique reproduirait le refus — contrairement à `a_synchro`
  // qui n'attend que le réseau. Voir prospection-statut.ts.
  echec_synchro: { label: 'ÉCHEC ENVOI', color: '#D32F2F', bg: '#FBECE9' },
  synchro: { label: 'SYNCHRO ✓', color: '#15803D', bg: '#DCFCE7' },
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
  verifiee: { label: 'Vérifiée', color: '#2563EB', bg: '#DBEAFE' },
  validee: { label: 'Validée', color: '#15803D', bg: '#DCFCE7' },
  rejetee: { label: 'Rejetée', color: '#DC2626', bg: '#FEE2E2' },
};

/** Badges de type de fiche (catégorie de premier niveau). */
export const TYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  PROSPECTION: { label: 'PRO', iconName: 'prospections', color: '#4777A2', bg: '#EAF1F7' },
  CRT: { label: 'CRT', iconName: 'crt', color: '#6D3FC4', bg: '#F1EDFB' },
  METEO: { label: 'MET', iconName: 'meteo', color: '#F59E0B', bg: '#FEF3C7' },
};

/** Badges de sous-type de prospection (intensive / extensive / validation). */
export const PROSPECTION_SUBTYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  intensive: { label: 'INT', iconName: 'intensif', color: '#4777A2', bg: '#EAF1F7' },
  extensive: { label: 'EXT', iconName: 'extensif', color: '#6D3FC4', bg: '#F1EDFB' },
  validation: { label: 'VAL', icon: '☑️', color: '#B45309', bg: '#FEF3C7' },
};

/** Badges de sous-type de traitement (aérien / terrestre). */
export const TRAITEMENT_SUBTYPE_BADGE_CONFIG: Record<string, BadgeStyle> = {
  AERIEN: { label: 'AÉRIEN', icon: '🚁', color: '#0891B2', bg: '#CFFAFE' },
  TERRESTRE: { label: 'TERRESTRE', icon: '🚜', color: '#166534', bg: '#DCFCE7' },
};

/**
 * #zone-a-reprendre-insigne : insigne d'une fiche de traitement validée dont
 * la surface restante n'est pas encore intégralement traitée — sur « Mes
 * fiches » ET « Zones à reprendre » (`FicheCard.insigneBadge`), pour repérer
 * au premier coup d'œil, sans ouvrir la liste dédiée, qu'un traitement mérite
 * d'être repris.
 */
export const TRAITEMENT_INSIGNE_REPRISE: BadgeStyle = {
  label: 'REPRISE POSSIBLE',
  icon: '↻',
  color: '#B45309',
  bg: '#FEF3C7',
};
