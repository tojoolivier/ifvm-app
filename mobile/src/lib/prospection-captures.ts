import {
  CaptureRow,
  DraftProspection,
  saveProspectionCaptures,
  startCaptureTimer,
} from './prospection-repository';

export type Sexe = 'F' | 'M';
export type Phenotype = 'solitaire' | 'solitaro_trans' | 'transiens' | 'gregaire';

/** Jeux de stades par sexe (prototype IFVM) : les femelles ont des sous-stades A3¼…A3¾, les mâles un jeu simplifié. */
export const FEMALE_STADES = ['A1', 'A2', 'A3', 'A3¼', 'A3½', 'A3¾', 'A3 4/4', 'A4', 'A5'];
export const MALE_STADES = ['A1', 'A234', 'A5'];

export const PHENOTYPES: { value: Phenotype; label: string }[] = [
  { value: 'solitaire', label: 'Solitaires' },
  { value: 'solitaro_trans', label: 'Solitaro-trans' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaires' },
];

export const CAPTURES_MAX = 50;
export const CHRONO_MAX_SECONDS = 30 * 60;

/** Nomadacris imagos : pas de sous-stades, 3 phénotypes (pas de "Solitaro-trans"), plafond propre (fiche papier IFVM). */
export type NsePhenotype = 'solitaire' | 'transiens' | 'gregaire';

export const NSE_STADES = MALE_STADES;

export const NSE_PHENOTYPES: { value: NsePhenotype; label: string }[] = [
  { value: 'solitaire', label: 'Solitaires' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaires' },
];

export const NSE_CAPTURES_MAX = 30;

/** Comptage courant, indexé par clé `sexe|phénotype|stade`. */
export interface CaptureCounts {
  [key: string]: number;
}

export function stadesForSexe(sexe: Sexe): string[] {
  return sexe === 'F' ? FEMALE_STADES : MALE_STADES;
}

/** Ramène un stade sélectionné vers le premier stade du nouveau jeu s'il n'y existe pas. */
export function stadeForSexeSwitch(currentStade: string, newSexe: Sexe): string {
  const stades = stadesForSexe(newSexe);
  return stades.includes(currentStade) ? currentStade : stades[0];
}

export function captureKey(sexe: Sexe, phenotype: Phenotype, stade: string): string {
  return `${sexe}|${phenotype}|${stade}`;
}

export function totalCaptures(counts: CaptureCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function totalBySexe(counts: CaptureCounts, sexe: Sexe): number {
  return Object.entries(counts)
    .filter(([key]) => key.startsWith(`${sexe}|`))
    .reduce((sum, [, n]) => sum + n, 0);
}

/** Phénotype avec le plus de captures toutes combinaisons confondues, ou null si aucune capture. */
export function dominantPhenotype(counts: CaptureCounts): Phenotype | null {
  const totals: Partial<Record<Phenotype, number>> = {};
  for (const [key, n] of Object.entries(counts)) {
    const phenotype = key.split('|')[1] as Phenotype;
    totals[phenotype] = (totals[phenotype] ?? 0) + n;
  }
  let best: Phenotype | null = null;
  let bestCount = 0;
  for (const [phenotype, n] of Object.entries(totals) as [Phenotype, number][]) {
    if (n > bestCount) {
      best = phenotype;
      bestCount = n;
    }
  }
  return best;
}

export function incrementCapture(
  counts: CaptureCounts,
  sexe: Sexe,
  phenotype: Phenotype,
  stade: string
): CaptureCounts {
  if (totalCaptures(counts) >= CAPTURES_MAX) return counts;
  const key = captureKey(sexe, phenotype, stade);
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

export function decrementCapture(
  counts: CaptureCounts,
  sexe: Sexe,
  phenotype: Phenotype,
  stade: string
): CaptureCounts {
  const key = captureKey(sexe, phenotype, stade);
  const current = counts[key] ?? 0;
  if (current <= 0) return counts;
  return { ...counts, [key]: current - 1 };
}

export function nseCaptureKey(phenotype: NsePhenotype, stade: string): string {
  return `${phenotype}|${stade}`;
}

export function dominantNsePhenotype(counts: CaptureCounts): NsePhenotype | null {
  const totals: Partial<Record<NsePhenotype, number>> = {};
  for (const [key, n] of Object.entries(counts)) {
    const phenotype = key.split('|')[0] as NsePhenotype;
    totals[phenotype] = (totals[phenotype] ?? 0) + n;
  }
  let best: NsePhenotype | null = null;
  let bestCount = 0;
  for (const [phenotype, n] of Object.entries(totals) as [NsePhenotype, number][]) {
    if (n > bestCount) {
      best = phenotype;
      bestCount = n;
    }
  }
  return best;
}

export function incrementNseCapture(
  counts: CaptureCounts,
  phenotype: NsePhenotype,
  stade: string
): CaptureCounts {
  if (totalCaptures(counts) >= NSE_CAPTURES_MAX) return counts;
  const key = nseCaptureKey(phenotype, stade);
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

export function decrementNseCapture(
  counts: CaptureCounts,
  phenotype: NsePhenotype,
  stade: string
): CaptureCounts {
  const key = nseCaptureKey(phenotype, stade);
  const current = counts[key] ?? 0;
  if (current <= 0) return counts;
  return { ...counts, [key]: current - 1 };
}

/** Chrono écoulé depuis `startedAt`, plafonné à CHRONO_MAX_SECONDS. */
export function chronoSeconds(startedAt: string | null, now: Date = new Date()): number {
  if (!startedAt) return 0;
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, Math.min(elapsed, CHRONO_MAX_SECONDS));
}

export function formatChrono(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

/** Démarre le chrono de session au premier passage sur l'écran, sans l'écraser à la reprise d'un brouillon. */
export async function ensureCaptureTimerStarted(draft: DraftProspection): Promise<DraftProspection> {
  if (draft.capture_started_at) return draft;
  return startCaptureTimer(draft.id);
}

/** Convertit le comptage courant en lignes `prospection_capture` (imagos uniquement, catégorie fixée par la grille). */
export function buildCaptureRows(
  espece: 'LMC' | 'NSE',
  categorie: 'imago' | 'larve',
  counts: CaptureCounts
): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, effectif] of Object.entries(counts)) {
    if (effectif <= 0) continue;
    const [sexe, phenotype, stade] = key.split('|') as [Sexe, Phenotype, string];
    rows.push({ espece, categorie, sexe, phase: phenotype, stade, effectif });
  }
  return rows;
}

export function parseCaptureRows(rows: CaptureRow[]): CaptureCounts {
  const counts: CaptureCounts = {};
  for (const row of rows) {
    counts[captureKey(row.sexe as Sexe, row.phase as Phenotype, row.stade)] = row.effectif;
  }
  return counts;
}

/** Persiste les comptages de la grille courante sous forme de lignes `prospection_capture`. */
export async function saveCaptureCounts(
  prospectionId: string,
  espece: 'LMC' | 'NSE',
  categorie: 'imago' | 'larve',
  counts: CaptureCounts
): Promise<void> {
  await saveProspectionCaptures(prospectionId, espece, categorie, buildCaptureRows(espece, categorie, counts));
}

/** Nomadacris imagos : pas de bascule sexe, `sexe` est persisté à NULL (cf. ADR-006). */
export function buildNseCaptureRows(counts: CaptureCounts): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, effectif] of Object.entries(counts)) {
    if (effectif <= 0) continue;
    const [phenotype, stade] = key.split('|') as [NsePhenotype, string];
    rows.push({ espece: 'NSE', categorie: 'imago', sexe: null, phase: phenotype, stade, effectif });
  }
  return rows;
}

export function parseNseCaptureRows(rows: CaptureRow[]): CaptureCounts {
  const counts: CaptureCounts = {};
  for (const row of rows) {
    counts[nseCaptureKey(row.phase as NsePhenotype, row.stade)] = row.effectif;
  }
  return counts;
}

export async function saveNseCaptureCounts(prospectionId: string, counts: CaptureCounts): Promise<void> {
  await saveProspectionCaptures(prospectionId, 'NSE', 'imago', buildNseCaptureRows(counts));
}
