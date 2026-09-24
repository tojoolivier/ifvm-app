import * as Network from 'expo-network';
import { apiClient } from '../src/lib/api-client';
import {
  DraftTraitement,
  estTraitementPretPourSynchro,
  markTraitementSynced,
  markTraitementConflict,
  markTraitementEchec,
} from '../src/lib/traitement-repository';
import {
  enregistrerEtSynchroniserTraitement,
  syncOneTraitement,
  syncAllTraitements,
} from '../src/lib/traitement-sync';
import { NetworkError, PreconditionError } from '../src/lib/errors';
import { useEquipeTravailStore } from '../src/lib/equipe-travail-store';

jest.mock('../src/lib/traitement-repository', () => ({
  // Par défaut toujours prête : les fixtures de ce fichier ne visent pas cette
  // règle (cf. #traitement-aerien-brouillon-incomplet-bloque-synchro, testée à
  // part ci-dessous) — un `immatricule_aeronef: null` dans `draft()` de base ne
  // doit pas faire échouer les scénarios de conflit/rotations qui n'en parlent
  // pas.
  estTraitementPretPourSynchro: jest.fn(() => true),
  markTraitementSynced: jest.fn(),
  markTraitementConflict: jest.fn(),
  markTraitementEchec: jest.fn(),
}));
jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/api-client', () => {
  // `sync-lot` lit le statut HTTP et la version serveur joints à l'erreur : les
  // vraies implémentations, sans effet de bord, plutôt qu'un stub qui mentirait.
  const { NetworkError } = jest.requireActual('../src/lib/errors');
  return {
    apiClient: {
      syncTraitement: jest.fn(),
      addRotation: jest.fn(),
      removeRotation: jest.fn(),
      addProduitUtilise: jest.fn(),
      removeProduitUtilise: jest.fn(),
    },
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
const mockEstPret = jest.mocked(estTraitementPretPourSynchro);
const mockSyncTraitement = jest.mocked(apiClient.syncTraitement);
const mockGetNetworkState = jest.mocked(Network.getNetworkStateAsync);

function draft(overrides: Partial<DraftTraitement> = {}): DraftTraitement {
  return {
    id: 'traitement-1',
    prospection_id: 'prospection-1',
    equipe_id: 'eq-1',
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
    nb_agents_permanents: null,
    nb_agents_temporaires: null,
    nb_personnel_local: null,
    moyens_atomiseur_nb: null,
    moyens_essence_litres: null,
    moyens_disque_rotatif_nb: null,
    moyens_piles_nb: null,
    moyens_ulvamast_nb: null,
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
    evaluations_risque_population: [
      { id: 'eval-1', traitement_id: 'traitement-1', ordre: 0, habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: 1 },
    ],
    statut: 'brouillon',
    statut_sync: 'local',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    server_updated_at: null,
    aerien: {
      traitement_id: 'traitement-1',
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rabe',
      chef_de_base_id: 'chef-1',
      consultant_international: null,
      immatricule_aeronef: null,
      base_principale: 'Base Betioky',
      stand: null,
      stand_date_installation: null,
      base_secondaire: null,
      base_secondaire_date_installation: null,
      nb_rotations: null,
      total_pesticide_l: null,
      total_pesticide_kg: null,
      surface_traitee_ha: null,
      surface_protegee_ha: null,
      reprise_traitement: null,
      traitement_origine_id: null,
      surface_cumulee_ha: null,
      surface_restante_ha: null,
      taux_mortalite_pourcent: null,
      evaluation_efficacite_heures_apres: null,
      methode_evaluation_efficacite: null,
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
  mockEstPret.mockReset().mockReturnValue(true);
  jest.mocked(apiClient.addRotation).mockClear();
  jest.mocked(apiClient.removeRotation).mockClear();
  jest.mocked(apiClient.addProduitUtilise).mockClear();
  jest.mocked(apiClient.removeProduitUtilise).mockClear();
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
        // #evaluation-risque-population : envoyée dans le payload principal
        // (commune à Aérien et Terrestre), sensibilisation normalisée en
        // vrai booléen (0/1/NULL en SQLite local).
        evaluations_risque_population: [
          { habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: true },
        ],
        aerien: expect.objectContaining({
          pilote: 'Jean Dupont',
          mecanicien: 'Marc Rabe',
          chef_de_base_id: 'chef-1',
          // #traitement-aerien-base-texte-libre : envoyée telle quelle,
          // jamais résolue contre le référentiel lieu_aerien.
          base_principale: 'Base Betioky',
        }),
      })
    );
    expect(mockMarkSynced).toHaveBeenCalledWith('traitement-1', '2026-08-13T00:00:00.000Z');
    expect(result.reussies).toEqual(['traitement-1']);
  });

  it('envoie les dates d\'installation du Stand/de la Base secondaire, indépendamment l\'une de l\'autre (#stand-base-secondaire-date-installation)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 201, body: { id: 'traitement-1', updated_at: '2026-08-13T00:00:00.000Z' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const draftAvecDates = draft({
      aerien: {
        ...draft().aerien!,
        stand: 'Stand Betioky',
        stand_date_installation: '2026-07-01',
        // Base secondaire vide alors que sa date est renseignée.
        base_secondaire: null,
        base_secondaire_date_installation: '2026-07-15',
      },
    });

    await enregistrerEtSynchroniserTraitement(draftAvecDates, 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        aerien: expect.objectContaining({
          stand: 'Stand Betioky',
          stand_date_installation: '2026-07-01',
          base_secondaire: null,
          base_secondaire_date_installation: '2026-07-15',
        }),
      })
    );
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
            numero_cuve: '1',
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

  it('supprime les rotations déjà côté serveur avant de repousser la liste locale, pour ne pas les dupliquer à chaque synchronisation (#persistance-fiches-traitement)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    // La réponse du sync principal porte les rotations déjà enregistrées côté
    // serveur (id serveur "rot-server-1") — distinctes de l'id local ("rot-1"),
    // qui n'a aucune signification côté serveur.
    mockSyncTraitement.mockResolvedValue({
      status: 200,
      body: {
        id: 'traitement-1',
        updated_at: '2026-08-13T00:00:00.000Z',
        aerien: { rotations: [{ id: 'rot-server-1' }] },
      },
    });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    const draftAvecRotation = draft({
      aerien: {
        ...draft().aerien!,
        rotations: [{ id: 'rot-1', traitement_aerien_id: 'traitement-1', numero: 1, numero_cuve: '1', produit_id: 'prod-1', quantite: 10, unite: 'L', surface_ha: 5, temperature_debut_c: 25, temperature_fin_c: 27, vent_debut_ms: 2, vent_fin_ms: 3, heure_debut: '06:00', heure_fin: '06:30', heure_ouverture_vanne: '06:05', heure_fermeture_vanne: '06:25', nom_commercial: 'Fyfanon' }],
      },
    });

    await enregistrerEtSynchroniserTraitement(draftAvecRotation, 'token-1');

    expect(apiClient.removeRotation).toHaveBeenCalledWith('token-1', 'traitement-1', 'rot-server-1');
    expect(apiClient.addRotation).toHaveBeenCalledWith(
      'token-1',
      'traitement-1',
      expect.objectContaining({ produit_id: 'prod-1' })
    );
    // La suppression précède le ré-ajout : sinon la fenêtre de duplication existe encore.
    const ordreAppelsRemove = jest.mocked(apiClient.removeRotation).mock.invocationCallOrder[0];
    const ordreAppelsAdd = jest.mocked(apiClient.addRotation).mock.invocationCallOrder[0];
    expect(ordreAppelsRemove).toBeLessThan(ordreAppelsAdd);
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
        agent_encadreur: null,
        consultant_international: null,
        surface_atomiseur_ha: 3,
        surface_disque_rotatif_ha: null,
        surface_atomiseur_autoporte_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: 10,
        nb_piles: 2,
        surface_traitee_ha: null,
        surface_protegee_ha: null,
        surface_cumulee_ha: null,
        surface_restante_ha: null,
        pesticide_unite: 'L',
        total_pesticide_l: null,
        pesticide_recu_l: 150,
        stock_initial_l: 40,
        pesticide_stock_restant_l: null,
        taux_mortalite_pourcent: null,
        evaluation_efficacite_heures_apres: null,
        methode_evaluation_efficacite: null,
        produits: [],
      },
    });

    await enregistrerEtSynchroniserTraitement(terrestreDraft, 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        type_traitement: 'TERRESTRE',
        terrestre: expect.objectContaining({
          chef_equipe_id: 'chef-equipe-1',
          vitesse_vent_ms: 2,
          // #stock-initial-terrestre : doit être transmis au même titre que
          // pesticide_recu_l, sans quoi le stock final resterait mal calculé
          // côté serveur après synchronisation.
          pesticide_recu_l: 150,
          stock_initial_l: 40,
        }),
      })
    );
  });

  it('supprime les produits déjà côté serveur avant de repousser la liste locale, pour ne pas les dupliquer à chaque synchronisation (#persistance-fiches-traitement)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({
      status: 200,
      body: {
        id: 'traitement-2',
        updated_at: '2026-08-13T00:00:00.000Z',
        terrestre: { produits: [{ id: 'produit-server-1' }] },
      },
    });
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
        agent_encadreur: null,
        consultant_international: null,
        surface_atomiseur_ha: 3,
        surface_disque_rotatif_ha: null,
        surface_atomiseur_autoporte_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: 10,
        nb_piles: 2,
        surface_traitee_ha: null,
        surface_protegee_ha: null,
        surface_cumulee_ha: null,
        surface_restante_ha: null,
        pesticide_unite: 'L',
        total_pesticide_l: null,
        pesticide_recu_l: null,
        stock_initial_l: null,
        pesticide_stock_restant_l: null,
        taux_mortalite_pourcent: null,
        evaluation_efficacite_heures_apres: null,
        methode_evaluation_efficacite: null,
        produits: [{ id: 'produit-local-1', traitement_terrestre_id: 'traitement-2', numero: 1, produit_id: 'prod-1', quantite_l: 5, nom_commercial: 'Fyfanon' }],
      },
    });

    await enregistrerEtSynchroniserTraitement(terrestreDraft, 'token-1');

    expect(apiClient.removeProduitUtilise).toHaveBeenCalledWith('token-1', 'traitement-2', 'produit-server-1');
    expect(apiClient.addProduitUtilise).toHaveBeenCalledWith(
      'token-1',
      'traitement-2',
      expect.objectContaining({ produit_id: 'prod-1' })
    );
    const ordreRemove = jest.mocked(apiClient.removeProduitUtilise).mock.invocationCallOrder[0];
    const ordreAdd = jest.mocked(apiClient.addProduitUtilise).mock.invocationCallOrder[0];
    expect(ordreRemove).toBeLessThan(ordreAdd);
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

  // #traitement-aerien-brouillon-incomplet-bloque-synchro
  it('refuse d’envoyer une fiche pas encore prête, sans jamais appeler le réseau', async () => {
    mockEstPret.mockReturnValue(false);

    await expect(syncOneTraitement(draft(), 'token-1')).rejects.toThrow(PreconditionError);
    expect(mockSyncTraitement).not.toHaveBeenCalled();
    expect(mockMarkSynced).not.toHaveBeenCalled();
    expect(mockMarkEchec).not.toHaveBeenCalled();
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

describe('rattachement à l’équipe (#641)', () => {
  beforeEach(() => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockSyncTraitement.mockResolvedValue({ status: 201, body: { id: 'traitement-1' } });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    useEquipeTravailStore.setState({ equipeId: null });
  });

  it('envoie l’équipe d’origine de la fiche, même si l’équipe de travail a changé depuis', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-actuelle' });

    await syncOneTraitement(draft({ equipe_id: 'eq-origine' }), 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ equipe_id: 'eq-origine' })
    );
  });

  it('une fiche sans équipe reste synchronisable avec l’équipe de travail courante', async () => {
    useEquipeTravailStore.setState({ equipeId: 'eq-actuelle' });

    await syncOneTraitement(draft({ equipe_id: null }), 'token-1');

    expect(apiClient.syncTraitement).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ equipe_id: 'eq-actuelle' })
    );
  });

  it('refuse avec un message qui renvoie vers Paramètres quand aucune équipe n’est connue', async () => {
    await expect(syncOneTraitement(draft({ equipe_id: null }), 'token-1')).rejects.toThrow(/équipe de travail/i);
    expect(apiClient.syncTraitement).not.toHaveBeenCalled();
  });
});
