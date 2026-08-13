jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
}));

// Mock de prospection-db avec une station
jest.mock('../src/lib/prospection-db', () => ({
  getDb: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([{ id: 'station-1' }]),
    getFirstAsync: jest.fn().mockResolvedValue({ id: 'station-1' }),
  }),
}));

// Mock de referentiel-sync
jest.mock('../src/lib/referentiel-sync', () => ({
  pullReferentiel: jest.fn().mockResolvedValue(undefined),
}));


import {
  CaptureRow,
  DraftProspection,
  completeProspection,
  markProspectionSynced,
  listAllProspectionCaptures,
  listAllProspectionPopulations,
  listAllProspectionInfestations,
} from '../src/lib/prospection-repository';
import { apiClient } from '../src/lib/api-client';
import * as Network from 'expo-network';
import {
  buildRecapitulatif,
  chronoSeconds,
  enregistrerEtSynchroniser,
  retrySyncProspection,
  formatChrono,
} from '../src/lib/prospection-review';

jest.mock('../src/lib/prospection-repository', () => ({
  completeProspection: jest.fn(),
  markProspectionSynced: jest.fn(),
  listAllProspectionCaptures: jest.fn(),
  listAllProspectionPopulations: jest.fn(),
  listAllProspectionInfestations: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createProspection: jest.fn() },
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

const mockCompleteProspection = jest.mocked(completeProspection);
const mockMarkSynced = jest.mocked(markProspectionSynced);
const mockCreateProspection = jest.mocked(apiClient.createProspection);
const mockGetNetworkState = jest.mocked(Network.getNetworkStateAsync);
const mockListAllCaptures = jest.mocked(listAllProspectionCaptures);
const mockListAllPopulations = jest.mocked(listAllProspectionPopulations);
const mockListAllInfestations = jest.mocked(listAllProspectionInfestations);

function draft(overrides: Partial<DraftProspection> = {}): DraftProspection {
  return {
    id: 'draft-1',
    type_prospection: 'intensive',
    campagne_id: 'camp-1',
    prospecteur_id: 'user-1',
    station_id: null,
    biotope: 'Mesophyle',
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    pa_nom: null,
    station_nom: null,
    degats_cultures_pourcent: null,
    verdissement_pourcent: null,
    hauteur_herbe_cm: null,
    station_libre: null,
    type_station: null,
    verdure_strate: null,
    signalement_source: null,
    signalement_date: null,
    signalement_description: null,
    conclusion_validation: null,
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
  mockListAllCaptures.mockReset();
  mockListAllPopulations.mockReset().mockResolvedValue([]);
  mockListAllInfestations.mockReset().mockResolvedValue([]);
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
    const recap = buildRecapitulatif(draft(), rows, 'Strate herbeuse 70%', []);
    expect(recap.totalCaptures).toBe(7);
    expect(recap.totalFemelles).toBe(5);
    expect(recap.totalMales).toBe(2);
    expect(recap.phenotypeDominantLabel).toBe('Transiens');
    expect(recap.nFiche).toBe('FI-20260802-ABC123');
    expect(recap.vegetationSummary).toBe('Strate herbeuse 70%');
  });

  it("affiche '—' si aucune capture", () => {
    const recap = buildRecapitulatif(draft(), [], '', []);
    expect(recap.phenotypeDominantLabel).toBe('—');
    expect(recap.totalCaptures).toBe(0);
  });

  it('construit une carte par groupe actif (espèce+catégorie), avec total/max/dominant propres', () => {
    const d = draft({ especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false }) });
    const rows: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 5 },
      { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L1', effectif: 3 },
    ];
    const recap = buildRecapitulatif(d, rows, '', []);
    expect(recap.reviewGroups).toEqual([
      { label: 'Locusta — Imagos', total: 5, max: 50, dominantLabel: 'Transiens' },
      { label: 'Locusta — Larves', total: 3, max: 65, dominantLabel: 'Grégaires' },
    ]);
  });

  it("résume l'infestation : formations renseignées listées, sinon 'aucune'", () => {
    const filled = buildRecapitulatif(draft(), [], '', [
      { espece: null, type_cible: 'essaim', taille_min: null, taille_max: null, taille_moy: null, surface_tot: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surf_infestee_pourcent: null },
    ]);
    expect(filled.infestationSummary).toBe('Essaim renseignée.');

    const empty = buildRecapitulatif(draft(), [], '', []);
    expect(empty.infestationSummary).toBe('Aucune formation renseignée.');
  });
});

describe('enregistrerEtSynchroniser', () => {
  it('complète toujours la fiche locale puis synchronise si en ligne', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1' });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([
      { espece: 'LMC', categorie: 'imago', densite_diffuse: 5, densite_groupee: 1, methode: null, accouplement: 'rare', ponte: null },
    ]);
    mockListAllInfestations.mockResolvedValue([
      { espece: null, type_cible: 'essaim', taille_min: null, taille_max: null, taille_moy: null, surface_tot: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surf_infestee_pourcent: null },
    ]);

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCompleteProspection).toHaveBeenCalledWith('draft-1');
    expect(mockListAllPopulations).toHaveBeenCalledWith('draft-1');
    expect(mockListAllInfestations).toHaveBeenCalledWith('draft-1');
    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        n_releve: null,
        populations: [expect.objectContaining({ espece: 'LMC', categorie: 'imago', densite_diffuse: 5 })],
        infestations: [expect.objectContaining({ type_cible: 'essaim', surface_tot: 5 })],
      })
    );
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

  it("remonte l'erreur de synchronisation au lieu de l'avaler, la fiche restant enregistrée localement (#98)", async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockRejectedValue(new Error('network error'));

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCompleteProspection).toHaveBeenCalledWith('draft-1');
    expect(result).toEqual({ synced: false, syncError: 'network error' });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('enregistre normalement une 3e, 4e, 5e fiche à la suite, même si le serveur rejette une des synchronisations (#98)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    for (let i = 1; i <= 5; i += 1) {
      mockCompleteProspection.mockResolvedValueOnce(draft({ id: `draft-${i}`, statut: 'en_attente' }));
      if (i === 3) {
        mockCreateProspection.mockRejectedValueOnce(new Error(`Erreur serveur sur la fiche ${i}`));
      } else {
        mockCreateProspection.mockResolvedValueOnce({ id: `remote-${i}` });
      }

      const result = await enregistrerEtSynchroniser(draft({ id: `draft-${i}` }), [], 'token-1');

      expect(mockCompleteProspection).toHaveBeenCalledWith(`draft-${i}`);
      if (i === 3) {
        expect(result).toEqual({ synced: false, syncError: 'Erreur serveur sur la fiche 3' });
      } else {
        expect(result).toEqual({ synced: true });
      }
    }
  });
});

describe('retrySyncProspection', () => {
  it('renvoie la fiche en_attente au serveur puis la marque synchronisée', async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1' });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await retrySyncProspection(draft({ statut: 'en_attente' }), 'token-1');

    expect(mockListAllCaptures).toHaveBeenCalledWith('draft-1');
    expect(mockListAllPopulations).toHaveBeenCalledWith('draft-1');
    expect(mockListAllInfestations).toHaveBeenCalledWith('draft-1');
    expect(mockCreateProspection).toHaveBeenCalled();
    expect(mockMarkSynced).toHaveBeenCalledWith('draft-1');
  });

  it("laisse remonter l'erreur au lieu de l'avaler, pour que l'appelant puisse afficher un toast", async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockCreateProspection.mockRejectedValue(new Error('Erreur serveur 500'));

    await expect(retrySyncProspection(draft({ statut: 'en_attente' }), 'token-1')).rejects.toThrow(
      'Erreur serveur 500'
    );
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});