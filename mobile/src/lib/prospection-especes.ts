import { updateProspectionEspeces, DraftProspection } from './prospection-repository';

export interface EspeceSelection {
  lmcImago: boolean;
  lmcLarve: boolean;
  nseImago: boolean;
  nseLarve: boolean;
}

export interface GrilleACapturer {
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
}

export const EMPTY_ESPECE_SELECTION: EspeceSelection = {
  lmcImago: false,
  lmcLarve: false,
  nseImago: false,
  nseLarve: false,
};

/** Nombre de grilles de capture à remplir, une par toggle actif. */
export function countGrilles(selection: EspeceSelection): number {
  return [selection.lmcImago, selection.lmcLarve, selection.nseImago, selection.nseLarve].filter(
    Boolean
  ).length;
}

export function hasSelection(selection: EspeceSelection): boolean {
  return countGrilles(selection) > 0;
}

/** Liste ordonnée des grilles espèce/catégorie à proposer à l'écran Compteur de captures. */
export function buildGrilles(selection: EspeceSelection): GrilleACapturer[] {
  const grilles: GrilleACapturer[] = [];
  if (selection.lmcImago) grilles.push({ espece: 'LMC', categorie: 'imago' });
  if (selection.lmcLarve) grilles.push({ espece: 'LMC', categorie: 'larve' });
  if (selection.nseImago) grilles.push({ espece: 'NSE', categorie: 'imago' });
  if (selection.nseLarve) grilles.push({ espece: 'NSE', categorie: 'larve' });
  return grilles;
}

/** Relit la sélection stockée sur le brouillon (colonne `especes`, JSON), vide si absente/invalide. */
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

/** Persiste la sélection espèces/stades sur la fiche brouillon locale. Requiert au moins un toggle actif. */
export async function saveEspeceSelection(
  draftId: string,
  selection: EspeceSelection
): Promise<DraftProspection> {
  if (!hasSelection(selection)) {
    throw new Error('Au moins une espèce/stade doit être sélectionné');
  }
  return updateProspectionEspeces(draftId, JSON.stringify(selection));
}
