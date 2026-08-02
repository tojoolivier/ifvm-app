import { CaptureRow, DraftProspection, completeProspection, markProspectionSynced } from '../src/lib/prospection-repository';
import { apiClient } from '../src/lib/api-client';
import * as Network from 'expo-network';
import { buildRecapitulatif, chronoSeconds, enregistrerEtSynchroniser, formatChrono } from '../src/lib/prospection-review';

jest.mock('../src/lib/prospection-repository', () => ({
  completeProspection: jest.fn(),
  markProspectionSynced: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createProspection: jest.fn() },
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

const mockCompleteProspection = jest.mocked(completeProspection);
const mockMarkSynced = jest.mocked(markProspectionSynced);
const mockCreateProspection = jest.mocked(apiClient.createProspection);
const mockGetNetworkState = jest.mocked(Network.getNetworkStateAsync);

function draft(overrides: Partial<DraftProspection> = {}): DraftProspection {
  return {
    id: 'draft-1',
    type_prospection: 'intensive',
    campagne_id: 'camp-1',
    prospecteur_id: 'user-1',
    station_id: null,
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    degats_cultures_pourcent: null,
    verdissement_pourcent: null,
    hauteur_herbe_cm: null,
    n_releve: null,
    n_fiche: 'FI-20260802-ABC123',
    n_message: null,
    especes: null,
    capture_started_at: null,
    grilles_completees: null,
    date_prospection: '2026-08-02',
    latitude: -18.8792,
    longitude: 47.5079,
    altitude: null,
    surf_station: 12,
    surf_prospectee: 8.5,
    surf_infestee: 1,
    degats_cultures: null,
    derniere_pluie: null,
    intensite_pluie: null,
    vegetation: null,
    sol: null,
    ennemis_naturels: null,
    observations: null,
    statut: 'brouillon',
    statut_sync: 'local',
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockCompleteProspection.mockReset();
  mockMarkSynced.mockReset();
  mockCreateProspection.mockReset();
  mockGetNetworkState.mockReset();
});

describe('formatChrono / chronoSeconds', () => {
  it('formate mm:ss', () => {
    expect(formatChrono(90)).toBe('01:30');
    expect(formatChrono(0)).toBe('00:00');
  });

  it("renvoie 0 si le chrono n'a jamais démarré", () => {
    expect(chronoSeconds(null)).toBe(0);
  });

  it('plafonne à 30 minutes', () => {
    const startedAt = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(chronoSeconds(startedAt)).toBe(1800);
  });
});

describe('buildRecapitulatif', () => {
  it('calcule les totaux et le phénotype dominant', () => {
    const rows: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 5 },
      { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 2 },
    ];
    const recap = buildRecapitulatif(draft(), rows, 'Strate herbeuse 70%');
    expect(recap.totalCaptures).toBe(7);
    expect(recap.totalFemelles).toBe(5);
    expect(recap.totalMales).toBe(2);
    expect(recap.phenotypeDominantLabel).toBe('Transiens');
    expect(recap.nFiche).toBe('FI-20260802-ABC123');
    expect(recap.vegetationSummary).toBe('Strate herbeuse 70%');
  });

  it("affiche '—' si aucune capture", () => {
    const recap = buildRecapitulatif(draft(), [], '');
    expect(recap.phenotypeDominantLabel).toBe('—');
    expect(recap.totalCaptures).toBe(0);
  });
});

describe('enregistrerEtSynchroniser', () => {
  it('complète toujours la fiche locale puis synchronise si en ligne', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1' });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCompleteProspection).toHaveBeenCalledWith('draft-1');
    expect(mockCreateProspection).toHaveBeenCalled();
    expect(mockMarkSynced).toHaveBeenCalledWith('draft-1');
    expect(result).toEqual({ synced: true });
  });

  it('ne tente pas le réseau hors-ligne, la fiche reste locale', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).not.toHaveBeenCalled();
    expect(mockMarkSynced).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: false });
  });

  it('échec réseau silencieux si le serveur est injoignable malgré la connectivité', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockRejectedValue(new Error('network error'));

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(result).toEqual({ synced: false });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});
