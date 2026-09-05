import * as Network from 'expo-network';
import { apiClient } from '../src/lib/api-client';
import {
  DraftTraitement,
  markTraitementSynced,
  markTraitementConflict,
  markTraitementEchec,
} from '../src/lib/traitement-repository';
import {
  enregistrerEtSynchroniserTraitement,
  syncOneTraitement,
  syncAllTraitements,
} from '../src/lib/traitement-sync';
import { NetworkError } from '../src/lib/errors';

jest.mock('../src/lib/traitement-repository', () => ({
  markTraitementSynced: jest.fn(),
  markTraitementConflict: jest.fn(),
  markTraitementEchec: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => {
  // `sync-lot` lit le statut HTTP et la version serveur joints à l'erreur : les
  // vraies implémentations, sans effet de bord, plutôt qu'un stub qui mentirait.
  const { NetworkError } = jest.requireActual('../src/lib/errors');
  return {
    apiClient: { syncTraitement: jest.fn(), addRotation: jest.fn(), addProduitUtilise: jest.fn() },
    statutHttpDe: (error: unknown) => {
      const statut = (error as { status?: number } | null)?.status;
      return typeof statut === 'number' ? statut : null;
    },
    versionServeurDe: (error: unknown) =>
      (error as { serverVersion?: unknown } | null)?.serverVersion ?? null,
    conflitSync: (message: string, serverVersion: unknown) => {
      const erreur = new NetworkError(message);
      erreur.status = 409;
      erreur.serverVersion = serverVersion;
      return erreur;
    },
  };
});
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

const mockMarkSynced = jest.mocked(markTraitementSynced);
const mockMarkConflict = jest.mocked(markTraitementConflict);
const mockMarkEchec = jest.mocked(markTraitementEchec);
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
    kit_botte: null,
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
      pilote_id: 'pilote-1',
      mecanicien_id: 'mecanicien-1',
      chef_de_base_id: 'chef-1',
      consultant_id: null,
      immatricule_aeronef: null,
      lieu_base_principale_id: null,
      lieu_stand_id: null,
      lieu_base_secondaire_id: null,
      nb_rotations: null,
      total_pesticide_l: null,
      total_pesticide_kg: null,
      surface_traitee_ha: null,
      surface_restante_ha: null,
      pesticide_recu_l: null,
      pesticide_stock_restant_l: null,
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
  mockMarkEchec.mockReset();
});

describe('enregistrerEtSynchroniserTraitement', () => {
  it('reste en local sans tenter le réseau si hors-ligne', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(mockSyncTraitement).not.toHaveBeenCalled();
    // Hors ligne n'est plus un `{ synced: false }` indiscernable d'un succès :
    // c'est un échec transitoire nommé, qui laisse la fiche dans la file.
    expect(result.reussies).toEqual([]);
    expect(result.echouees[0]).toMatchObject({ id: 'traitement-1', sort: 'file' });
    expect(mockMarkEchec).not.toHaveBeenCalled();
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
        aerien: expect.objectContaining({ pilote_id: 'pilote-1', mecanicien_id: 'mecanicien-1', chef_de_base_id: 'chef-1' }),
      })
    );
    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', '2026-08-13T00:00:00.000Z');
    expect(result.reussies).toEqual(['traitement-1']);
  });

  it('pousse nom_commercial avec chaque rotation lors de la synchro (#produit-nom-commercial)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 201, body: { id: 'traitement-1', updated_at: '2026-08-13T00:00:00.000Z' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const draftAvecRotation = draft({
      aerien: {
        ...draft().aerien!,
        rotations: [
          {
            id: 'rot-1',
            traitement_aerien_id: 'traitement-1',
            numero: 1,
            numero_cuve: 'C1',
            produit_id: 'prod-1',
            quantite: 10,
            unite: 'L',
            surface_ha: 5,
            temperature_debut_c: 25,
            temperature_fin_c: 27,
            vent_debut_ms: 2,
            vent_fin_ms: 3,
            heure_debut: '06:00',
            heure_fin: '06:30',
            heure_ouverture_vanne: '06:05',
            heure_fermeture_vanne: '06:25',
            nom_commercial: 'Fyfanon',
          },
        ],
      },
    });

    await enregistrerEtSynchroniserTraitement(draftAvecRotation, 'token-1');

    expect(apiClient.addRotation).toHaveBeenCalledWith(
      'token-1',
      'traitement-1',
      expect.objectContaining({ produit_id: 'prod-1', nom_commercial: 'Fyfanon' })
    );
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
    expect(result.reussies).toEqual(['traitement-1']);
  });

  it('persiste le conflit et ne synchronise pas sur 409', async () => {
    const serverVersion = { id: 'traitement-1', statut: 'validee', localite: 'ServerLocalite' };
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 409, body: serverVersion });
    mockMarkConflict.mockResolvedValue(draft({ statut_sync: 'conflict' }));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(mockMarkConflict).toHaveBeenCalledWith('traitement-1', serverVersion);
    expect(mockMarkSynced).not.toHaveBeenCalled();
    // La version serveur n'est plus aplatie en `Error` générique : elle traverse
    // le résumé intacte (ADR-012 décision 9, #177).
    expect(result.conflits).toEqual([
      { id: 'traitement-1', label: 'Fiche du 2026-08-12', serverVersion },
    ]);
    expect(result.echouees).toEqual([]);
  });

  /*
   * Ce test protège le silence qu'ADR-012 supprime : `{ synced: false }` seul
   * était indiscernable de « pas encore tentée », et l'écran affichait le même
   * « Fiche enregistrée » qu'en cas de succès. L'échec figure désormais dans le
   * résumé, avec son sort (#173 puis #177).
   */
  it('fait figurer l’échec au résumé quand le serveur est injoignable', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockRejectedValue(new NetworkError('network error'));

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(result.reussies).toEqual([]);
    expect(result.echouees[0]).toMatchObject({ id: 'traitement-1', classe: 'NetworkError', sort: 'file' });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('sort de la file la fiche que le serveur refuse (4xx)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    const refus = new NetworkError('champ obligatoire manquant');
    (refus as unknown as { status: number }).status = 422;
    mockSyncTraitement.mockRejectedValue(refus);

    const result = await enregistrerEtSynchroniserTraitement(draft(), 'token-1');

    expect(result.echouees[0].sort).toBe('echec');
    expect(mockMarkEchec).toHaveBeenCalledWith('traitement-1');
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
        pesticide_recu_l: null,
        pesticide_stock_restant_l: null,
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

describe('syncOneTraitement — l’unitaire lève', () => {
  it('marque la fiche synced sur succès', async () => {
    mockSyncTraitement.mockResolvedValue({ status: 200, body: { id: 'traitement-1' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await syncOneTraitement(draft(), 'token-1');

    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', undefined);
  });

  it('lève un conflit qui PORTE la version serveur au lieu de l’aplatir', async () => {
    const serverVersion = { id: 'traitement-1', statut: 'validee' };
    mockSyncTraitement.mockResolvedValue({ status: 409, body: serverVersion });

    // `retrySyncTraitement` récupérait cette version par le réseau puis la
    // jetait dans un `new Error('Conflit de synchronisation')` générique.
    await expect(syncOneTraitement(draft(), 'token-1')).rejects.toMatchObject({
      status: 409,
      serverVersion,
    });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('jette sur toute erreur réseau ou HTTP', async () => {
    mockSyncTraitement.mockRejectedValue(new Error('network error'));

    await expect(syncOneTraitement(draft(), 'token-1')).rejects.toThrow('network error');
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});

describe('syncAllTraitements — le lot résume', () => {
  it('ne s’arrête pas à la fiche en conflit', async () => {
    const serverVersion = { id: 'b', statut: 'validee' };
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockMarkConflict.mockResolvedValue(draft({ statut_sync: 'conflict' }));
    mockSyncTraitement
      .mockResolvedValueOnce({ status: 200, body: { id: 'a' } })
      .mockResolvedValueOnce({ status: 409, body: serverVersion })
      .mockResolvedValueOnce({ status: 200, body: { id: 'c' } });

    const resume = await syncAllTraitements(
      [draft({ id: 'a' }), draft({ id: 'b' }), draft({ id: 'c' })],
      'token-1'
    );

    expect(resume.reussies).toEqual(['a', 'c']);
    expect(resume.conflits.map((f) => f.id)).toEqual(['b']);
  });
});
