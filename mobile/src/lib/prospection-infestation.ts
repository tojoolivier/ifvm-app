import {
  InfestationRow,
  getProspectionInfestation,
  saveProspectionInfestation,
} from './prospection-repository';

export type TypeCible = 'tache_larvaire' | 'bande_larvaire' | 'vol_clair' | 'essaim';

export type TypeEssaim = 'vol_clair' | 'dense' | 'tres_dense';

export type TypeLarve = 'tache_larvaire' | 'bande_larvaire';

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
  pullulationNb: string;
  tailleLong: string;
  tailleLarge: string;
  tailleEpaisseur: string;
  essaimEnVol: boolean | null;
  essaimPose: boolean | null;
  typeEssaim: TypeEssaim | null;
  nbTachesBandes: string;
  interdistanceM: string;
  surfaceContamineeHa: string;
  typeLarve: TypeLarve | null;
  surfInfesteePourcent: string;
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
  pullulationNb: '',
  tailleLong: '',
  tailleLarge: '',
  tailleEpaisseur: '',
  essaimEnVol: null,
  essaimPose: null,
  typeEssaim: null,
  nbTachesBandes: '',
  interdistanceM: '',
  surfaceContamineeHa: '',
  typeLarve: null,
  surfInfesteePourcent: '',
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
    pullulationNb: toDisplayValue(row.pullulation_nb),
    tailleLong: toDisplayValue(row.taille_long),
    tailleLarge: toDisplayValue(row.taille_large),
    tailleEpaisseur: toDisplayValue(row.taille_epaisseur),
    essaimEnVol: row.essaim_en_vol ?? null,
    essaimPose: row.essaim_pose ?? null,
    typeEssaim: (row.type_essaim as TypeEssaim) ?? null,
    nbTachesBandes: toDisplayValue(row.nb_taches_bandes),
    interdistanceM: toDisplayValue(row.interdistance_m),
    surfaceContamineeHa: toDisplayValue(row.surface_contaminee_ha),
    typeLarve: (row.type_larve as TypeLarve) ?? null,
    surfInfesteePourcent: toDisplayValue(row.surf_infestee_pourcent),
  };
}

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

export async function saveInfestationDescription(
  prospectionId: string,
  state: InfestationDescriptionState
): Promise<void> {
  const existing = await getProspectionInfestation(prospectionId);
  await saveProspectionInfestation(prospectionId, {
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
    direction_de: existing?.direction_de ?? null,
    direction_vers: existing?.direction_vers ?? null,
    vent_de: existing?.vent_de ?? null,
    vent_vitesse: existing?.vent_vitesse ?? null,
    pullulation_nb: toNumberOrNull(state.pullulationNb),
    taille_long: toNumberOrNull(state.tailleLong),
    taille_large: toNumberOrNull(state.tailleLarge),
    taille_epaisseur: toNumberOrNull(state.tailleEpaisseur),
    essaim_en_vol: state.essaimEnVol ?? null,
    essaim_pose: state.essaimPose ?? null,
    type_essaim: state.typeEssaim ?? null,
    nb_taches_bandes: toNumberOrNull(state.nbTachesBandes),
    interdistance_m: toNumberOrNull(state.interdistanceM),
    surface_contaminee_ha: toNumberOrNull(state.surfaceContamineeHa),
    type_larve: state.typeLarve ?? null,
    surf_infestee_pourcent: toNumberOrNull(state.surfInfesteePourcent),
  });
}

export async function saveInfestationComportement(
  prospectionId: string,
  state: InfestationComportementState
): Promise<void> {
  const existing = await getProspectionInfestation(prospectionId);
  await saveProspectionInfestation(prospectionId, {
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
    direction_de: existing?.direction_de ?? null,
    direction_vers: state.directionVers,
    vent_de: state.ventDe,
    vent_vitesse: toNumberOrNull(state.ventVitesse),
    pullulation_nb: existing?.pullulation_nb ?? null,
    taille_long: existing?.taille_long ?? null,
    taille_large: existing?.taille_large ?? null,
    taille_epaisseur: existing?.taille_epaisseur ?? null,
    essaim_en_vol: existing?.essaim_en_vol ?? null,
    essaim_pose: existing?.essaim_pose ?? null,
    type_essaim: existing?.type_essaim ?? null,
    nb_taches_bandes: existing?.nb_taches_bandes ?? null,
    interdistance_m: existing?.interdistance_m ?? null,
    surface_contaminee_ha: existing?.surface_contaminee_ha ?? null,
    type_larve: existing?.type_larve ?? null,
    surf_infestee_pourcent: existing?.surf_infestee_pourcent ?? null,
  });
}