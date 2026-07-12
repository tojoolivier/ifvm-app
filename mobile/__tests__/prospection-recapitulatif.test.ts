import { apiClient } from '../src/lib/api-client';
import {
  CaptureRow,
  DraftProspection,
  completeProspection,
  listAllProspectionCaptures,
  markProspectionSynced,
} from '../src/lib/prospection-repository';

jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    createProspection: jest.fn(),
  },
}));

jest.mock('../src/lib/prospection-repository', () => ({
  completeProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn(),
  markProspectionSynced: jest.fn(),
}));

import {
  buildRecapitulatif,
  buildVegetationSummary,
  enregistrerEtSynchroniser,
} from '../src/lib/prospection-recapitulatif';
import { DEFAULT_VEGETATION_SOL, STRATE_KEYS, StratesState, VegetationSolState } from '../src/lib/prospection-vegetation';

function stratesWithTotal(recouvrementByKey: Partial<Record<(typeof STRATE_KEYS)[number], number>>): StratesState {
  const strates = {} as StratesState;
  for (const key of STRATE_KEYS) {
    strates[key] = { recouvrement: recouvrementByKey[key] ?? 0, phenologie: null, hauteur: null };
  }
  return strates;
}

const mockCreateProspection = jest.mocked(apiClient.createProspection);
const mockCompleteProspection = jest.mocked(completeProspection);
const mockListAllCaptures = jest.mocked(listAllProspectionCaptures);
const mockMarkSynced = jest.mocked(markProspectionSynced);

const BASE_DRAFT: DraftProspection = {
  id: '11111111-1111-1111-1111-111111111111',
  type_prospection: 'intensive',
  campagne_id: '22222222-2222-2222-2222-222222222222',
  prospecteur_id: '33333333-3333-3333-3333-333333333333',
  station_id: null,
  n_fiche: 'IFVM-2026-0001',
  especes: null,
  capture_started_at: '2026-07-11T08:00:00.000Z',
  grilles_completees: null,
  date_prospection: '2026-07-11',
  latitude: -18.9,
  longitude: 47.5,
  altitude: 1200,
  surf_station: 10,
  surf_prospectee: 8,
  surf_infestee: 2,
  degats_cultures: 'faibles',
  vegetation: JSON.stringify({ strates: stratesWithTotal({ herbeuse: 40, sol_nu: 60 }) }),
  sol: JSON.stringify({ humidite: 'surface', texture: 'limoneuse' }),
  statut: 'brouillon',
  statut_sync: 'local',
  created_at: '2026-07-11T08:00:00.000Z',
  updated_at: '2026-07-11T08:00:00.000Z',
};

const CAPTURE_ROWS: CaptureRow[] = [
  { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'gregaire', stade: 'A1', effectif: 5 },
  { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 3 },
  { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A2', effectif: 1 },
];

beforeEach(() => {
  jest.resetAllMocks();
});

describe('buildVegetationSummary', () => {
  it('always includes the strates total, with a placeholder when nothing is set', () => {
    expect(buildVegetationSummary(DEFAULT_VEGETATION_SOL)).toBe('Strates (0%) : —');
  });

  it('appends the labels of every selector that is set, plus non-zero strates', () => {
    const state: VegetationSolState = {
      strates: stratesWithTotal({ herbeuse: 40, sol_nu: 60 }),
      humidite: 'surface',
      texture: 'limoneuse',
      degatsCultures: 'faibles',
    };
    expect(buildVegetationSummary(state)).toBe(
      'Strates (100%) : Herbeuse 40%, Sol nu 60% · Humidité Surf. · Texture Limoneuse · Dégâts culture Faibles'
    );
  });
});

describe('buildRecapitulatif', () => {
  it('derives all values from the draft and its capture rows, without resaisie', async () => {
    mockListAllCaptures.mockResolvedValueOnce(CAPTURE_ROWS);

    const recap = await buildRecapitulatif(BASE_DRAFT);

    expect(recap.nFiche).toBe('IFVM-2026-0001');
    expect(recap.totalCaptures).toBe(9);
    expect(recap.totalFemelles).toBe(6);
    expect(recap.totalMales).toBe(3);
    expect(recap.phenotypeDominantLabel).toBe('Grégaires');
    expect(recap.surfStation).toBe(10);
    expect(recap.surfProspectee).toBe(8);
    expect(recap.surfInfestee).toBe(2);
    expect(recap.vegetationSummary).toContain('Herbeuse 40%');
  });

  it('falls back to GPS coordinates as the station label when no station is set', async () => {
    mockListAllCaptures.mockResolvedValueOnce([]);

    const recap = await buildRecapitulatif(BASE_DRAFT);

    expect(recap.stationLabel).toBe('-18.9000, 47.5000');
    expect(recap.totalCaptures).toBe(0);
    expect(recap.phenotypeDominantLabel).toBe('—');
  });
});

describe('enregistrerEtSynchroniser', () => {
  const COMPLETED = { ...BASE_DRAFT, statut: 'en_attente' };

  it('always persists the fiche locally as complete before attempting sync', async () => {
    mockCompleteProspection.mockResolvedValueOnce(COMPLETED);
    mockListAllCaptures.mockResolvedValueOnce(CAPTURE_ROWS);
    mockCreateProspection.mockResolvedValueOnce({ id: 'server-id' });

    const result = await enregistrerEtSynchroniser(BASE_DRAFT, 'tok');

    expect(mockCompleteProspection).toHaveBeenCalledWith(BASE_DRAFT.id);
    expect(result).toEqual({ synced: true });
    expect(mockMarkSynced).toHaveBeenCalledWith(COMPLETED.id);
  });

  it('sends the captures and parsed vegetation/sol JSON to the API', async () => {
    mockCompleteProspection.mockResolvedValueOnce(COMPLETED);
    mockListAllCaptures.mockResolvedValueOnce(CAPTURE_ROWS);
    mockCreateProspection.mockResolvedValueOnce({ id: 'server-id' });

    await enregistrerEtSynchroniser(BASE_DRAFT, 'tok');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        campagne_id: COMPLETED.campagne_id,
        vegetation: { strates: stratesWithTotal({ herbeuse: 40, sol_nu: 60 }) },
        sol: { humidite: 'surface', texture: 'limoneuse' },
        captures: [
          { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'gregaire', stade: 'A1', effectif: 5 },
          { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 3 },
          { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A2', effectif: 1 },
        ],
      })
    );
  });

  it('does not throw and reports synced=false when the sync attempt fails (offline-first)', async () => {
    mockCompleteProspection.mockResolvedValueOnce(COMPLETED);
    mockListAllCaptures.mockResolvedValueOnce(CAPTURE_ROWS);
    mockCreateProspection.mockRejectedValueOnce(new Error('network down'));

    const result = await enregistrerEtSynchroniser(BASE_DRAFT, 'tok');

    expect(result).toEqual({ synced: false });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});
