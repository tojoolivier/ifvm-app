import { Espece, stadesLarvairesFor } from './prospection-especes-stades';
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

/** Dégâts sur les cultures (D — Observations, Terrestre + Aérien) — choix
 * unique à 3 niveaux. Réutilise les valeurs de `DegatsCultures` côté backend
 * (déjà utilisé par l'Intensif, 4 valeurs : nuls/faibles/moyens/forts) — cet
 * écran n'en propose que 3, jamais "nuls" côté extensif, mais reste
 * compatible avec le même champ. */
export const DEGATS_CULTURES_EXTENSIF_OPTIONS: { value: string; label: string }[] = [
  { value: 'faibles', label: 'Faible' },
  { value: 'moyens', label: 'Moyen' },
  { value: 'forts', label: 'Forte' },
];

export const DEPLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'repos', label: 'Repos' },
  { value: 'perchee', label: 'Perchée' },
];


/** Type de cible (extensif, par espèce) : mêmes 3 valeurs que l'Infestation intensive
 * (migration backend 0031) — remplace l'ancien « Type de capture » (essaim/vol clair). */
export type TypeCibleImago = 'vol_clair' | 'dense' | 'tres_dense';

/** Libellés partagés entre l'écran de saisie (extensive-imagos.tsx) et le récapitulatif
 * (extensive-recap.tsx) — une seule source pour ne pas laisser les deux dériver. */
export const TYPE_CIBLE_IMAGO_OPTIONS: { value: TypeCibleImago; label: string }[] = [
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'dense', label: 'Dense' },
  { value: 'tres_dense', label: 'Très dense' },
];

export function typeCibleImagoLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return TYPE_CIBLE_IMAGO_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** État (extensif, par espèce) : même vocabulaire que `prospection_infestation.comportement`
 * côté intensif. Détermine automatiquement le Comportement de l'essaim (cf. handleEtatChange
 * dans infestation.tsx, repris à l'identique dans extensive-imagos.tsx). */
export type EtatImago = 'repos' | 'deplacement';
export type ComportementEssaimImago = 'vol' | 'pose';

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
    maleA234: number;
    maleA5: number;
  };
  popDiff: string;
  popGroup: string;
  typeCible: TypeCibleImago;
  accouplement: string | null;
  ponte: string | null;
  interdistance: string;
  etat: EtatImago | null;
  comportementEssaim: ComportementEssaimImago | null;
  directionDe: string;
  directionVers: string;
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
  // ✨ AJOUT : Densités par espèce (comme pour les imagos)
  popDiff: string;
  popGroup: string;
  // Ex-« données communes » (#225) : tache/bande larvaire, interdistance, déplacement et
  // surface contaminée étaient jusqu'ici un unique jeu de valeurs partagé entre LMC et
  // NSE (une seule ligne d'état sur l'écran, appliquée aux deux lignes population lors
  // de l'enregistrement) — modifier l'une écrasait silencieusement l'autre au prochain
  // « Suivant ». Repris ici en per-espèce, même principe que
  // `ExtensiveImagoSpeciesData` (accouplement, ponte, interdistance...).
  tacheLarvaire: boolean;
  bandeLarvaire: boolean;
  interdistance: string;
  deplacement: string;
  surfaceContamineeHa: string;
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
      maleA234: 0,
      maleA5: 0,
    },
    popDiff: '',
    popGroup: '',
    typeCible: 'vol_clair',
    accouplement: null,
    ponte: null,
    interdistance: '',
    etat: null,
    comportementEssaim: null,
    directionDe: '',
    directionVers: '',
  };
}

export function createEmptyLarveSpeciesData(espece: Espece): ExtensiveLarveSpeciesData {
  const stadesList = stadesLarvairesFor(espece);
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
    // ✨ AJOUT : Initialisation des densités
    popDiff: '',
    popGroup: '',
    tacheLarvaire: false,
    bandeLarvaire: false,
    interdistance: '',
    deplacement: 'repos',
    surfaceContamineeHa: '',
  };
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
  return s.maleA1 + s.maleA234 + s.maleA5;
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

export function imagoTotalFromRow(row: PopulationRow | null): number {
  if (!row) return 0;
  return (row.captures_sol ?? 0) + (row.captures_trans ?? 0) + (row.captures_greg ?? 0) + (row.captures_solitaro_transiens ?? 0);
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

export function speciesDataToPopulationRow(espece: Espece, data: ExtensiveImagoSpeciesData): PopulationRow {
  return {
    espece,
    categorie: 'imago',
    densite_diffuse: data.popDiff ? parseFloat(data.popDiff) : null,
    densite_groupee: data.popGroup ? parseFloat(data.popGroup) : null,
    methode: null,
    accouplement: data.accouplement,
    ponte: data.ponte,
    captures_nombre: data.totalCaptures,
    captures_sol: data.phases.solitaire,
    captures_trans: data.phases.transiens,
    captures_greg: data.phases.gregaire,
    // Bug corrigé : cette 4e case de phase (PDF 11) avait sa propre colonne en base
    // depuis toujours, mais n'était jamais alimentée ici — une valeur saisie et
    // comptée dans la validation « Captures = Phases » disparaissait donc au
    // premier enregistrement.
    captures_solitaro_transiens: data.phases.solitaroTransiens,
    stade_imago: 'A1',
    interdistance: data.interdistance ? parseFloat(data.interdistance) : null,
    type_cible: data.typeCible,
    direction_de: data.directionDe || null,
    direction_vers: data.directionVers || null,
    etat: data.etat,
    // Comportement de l'essaim dérivé de l'État à la sauvegarde (source de vérité unique),
    // même logique que rowFromForm dans infestation.tsx : ne pas se fier uniquement à
    // comportementEssaim, tenu à jour par l'écran mais recalculé ici par sécurité.
    essaim_en_vol: data.etat === 'deplacement' ? true : data.etat === 'repos' ? false : null,
    essaim_pose: data.etat === 'repos' ? true : data.etat === 'deplacement' ? false : null,
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
      solitaroTransiens: row.captures_solitaro_transiens ?? 0,
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
      maleA234: 0,
      maleA5: 0,
    },
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    typeCible: (row.type_cible as TypeCibleImago | null) ?? 'vol_clair',
    accouplement: row.accouplement ?? null,
    ponte: row.ponte ?? null,
    interdistance: row.interdistance != null ? String(row.interdistance) : '',
    etat: (row.etat as EtatImago | null) ?? null,
    comportementEssaim: row.essaim_en_vol ? 'vol' : row.essaim_pose ? 'pose' : null,
    directionDe: row.direction_de ?? '',
    directionVers: row.direction_vers ?? '',
  };
}

export function larveSpeciesDataToPopulationRow(espece: Espece, data: ExtensiveLarveSpeciesData): PopulationRow {
  return {
    espece,
    categorie: 'larve',
    densite_diffuse: data.popDiff && data.popDiff.trim() !== '' ? parseFloat(data.popDiff) : null,
    densite_groupee: data.popGroup && data.popGroup.trim() !== '' ? parseFloat(data.popGroup) : null,
    methode: null,
    accouplement: null,
    ponte: null,
    captures_nombre: data.totalCaptures,
    captures_sol: data.phases.solitaire,
    captures_trans: data.phases.transiens,
    captures_greg: data.phases.gregaire,
    densites_larve: JSON.stringify(data.stades),
    tache_larvaire: data.tacheLarvaire,
    bande_larvaire: data.bandeLarvaire,
    interdistance: data.interdistance && data.interdistance.trim() !== '' ? parseFloat(data.interdistance) : null,
    deplacement: data.deplacement,
    // ✅ CORRECTION
    surface_contaminee_ha: data.surfaceContamineeHa && data.surfaceContamineeHa.trim() !== '' 
      ? parseFloat(data.surfaceContamineeHa) 
      : null,
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
    // ✨ AJOUT : Restauration des densités depuis la base
    popDiff: row.densite_diffuse != null ? String(row.densite_diffuse) : '',
    popGroup: row.densite_groupee != null ? String(row.densite_groupee) : '',
    tacheLarvaire: Boolean(row.tache_larvaire),
    bandeLarvaire: Boolean(row.bande_larvaire),
    interdistance: row.interdistance != null ? String(row.interdistance) : '',
    deplacement: row.deplacement ?? 'repos',
    surfaceContamineeHa: row.surface_contaminee_ha != null ? String(row.surface_contaminee_ha) : '',
  };
}

// ==========================================
// Mode aérien (extensif) — opérations
// ==========================================

export type TypeOperationAerienne = 'convoyage' | 'prospection' | 'divers';

export const TYPE_OPERATION_OPTIONS: { value: TypeOperationAerienne; label: string }[] = [
  { value: 'convoyage', label: 'Convoyage' },
  { value: 'prospection', label: 'Prospection' },
  { value: 'divers', label: 'Divers' },
];

/** `HH:MM` strict (00-23:00-59) — même contrainte que côté backend (migration 0035). */
export const HEURE_STRICTE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Durée entre deux `HH:MM`, jamais saisie par l'agent — même algorithme que
 * `_calculer_duree_minutes` côté backend (`prospection_use_cases.py`), pour que
 * l'affichage en direct sur l'écran corresponde exactement à ce que la synchro
 * recalculera. Franchissement de minuit : fin < début ⇒ +24h.
 */
export function calculerDureeMinutes(debutHeure: string, finHeure: string): number {
  const [heureDebut, minuteDebut] = debutHeure.split(':').map(Number);
  const [heureFin, minuteFin] = finHeure.split(':').map(Number);
  const debut = heureDebut * 60 + minuteDebut;
  let fin = heureFin * 60 + minuteFin;
  if (fin < debut) fin += 24 * 60;
  return fin - debut;
}

/** `123` minutes → `"02:03"`. */
export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}