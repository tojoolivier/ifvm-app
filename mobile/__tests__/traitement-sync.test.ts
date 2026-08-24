import * as Network from 'expo-network';
import { apiClient } from '../src/lib/api-client';
import {
  DraftTraitement,
  markTraitementSynced,
  markTraitementConflict,
} from '../src/lib/traitement-repository';
import {
  enregistrerEtSynchroniserTraitement,
  retrySyncTraitement,
} from '../src/lib/traitement-sync';

jest.mock('../src/lib/traitement-repository', () => ({
  markTraitementSynced: jest.fn(),
  markTraitementConflict: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { syncTraitement: jest.fn() },
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

const mockMarkSynced = jest.mocked(markTraitementSynced);
const mockMarkConflict = jest.mocked(markTraitementConflict);
const mockSyncTraitement = jest.mocked(apiClient.syncTraitement);
const mockGetNetworkState = jest.mocked(Network.getNetworkStateAsync);

function draft(overrides: Partial<DraftTraitement> = {}): DraftTraitement {
  return {
    id: 'traitement-1',
    prospection_id: 'prospection-1',
    numero_fiche: null,
    type_traitement: 'AERIEN',
    mode_traitement: null,
    date_traitement: '2026-08-12',
    date_validation: null,
    localite: null,
    region: null,
    district: null,
    commune: null,
    latitude: null,
    longitude: null,
    altitude: null,
    kit_combinaison: null,
    kit_gants: null,
    kit_lunettes: null,
    kit_masques: null,
    kit_boite: null,
    zones_exposees: null,
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
    empoisonnement: null,
    empoisonnement_type: null,
    empoisonnement_mode: null,
    empoisonnement_autre: null,
    evaluation_risque: null,
    comportement_anormal: null,
    comportement_non_cibles: null,
    mortalite: null,
    mortalite_familles: null,
    observations: null,
    statut: 'brouillon',
    statut_sync: 'local',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    server_updated_at: null,
    aerien: {
      traitement_id: 'traitement-1',
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rakoto',
      chef_de_base_id: 'chef-1',
      consultant_international: null,
      nb_rotations: null,
      total_pesticide_l: null,
      rotations: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockMarkSynced.mockReset();
  mockMarkConflict.mockReset();
  mockSyncTraitement.mockReset();
  mockGetNetworkState.mockReset();
});

describe('enregistrerEtSynchroniserTraitement', () => {
  it('reste en local sans tenter le réseau si hors-ligne', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(mockSyncTraitement).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: false });
  });

  it('synchronise et marque la fiche synced sur 201 (création)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 201, body: { id: 'traitement-1', updated_at: '2026-08-13T00:00:00.000Z' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        id: 'traitement-1',
        type_traitement: 'AERIEN',
        base_updated_at: '2026-08-12T00:00:00.000Z',
        aerien: expect.objectContaining({ pilote: 'Jean Dupont', mecanicien: 'Marc Rakoto', chef_de_base_id: 'chef-1' }),
      })
    );
    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', '2026-08-13T00:00:00.000Z');
    expect(result).toEqual({ synced: true, serverVersion: { id: 'traitement-1', updated_at: '2026-08-13T00:00:00.000Z' } });
  });

  it('utilise server_updated_at comme base_updated_at quand la fiche a déjà été synchronisée', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 200, body: { id: 'traitement-1' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await enregistrerEtSynchroniserTraitement(
      draft({ server_updated_at: '2026-08-13T05:00:00.000Z', updated_at: '2026-08-14T09:00:00.000Z' }),
      'token-1'
    );

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ base_updated_at: '2026-08-13T05:00:00.000Z' })
    );
  });

  it('synchronise et marque la fiche synced sur 200 (mise à jour)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 200, body: { id: 'traitement-1' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', undefined);
    expect(result).toEqual({ synced: true, serverVersion: { id: 'traitement-1' } });
  });

  it('persiste le conflit et ne synchronise pas sur 409', async () => {
    const serverVersion = { id: 'traitement-1', statut: 'validee', localite: 'ServerLocalite' };
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 409, body: serverVersion });
    mockMarkConflict.mockResolvedValue(draft({ statut_sync: 'conflict' }));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(mockMarkConflict).toHaveBeenCalledWith('traitement-1', serverVersion);
    expect(mockMarkSynced).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: false, conflict: true, serverVersion });
  });

  /*
   * Ce test protégeait le silence qu'ADR-012 supprime : `{ synced: false }`
   * seul était indiscernable de « pas encore tentée », et l'écran affichait le
   * même « Fiche enregistrée » qu'en cas de succès. Le motif remonte
   * désormais, comme le faisait déjà `prospection-review` (issue #173).
   */
  it('remonte le motif de l’échec quand le serveur est injoignable', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockRejectedValue(new Error('network error'));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(result).toEqual({ synced: false, syncError: 'network error' });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('envoie le bloc terrestre pour une fiche TERRESTRE', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 201, body: { id: 'traitement-2' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const terrestreDraft = draft({
      id: 'traitement-2',
      type_traitement: 'TERRESTRE',
      aerien: undefined,
      terrestre: {
        traitement_id: 'traitement-2',
        heure_debut: '08:00:00',
        heure_fin: '10:00:00',
        vitesse_vent_ms: 2,
        direction_vent: 'N',
        temperature_c: 25,
        reprise_traitement: false,
        traitement_origine_id: null,
        chef_equipe_id: 'chef-equipe-1',
        agent_encadreur_id: null,
        consultant_international: null,
        surface_atomiseur_ha: 3,
        surface_disque_rotatif_ha: null,
        surface_ulvamast_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: 10,
        nb_piles: 2,
        surface_traitee_ha: null,
        surface_cumulee_ha: null,
        surface_restante_ha: null,
        total_pesticide_l: null,
        produits: [],
      },
    });

    await enregistrerEtSynchroniserTraitement(terrestreDraft, 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        type_traitement: 'TERRESTRE',
        terrestre: expect.objectContaining({ chef_equipe_id: 'chef-equipe-1', vitesse_vent_ms: 2 }),
      })
    );
  });
});

describe('retrySyncTraitement', () => {
  it('marque la fiche synced sur succès', async () => {
    mockSyncTraitement.mockResolvedValue({ status: 200, body: { id: 'traitement-1' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await retrySyncTraitement(draft(), 'token-1');

    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', undefined);
  });

  it('persiste le conflit puis jette pour signaler l\'échec au retry-queue', async () => {
    const serverVersion = { id: 'traitement-1', statut: 'validee' };
    mockSyncTraitement.mockResolvedValue({ status: 409, body: serverVersion });
    mockMarkConflict.mockResolvedValue(draft({ statut_sync: 'conflict' }));

    await expect(retrySyncTraitement(draft(), 'token-1')).rejects.toThrow();

    expect(mockMarkConflict).toHaveBeenCalledWith('traitement-1', serverVersion);
  });

  it('jette sur toute erreur réseau ou HTTP', async () => {
    mockSyncTraitement.mockRejectedValue(new Error('network error'));

    await expect(retrySyncTraitement(draft(), 'token-1')).rejects.toThrow('network error');
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});
