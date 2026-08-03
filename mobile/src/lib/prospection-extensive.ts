import { Espece, stadesFor } from './prospection-especes-stades';
import { PopulationRow } from './prospection-repository';

/** Phase imago simplifiée (A1-A5) du protocole extensif — distincte des stades sexués de l'Intensif. */
export const EXTENSIVE_IMAGO_PHASES = ['A1', 'A2', 'A3', 'A4', 'A5'];

export type PhenotypeKey = 'sol' | 'trans' | 'greg';

export const PHENOTYPE_ROWS: { key: PhenotypeKey; label: string }[] = [
  { key: 'trans', label: 'Trans.' },
  { key: 'sol', label: 'Sol.' },
  { key: 'greg', label: 'Greg.' },
];

export const BIOTOPE_EXTENSIVE_OPTIONS: { value: string; label: string }[] = [
  { value: 'riziere_bordure', label: 'Rizière en bordure' },
  { value: 'bas_fond', label: 'Bas-fond' },
  { value: 'plateau', label: 'Plateau' },
  { value: 'jachere', label: 'Jachère' },
  { value: 'culture', label: 'Culture' },
];

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

export function emptyExtensiveLarveState(espece: Espece): ExtensiveLarveState {
  const densites: Record<string, number> = {};
  for (const stade of stadesFor(espece, 'larve', null)) densites[stade] = 0;
  return { stade: stadesFor(espece, 'larve', null)[0], densites, tl: false, bl: false, interdist: '', deplacement: 'repos' };
}

export function imagoTotal(state: ExtensiveImagoState): number {
  return (state.sol || 0) + (state.trans || 0) + (state.greg || 0);
}

export function larveTotal(state: ExtensiveLarveState): number {
  return Object.values(state.densites).reduce((acc, v) => acc + (v || 0), 0);
}

/** Total agrégé directement depuis la ligne persistée, sans reconstruire un état d'écran complet. */
export function imagoTotalFromRow(row: PopulationRow | null): number {
  if (!row) return 0;
  return (row.captures_sol ?? 0) + (row.captures_trans ?? 0) + (row.captures_greg ?? 0);
}

export function larveTotalFromRow(row: PopulationRow | null): number {
  if (!row || !row.densites_larve) return 0;
  const densites = JSON.parse(row.densites_larve) as Record<string, number>;
  return Object.values(densites).reduce((acc, v) => acc + (v || 0), 0);
}

export function imagoStateToPopulationRow(espece: Espece, state: ExtensiveImagoState): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: state.popDiff ? parseFloat(state.popDiff) : null,
    densite_groupee: state.popGroup ? parseFloat(state.popGroup) : null,
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

