import { Espece, stadesFor } from './prospection-especes-stades';
import { PopulationRow } from './prospection-repository';

export const EXTENSIVE_IMAGO_PHASES = ['A1', 'A2', 'A3', 'A4', 'A5'];

export type PhenotypeKey = 'sol' | 'trans' | 'greg';

export const PHENOTYPE_ROWS: { key: PhenotypeKey; label: string }[] = [
  { key: 'trans', label: 'Trans.' },
  { key: 'sol', label: 'Sol.' },
  { key: 'greg', label: 'Greg.' },
];

export const IMAGO_PHASE_ROWS = [
  { key: 'solitaire', label: 'Solitaire' },
  { key: 'transiens', label: 'Transiens' },
  { key: 'solitaroTransiens', label: 'Solitaro-Transiens' },
  { key: 'gregaire', label: 'Grégaire' },
] as const;

export const LARVE_PHASE_ROWS = [
  { key: 'solitaire', label: 'Solitaire' },
  { key: 'transiens', label: 'Transiens' },
  { key: 'gregaire', label: 'Grégaire' },
] as const;

export type PhaseKey = typeof IMAGO_PHASE_ROWS[number]['key'];

export const BIOTOPE_EXTENSIVE_OPTIONS = [
  { value: 'mesophyle', label: 'Mesophyle' },
  { value: 'xerophyle', label: 'Xerophyle' },
  { value: 'hydrophyle', label: 'Hydrophyle' },
];

export const TYPE_STATION_EXTENSIVE = {
  MESOPHYLE: 'mesophyle',
  XEROPHYLE: 'xerophyle',
  HYDROPHYLE: 'hydrophyle',
} as const;

export type TypeStationExtensive = typeof TYPE_STATION_EXTENSIVE[keyof typeof TYPE_STATION_EXTENSIVE];

export const NIVEAU_OPTIONS: { value: string; label: string }[] = [
  { value: 'faible', label: 'Faible' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'forte', label: 'Forte' },
];

export const DEPLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'repos', label: 'Repos' },
  { value: 'perchee', label: 'Perchée' },
];

export interface ExtensiveImagoState {
  sol: number;
  trans: number;
  greg: number;
  active: PhenotypeKey;
  phase: string;
  popDiff: string;
  popGroup: string;
  essaim: boolean;
}

export interface ExtensiveImagoSpeciesData {
  totalCaptures: number;
  activePhase: PhaseKey;
  phases: {
    solitaire: number;
    transiens: number;
    solitaroTransiens: number;
    gregaire: number;
  };
  stades: {
    femelleA1: number;
    femelleA2: number;
    femelleA3: number;
    femelleA3_1_4: number;
    femelleA3_1_2: number;
    femelleA3_3_4: number;
    femelleA3_4_4: number;
    femelleA4: number;
    femelleA5: number;
    maleA1: number;
    maleA123: number;
    maleA5: number;
  };
  popDiff: string;
  popGroup: string;
  typeCapture: 'essaim' | 'volClair';
}

export interface ExtensiveLarveSpeciesData {
  totalCaptures: number;
  phases: {
    solitaire: number;
    transiens: number;
    gregaire: number;
  };
  stades: Record<string, number>;
  activePhase: PhaseKey | null;
}

export interface ExtensiveLarveState {
  stade: string;
  densites: Record<string, number>;
  tl: boolean;
  bl: boolean;
  interdist: string;
  deplacement: string;
}

export function emptyExtensiveImagoState(): ExtensiveImagoState {
  return { sol: 0, trans: 0, greg: 0, active: 'trans', phase: 'A1', popDiff: '', popGroup: '', essaim: false };
}

export function createEmptySpeciesData(): ExtensiveImagoSpeciesData {
  return {
    totalCaptures: 0,
    activePhase: 'solitaire',
    phases: {
      solitaire: 0,
      transiens: 0,
      solitaroTransiens: 0,
      gregaire: 0,
    },
    stades: {
      femelleA1: 0,
      femelleA2: 0,
      femelleA3: 0,
      femelleA3_1_4: 0,
      femelleA3_1_2: 0,
      femelleA3_3_4: 0,
      femelleA3_4_4: 0,
      femelleA4: 0,
      femelleA5: 0,
      maleA1: 0,
      maleA123: 0,
      maleA5: 0,
    },
    popDiff: '',
    popGroup: '',
    typeCapture: 'essaim',
  };
}

export function createEmptyLarveSpeciesData(espece: Espece): ExtensiveLarveSpeciesData {
  const stadesList = stadesFor(espece, 'larve', null);
  const stades: Record<string, number> = {};
  for (const stade of stadesList) {
    stades[stade] = 0;
  }
  return {
    totalCaptures: 0,
    phases: {
      solitaire: 0,
      transiens: 0,
      gregaire: 0,
    },
    stades,
    activePhase: null,
  };
}

export function emptyExtensiveLarveState(espece: Espece): ExtensiveLarveState {
  const densites: Record<string, number> = {};
  for (const stade of stadesFor(espece, 'larve', null)) densites[stade] = 0;
  return { stade: stadesFor(espece, 'larve', null)[0], densites, tl: false, bl: false, interdist: '', deplacement: 'repos' };
}

export function imagoTotal(state: ExtensiveImagoState): number {
  return (state.sol || 0) + (state.trans || 0) + (state.greg || 0);
}

export function totalPhasesForSpecies(data: ExtensiveImagoSpeciesData): number {
  return data.phases.solitaire + data.phases.transiens + data.phases.solitaroTransiens + data.phases.gregaire;
}

export function totalStadesFemelles(data: ExtensiveImagoSpeciesData): number {
  const s = data.stades;
  return s.femelleA1 + s.femelleA2 + s.femelleA3 + 
         s.femelleA3_1_4 + s.femelleA3_1_2 + s.femelleA3_3_4 + 
         s.femelleA3_4_4 + s.femelleA4 + s.femelleA5;
}

export function totalStadesMales(data: ExtensiveImagoSpeciesData): number {
  const s = data.stades;
  return s.maleA1 + s.maleA123 + s.maleA5;
}

export function totalStadesForSpecies(data: ExtensiveImagoSpeciesData): number {
  return totalStadesFemelles(data) + totalStadesMales(data);
}

export function totalLarvePhases(data: ExtensiveLarveSpeciesData): number {
  return data.phases.solitaire + data.phases.transiens + data.phases.gregaire;
}

export function totalLarveStades(data: ExtensiveLarveSpeciesData): number {
  return Object.values(data.stades).reduce((sum, val) => sum + val, 0);
}

export function isLarveDataConsistent(data: ExtensiveLarveSpeciesData): boolean {
  if (data.totalCaptures <= 0) return false;
  const totalPhases = totalLarvePhases(data);
  const totalStades = totalLarveStades(data);
  return data.totalCaptures === totalPhases && data.totalCaptures === totalStades;
}

export function larveTotal(state: ExtensiveLarveState): number {
  return Object.values(state.densites).reduce((acc, v) => acc + (v || 0), 0);
}

export function imagoTotalFromRow(row: PopulationRow | null): number {
  if (!row) return 0;
  return (row.captures_sol ?? 0) + (row.captures_trans ?? 0) + (row.captures_greg ?? 0);
}

export function larveTotalFromRow(row: PopulationRow | null): number {
  if (!row || !row.densites_larve) return 0;
  const densites = JSON.parse(row.densites_larve) as Record<string, number>;
  return Object.values(densites).reduce((acc, v) => acc + (v || 0), 0);
}

export function parseDensite(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function imagoStateToPopulationRow(espece: Espece, state: ExtensiveImagoState): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: parseDensite(state.popDiff),
    densite_groupee: parseDensite(state.popGroup),
    methode: null,
    accouplement: null,
    ponte: null,
    captures_sol: state.sol,
    captures_trans: state.trans,
    captures_greg: state.greg,
    stade_imago: state.phase,
    essaim_observe: state.essaim,
  };
}

export function speciesDataToPopulationRow(
  espece: Espece,
  data: ExtensiveImagoSpeciesData,
  commonData: {
    popDiff: string;
    popGroup: string;
    typeCapture: 'essaim' | 'volClair';
  }
): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: commonData.popDiff ? parseFloat(commonData.popDiff) : null,
    densite_groupee: commonData.popGroup ? parseFloat(commonData.popGroup) : null,
    methode: null,
    accouplement: null,
    ponte: null,
    captures_nombre: data.totalCaptures,
    captures_sol: data.phases.solitaire,
    captures_trans: data.phases.transiens,
    captures_greg: data.phases.gregaire,
    stade_imago: 'A1',
    essaim_observe: commonData.typeCapture === 'essaim',
  };
}

export function populationRowToImagoState(row: PopulationRow | null): ExtensiveImagoState {
  if (!row) return emptyExtensiveImagoState();
  return {
    sol: row.captures_sol ?? 0,
    trans: row.captures_trans ?? 0,
    greg: row.captures_greg ?? 0,
    active: 'trans',
    phase: row.stade_imago ?? 'A1',
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    essaim: Boolean(row.essaim_observe),
  };
}

export function populationRowToSpeciesData(row: PopulationRow | null): ExtensiveImagoSpeciesData {
  if (!row) return createEmptySpeciesData();
  return {
    totalCaptures: row.captures_nombre ?? 0,
    activePhase: 'solitaire',
    phases: {
      solitaire: row.captures_sol ?? 0,
      transiens: row.captures_trans ?? 0,
      solitaroTransiens: 0,
      gregaire: row.captures_greg ?? 0,
    },
    stades: {
      femelleA1: 0,
      femelleA2: 0,
      femelleA3: 0,
      femelleA3_1_4: 0,
      femelleA3_1_2: 0,
      femelleA3_3_4: 0,
      femelleA3_4_4: 0,
      femelleA4: 0,
      femelleA5: 0,
      maleA1: 0,
      maleA123: 0,
      maleA5: 0,
    },
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    typeCapture: Boolean(row.essaim_observe) ? 'essaim' : 'volClair',
  };
}

export function extractCommonImagoData(row: PopulationRow | null): {
  popDiff: string;
  popGroup: string;
  typeCapture: 'essaim' | 'volClair';
} {
  if (!row) {
    return {
      popDiff: '',
      popGroup: '',
      typeCapture: 'essaim',
    };
  }
  return {
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    typeCapture: Boolean(row.essaim_observe) ? 'essaim' : 'volClair',
  };
}

export function larveSpeciesDataToPopulationRow(
  espece: Espece,
  data: ExtensiveLarveSpeciesData,
  commonData: {
    tl: boolean;
    bl: boolean;
    interdist: string;
    deplacement: string;
  }
): PopulationRow {
  return {
    espece,
    categorie: 'larve',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
    captures_nombre: data.totalCaptures,
    captures_sol: data.phases.solitaire,
    captures_trans: data.phases.transiens,
    captures_greg: data.phases.gregaire,
    densites_larve: JSON.stringify(data.stades),
    tache_larvaire: commonData.tl,
    bande_larvaire: commonData.bl,
    interdistance: commonData.interdist ? parseFloat(commonData.interdist) : null,
    deplacement: commonData.deplacement,
  };
}

export function populationRowToLarveSpeciesData(
  espece: Espece,
  row: PopulationRow | null
): ExtensiveLarveSpeciesData {
  const empty = createEmptyLarveSpeciesData(espece);
  if (!row) return empty;
  
  const parsedStades = row.densites_larve ? JSON.parse(row.densites_larve) : {};
  
  return {
    totalCaptures: row.captures_nombre ?? 0,
    phases: {
      solitaire: row.captures_sol ?? 0,
      transiens: row.captures_trans ?? 0,
      gregaire: row.captures_greg ?? 0,
    },
    stades: { ...empty.stades, ...parsedStades },
    activePhase: null,
  };
}

export function extractCommonLarveData(row: PopulationRow | null): {
  tl: boolean;
  bl: boolean;
  interdist: string;
  deplacement: string;
} {
  if (!row) {
    return {
      tl: false,
      bl: false,
      interdist: '',
      deplacement: 'repos',
    };
  }
  return {
    tl: Boolean(row.tache_larvaire),
    bl: Boolean(row.bande_larvaire),
    interdist: row.interdistance != null ? String(row.interdistance) : '',
    deplacement: row.deplacement ?? 'repos',
  };
}

export function larveStateToPopulationRow(espece: Espece, state: ExtensiveLarveState): PopulationRow {
  return {
    espece,
    categorie: 'larve',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
    densites_larve: JSON.stringify(state.densites),
    tache_larvaire: state.tl,
    bande_larvaire: state.bl,
    interdistance: state.interdist ? parseFloat(state.interdist) : null,
    deplacement: state.deplacement,
  };
}

export function populationRowToLarveState(espece: Espece, row: PopulationRow | null): ExtensiveLarveState {
  const fresh = emptyExtensiveLarveState(espece);
  if (!row) return fresh;
  const parsed = row.densites_larve ? JSON.parse(row.densites_larve) : {};
  return {
    stade: fresh.stade,
    densites: { ...fresh.densites, ...parsed },
    tl: Boolean(row.tache_larvaire),
    bl: Boolean(row.bande_larvaire),
    interdist: row.interdistance != null ? String(row.interdistance) : '',
    deplacement: row.deplacement ?? 'repos',
  };
}