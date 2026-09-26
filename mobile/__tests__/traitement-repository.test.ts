import {
  createDraftTraitementAerien,
  createDraftTraitementTerrestre,
  updateTraitementReference,
  genererNumeroFicheDisponible,
  updateTraitementAerien,
  updateTraitementTerrestre,
  updateTraitementMoyens,
  updateTraitementImpacts,
  addRotation,
  updateRotation,
  deleteRotation,
  deleteAllRotationsForTraitementAerien,
  addProduitUtilise,
  deleteProduitUtilise,
  deleteAllProduitsForTraitementTerrestre,
  saveCible,
  getTraitement,
  listDraftTraitements,
  listUnsyncedTraitements,
  listReprenableTraitements,
  markTraitementSynced,
  markTraitementConflict,
  markTraitementValidee,
  saveSignatureLocal,
  clearSignatureLocal,
  countUnsyncedTraitements,
  deleteDraftTraitement,
  marquerTraitementEnregistre,
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
  mecanicien: 'Marc Rabe',
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

  it('pré-remplit l’immatriculation depuis l’affectation active de l’équipe (#642)', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await createDraftTraitementAerien({ ...AERIEN_INPUT, immatriculeAeronef: '5R-MHR' });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO traitement_aerien \([\s\S]*immatricule_aeronef/),
      expect.arrayContaining(['5R-MHR'])
    );
  });

  it('rattache le brouillon à l’équipe de travail reçue en entrée (#641)', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await createDraftTraitementAerien({ ...AERIEN_INPUT, equipeId: 'eq-1' });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO traitement \([\s\S]*equipe_id/),
      expect.arrayContaining(['eq-1'])
    );
  });

  // #traitement-brouillon-distinct-fiche-creee : une fiche neuve naît hors de la file de
  // synchronisation (statut_sync = 'brouillon'), pas « local ».
  it('crée la fiche avec statut_sync = brouillon (hors file de synchronisation)', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await createDraftTraitementAerien(AERIEN_INPUT);

    const [sql] = runAsync.mock.calls.find(([q]) => String(q).includes('INSERT INTO traitement ('))!;
    expect(sql).toContain("'brouillon', 'brouillon'");
    expect(sql).not.toContain("'local'");
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
        agent_encadreur: null,
        consultant_international: null,
        surface_atomiseur_ha: null,
        surface_disque_rotatif_ha: null,
        surface_atomiseur_autoporte_ha: null,
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
      mecanicien: 'Marc Rabe',
      chefDeBaseId: AERIEN_INPUT.chefDeBaseId,
      consultantInternational: null,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement_aerien SET'),
      expect.arrayContaining(['Jean Dupont', 'Marc Rabe', AERIEN_INPUT.chefDeBaseId])
    );
  });

  it('persists stand/base secondaire dates d\'installation, indépendamment l\'une de l\'autre (#stand-base-secondaire-date-installation)', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await updateTraitementAerien(AERIEN_INPUT.id, {
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rabe',
      chefDeBaseId: AERIEN_INPUT.chefDeBaseId,
      stand: 'Stand Betioky',
      standDateInstallation: '2026-07-01',
      // Base secondaire vide alors que sa date est renseignée : les deux
      // couples (texte libre, date) sont indépendants.
      baseSecondaire: null,
      baseSecondaireDateInstallation: '2026-07-15',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('stand_date_installation = ?'),
      expect.arrayContaining(['Stand Betioky', '2026-07-01', null, '2026-07-15'])
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('base_secondaire_date_installation = ?'),
      expect.anything()
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

  // #recap-terrestre-moyens-produits-vides : ces deux valeurs, calculées en
  // direct sur l'écran « Équipe » (computeTotalPesticideTerrestre/
  // computePesticideStockRestant), n'étaient jusqu'ici jamais transmises à
  // cette fonction — le récapitulatif les retrouvait donc toujours vides.
  it('persists totalPesticideL and pesticideStockRestantL (#recap-terrestre-moyens-produits-vides)', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, type_traitement: 'TERRESTRE' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await updateTraitementTerrestre(TERRESTRE_INPUT.id, {
      chefEquipeId: TERRESTRE_INPUT.chefEquipeId,
      totalPesticideL: 12,
      pesticideStockRestantL: 8,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('total_pesticide_l = ?'),
      expect.arrayContaining([12, 8])
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
      nb_agents_permanents: null,
      nb_agents_temporaires: null,
      nb_personnel_local: null,
      moyens_atomiseur_nb: null,
      moyens_essence_litres: null,
      moyens_disque_rotatif_nb: null,
      moyens_piles_nb: null,
      moyens_ulvamast_nb: null,
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
      evaluation_risque: { sol: true },
      comportement_anormal: false,
      comportement_non_cibles: [],
      mortalite: false,
      mortalite_familles: [],
      observations: 'RAS',
      evaluationsRisquePopulation: [
        { id: 'eval-1', habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: true },
      ],
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement SET'),
      expect.arrayContaining(['AGENT', 'INGESTION', JSON.stringify({ sol: true }), 'RAS'])
    );
    // #evaluation-risque-population : remplacée en bloc (DELETE puis INSERT),
    // jamais un diff ligne à ligne.
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement_evaluation_risque_population'),
      [AERIEN_INPUT.id]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_evaluation_risque_population'),
      ['eval-1', AERIEN_INPUT.id, 0, 'Rizière', 1.5, true]
    );
  });

  it('replaces the population risk evaluations list on every save, including clearing it', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_TRAITEMENT_ROW).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await updateTraitementImpacts(AERIEN_INPUT.id, {
      empoisonnement: false,
      empoisonnement_type: null,
      empoisonnement_mode: null,
      empoisonnement_autre: null,
      evaluation_risque: {},
      comportement_anormal: false,
      comportement_non_cibles: [],
      mortalite: false,
      mortalite_familles: [],
      observations: null,
      evaluationsRisquePopulation: [],
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement_evaluation_risque_population'),
      [AERIEN_INPUT.id]
    );
    expect(runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_evaluation_risque_population'),
      expect.anything()
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
      modeTraitement: 'BARRIERE',
      dateTraitement: '2026-08-12',
      dateValidation: null,
      numeroFiche: 'TR-20260812-1',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE traitement SET'),
      expect.arrayContaining(['Ambositra', -20.5, 47.2])
    );
  });

  it('persiste un changement de mode de traitement sur une fiche déjà créée (#persistance-fiches-traitement — auparavant jamais écrit ici, la modification disparaissait au prochain enregistrement)', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, mode_traitement: 'TOTAL' })
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
      modeTraitement: 'TOTAL',
      dateTraitement: '2026-08-12',
      dateValidation: null,
      numeroFiche: null,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('mode_traitement = ?'),
      expect.arrayContaining(['TOTAL'])
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
      modeTraitement: null,
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
        modeTraitement: null,
        dateTraitement: null,
        dateValidation: null,
        numeroFiche: null,
      })
    ).rejects.toThrow('Échec de la mise à jour de la fiche brouillon locale');
  });
});

describe('genererNumeroFicheDisponible', () => {
  // #numero-fiche-traitement-trt : « TRT-[TERR|AER]-[Date]-[NNN] », le numéro d'ordre continue par type.
  beforeEach(() => {
    getAllAsync.mockReset().mockResolvedValue([]);
    getFirstAsync.mockReset();
  });

  it('commence à 001 quand aucune fiche de ce type n’existe encore', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const numero = await genererNumeroFicheDisponible('AERIEN', '2026-08-11');

    expect(numero).toBe('TRT-AER-2026-08-11-001');
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('numero_fiche LIKE ?'), ['TRT-AER-%', null, null]);
  });

  it('continue le numéro d’ordre du type, quelle que soit la date des fiches existantes', async () => {
    getAllAsync.mockResolvedValueOnce([
      { numero_fiche: 'TRT-TERR-2026-01-05-001' },
      { numero_fiche: 'TRT-TERR-2026-03-20-002' },
      { numero_fiche: 'TRT-TERR-2026-02-11-007' },
    ]);
    getFirstAsync.mockResolvedValueOnce(null);

    const numero = await genererNumeroFicheDisponible('TERRESTRE', '2026-08-11');

    expect(numero).toBe('TRT-TERR-2026-08-11-008');
  });

  it('ignore les anciennes fiches (ancien format) et les numéros suffixés pour le compteur', async () => {
    getAllAsync.mockResolvedValueOnce([
      { numero_fiche: 'TRT-TERR-2026-01-05-003' },
      { numero_fiche: 'TRT-TERR-2026-01-05-003-2' },
      { numero_fiche: 'TRT-TERR-mal-forme' },
    ]);
    getFirstAsync.mockResolvedValueOnce(null);

    expect(await genererNumeroFicheDisponible('TERRESTRE', '2026-08-11')).toBe('TRT-TERR-2026-08-11-004');
  });

  it('appends an incremental suffix while the candidate collides locally', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ id: 'autre-fiche' }) // base sans suffixe
      .mockResolvedValueOnce({ id: 'autre-fiche' }) // suffixe 2
      .mockResolvedValueOnce(null); // suffixe 3 libre

    const numero = await genererNumeroFicheDisponible('TERRESTRE', '2026-08-11');

    expect(numero).toBe('TRT-TERR-2026-08-11-001-3');
  });

  it('excludes the fiche itself so regenerating an existing draft does not collide with its own row', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await genererNumeroFicheDisponible('AERIEN', '2026-08-11', AERIEN_INPUT.id);

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), ['TRT-AER-%', AERIEN_INPUT.id, AERIEN_INPUT.id]);
    expect(getFirstAsync).toHaveBeenCalledWith(expect.any(String), [
      'TRT-AER-2026-08-11-001',
      AERIEN_INPUT.id,
      AERIEN_INPUT.id,
    ]);
  });

  it('throws once every attempt up to the retry cap collides', async () => {
    getFirstAsync.mockResolvedValue({ id: 'toujours-pris' });

    await expect(genererNumeroFicheDisponible('AERIEN', '2026-08-11')).rejects.toThrow(
      "Impossible de générer un numero_fiche unique de type 'AERIEN'"
    );
  });
});

describe('rotations (aerien)', () => {
  it('adds a rotation scoped to a traitement_aerien_id', async () => {
    // numero_cuve n'est plus écrit par le mobile (migration 0046) : dérivé côté
    // serveur, la colonne locale reste NULL tant que la fiche n'a pas encore
    // synchronisé cette rotation.
    getFirstAsync.mockResolvedValueOnce({
      id: 'rot-1',
      traitement_aerien_id: AERIEN_INPUT.id,
      numero: null,
      numero_cuve: null,
      produit_id: 'prod-1',
      quantite: 12.5,
      unite: 'L',
      surface_ha: 3.5,
      temperature_debut_c: 20,
      temperature_fin_c: 25,
      vent_debut_ms: 1.2,
      vent_fin_ms: 1.5,
    });

    const rotation = await addRotation(AERIEN_INPUT.id, {
      produit_id: 'prod-1',
      quantite: 12.5,
      unite: 'L',
      surface_ha: 3.5,
      temperature_debut_c: 20,
      temperature_fin_c: 25,
      vent_debut_ms: 1.2,
      vent_fin_ms: 1.5,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rotation'),
      expect.arrayContaining([AERIEN_INPUT.id, 'prod-1', 12.5, 'L', 3.5])
    );
    expect(rotation.quantite).toBe(12.5);
  });

  it('updates an existing rotation by id', async () => {
    getFirstAsync.mockResolvedValueOnce({
      id: 'rot-1',
      traitement_aerien_id: AERIEN_INPUT.id,
      numero: null,
      numero_cuve: null,
      produit_id: 'prod-1',
      quantite: 15,
      unite: 'kg',
      surface_ha: 4.0,
      temperature_debut_c: 21,
      temperature_fin_c: 26,
      vent_debut_ms: 1.1,
      vent_fin_ms: 1.4,
    });

    await updateRotation('rot-1', {
      produit_id: 'prod-1',
      quantite: 15,
      unite: 'kg',
      surface_ha: 4.0,
      temperature_debut_c: 21,
      temperature_fin_c: 26,
      vent_debut_ms: 1.1,
      vent_fin_ms: 1.4,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rotation SET'),
      expect.arrayContaining(['prod-1', 15, 'kg', 4.0, 'rot-1'])
    );
  });

  it('adds/updates nom_commercial on a rotation (#produit-nom-commercial)', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'rot-1', nom_commercial: 'Fyfanon' });
    await addRotation(AERIEN_INPUT.id, { produit_id: 'prod-1', nom_commercial: 'Fyfanon' });
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rotation'),
      expect.arrayContaining(['Fyfanon'])
    );

    getFirstAsync.mockResolvedValueOnce({ id: 'rot-1', nom_commercial: 'Nurelle' });
    await updateRotation('rot-1', { produit_id: 'prod-2', nom_commercial: 'Nurelle' });
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rotation SET'),
      expect.arrayContaining(['Nurelle'])
    );
  });

  it('deletes a rotation by id', async () => {
    await deleteRotation('rot-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rotation'),
      ['rot-1']
    );
  });

  it('deletes all rotations of a traitement_aerien_id (#persistance-fiches-traitement — purge avant re-création, sans quoi rotations.tsx duplique à chaque "Continuer")', async () => {
    await deleteAllRotationsForTraitementAerien(AERIEN_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rotation WHERE traitement_aerien_id = ?'),
      [AERIEN_INPUT.id]
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

  it('adds nom_commercial on a produit_utilise (#produit-nom-commercial)', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'pu-1', nom_commercial: 'Fyfanon' });

    await addProduitUtilise(TERRESTRE_INPUT.id, { produit_id: 'prod-2', nom_commercial: 'Fyfanon' });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO produit_utilise'),
      expect.arrayContaining(['Fyfanon'])
    );
  });

  it('deletes a produit_utilise by id (no PUT, delete then recreate)', async () => {
    await deleteProduitUtilise('pu-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM produit_utilise'),
      ['pu-1']
    );
  });

  it('deletes all produits of a traitement_terrestre_id (#persistance-fiches-traitement — purge avant re-création, sans quoi traitement.tsx duplique à chaque "Continuer")', async () => {
    await deleteAllProduitsForTraitementTerrestre(TERRESTRE_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM produit_utilise WHERE traitement_terrestre_id = ?'),
      [TERRESTRE_INPUT.id]
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
      [AERIEN_INPUT.id, 'LMC', 1, 2, 0, 'diffuse', 3.5, null, null, null, null, null, null, null, null, null]
    );
  });

  it('upserts the per-species detail alongside the aggregate totals', async () => {
    await saveCible(AERIEN_INPUT.id, {
      espece: 'MELANGE',
      petites_larves: 24,
      grandes_larves: 8,
      vols_clairs_essaims: null,
      repartition_population: 'DIFFUSE',
      surface_infestee_ha: 10,
      petites_larves_lmc: 22,
      petites_larves_nse: 2,
      grandes_larves_lmc: 3,
      grandes_larves_nse: 5,
      densite_diffuse_lmc: 20,
      densite_groupee_lmc: 3,
      densite_diffuse_nse: 5,
      densite_groupee_nse: null,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO cible'),
      [AERIEN_INPUT.id, 'MELANGE', 24, 8, null, 'DIFFUSE', 10, 22, 2, 3, 5, 20, 3, 5, null, null]
    );
  });

  /**
   * #zone-a-reprendre-surface-reste-a-traiter : uniquement pour une fiche
   * démarrée depuis « Zones à reprendre » — `null` pour un traitement neuf
   * (cf. les deux tests ci-dessus, qui ne le fournissent pas).
   */
  it('upserts surface_restante_origine_ha for a fiche started from Zones à reprendre', async () => {
    await saveCible(AERIEN_INPUT.id, {
      espece: 'LMC',
      surface_infestee_ha: 5,
      surface_restante_origine_ha: 2.5,
    });

    const [, params] = runAsync.mock.calls[0];
    expect(params[params.length - 1]).toBe(2.5);
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
        pilote: 'Jean Dupont',
        mecanicien: 'Marc Rabe',
        chef_de_base_id: 'chef-1',
        consultant_international: null,
        nb_rotations: 2,
        total_pesticide_l: 40,
      });
    getAllAsync.mockResolvedValueOnce([
      {
        id: 'rot-1',
        traitement_aerien_id: AERIEN_INPUT.id,
        numero: 1,
        numero_cuve: '1',
        produit_id: 'prod-1',
        quantite: 20,
        unite: 'L',
        surface_ha: 5,
        temperature_debut_c: null,
        temperature_fin_c: null,
        vent_debut_ms: null,
        vent_fin_ms: null,
        heure_ouverture_vanne: null,
        heure_fermeture_vanne: null,
      },
    ]);

    const result = await getTraitement(AERIEN_INPUT.id);

    expect(result?.aerien?.pilote).toBe('Jean Dupont');
    expect(result?.aerien?.rotations).toHaveLength(1);
    expect(result?.terrestre).toBeUndefined();
  });

  it('attache les signatures déjà persistées localement (#signatures-auto-equipe)', async () => {
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW)
      .mockResolvedValueOnce(null) // cible
      .mockResolvedValueOnce({ traitement_id: AERIEN_INPUT.id }); // aerien row (minimal)
    getAllAsync
      .mockResolvedValueOnce([]) // rotations
      .mockResolvedValueOnce([
        {
          id: 'sig-1',
          traitement_id: AERIEN_INPUT.id,
          role: 'PILOTE',
          signataire_nom: 'Jean Dupont',
          signature_image: 'M0 0 L1 1',
          horodatage: '2026-08-26T00:00:00Z',
        },
      ]); // signatures

    const result = await getTraitement(AERIEN_INPUT.id);

    expect(result?.signatures).toEqual([
      expect.objectContaining({ role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M0 0 L1 1' }),
    ]);
  });

  it('attache les évaluations du risque pour la population, ordonnées (#evaluation-risque-population)', async () => {
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW)
      .mockResolvedValueOnce(null) // cible
      .mockResolvedValueOnce({ traitement_id: AERIEN_INPUT.id }); // aerien row (minimal)
    getAllAsync
      .mockResolvedValueOnce([]) // rotations
      .mockResolvedValueOnce([]) // signatures
      .mockResolvedValueOnce([
        { id: 'eval-1', traitement_id: AERIEN_INPUT.id, ordre: 0, habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: 1 },
        { id: 'eval-2', traitement_id: AERIEN_INPUT.id, ordre: 1, habitat_proche: 'Forêt', distance_km: 3, sensibilisation: 0 },
      ]); // evaluations_risque_population

    const result = await getTraitement(AERIEN_INPUT.id);

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM traitement_evaluation_risque_population'),
      [AERIEN_INPUT.id]
    );
    expect(result?.evaluations_risque_population).toEqual([
      expect.objectContaining({ id: 'eval-1', habitat_proche: 'Rizière' }),
      expect.objectContaining({ id: 'eval-2', habitat_proche: 'Forêt' }),
    ]);
  });
});

describe('saveSignatureLocal', () => {
  it('remplace (delete puis insert) la signature existante d’un rôle', async () => {
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await saveSignatureLocal(AERIEN_INPUT.id, 'PILOTE', 'Jean Dupont', 'M0 0 L1 1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement_signature'),
      [AERIEN_INPUT.id, 'PILOTE']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_signature'),
      expect.arrayContaining([AERIEN_INPUT.id, 'PILOTE', 'Jean Dupont', 'M0 0 L1 1'])
    );
  });
});

describe('clearSignatureLocal', () => {
  it('supprime la signature locale d’un rôle', async () => {
    await clearSignatureLocal(AERIEN_INPUT.id, 'PILOTE');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement_signature'),
      [AERIEN_INPUT.id, 'PILOTE']
    );
  });
});

describe('markTraitementValidee', () => {
  it('verrouille la fiche et réécrit les signatures avec les valeurs canoniques serveur', async () => {
    getFirstAsync
      .mockResolvedValueOnce({ ...STORED_TRAITEMENT_ROW, statut: 'validee' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getAllAsync.mockResolvedValueOnce([]);

    await markTraitementValidee(AERIEN_INPUT.id, '2026-08-26', [
      {
        id: 'sig-serveur-1',
        traitement_id: AERIEN_INPUT.id,
        role: 'PILOTE',
        signataire_nom: 'Jean Dupont',
        signature_image: 'M0 0 L1 1',
        horodatage: '2026-08-26T00:00:00Z',
      },
    ]);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'validee'"),
      ['2026-08-26', expect.any(String), AERIEN_INPUT.id]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement_signature'),
      [AERIEN_INPUT.id]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO traitement_signature'),
      ['sig-serveur-1', AERIEN_INPUT.id, 'PILOTE', 'Jean Dupont', 'M0 0 L1 1', '2026-08-26T00:00:00Z']
    );
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

describe('listUnsyncedTraitements (#synchronisation-automatique)', () => {
  it('n\'exclut pas les fiches encore "brouillon" — une fiche complète coincée hors ligne à la validation finale ne passe jamais à "validee"', async () => {
    getAllAsync.mockResolvedValueOnce([{ id: STORED_TRAITEMENT_ROW.id }]); // liste des ids en attente
    getFirstAsync
      .mockResolvedValueOnce(STORED_TRAITEMENT_ROW) // ligne traitement (getTraitement)
      .mockResolvedValueOnce(null) // cible
      // Équipe & Références déjà complètes (#traitement-aerien-brouillon-incomplet-bloque-synchro) —
      // ce scénario porte sur le filtre SQL par statut, pas sur la complétude.
      .mockResolvedValueOnce({
        traitement_id: STORED_TRAITEMENT_ROW.id,
        pilote: 'Jean Dupont',
        mecanicien: 'Marc Rabe',
        chef_de_base_id: 'chef-1',
        immatricule_aeronef: '5R-ABC',
        base_principale: 'Base Betioky',
      });
    getAllAsync
      .mockResolvedValueOnce([]) // rotations
      .mockResolvedValueOnce([]) // signatures
      .mockResolvedValueOnce([]); // evaluations_risque_population

    const result = await listUnsyncedTraitements();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(STORED_TRAITEMENT_ROW.id);
    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain("statut_sync = 'local'");
    expect(sql).toContain("statut_sync = 'conflict'");
    expect(sql).not.toContain("statut = 'validee'");
  });

  it('ne retourne rien quand aucune fiche n\'est en attente', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    const result = await listUnsyncedTraitements();

    expect(result).toEqual([]);
    expect(getFirstAsync).not.toHaveBeenCalled();
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

  it('selects surface_restante_ha (surface disponible à traiter pour la reprise) pour les deux types', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listReprenableTraitements();

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toEqual(
      expect.stringContaining('traitement_terrestre.surface_restante_ha AS surface_restante_ha')
    );
    expect(sql).toEqual(
      expect.stringContaining('traitement_aerien.surface_restante_ha AS surface_restante_ha')
    );
  });

  it('renvoie surface_restante_ha telle que stockée localement (y compris null)', async () => {
    getAllAsync.mockResolvedValueOnce([
      { id: 'trait-1', numero_fiche: 'F-1', type_traitement: 'TERRESTRE', surface_restante_ha: 3.5 },
      { id: 'trait-2', numero_fiche: 'F-2', type_traitement: 'AERIEN', surface_restante_ha: null },
    ]);

    const fiches = await listReprenableTraitements();

    expect(fiches[0].surface_restante_ha).toBe(3.5);
    expect(fiches[1].surface_restante_ha).toBeNull();
  });

  it('exclut la branche Terrestre dont la surface restante a été explicitement déclarée abandonnée (#zone-a-reprendre-surface-abandonnee)', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listReprenableTraitements();

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('surface_restante_abandonnee IS NOT 1'));
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
    // #traitement-brouillon-distinct-fiche-creee : un brouillon (jamais enregistré) ne compte pas.
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync NOT IN ('synced', 'brouillon')")
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
    const result = await deleteDraftTraitement({ id: AERIEN_INPUT.id, statut: 'brouillon' });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM traitement'),
      [AERIEN_INPUT.id]
    );
    expect(result).toBe(true);
  });

  it('refuse de supprimer une fiche déjà validée (même garde que deleteDraftProspection)', async () => {
    await expect(
      deleteDraftTraitement({ id: AERIEN_INPUT.id, statut: 'validee' })
    ).rejects.toThrow('Seules les fiches en brouillon peuvent être supprimées.');

    expect(runAsync).not.toHaveBeenCalled();
  });
});

// #traitement-brouillon-distinct-fiche-creee : « Enregistrer » (recap.tsx) fait passer la
// fiche de brouillon à « local » (à synchro) — et seulement elle.
describe('marquerTraitementEnregistre', () => {
  it('passe statut_sync de brouillon à local, sans jamais toucher une fiche déjà enregistrée/envoyée', async () => {
    await marquerTraitementEnregistre('trait-1');

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain("SET statut_sync = 'local'");
    expect(sql).toContain("AND statut_sync = 'brouillon'");
    expect(params).toEqual([expect.any(String), 'trait-1']);
  });
});
