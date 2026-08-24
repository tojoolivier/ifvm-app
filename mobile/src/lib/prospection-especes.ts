import { GrilleKey } from './prospection-especes-stades';
import { updateProspectionEspeces, DraftProspection } from './prospection-repository';
import { PreconditionError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'prospection-especes' });

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
  } catch (error) {
    // Silence délibéré : la sélection d'espèces est re-saisissable en un
    // geste. Bloquer la fiche pour une chaîne corrompue coûterait plus à
    // l'agent que de la lui redemander — mais la corruption doit se voir.
    log.ignore(
      error,
      'Sélection d’espèces corrompue — repli sur une sélection vide, re-saisissable.'
    );

    return { ...EMPTY_ESPECE_SELECTION };
  }
}

export async function saveEspeceSelection(draftId: string, selection: EspeceSelection): Promise<DraftProspection> {
  if (!hasSelection(selection)) {
    throw new PreconditionError('Au moins une espèce/stade doit être sélectionné');
  }
  return updateProspectionEspeces(draftId, JSON.stringify(selection));
}

/**
 * Grilles déjà remplies, pour ne pas les re-présenter à l'agent — un simple
 * indicateur d'avancement, pas une donnée de terrain (#189, même critère que
 * {@link parseEspeceSelection}) : au pire une grille déjà remplie est
 * re-montrée, ce qui coûte moins que de bloquer la fiche sur une chaîne
 * corrompue.
 */
export function parseGrillesCompletees(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    log.ignore(error, 'Liste des grilles complétées corrompue — repli sur aucune grille marquée, re-détectable.');
    return [];
  }
}
