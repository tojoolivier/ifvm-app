import { GrilleKey } from './prospection-especes-stades';
import { updateProspectionEspeces, DraftProspection } from './prospection-repository';

export interface EspeceSelection {
  lmcImago: boolean;
  lmcLarve: boolean;
  nseImago: boolean;
  nseLarve: boolean;
}

export const EMPTY_ESPECE_SELECTION: EspeceSelection = {
  lmcImago: false,
  lmcLarve: false,
  nseImago: false,
  nseLarve: false,
};

export function hasSelection(selection: EspeceSelection): boolean {
  return selection.lmcImago || selection.lmcLarve || selection.nseImago || selection.nseLarve;
}

export function countGrilles(selection: EspeceSelection): number {
  return [selection.lmcImago, selection.lmcLarve, selection.nseImago, selection.nseLarve].filter(Boolean).length;
}

/** Ordre d'affichage du prototype : LMC imagos, LMC larves, NSE imagos, NSE larves. */
export function buildGrilles(selection: EspeceSelection): GrilleKey[] {
  const grilles: GrilleKey[] = [];
  if (selection.lmcImago) grilles.push({ espece: 'LMC', categorie: 'imago' });
  if (selection.lmcLarve) grilles.push({ espece: 'LMC', categorie: 'larve' });
  if (selection.nseImago) grilles.push({ espece: 'NSE', categorie: 'imago' });
  if (selection.nseLarve) grilles.push({ espece: 'NSE', categorie: 'larve' });
  return grilles;
}

export function parseEspeceSelection(raw: string | null): EspeceSelection {
  if (!raw) return { ...EMPTY_ESPECE_SELECTION };
  try {
    const parsed = JSON.parse(raw);
    return {
      lmcImago: Boolean(parsed.lmcImago),
      lmcLarve: Boolean(parsed.lmcLarve),
      nseImago: Boolean(parsed.nseImago),
      nseLarve: Boolean(parsed.nseLarve),
    };
  } catch {
    return { ...EMPTY_ESPECE_SELECTION };
  }
}

export async function saveEspeceSelection(draftId: string, selection: EspeceSelection): Promise<DraftProspection> {
  if (!hasSelection(selection)) {
    throw new Error('Au moins une espèce/stade doit être sélectionné');
  }
  return updateProspectionEspeces(draftId, JSON.stringify(selection));
}
