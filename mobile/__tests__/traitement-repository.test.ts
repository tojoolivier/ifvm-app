import {
  createDraftTraitementAerien,
  createDraftTraitementTerrestre,
  updateTraitementReference,
  updateTraitementAerien,
  updateTraitementTerrestre,
  updateTraitementMoyens,
  updateTraitementImpacts,
  addRotation,
  updateRotation,
  deleteRotation,
  addProduitUtilise,
  deleteProduitUtilise,
  saveCible,
  getTraitement,
  listDraftTraitements,
  listTraitementsByChefEquipe,
  listReprenableTraitements,
  markTraitementSynced,
  markTraitementConflict,
  countUnsyncedTraitements,
  deleteDraftTraitement,
} from '../src/lib/traitement-repository';

const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('../src/lib/prospection-db', () => ({
  getDb: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => runAsync(...args),
    getFirstAsync: (...args: unknown[]) => getFirstAsync(...args),
    getAllAsync: (...args: unknown[]) => getAllAsync(...args),
  }),
}));

const AERIEN_INPUT = {
  id: '11111111-1111-1111-1111-111111111111',
  prospectionId: '22222222-2222-2222-2222-222222222222',
  pilote: 'Jean Dupont',
  mecanicien: 'Marc Rakoto',
  chefDeBaseId: '33333333-3333-3333-3333-333333333333',
};

const TERRESTRE_INPUT = {
  id: '44444444-4444-4444-4444-444444444444',
  prospectionId: '22222222-2222-2222-2222-222222222222',
  chefEquipeId: '55555555-5555-5555-5555-555555555555',
};

const STORED_TRAITEMENT_ROW = {
  id: AERIEN_INPUT.id,
  prospection_id: AERIEN_INPUT.prospectionId,
  numero_fiche: null,
  type_traitement: 'AERIEN',
  mode_traitement: null,
  date_traitement: null,
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
};

beforeEach(() => {
  runAsync.mockClear();
  getFirstAsync.mockReset();
  getAllAsync.mockReset();
});

describe('createDraftTraitementAerien', () => {
  it('inserts a traitement row (AERIEN, brouillon/local) and its traitement_aerien row', async () => {
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW) // getTraitement -> traitement
      .mockResolvedValueOnce(null) // cible row
      .mockResolvedValueOnce({
        traitement_id: AERIEN_INPUT.id,
        pilote: AERIEN_INPUT.pilote,
        mecanicien: AERIEN_INPUT.mecanicien,
        chef_de_base_id: AERIEN_INPUT.chefDeBaseId,
        consultant_international: null,
        nb_rotations: null,
        total_pesticide_l: null,
      }); // aerien row
    getAllAsync.mockResolvedValueOnce([]); // rotations

    const result = await createDraftTraitementAerien(AERIEN_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO traitement[\s\S]*'AERIEN'/),
      expect.arrayContaining([AERIEN_INPUT.id, AERIEN_INPUT.prospectionId])
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_aerien'),
      expect.arrayContaining([AERIEN_INPUT.id, AERIEN_INPUT.pilote, AERIEN_INPUT.mecanicien, AERIEN_INPUT.chefDeBaseId])
    );
    expect(result.type_traitement).toBe('AERIEN');
    expect(result.aerien?.pilote).toBe(AERIEN_INPUT.pilote);
  });
});

describe('createDraftTraitementTerrestre', () => {
  it('inserts a traitement row (TERRESTRE, brouillon/local) and its traitement_terrestre row', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, id: TERRESTRE_INPUT.id, type_traitement: 'TERRESTRE' })
      .mockResolvedValueOnce(null) // cible row
      .mockResolvedValueOnce({
        traitement_id: TERRESTRE_INPUT.id,
        heure_debut: null,
        heure_fin: null,
        vitesse_vent_ms: null,
        direction_vent: null,
        temperature_c: null,
        reprise_traitement: null,
        traitement_origine_id: null,
        chef_equipe_id: TERRESTRE_INPUT.chefEquipeId,
        agent_encadreur_id: null,
        consultant_international: null,
        surface_atomiseur_ha: null,
        surface_disque_rotatif_ha: null,
        surface_ulvamast_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: null,
        nb_piles: null,
        surface_traitee_ha: null,
        surface_cumulee_ha: null,
        surface_restante_ha: null,
        total_pesticide_l: null,
      });
    getAllAsync.mockResolvedValueOnce([]); // produits

    const result = await createDraftTraitementTerrestre(TERRESTRE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO traitement[\s\S]*'TERRESTRE'/),
      expect.arrayContaining([TERRESTRE_INPUT.id, TERRESTRE_INPUT.prospectionId])
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_terrestre'),
      expect.arrayContaining([TERRESTRE_INPUT.id, TERRESTRE_INPUT.chefEquipeId])
    );
    expect(result.type_traitement).toBe('TERRESTRE');
    expect(result.terrestre?.chef_equipe_id).toBe(TERRESTRE_INPUT.chefEquipeId);
  });
});

describe('updateTraitementAerien', () => {
  it('updates the aerien specialisation fields', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await updateTraitementAerien(AERIEN_INPUT.id, {
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rakoto',
      chefDeBaseId: AERIEN_INPUT.chefDeBaseId,
      consultantInternational: null,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement_aerien SET'),
      expect.arrayContaining(['Jean Dupont', 'Marc Rakoto', AERIEN_INPUT.chefDeBaseId])
    );
  });
});

describe('updateTraitementTerrestre', () => {
  it('updates the terrestre specialisation fields', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, type_traitement: 'TERRESTRE' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await updateTraitementTerrestre(TERRESTRE_INPUT.id, {
      chefEquipeId: TERRESTRE_INPUT.chefEquipeId,
      heureDebut: '08:00',
      heureFin: '10:00',
      surface_atomiseur_ha: 2,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement_terrestre SET'),
      expect.arrayContaining([TERRESTRE_INPUT.chefEquipeId, '08:00', '10:00'])
    );
  });
});

describe('updateTraitementMoyens', () => {
  it('persists the EPI kit, exposed zones and vegetation fields', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await updateTraitementMoyens(AERIEN_INPUT.id, {
      kit_combinaison: 3,
      kit_gants: 3,
      kit_lunettes: 0,
      kit_masques: 0,
      kit_botte: 3,
      zones_exposees: { habitations: true },
      hauteur_strate_herbeuse_m: 1.2,
      hauteur_strate_arboree_m: 5,
      recouvrement_percent: 40,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement SET'),
      expect.arrayContaining([3, 3, JSON.stringify({ habitations: true }), 1.2, 5, 40])
    );
  });
});

describe('updateTraitementImpacts', () => {
  it('persists the empoisonnement, risk evaluation and observations fields', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await updateTraitementImpacts(AERIEN_INPUT.id, {
      empoisonnement: true,
      empoisonnement_type: 'AGENT',
      empoisonnement_mode: 'INGESTION',
      empoisonnement_autre: null,
      evaluation_risque: { sol: 'FAIBLE' },
      comportement_anormal: false,
      comportement_non_cibles: [],
      mortalite: false,
      mortalite_familles: [],
      observations: 'RAS',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement SET'),
      expect.arrayContaining(['AGENT', 'INGESTION', JSON.stringify({ sol: 'FAIBLE' }), 'RAS'])
    );
  });
});

describe('updateTraitementReference', () => {
  it('updates the common reference fields and touches updated_at', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, localite: 'Ambositra', latitude: -20.5, longitude: 47.2 })
      .mockResolvedValueOnce(null) // cible
      .mockResolvedValueOnce(null); // aerien

    await updateTraitementReference(AERIEN_INPUT.id, {
      localite: 'Ambositra',
      region: 'Amoron\'i Mania',
      district: 'Ambositra',
      commune: 'Ambositra',
      latitude: -20.5,
      longitude: 47.2,
      altitude: 1200,
      dateTraitement: '2026-08-12',
      dateValidation: null,
      numeroFiche: 'TR-20260812-1',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement SET'),
      expect.arrayContaining(['Ambositra', -20.5, 47.2])
    );
  });

  it('persists the validation date alongside the other reference fields', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, date_validation: '2026-08-13' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await updateTraitementReference(AERIEN_INPUT.id, {
      localite: 'Ambositra',
      region: null,
      district: null,
      commune: null,
      latitude: null,
      longitude: null,
      altitude: null,
      dateTraitement: '2026-08-12',
      dateValidation: '2026-08-13',
      numeroFiche: null,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('date_validation'),
      expect.arrayContaining(['2026-08-13'])
    );
  });

  it('throws if the row cannot be read back after update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(
      updateTraitementReference(AERIEN_INPUT.id, {
        localite: null,
        region: null,
        district: null,
        commune: null,
        latitude: null,
        longitude: null,
        altitude: null,
        dateTraitement: null,
        dateValidation: null,
        numeroFiche: null,
      })
    ).rejects.toThrow('Échec de la mise à jour de la fiche brouillon locale');
  });
});

describe('rotations (aerien)', () => {
  it('adds a rotation scoped to a traitement_aerien_id', async () => {
    getFirstAsync.mockResolvedValueOnce({
      id: 'rot-1',
      traitement_aerien_id: AERIEN_INPUT.id,
      numero: null,
      numero_cuve: 'C1',
      produit_id: 'prod-1',
      quantite_l: 12.5,
      temperature_debut_c: 20,
      temperature_fin_c: 25,
      vent_debut_ms: 1.2,
      vent_fin_ms: 1.5,
    });

    const rotation = await addRotation(AERIEN_INPUT.id, {
      numero_cuve: 'C1',
      produit_id: 'prod-1',
      quantite_l: 12.5,
      temperature_debut_c: 20,
      temperature_fin_c: 25,
      vent_debut_ms: 1.2,
      vent_fin_ms: 1.5,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rotation'),
      expect.arrayContaining([AERIEN_INPUT.id, 'C1', 'prod-1', 12.5])
    );
    expect(rotation.numero_cuve).toBe('C1');
  });

  it('updates an existing rotation by id', async () => {
    getFirstAsync.mockResolvedValueOnce({
      id: 'rot-1',
      traitement_aerien_id: AERIEN_INPUT.id,
      numero: null,
      numero_cuve: 'C2',
      produit_id: 'prod-1',
      quantite_l: 15,
      temperature_debut_c: 21,
      temperature_fin_c: 26,
      vent_debut_ms: 1.1,
      vent_fin_ms: 1.4,
    });

    await updateRotation('rot-1', {
      numero_cuve: 'C2',
      produit_id: 'prod-1',
      quantite_l: 15,
      temperature_debut_c: 21,
      temperature_fin_c: 26,
      vent_debut_ms: 1.1,
      vent_fin_ms: 1.4,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rotation SET'),
      expect.arrayContaining(['C2', 'prod-1', 15, 'rot-1'])
    );
  });

  it('deletes a rotation by id', async () => {
    await deleteRotation('rot-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rotation'),
      ['rot-1']
    );
  });
});

describe('produits utilisés (terrestre)', () => {
  it('adds a produit_utilise scoped to a traitement_terrestre_id', async () => {
    getFirstAsync.mockResolvedValueOnce({
      id: 'pu-1',
      traitement_terrestre_id: TERRESTRE_INPUT.id,
      numero: null,
      produit_id: 'prod-2',
      quantite_l: 5,
    });

    const produit = await addProduitUtilise(TERRESTRE_INPUT.id, {
      produit_id: 'prod-2',
      quantite_l: 5,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO produit_utilise'),
      expect.arrayContaining([TERRESTRE_INPUT.id, 'prod-2', 5])
    );
    expect(produit.produit_id).toBe('prod-2');
  });

  it('deletes a produit_utilise by id (no PUT, delete then recreate)', async () => {
    await deleteProduitUtilise('pu-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM produit_utilise'),
      ['pu-1']
    );
  });
});

describe('saveCible', () => {
  it('upserts the read-only cible snapshot for a traitement', async () => {
    await saveCible(AERIEN_INPUT.id, {
      espece: 'LMC',
      petites_larves: 1,
      grandes_larves: 2,
      vols_clairs_essaims: 0,
      repartition_population: 'diffuse',
      surface_infestee_ha: 3.5,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO cible'),
      [AERIEN_INPUT.id, 'LMC', 1, 2, 0, 'diffuse', 3.5]
    );
  });
});

describe('getTraitement', () => {
  it('returns null when no row matches the id', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await getTraitement('does-not-exist');

    expect(result).toBeNull();
  });

  it('attaches the aerien child with its rotations when type_traitement is AERIEN', async () => {
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW)
      .mockResolvedValueOnce(null) // cible
      .mockResolvedValueOnce({
        traitement_id: AERIEN_INPUT.id,
        pilote: 'Jean',
        mecanicien: 'Marc',
        chef_de_base_id: 'chef-1',
        consultant_international: null,
        nb_rotations: 2,
        total_pesticide_l: 40,
      });
    getAllAsync.mockResolvedValueOnce([
      { id: 'rot-1', traitement_aerien_id: AERIEN_INPUT.id, numero: 1, numero_cuve: 'C1', produit_id: 'prod-1', quantite_l: 20, temperature_debut_c: null, temperature_fin_c: null, vent_debut_ms: null, vent_fin_ms: null },
    ]);

    const result = await getTraitement(AERIEN_INPUT.id);

    expect(result?.aerien?.pilote).toBe('Jean');
    expect(result?.aerien?.rotations).toHaveLength(1);
    expect(result?.terrestre).toBeUndefined();
  });
});

describe('listDraftTraitements', () => {
  it('lists only brouillon rows ordered by most recently updated', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_TRAITEMENT_ROW]);

    const result = await listDraftTraitements();

    expect(result).toEqual([STORED_TRAITEMENT_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE statut = 'brouillon'")
    );
  });
});

describe('listTraitementsByChefEquipe', () => {
  it('joins traitement_terrestre on chef_equipe_id', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_TRAITEMENT_ROW]);

    const result = await listTraitementsByChefEquipe('chef-1');

    expect(result).toEqual([STORED_TRAITEMENT_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('chef_equipe_id = ?'),
      ['chef-1']
    );
  });
});

describe('listReprenableTraitements', () => {
  it('queries locally cached validated traitements with a remaining or unknown surface', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listReprenableTraitements();

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining("statut = 'validee'"));
    expect(sql).toEqual(
      expect.stringContaining('surface_restante_ha IS NULL OR traitement_terrestre.surface_restante_ha > 0')
    );
  });

  it('excludes fiches already used as the origin of another reprise', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listReprenableTraitements();

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('NOT IN'));
    expect(sql).toEqual(expect.stringContaining('traitement_origine_id'));
  });
});

describe('markTraitementSynced', () => {
  it('sets statut_sync to synced', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, statut_sync: 'synced' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await markTraitementSynced(AERIEN_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync = 'synced'"),
      expect.arrayContaining([AERIEN_INPUT.id])
    );
  });

  it('writes the server updated_at into the dedicated server_updated_at column, distinct from local updated_at', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, statut_sync: 'synced' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await markTraitementSynced(AERIEN_INPUT.id, '2026-08-14T12:00:00.000Z');

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('server_updated_at'));
    expect(params).toContain('2026-08-14T12:00:00.000Z');
    // updated_at (local write clock) stays distinct from server_updated_at.
    expect(params.filter((p: unknown) => p === '2026-08-14T12:00:00.000Z')).toHaveLength(1);
  });
});

describe('markTraitementConflict', () => {
  it('persists the server TraitementRead locally with statut_sync = conflict', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, statut_sync: 'conflict' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await markTraitementConflict(AERIEN_INPUT.id, {
      ...STORED_TRAITEMENT_ROW,
      localite: 'ServerLocalite',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync = 'conflict'"),
      expect.arrayContaining(['ServerLocalite'])
    );
  });

  it('writes the server updated_at into server_updated_at', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, statut_sync: 'conflict' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await markTraitementConflict(AERIEN_INPUT.id, {
      ...STORED_TRAITEMENT_ROW,
      updated_at: '2026-08-14T09:00:00.000Z',
    });

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('server_updated_at'));
    expect(params).toContain('2026-08-14T09:00:00.000Z');
  });
});

describe('countUnsyncedTraitements', () => {
  it('counts rows whose statut_sync is not synced', async () => {
    getFirstAsync.mockResolvedValueOnce({ count: 3 });

    const result = await countUnsyncedTraitements();

    expect(result).toBe(3);
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync != 'synced'")
    );
  });

  it('returns 0 when the query yields no row', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await countUnsyncedTraitements();

    expect(result).toBe(0);
  });
});

describe('deleteDraftTraitement', () => {
  it('hard-deletes a local-only draft (children cascade)', async () => {
    const result = await deleteDraftTraitement(AERIEN_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement'),
      [AERIEN_INPUT.id]
    );
    expect(result).toBe(true);
  });
});
