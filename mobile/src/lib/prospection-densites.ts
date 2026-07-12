import {
  PopulationRow,
  getProspectionPopulation,
  saveProspectionPopulation,
} from './prospection-repository';

export type MethodeMesure = 'battage' | 'comptage_direct';

export const METHODE_OPTIONS: { value: MethodeMesure; label: string }[] = [
  { value: 'battage', label: 'Battage' },
  { value: 'comptage_direct', label: 'Comptage direct' },
];

export type Intensite = 'neant' | 'rare' | 'peu' | 'beaucoup' | 'dominant';

export const INTENSITE_OPTIONS: { value: Intensite; label: string }[] = [
  { value: 'neant', label: 'Néant' },
  { value: 'rare', label: 'Rare' },
  { value: 'peu', label: 'Peu' },
  { value: 'beaucoup', label: 'Beaucoup' },
  { value: 'dominant', label: 'Dominant' },
];

export interface DensitesState {
  diffuseImago: string;
  diffuseLarve: string;
  groupeeImago: string;
  groupeeLarve: string;
  methode: MethodeMesure | null;
}

export const EMPTY_DENSITES: DensitesState = {
  diffuseImago: '',
  diffuseLarve: '',
  groupeeImago: '',
  groupeeLarve: '',
  methode: null,
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toDisplayValue(value: number | null): string {
  return value != null ? String(value) : '';
}

/** Relit les densités déjà saisies pour une espèce (lignes `prospection_population` imago + larve). */
export function parseDensites(imago: PopulationRow | null, larve: PopulationRow | null): DensitesState {
  return {
    diffuseImago: toDisplayValue(imago?.densite_diffuse ?? null),
    diffuseLarve: toDisplayValue(larve?.densite_diffuse ?? null),
    groupeeImago: toDisplayValue(imago?.densite_groupee ?? null),
    groupeeLarve: toDisplayValue(larve?.densite_groupee ?? null),
    methode: (imago?.methode ?? larve?.methode ?? null) as MethodeMesure | null,
  };
}

/**
 * Persiste les densités diffuse/groupée saisies : une ligne `prospection_population` par
 * catégorie (imago/larve). Préserve l'accouplement/ponte déjà saisis (écran Accouplement/Ponte).
 */
export async function saveDensites(
  prospectionId: string,
  espece: 'LMC' | 'NSE',
  state: DensitesState
): Promise<void> {
  const [existingImago, existingLarve] = await Promise.all([
    getProspectionPopulation(prospectionId, espece, 'imago'),
    getProspectionPopulation(prospectionId, espece, 'larve'),
  ]);

  await saveProspectionPopulation(prospectionId, {
    espece,
    categorie: 'imago',
    densite_diffuse: toNumberOrNull(state.diffuseImago),
    densite_groupee: toNumberOrNull(state.groupeeImago),
    methode: state.methode,
    accouplement: existingImago?.accouplement ?? null,
    ponte: existingImago?.ponte ?? null,
  });

  await saveProspectionPopulation(prospectionId, {
    espece,
    categorie: 'larve',
    densite_diffuse: toNumberOrNull(state.diffuseLarve),
    densite_groupee: toNumberOrNull(state.groupeeLarve),
    methode: state.methode,
    accouplement: existingLarve?.accouplement ?? null,
    ponte: existingLarve?.ponte ?? null,
  });
}

export interface ReproductionState {
  accouplement: Intensite | null;
  ponte: Intensite | null;
}

export const EMPTY_REPRODUCTION: ReproductionState = { accouplement: null, ponte: null };

/** Accouplement/ponte n'ont de sens que pour les imagos (cf. #13). */
export function parseReproduction(imago: PopulationRow | null): ReproductionState {
  return {
    accouplement: (imago?.accouplement ?? null) as Intensite | null,
    ponte: (imago?.ponte ?? null) as Intensite | null,
  };
}

/** Persiste l'accouplement/ponte sur la ligne imago, en préservant les densités déjà saisies. */
export async function saveReproduction(
  prospectionId: string,
  espece: 'LMC' | 'NSE',
  state: ReproductionState
): Promise<void> {
  const existing = await getProspectionPopulation(prospectionId, espece, 'imago');
  await saveProspectionPopulation(prospectionId, {
    espece,
    categorie: 'imago',
    densite_diffuse: existing?.densite_diffuse ?? null,
    densite_groupee: existing?.densite_groupee ?? null,
    methode: existing?.methode ?? null,
    accouplement: state.accouplement,
    ponte: state.ponte,
  });
}
