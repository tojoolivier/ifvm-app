// Logique pure de la « Fiche de vol » (suivi des heures de vol, backend
// `app/domain/fiche_vol.py` — cahier des charges « Formulaire de gestion des
// heures de vol », ADR-011 §7). Gardée hors des composants pour rester
// testable sans monter de rendu React, même patron que dashboard-metrics.ts.

/** `TYPES_VOL` côté backend (app/domain/fiche_vol.py) — ordre sans importance ici. */
export const TYPE_VOL_LABELS: Record<string, string> = {
  PROSPECTION: 'Prospection',
  MEP: 'Mise en place',
  APPLICATION: 'Application',
  CONVOYAGE: 'Convoyage',
  DIVERS: 'Divers',
}

/** `ROLES_SIGNATURE` côté backend. */
export const ROLE_SIGNATURE_LABELS: Record<string, string> = {
  PILOTE: 'Pilote',
  MECANICIEN: 'Mécanicien',
  CHEF_DE_BASE: 'Chef de base',
  CONSULTANT_INTERNATIONAL: 'Consultant international',
}

/**
 * Minutes -> `HH:MM`, même convention que `formatDuree` côté mobile
 * (`mobile/src/lib/prospection-extensive.ts`) — un total d'heures de vol
 * affiché à l'identique, que ce soit consulté sur le terrain ou au bureau.
 */
export function formatDureeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
