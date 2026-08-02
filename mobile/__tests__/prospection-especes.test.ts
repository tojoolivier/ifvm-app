import {
  EMPTY_ESPECE_SELECTION,
  buildGrilles,
  countGrilles,
  hasSelection,
  parseEspeceSelection,
  saveEspeceSelection,
} from '../src/lib/prospection-especes';
import { updateProspectionEspeces } from '../src/lib/prospection-repository';

jest.mock('../src/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn(),
}));

const mockUpdate = jest.mocked(updateProspectionEspeces);

beforeEach(() => {
  mockUpdate.mockReset();
});

describe('countGrilles / hasSelection', () => {
  it('compte 0 grille sur une sélection vide', () => {
    expect(countGrilles(EMPTY_ESPECE_SELECTION)).toBe(0);
    expect(hasSelection(EMPTY_ESPECE_SELECTION)).toBe(false);
  });

  it('compte les toggles actifs', () => {
    const selection = { lmcImago: true, lmcLarve: false, nseImago: true };
    expect(countGrilles(selection)).toBe(2);
    expect(hasSelection(selection)).toBe(true);
  });
});

describe('buildGrilles', () => {
  it("respecte l'ordre du prototype : LMC imago, LMC larve, NSE imago", () => {
    const grilles = buildGrilles({ lmcImago: true, lmcLarve: true, nseImago: true });
    expect(grilles).toEqual([
      { espece: 'LMC', categorie: 'imago' },
      { espece: 'LMC', categorie: 'larve' },
      { espece: 'NSE', categorie: 'imago' },
    ]);
  });

  it('ne renvoie que les toggles activés', () => {
    expect(buildGrilles({ lmcImago: false, lmcLarve: true, nseImago: false })).toEqual([
      { espece: 'LMC', categorie: 'larve' },
    ]);
  });
});

describe('parseEspeceSelection', () => {
  it('renvoie une sélection vide si raw est null', () => {
    expect(parseEspeceSelection(null)).toEqual(EMPTY_ESPECE_SELECTION);
  });

  it('renvoie une sélection vide si le JSON est invalide', () => {
    expect(parseEspeceSelection('{invalid')).toEqual(EMPTY_ESPECE_SELECTION);
  });

  it('parse une sélection JSON valide', () => {
    expect(parseEspeceSelection(JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true }))).toEqual({
      lmcImago: true,
      lmcLarve: false,
      nseImago: true,
    });
  });
});

describe('saveEspeceSelection', () => {
  it('rejette si aucune espèce sélectionnée', async () => {
    await expect(saveEspeceSelection('draft-1', EMPTY_ESPECE_SELECTION)).rejects.toThrow(
      'Au moins une espèce/stade doit être sélectionné'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('persiste la sélection en JSON', async () => {
    mockUpdate.mockResolvedValue({} as any);
    const selection = { lmcImago: true, lmcLarve: false, nseImago: false };
    await saveEspeceSelection('draft-1', selection);
    expect(mockUpdate).toHaveBeenCalledWith('draft-1', JSON.stringify(selection));
  });
});
