export interface CompassDirection {
  label: string;
  deg: number;
}

export const COMPASS_DIRECTIONS: CompassDirection[] = [
  { label: 'N', deg: 0 },
  { label: 'NE', deg: 45 },
  { label: 'E', deg: 90 },
  { label: 'SE', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SO', deg: 225 },
  { label: 'O', deg: 270 },
  { label: 'NO', deg: 315 },
];

export function oppositeDirection(label: string): string {
  const index = COMPASS_DIRECTIONS.findIndex((d) => d.label === label);
  return COMPASS_DIRECTIONS[(index + 4) % COMPASS_DIRECTIONS.length].label;
}

const COMPASS_DIRECTION_LABELS: Record<string, string> = {
  N: 'Nord',
  NE: 'Nord-Est',
  E: 'Est',
  SE: 'Sud-Est',
  S: 'Sud',
  SO: 'Sud-Ouest',
  O: 'Ouest',
  NO: 'Nord-Ouest',
};

/**
 * Formate la « Direction du déplacement » choisie (ex. "NE") pour le
 * récapitulatif — toutes fiches de prospection confondues (Intensive,
 * Extensive, Validation/Revalidation, qui réutilisent les écrans de
 * l'Intensif) : n'affiche que l'élément réellement choisi par l'agent
 * ("vers Nord-Est"), sans le sens opposé dérivé automatiquement
 * (direction_vers/directionVers) qui n'a jamais été une saisie.
 */
export function formatDirectionDeplacement(code: string | null | undefined): string {
  if (!code) return '—';
  return `vers ${COMPASS_DIRECTION_LABELS[code] ?? code}`;
}

/** Seuil placeholder — à remplacer par le seuil critique agronomique réel une fois confirmé. */
const DENSITE_SEUIL_CRITIQUE = 300;

export function densityInsight(densiteMoy: number | null): string | null {
  if (densiteMoy == null) return null;
  return densiteMoy >= DENSITE_SEUIL_CRITIQUE
    ? 'Densité moyenne dépasse le seuil critique.'
    : 'Densité modérée, à surveiller.';
}

export function comportementInsight(
  comportement: 'repos' | 'deplacement' | null,
  ventVersLabel: string | null,
  ventVitesse: number | null
): string | null {
  if (comportement === 'deplacement' && ventVitesse != null) {
    return `Déplacement ${ventVersLabel ?? ''} + vent portant → progression vers les cultures à surveiller.`;
  }
  if (comportement === 'repos') {
    return 'Bande stable, pas de déplacement notable.';
  }
  return null;
}
