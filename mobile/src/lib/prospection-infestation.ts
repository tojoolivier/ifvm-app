import {
  InfestationRow,
  getProspectionInfestation,
  saveProspectionInfestation,
} from './prospection-repository';

export type TypeCible = 'tache_larvaire' | 'bande_larvaire' | 'vol_clair' | 'essaim';

export const TYPE_CIBLE_OPTIONS: { value: TypeCible; label: string }[] = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'essaim', label: 'Essaim' },
];

export type Comportement = 'repos' | 'deplacement';

export const COMPORTEMENT_OPTIONS: { value: Comportement; label: string }[] = [
  { value: 'repos', label: 'Repos' },
  { value: 'deplacement', label: 'Déplacement' },
];

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';

export const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'N', label: 'N' },
  { value: 'NE', label: 'NE' },
  { value: 'E', label: 'E' },
  { value: 'SE', label: 'SE' },
  { value: 'S', label: 'S' },
  { value: 'SO', label: 'SO' },
  { value: 'O', label: 'O' },
  { value: 'NO', label: 'NO' },
];

export interface InfestationDescriptionState {
  typeCible: TypeCible | null;
  tailleMin: string;
  tailleMax: string;
  tailleMoy: string;
  surfaceTot: string;
  densiteMin: string;
  densiteMax: string;
  densiteMoy: string;
  interdistance: string;
}

export const EMPTY_INFESTATION_DESCRIPTION: InfestationDescriptionState = {
  typeCible: null,
  tailleMin: '',
  tailleMax: '',
  tailleMoy: '',
  surfaceTot: '',
  densiteMin: '',
  densiteMax: '',
  densiteMoy: '',
  interdistance: '',
};

export interface InfestationComportementState {
  comportement: Comportement | null;
  directionVers: Direction | null;
  ventDe: Direction | null;
  ventVitesse: string;
}

export const EMPTY_INFESTATION_COMPORTEMENT: InfestationComportementState = {
  comportement: null,
  directionVers: null,
  ventDe: null,
  ventVitesse: '',
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toDisplayValue(value: number | null): string {
  return value != null ? String(value) : '';
}

/** Relit la description d'infestation déjà saisie */
export function parseInfestationDescription(row: InfestationRow | null): InfestationDescriptionState {
  if (!row) return EMPTY_INFESTATION_DESCRIPTION;
  return {
    typeCible: row.type_cible as TypeCible,
    tailleMin: toDisplayValue(row.taille_min),
    tailleMax: toDisplayValue(row.taille_max),
    tailleMoy: toDisplayValue(row.taille_moy),
    surfaceTot: toDisplayValue(row.surface_tot),
    densiteMin: toDisplayValue(row.densite_min),
    densiteMax: toDisplayValue(row.densite_max),
    densiteMoy: toDisplayValue(row.densite_moy),
    interdistance: toDisplayValue(row.interdistance),
  };
}

/** Relit le comportement d'infestation déjà saisi */
export function parseInfestationComportement(row: InfestationRow | null): InfestationComportementState {
  if (!row) return EMPTY_INFESTATION_COMPORTEMENT;
  return {
    comportement: (row.comportement ?? null) as Comportement | null,
    directionVers: (row.direction_vers ?? null) as Direction | null,
    ventDe: (row.vent_de ?? null) as Direction | null,
    ventVitesse: toDisplayValue(row.vent_vitesse),
  };
}

export function isInfestationDescriptionComplete(state: InfestationDescriptionState): boolean {
  return state.typeCible != null;
}

/** Persiste la description d'infestation, en préservant le comportement déjà saisi */
export async function saveInfestationDescription(
  prospectionId: string,
  state: InfestationDescriptionState,
  espece?: string | null  // ← Rendre optionnel avec ?
): Promise<void> {
  const existing = await getProspectionInfestation(prospectionId);
  await saveProspectionInfestation(prospectionId, {
    espece: espece ?? existing?.espece ?? null,  // ← Utiliser existing si non fourni
    type_cible: state.typeCible ?? '',
    taille_min: toNumberOrNull(state.tailleMin),
    taille_max: toNumberOrNull(state.tailleMax),
    taille_moy: toNumberOrNull(state.tailleMoy),
    surface_tot: toNumberOrNull(state.surfaceTot),
    densite_min: toNumberOrNull(state.densiteMin),
    densite_max: toNumberOrNull(state.densiteMax),
    densite_moy: toNumberOrNull(state.densiteMoy),
    interdistance: toNumberOrNull(state.interdistance),
    comportement: existing?.comportement ?? null,
    direction_vers: existing?.direction_vers ?? null,
    vent_de: existing?.vent_de ?? null,
    vent_vitesse: existing?.vent_vitesse ?? null,
  });
}

/** Persiste le comportement d'infestation, en préservant la description déjà saisie */
export async function saveInfestationComportement(
  prospectionId: string,
  state: InfestationComportementState
): Promise<void> {
  const existing = await getProspectionInfestation(prospectionId);
  await saveProspectionInfestation(prospectionId, {
    espece: existing?.espece ?? null,
    type_cible: existing?.type_cible ?? '',
    taille_min: existing?.taille_min ?? null,
    taille_max: existing?.taille_max ?? null,
    taille_moy: existing?.taille_moy ?? null,
    surface_tot: existing?.surface_tot ?? null,
    densite_min: existing?.densite_min ?? null,
    densite_max: existing?.densite_max ?? null,
    densite_moy: existing?.densite_moy ?? null,
    interdistance: existing?.interdistance ?? null,
    comportement: state.comportement,
    direction_vers: state.directionVers,
    vent_de: state.ventDe,
    vent_vitesse: toNumberOrNull(state.ventVitesse),
  });
}