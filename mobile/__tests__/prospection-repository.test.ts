import {
  alignerNumeroFicheSurNumeroMessage,
  createDraftProspection,
  materialiserProspectionValidee,
  getProspection,
  listDraftProspections,
  listToutesProspectionsLocal,
  listUnsyncedProspections,
  listValidatedProspections,
  listProspectionsDisponiblesPourTraitementLocal,
  listProspectionsARevaliderLocal,
  synchroniserStatutServeur,
  demarrerRevalidation,
  countUnsyncedProspections,
  updateProspectionReference,
  updateProspectionEspeces,
  updateProspectionVegetation,
  updateProspectionObservations,
  updateProspectionExtensiveReference,
  updateProspectionExtensiveObservations,
  completeProspection,
  concludeValidation,
  startCaptureTimer,
  saveProspectionCaptures,
  listProspectionCaptures,
  markGrilleCompleted,
  getProspectionPopulation,
  saveProspectionPopulation,
  listAllProspectionPopulations,
  getProspectionInfestation,
  saveProspectionInfestation,
  deleteProspectionInfestation,
  listAllProspectionInfestations,
  deleteProspection,
} from '../src/lib/prospection-repository';

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

const BASE_INPUT = {
  id: '11111111-1111-1111-1111-111111111111',
  typeProspection: 'intensive' as const,
  campagneId: '22222222-2222-2222-2222-222222222222',
  prospecteurId: '33333333-3333-3333-3333-333333333333',
  dateProspection: '2026-07-11',
};

const STORED_ROW = {
  id: BASE_INPUT.id,
  type_prospection: 'intensive',
  campagne_id: BASE_INPUT.campagneId,
  prospecteur_id: BASE_INPUT.prospecteurId,
  station_id: null,
  n_fiche: null,
  especes: null,
  capture_started_at: null,
  date_prospection: BASE_INPUT.dateProspection,
  latitude: null,
  longitude: null,
  altitude: null,
  surface_station: null,
  surface_prospectee: null,
  surface_infestee: null,
  statut: 'brouillon',
  statut_sync: 'local',
  created_at: '2026-07-11T00:00:00.000Z',
  updated_at: '2026-07-11T00:00:00.000Z',
};

beforeEach(() => {
  runAsync.mockClear();
  getFirstAsync.mockReset();
  getAllAsync.mockReset();
});

describe('createDraftProspection', () => {
  it('inserts a draft row with brouillon/local status', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    await createDraftProspection(BASE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO prospection'),
      expect.arrayContaining([
        BASE_INPUT.id,
        BASE_INPUT.typeProspection,
        BASE_INPUT.campagneId,
        BASE_INPUT.prospecteurId,
      ])
    );
  });

  it('returns the row read back from local storage', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await createDraftProspection(BASE_INPUT);

    expect(result).toEqual(STORED_ROW);
  });

  it('throws if the row cannot be read back after insertion', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(createDraftProspection(BASE_INPUT)).rejects.toThrow(
      'Échec de la création de la fiche brouillon locale'
    );
  });
});

// #fiches-validees-multi-utilisateurs, étendu par #revalidation-prospection
// (matérialisation complète : les champs restent à null ici pour ne pas
// alourdir le test, seuls ceux exercés par les assertions sont renseignés).
const CHAMPS_PROSPECTION_VALIDEE_PAR_DEFAUT = {
  prospecteurNom: null,
  stationId: null,
  stationNom: null,
  latitude: null,
  longitude: null,
  altitude: null,
  biotope: [],
  surfaceStation: null,
  surfaceProspectee: null,
  degatsCultures: null,
  dernierePluie: null,
  intensitePluie: null,
  vegetation: null,
  sol: null,
  ennemisNaturels: null,
  validatedAt: null,
  revalideDeId: null,
  za: null,
  paCode: null,
  degatsCulturesPourcent: null,
  verdissementPourcent: null,
  hauteurHerbeCm: null,
  heureObservationAt: null,
  stationLibre: null,
  typeStation: [],
  verdureStrate: null,
  signalementSource: null,
  signalementDate: null,
  signalementDescription: null,
  conclusionValidation: null,
  avertissements: [],
  modeExtensif: null,
  societe: null,
  immatriculeAeronef: null,
  pilote: null,
  mecanicien: null,
  chefDeBase: null,
  base: null,
  baseNumero: null,
  baseDateInstallation: null,
  baseLatitude: null,
  baseLongitude: null,
  baseSecondaire: null,
  baseSecondaireDateInstallation: null,
  baseSecondaireLatitude: null,
  baseSecondaireLongitude: null,
  signatureVisaNom: null,
  signatureVisaHorodatage: null,
  signatureVisaImage: null,
  signatureConsultantFaoNom: null,
  signatureConsultantFaoHorodatage: null,
  signatureConsultantFaoImage: null,
  signaturePiloteNom: null,
  signaturePiloteHorodatage: null,
  signaturePiloteImage: null,
  signatureChefBaseNom: null,
  signatureChefBaseHorodatage: null,
  signatureChefBaseImage: null,
};

describe('materialiserProspectionValidee', () => {
  const FICHE_VALIDEE_AUTRE_AGENT = {
    ...CHAMPS_PROSPECTION_VALIDEE_PAR_DEFAUT,
    id: 'presp-autre-agent',
    typeProspection: 'extensive',
    campagneId: 'camp-1',
    prospecteurId: 'autre-agent',
    dateProspection: '2026-08-01',
    surfaceInfestee: 12.5,
    nFiche: 'F-001',
    nMessage: null,
    region: 'Atsimo-Andrefana',
    district: 'Toliara II',
    commune: 'Betsinjaka',
    observations: null,
    statut: 'validee',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
  };

  it('écrit la fiche avec le statut et statut_sync=synced fournis par le serveur (pas brouillon/local)', async () => {
    await materialiserProspectionValidee(FICHE_VALIDEE_AUTRE_AGENT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT OR REPLACE INTO prospection[\s\S]*'synced'/),
      expect.arrayContaining(['presp-autre-agent', 'extensive', 'validee'])
    );
  });

  it('#revalidation-prospection : écrit validated_at et revalide_de_id quand fournis', async () => {
    await materialiserProspectionValidee({
      ...FICHE_VALIDEE_AUTRE_AGENT,
      id: 'presp-revalidee',
      validatedAt: '2026-08-01T00:00:00Z',
      revalideDeId: 'presp-perimee',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('revalide_de_id'),
      expect.arrayContaining(['2026-08-01T00:00:00Z', 'presp-perimee'])
    );
  });
});

describe('getProspection', () => {
  it('returns null when no row matches the id', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const result = await getProspection('does-not-exist');

    expect(result).toBeNull();
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM prospection'),
      ['does-not-exist']
    );
  });

  it('returns the matching row', async () => {
    getFirstAsync.mockResolvedValueOnce(STORED_ROW);

    const result = await getProspection(BASE_INPUT.id);

    expect(result).toEqual(STORED_ROW);
  });
});

describe('listDraftProspections', () => {
  it('lists only brouillon rows ordered by most recently updated', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listDraftProspections();

    expect(result).toEqual([STORED_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE statut = 'brouillon'")
    );
  });
});

describe('listToutesProspectionsLocal', () => {
  it("liste toutes les fiches locales, tous statuts, triées par dernière modification — jamais plafonnée (#fiches-validees-liste-non-plafonnee)", async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listToutesProspectionsLocal();

    expect(result).toEqual([STORED_ROW]);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('ORDER BY updated_at DESC'));
    expect(sql).not.toMatch(/LIMIT/i);
    expect(params).toBeUndefined();
  });
});

describe('listUnsyncedProspections (#synchronisation-automatique)', () => {
  it('n\'est pas plafonnée : aucune LIMIT dans la requête', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listUnsyncedProspections();

    expect(result).toEqual([STORED_ROW]);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/i);
    expect(params).toBeUndefined();
  });

  it('ne retient que les fiches en_attente non encore synchronisées (hors échec)', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listUnsyncedProspections();

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain("statut = 'en_attente'");
    expect(sql).toContain("statut_sync = 'local'");
    expect(sql).toContain("statut_sync = 'conflict'");
    expect(sql).not.toContain("'echec'");
  });
});

describe('listValidatedProspections', () => {
  it('lists only extensive/validation rows synced with the server, ordered by most recently updated', async () => {
    const eligibleRow = { ...STORED_ROW, type_prospection: 'extensive', statut_sync: 'synced' };
    getAllAsync.mockResolvedValueOnce([eligibleRow]);

    const result = await listValidatedProspections();

    expect(result).toEqual([eligibleRow]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("p.type_prospection IN ('extensive', 'validation')")
    );
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("AND p.statut_sync = 'synced'"));
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY p.updated_at DESC'));
  });

  it('excludes prospections whose surface infestée is already fully treated (Aérien ou Terrestre)', async () => {
    // Le "vrai" filtrage se joue en SQL (non exécuté par ce mock) — ce test garde
    // seulement une trace de non-régression sur la présence des deux clauses
    // d'exclusion (une par type de traitement), ajoutées avec le chaînage de
    // reprise généralisé à l’Aérien (migration backend 0050).
    getAllAsync.mockResolvedValueOnce([]);

    await listValidatedProspections();

    const [query] = getAllAsync.mock.calls[0];
    expect(query).toContain('JOIN traitement_terrestre tt ON tt.traitement_id = t.id');
    expect(query).toContain('tt.surface_restante_ha IS NOT NULL AND tt.surface_restante_ha <= 0');
    expect(query).toContain('JOIN traitement_aerien ta ON ta.traitement_id = t.id');
    expect(query).toContain('ta.surface_restante_ha IS NOT NULL AND ta.surface_restante_ha <= 0');
  });
});

describe('listProspectionsDisponiblesPourTraitementLocal', () => {
  it('renvoie les fiches validées, tous types confondus, surface infestée connue ou non', async () => {
    const row = { ...STORED_ROW, type_prospection: 'intensive', statut: 'validee', surface_infestee: 3.2 };
    getAllAsync.mockResolvedValueOnce([row]);

    const result = await listProspectionsDisponiblesPourTraitementLocal();

    expect(result).toEqual([row]);
    const [query] = getAllAsync.mock.calls[0];
    // La liste elle-même n'est pas restreinte par type (contrairement à
    // listValidatedProspections) — seule l'exclusion des fiches périmées
    // (#revalidation-prospection, ci-dessous) cible extensive/validation.
    // #surface-infestee-facultative : plus de filtre sur `surface_infestee`
    // (autrefois obligatoire pour extensive/validation, jamais renseigné pour
    // certaines fiches légitimes depuis que le champ est facultatif partout).
    // #liste-traitement-apres-validation : statut='validee', pas seulement
    // synchronisée — même filtre que le chemin en ligne.
    expect(query).toContain("p.statut = 'validee'");
    expect(query).not.toContain('surface_infestee IS NOT NULL');
    expect(query).toContain('ORDER BY p.updated_at DESC');
  });

  it('exclut toute fiche déjà rattachée à un traitement (même règle que le serveur, disponible_pour_traitement)', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listProspectionsDisponiblesPourTraitementLocal();

    const [query] = getAllAsync.mock.calls[0];
    expect(query).toContain('NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)');
  });

  it("#liste-traitement-apres-validation : n'inclut jamais une fiche seulement envoyée (en_attente), pas encore validée par un administrateur", async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listProspectionsDisponiblesPourTraitementLocal();

    const [query] = getAllAsync.mock.calls[0];
    expect(query).not.toContain('statut_sync');
    expect(query).toContain("p.statut = 'validee'");
  });

  it('#revalidation-prospection : exclut aussi les fiches extensive/validation périmées et celles déjà revalidées', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listProspectionsDisponiblesPourTraitementLocal();

    const [query] = getAllAsync.mock.calls[0];
    expect(query).toContain("type_prospection IN ('extensive', 'validation')");
    expect(query).toContain('julianday');
    expect(query).toContain('enfant.revalide_de_id = p.id');
    // #revalidation-cree-apres-confirmation : un brouillon de revalidation
    // seulement amorcé (jamais confirmé/enregistré) ne doit pas exclure
    // l'origine — seule une revalidation réellement créée (statut != brouillon).
    expect(query).toContain("enfant.statut != 'brouillon'");
  });
});

describe('listProspectionsARevaliderLocal', () => {
  it("renvoie les fiches extensive/validation périmées, ordonnées par ancienneté de validation", async () => {
    const row = { ...STORED_ROW, type_prospection: 'extensive', validated_at: '2026-08-01T00:00:00Z' };
    getAllAsync.mockResolvedValueOnce([row]);

    const result = await listProspectionsARevaliderLocal();

    expect(result).toEqual([row]);
    const [query] = getAllAsync.mock.calls[0];
    expect(query).toContain("type_prospection IN ('extensive', 'validation')");
    expect(query).toContain('validated_at IS NOT NULL');
    expect(query).toContain('julianday');
    expect(query).toContain('ORDER BY p.validated_at ASC');
  });

  it('exclut les fiches déjà traitées et celles déjà revalidées', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listProspectionsARevaliderLocal();

    const [query] = getAllAsync.mock.calls[0];
    expect(query).toContain('NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)');
    expect(query).toContain('enfant.revalide_de_id = p.id');
    // #revalidation-cree-apres-confirmation : idem, cf. le test équivalent de
    // listProspectionsDisponiblesPourTraitementLocal ci-dessus.
    expect(query).toContain("enfant.statut != 'brouillon'");
  });
});

describe('synchroniserStatutServeur', () => {
  it('#liste-traitement-apres-validation : reporte le statut et validated_at authentiques du serveur', async () => {
    await synchroniserStatutServeur([
      { id: 'presp-1', statut: 'validee', validated_at: '2026-09-01T00:00:00Z' },
      { id: 'presp-2', statut: 'rejetee', validated_at: null },
    ]);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET statut = ?, validated_at = ?'),
      ['validee', '2026-09-01T00:00:00Z', 'presp-1']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET statut = ?, validated_at = ?'),
      ['rejetee', null, 'presp-2']
    );
  });

  it("ne touche jamais updated_at (ne doit pas faire remonter la fiche dans les listes triées dessus)", async () => {
    await synchroniserStatutServeur([{ id: 'presp-1', statut: 'validee', validated_at: null }]);

    const [query] = runAsync.mock.calls[0];
    expect(query).not.toContain('updated_at');
  });
});

describe('demarrerRevalidation', () => {
  const FICHE_PERIMEE = {
    ...STORED_ROW,
    id: 'presp-perimee',
    type_prospection: 'extensive',
    region: 'Atsimo-Andrefana',
    n_fiche: 'F-001',
    validated_at: '2026-08-01T00:00:00.000Z',
    revalide_de_id: null,
  };

  it('lève une erreur explicite si la fiche source n’est pas locale', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(demarrerRevalidation('inconnue')).rejects.toThrow(/introuvable localement/);
  });

  it('clone la fiche dans un nouveau brouillon chaîné via revalide_de_id, avec statut/dates réinitialisés', async () => {
    getFirstAsync.mockResolvedValueOnce(FICHE_PERIMEE);
    getAllAsync.mockResolvedValue([]);

    const { draftId } = await demarrerRevalidation('presp-perimee');

    expect(draftId).not.toBe('presp-perimee');
    const insertCall = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO prospection'));
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall!;
    // 'brouillon'/'local' sont des littéraux dans le SQL, pas des paramètres liés.
    expect(sql).toContain("VALUES (?, 'brouillon', 'local'");
    expect(sql).toContain('revalide_de_id');
    expect(params).toEqual(
      expect.arrayContaining([draftId, 'presp-perimee', 'Atsimo-Andrefana', 'F-001'])
    );
  });

  it('ne clone jamais le revalide_de_id/statut/statut_sync de la source elle-même', async () => {
    getFirstAsync.mockResolvedValueOnce({
      ...FICHE_PERIMEE,
      revalide_de_id: 'presp-grand-parent',
      statut: 'validee',
      statut_sync: 'synced',
    });
    getAllAsync.mockResolvedValue([]);

    await demarrerRevalidation('presp-perimee');

    const [, params] = runAsync.mock.calls.find(([sql]) => sql.includes('INSERT INTO prospection'))!;
    // Le seul revalide_de_id transmis est la source elle-même — jamais le
    // parent DE la source (pas de télescopage de la chaîne).
    expect(params).not.toContain('presp-grand-parent');
    expect(params).not.toContain('validee');
    expect(params).not.toContain('synced');
  });

  it('ne clone jamais validated_at de la source — sinon le brouillon en cours reparaîtrait dans « à revalider » avant même d’être terminé', async () => {
    getFirstAsync.mockResolvedValueOnce(FICHE_PERIMEE);
    getAllAsync.mockResolvedValue([]);

    await demarrerRevalidation('presp-perimee');

    const [sql, params] = runAsync.mock.calls.find(([s]) => s.includes('INSERT INTO prospection'))!;
    expect(sql).not.toContain('validated_at');
    expect(params).not.toContain(FICHE_PERIMEE.validated_at);
  });

  it("#revalidation-nouvelle-date : pose la date du jour, jamais celle de la fiche périmée — le numéro (n_fiche), lui, reste identique", async () => {
    getFirstAsync.mockResolvedValueOnce(FICHE_PERIMEE);
    getAllAsync.mockResolvedValue([]);

    await demarrerRevalidation('presp-perimee');

    const [sql, params] = runAsync.mock.calls.find(([s]) => s.includes('INSERT INTO prospection'))!;
    expect(sql).toContain('date_prospection');
    expect(params).not.toContain(FICHE_PERIMEE.date_prospection);
    const aujourdHui = new Date().toISOString().slice(0, 10);
    expect(params).toContain(aujourdHui);
    // Le numéro, lui, est bien conservé à l'identique (comportement inchangé).
    expect(params).toContain('F-001');
  });

  it('clone populations, infestations, captures et opérations aériennes vers le nouveau brouillon', async () => {
    getFirstAsync.mockResolvedValueOnce(FICHE_PERIMEE);
    getAllAsync
      .mockResolvedValueOnce([{ espece: 'LMC', categorie: 'imago' }]) // populations
      .mockResolvedValueOnce([{ type_cible: 'dense' }]) // infestations
      .mockResolvedValueOnce([
        { espece: 'LMC', categorie: 'imago', sexe: null, phase: 'gregaire', stade: 'L1', effectif: 3 },
      ]) // captures
      .mockResolvedValueOnce([]); // opérations aériennes

    const { draftId } = await demarrerRevalidation('presp-perimee');

    const appelsAvecDraftId = runAsync.mock.calls.filter(
      ([, params]) => Array.isArray(params) && params.includes(draftId)
    );
    // Au moins la ligne prospection elle-même + la capture clonée.
    expect(appelsAvecDraftId.length).toBeGreaterThanOrEqual(2);
    const requetesLecture = getAllAsync.mock.calls.map(([sql]) => sql);
    expect(requetesLecture.some((sql) => sql.includes('prospection_population'))).toBe(true);
    expect(requetesLecture.some((sql) => sql.includes('prospection_infestation'))).toBe(true);
    expect(requetesLecture.some((sql) => sql.includes('prospection_capture'))).toBe(true);
    expect(requetesLecture.some((sql) => sql.includes('prospection_operation_aerienne'))).toBe(true);
  });
});

describe('updateProspectionReference', () => {
  const REFERENCE_INPUT = {
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1280,
    surfaceStation: 10,
    surfaceProspectee: 8,
    surfaceInfestee: 2,
    nFiche: 'FI-20260711-111111',
  };

  it('updates position, surfaces and n° fiche on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...REFERENCE_INPUT });

    await updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      expect.arrayContaining([
        REFERENCE_INPUT.latitude,
        REFERENCE_INPUT.longitude,
        REFERENCE_INPUT.altitude,
        REFERENCE_INPUT.surfaceStation,
        REFERENCE_INPUT.surfaceProspectee,
        REFERENCE_INPUT.surfaceInfestee,
        REFERENCE_INPUT.nFiche,
      ])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, ...REFERENCE_INPUT };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionReference(BASE_INPUT.id, REFERENCE_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });

});

describe('updateProspectionEspeces', () => {
  const ESPECES_JSON = JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true });

  it('updates the especes column on the draft row', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, especes: ESPECES_JSON });

    await updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET especes'),
      expect.arrayContaining([ESPECES_JSON, BASE_INPUT.id])
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, especes: ESPECES_JSON };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionEspeces(BASE_INPUT.id, ESPECES_JSON)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionVegetation', () => {
  const VEGETATION_INPUT = {
    vegetation: JSON.stringify({ recouvrement_herbeux: 40 }),
    sol: JSON.stringify({ humidite: 'surface', texture: 'limoneuse' }),
  };

  it('updates vegetation/sol columns on the draft row, without touching degats_cultures/ennemis/observations (owned by Observations screen)', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...VEGETATION_INPUT });

    await updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      expect.arrayContaining([VEGETATION_INPUT.vegetation, VEGETATION_INPUT.sol, BASE_INPUT.id])
    );
    const sql = runAsync.mock.calls[0][0] as string;
    expect(sql).not.toContain('degats_cultures =');
    expect(sql).not.toContain('ennemis_naturels');
    expect(sql).not.toContain('observations =');
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, ...VEGETATION_INPUT };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionVegetation(BASE_INPUT.id, VEGETATION_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionObservations', () => {
  const OBSERVATIONS_INPUT = {
    degatsCultures: 'moyens',
    ennemisNaturels: 'Oiseaux, Mantes',
    observations: 'RAS',
    heureObservationAt: null as string | null,
  };

  it('updates degats_cultures/ennemis_naturels/observations/derniere_pluie/intensite_pluie/heure_observation_at columns', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...OBSERVATIONS_INPUT });

    await updateProspectionObservations(BASE_INPUT.id, OBSERVATIONS_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        OBSERVATIONS_INPUT.degatsCultures,
        OBSERVATIONS_INPUT.ennemisNaturels,
        OBSERVATIONS_INPUT.observations,
        null,
        null,
        OBSERVATIONS_INPUT.heureObservationAt,
        null, // signatureVisaNom
        null, // signatureVisaHorodatage
        null, // signatureVisaImage
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('passes derniere_pluie/intensite_pluie/heure_observation_at through when provided', async () => {
    const input = {
      ...OBSERVATIONS_INPUT,
      dernierePluie: '2026-08-01',
      intensitePluie: 'forte',
      heureObservationAt: '2026-08-25T14:35:00.000Z',
    };
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...input });

    await updateProspectionObservations(BASE_INPUT.id, input);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        input.degatsCultures,
        input.ennemisNaturels,
        input.observations,
        input.dernierePluie,
        input.intensitePluie,
        input.heureObservationAt,
        null, // signatureVisaNom
        null, // signatureVisaHorodatage
        null, // signatureVisaImage
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('passe le triplet de la signature auto (nom/horodatage/tracé) quand fourni (écran Observations, remplace Photo)', async () => {
    const input = {
      ...OBSERVATIONS_INPUT,
      signatureVisaNom: 'Jean Rakoto',
      signatureVisaHorodatage: '2026-09-22T08:00:00.000Z',
      signatureVisaImage: 'M0 0 L1 1',
    };
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...input });

    await updateProspectionObservations(BASE_INPUT.id, input);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        input.degatsCultures,
        input.ennemisNaturels,
        input.observations,
        null,
        null,
        input.heureObservationAt,
        'Jean Rakoto',
        '2026-09-22T08:00:00.000Z',
        'M0 0 L1 1',
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('returns the updated row read back from local storage', async () => {
    const updated = { ...STORED_ROW, ...OBSERVATIONS_INPUT };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await updateProspectionObservations(BASE_INPUT.id, OBSERVATIONS_INPUT);

    expect(result).toEqual(updated);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionObservations(BASE_INPUT.id, OBSERVATIONS_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionExtensiveReference', () => {
  const REF_INPUT = {
    latitude: 18.8792,
    longitude: 47.5079,
    stationLibre: 'Ambohimanga',
    typeStation: 'riziere_bordure',
    surfaceStation: 2.1,
    surfaceInfestee: 0.5,
    nMessage: '2026-0301',
    heureObservationAt: '2026-08-26T09:15:00.000Z',
  };

  it('writes station_libre/type_station/surface_station/surface_infestee/n_message/heure_observation_at, not station_id lookup fields', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW });

    await updateProspectionExtensiveReference(BASE_INPUT.id, REF_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        REF_INPUT.latitude,
        REF_INPUT.longitude,
        REF_INPUT.stationLibre,
        REF_INPUT.typeStation,
        REF_INPUT.surfaceStation,
        REF_INPUT.surfaceInfestee,
        REF_INPUT.nMessage,
        REF_INPUT.heureObservationAt,
        // Mode aérien uniquement — non fournis par REF_INPUT (mode terrestre implicite
        // dans ce test), donc null : cf. les champs équipe/aéronef/base (+ numéro,
        // date d'installation, GPS de la base principale et de la base secondaire)
        // ajoutés à ExtensiveReferenceUpdateInput.
        null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(updateProspectionExtensiveReference(BASE_INPUT.id, REF_INPUT)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

// #numero-fiche-extensive-egal-n-message
describe('alignerNumeroFicheSurNumeroMessage', () => {
  it('copies n_message into n_fiche, only for rows where n_message is set', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, n_message: '20260711-1111', n_fiche: '20260711-1111' });

    await alignerNumeroFicheSurNumeroMessage(BASE_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET n_fiche = n_message'),
      [expect.any(String), BASE_INPUT.id]
    );
    // La clause WHERE protège les fiches sans n_message (n_fiche resterait inchangé,
    // pas écrasé par NULL) — vérifié ici sur le texte de la requête plutôt que sur son
    // exécution : `runAsync` est un mock, seul SQLite ferait réellement respecter le filtre.
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('n_message IS NOT NULL'),
      expect.any(Array)
    );
  });

  it('returns the updated row (n_fiche now equal to n_message) read back from local storage', async () => {
    const updated = { ...STORED_ROW, n_message: '20260711-1111', n_fiche: '20260711-1111' };
    getFirstAsync.mockResolvedValueOnce(updated);

    const result = await alignerNumeroFicheSurNumeroMessage(BASE_INPUT.id);

    expect(result.n_fiche).toBe('20260711-1111');
    expect(result.n_fiche).toBe(result.n_message);
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(alignerNumeroFicheSurNumeroMessage(BASE_INPUT.id)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('updateProspectionExtensiveObservations', () => {
  const OBS_INPUT = {
    degatsCultures: 'moyens',
    verdissementPourcent: 65,
    hauteurHerbeCm: 32,
    dernierePluie: '22/06',
    intensitePluie: 'faible',
  };

  it('writes degats/verdissement/hauteur/pluie columns', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW });

    await updateProspectionExtensiveObservations(BASE_INPUT.id, OBS_INPUT);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        OBS_INPUT.degatsCultures,
        OBS_INPUT.verdissementPourcent,
        OBS_INPUT.hauteurHerbeCm,
        OBS_INPUT.dernierePluie,
        OBS_INPUT.intensitePluie,
        null, // signatureVisaNom
        null, // signatureVisaHorodatage
        null, // signatureVisaImage
        null, // signatureConsultantFaoNom
        null, // signatureConsultantFaoHorodatage
        null, // signatureConsultantFaoImage
        null, // signaturePiloteNom
        null, // signaturePiloteHorodatage
        null, // signaturePiloteImage
        null, // signatureChefBaseNom
        null, // signatureChefBaseHorodatage
        null, // signatureChefBaseImage
        null, // observations (Remarques)
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('writes signatures columns (mode aérien) — aucun pesticide embarqué côté prospection', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW });

    await updateProspectionExtensiveObservations(BASE_INPUT.id, {
      ...OBS_INPUT,
      signatureVisaNom: 'Rakoto V.',
      signatureVisaHorodatage: '2026-09-01T09:00:00.000Z',
      signatureVisaImage: 'M-1 -1 L9 9',
      signatureConsultantFaoNom: 'John Smith',
      signatureConsultantFaoHorodatage: '2026-09-01T09:05:00.000Z',
      signatureConsultantFaoImage: 'M0 0 L1 1',
      signaturePiloteNom: 'Jean Rakoto',
      signaturePiloteHorodatage: '2026-09-01T09:10:00.000Z',
      signaturePiloteImage: 'M2 2 L3 3',
      signatureChefBaseNom: 'Sarah Ravelo',
      signatureChefBaseHorodatage: '2026-09-01T09:15:00.000Z',
      signatureChefBaseImage: 'M4 4 L5 5',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        OBS_INPUT.degatsCultures,
        OBS_INPUT.verdissementPourcent,
        OBS_INPUT.hauteurHerbeCm,
        OBS_INPUT.dernierePluie,
        OBS_INPUT.intensitePluie,
        'Rakoto V.',
        '2026-09-01T09:00:00.000Z',
        'M-1 -1 L9 9',
        'John Smith',
        '2026-09-01T09:05:00.000Z',
        'M0 0 L1 1',
        'Jean Rakoto',
        '2026-09-01T09:10:00.000Z',
        'M2 2 L3 3',
        'Sarah Ravelo',
        '2026-09-01T09:15:00.000Z',
        'M4 4 L5 5',
        null, // observations (Remarques)
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });
});

describe('concludeValidation', () => {
  it('writes conclusion_validation without touching statut', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, conclusion_validation: 'confirmee' });

    await concludeValidation(BASE_INPUT.id, 'confirmee');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET conclusion_validation'),
      ['confirmee', expect.any(String), BASE_INPUT.id]
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(concludeValidation(BASE_INPUT.id, 'infirmee')).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('completeProspection', () => {
  it('bascule une fiche de validation/signalement directement en validee, n_fiche aligné sur n_message', async () => {
    const ligne = {
      ...STORED_ROW,
      type_prospection: 'validation',
      statut: 'validee',
      n_fiche: '20260711-ABCD',
    };
    // #numeros-fiche-uniques : `completeProspection` relit désormais la fiche
    // avant de la clôturer (contrôle anti-doublon) puis une seconde fois après
    // — deux appels à `getFirstAsync`, tous deux servis par la même ligne ici
    // (le contrôle anti-doublon lui-même ne consomme aucun appel supplémentaire
    // pour cette fiche : `n_message` est absent du fixture, donc rien à vérifier).
    getFirstAsync.mockResolvedValueOnce(ligne).mockResolvedValueOnce(ligne);

    await completeProspection(BASE_INPUT.id);

    // La bascule se joue en SQL (CASE WHEN type_prospection = 'validation'),
    // pas en JS : un signalement saute la chaîne administrative en_attente ->
    // verifiee -> validee réservée à l'intensif/extensif, et reprend comme n°
    // de fiche définitif le n° de message déjà généré à la Référence — jamais
    // un second numéro. Le mock ne rejoue pas le CASE lui-même, cette
    // assertion garde seulement une trace de non-régression sur sa présence.
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "CASE WHEN type_prospection = 'validation' AND revalide_de_id IS NULL THEN 'validee' ELSE 'en_attente' END"
      ),
      [expect.any(String), BASE_INPUT.id]
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "CASE WHEN type_prospection = 'validation' AND n_message IS NOT NULL THEN n_message ELSE n_fiche END"
      ),
      [expect.any(String), BASE_INPUT.id]
    );
  });

  /**
   * #revalidation-verification-standard : revirement du comportement
   * historique — une revalidation (`revalide_de_id` non nul), y compris pour
   * une fiche de type Validation, suit désormais la même chaîne en_attente ->
   * vérifiée -> validée qu'une fiche neuve, plutôt que d'être validée
   * immédiatement. Le SQL lui-même porte ce comportement (`AND revalide_de_id
   * IS NULL`, cf. test ci-dessus) — ce test-ci documente juste le résultat.
   */
  it('#revalidation-verification-standard : une revalidation reste en_attente, même de type Validation', async () => {
    const ligne = {
      ...STORED_ROW,
      type_prospection: 'validation',
      statut: 'en_attente',
      n_fiche: null,
      n_message: 'MSG-010',
      revalide_de_id: 'fiche-perimee-id',
    };
    getFirstAsync
      .mockResolvedValueOnce(ligne) // lecture initiale (current)
      .mockResolvedValueOnce(null) // contrôle anti-doublon : aucun
      .mockResolvedValueOnce(ligne); // lecture finale (updated)

    const resultat = await completeProspection(BASE_INPUT.id);

    expect(resultat.statut).toBe('en_attente');
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "CASE WHEN type_prospection = 'validation' AND revalide_de_id IS NULL THEN 'validee' ELSE 'en_attente' END"
      ),
      [expect.any(String), BASE_INPUT.id]
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(completeProspection(BASE_INPUT.id)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });

  describe('#numeros-fiche-uniques : refus de clôturer un doublon', () => {
    it('refuse de clôturer si une autre fiche locale porte déjà ce n_fiche (Intensif/Extensif)', async () => {
      const ligne = { ...STORED_ROW, n_fiche: '20260711-ABCD', revalide_de_id: null };
      getFirstAsync
        .mockResolvedValueOnce(ligne) // lecture initiale (current)
        .mockResolvedValueOnce({ id: 'autre-fiche-id' }); // contrôle anti-doublon : trouvé

      await expect(completeProspection(BASE_INPUT.id)).rejects.toThrow(
        'Le numéro « 20260711-ABCD » est déjà utilisé par une autre fiche'
      );
      expect(runAsync).not.toHaveBeenCalled();
    });

    it('vérifie n_message (pas n_fiche, pas encore posé) pour une fiche de Validation/Signalement', async () => {
      const ligne = { ...STORED_ROW, type_prospection: 'validation', n_fiche: null, n_message: 'MSG-001', revalide_de_id: null };
      getFirstAsync
        .mockResolvedValueOnce(ligne)
        .mockResolvedValueOnce({ id: 'autre-fiche-id' });

      await expect(completeProspection(BASE_INPUT.id)).rejects.toThrow(
        'Le numéro « MSG-001 » est déjà utilisé par une autre fiche'
      );
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id != ? AND n_fiche = ?'),
        [BASE_INPUT.id, 'MSG-001']
      );
      expect(runAsync).not.toHaveBeenCalled();
    });

    it('#revalidation-prospection : ne bloque jamais quand le seul « doublon » trouvé est la fiche périmée que celle-ci revalide', async () => {
      const ligne = {
        ...STORED_ROW,
        n_fiche: '20260711-ABCD',
        revalide_de_id: 'fiche-perimee-id',
      };
      getFirstAsync
        .mockResolvedValueOnce(ligne) // lecture initiale (current)
        .mockResolvedValueOnce({ id: 'fiche-perimee-id' }) // contrôle anti-doublon : la source elle-même
        .mockResolvedValueOnce(ligne); // lecture finale (updated)

      await expect(completeProspection(BASE_INPUT.id)).resolves.toBeTruthy();
      expect(runAsync).toHaveBeenCalled();
    });

    it("n'appelle aucun contrôle quand la fiche n'a encore aucun numéro (rien à vérifier)", async () => {
      const ligne = { ...STORED_ROW, n_fiche: null, n_message: null };
      getFirstAsync.mockResolvedValueOnce(ligne).mockResolvedValueOnce(ligne);

      await expect(completeProspection(BASE_INPUT.id)).resolves.toBeTruthy();
      expect(getFirstAsync).toHaveBeenCalledTimes(2);
      expect(runAsync).toHaveBeenCalled();
    });
  });
});

describe('startCaptureTimer', () => {
  it('sets capture_started_at only when not already running', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, capture_started_at: '2026-07-11T10:00:00.000Z' });

    await startCaptureTimer(BASE_INPUT.id);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('capture_started_at IS NULL'),
      expect.arrayContaining([BASE_INPUT.id])
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(startCaptureTimer(BASE_INPUT.id)).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('markGrilleCompleted', () => {
  it('stores the first completed grille as a single-element JSON array', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: null });
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });

    await markGrilleCompleted(BASE_INPUT.id, 'LMC|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET grilles_completees'),
      [JSON.stringify(['LMC|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('is idempotent and accumulates distinct grilles', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });
    getFirstAsync.mockResolvedValueOnce({
      ...STORED_ROW,
      grilles_completees: JSON.stringify(['LMC|imago', 'NSE|imago']),
    });

    await markGrilleCompleted(BASE_INPUT.id, 'NSE|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET grilles_completees'),
      [JSON.stringify(['LMC|imago', 'NSE|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('re-marking the same grille does not duplicate it', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: JSON.stringify(['LMC|imago']) });

    await markGrilleCompleted(BASE_INPUT.id, 'LMC|imago');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET grilles_completees'),
      [JSON.stringify(['LMC|imago']), expect.any(String), BASE_INPUT.id]
    );
  });

  it('throws if the row cannot be read back after the update', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, grilles_completees: null });
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(markGrilleCompleted(BASE_INPUT.id, 'LMC|imago')).rejects.toThrow(
      'Échec de la mise à jour de la fiche brouillon locale'
    );
  });
});

describe('saveProspectionCaptures', () => {
  const ROWS = [{ espece: 'LMC' as const, categorie: 'imago' as const, sexe: 'F' as const, phase: 'solitaire', stade: 'A1', effectif: 2 }];

  it('deletes existing rows for the grille then inserts the new ones', async () => {
    await saveProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago', ROWS);

    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM prospection_capture'),
      [BASE_INPUT.id, 'LMC', 'imago']
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO prospection_capture'),
      expect.arrayContaining([BASE_INPUT.id, 'LMC', 'imago', 'F', 'solitaire', 'A1', 2])
    );
  });

  it('only deletes when there are no rows to persist', async () => {
    await saveProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago', []);

    expect(runAsync).toHaveBeenCalledTimes(1);
  });
});

describe('listProspectionCaptures', () => {
  it('lists rows for a given grille', async () => {
    const rows = [{ espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A1', effectif: 2 }];
    getAllAsync.mockResolvedValueOnce(rows);

    const result = await listProspectionCaptures(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toEqual(rows);
    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'LMC', 'imago']);
  });
});

describe('getProspectionPopulation', () => {
  it('returns null when no row matches', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const result = await getProspectionPopulation(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toBeNull();
    expect(getFirstAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'LMC', 'imago']);
  });

  /**
   * #nombre-de-capture-fiable — régression réelle : POPULATION_COLUMNS omettait
   * `captures_nombre` (et `temps_capture`) du SELECT, alors que ces deux colonnes sont
   * bien écrites par `saveProspectionPopulation`. Résultat en usage réel (non détecté
   * par les tests d'écran, qui mockent `getProspectionPopulation` sans jamais exécuter
   * cette requête) : la valeur de « Nombre total de captures » était TOUJOURS
   * `undefined` à la lecture, quelle que soit la valeur réellement enregistrée en base
   * — donc affichée comme 0 partout (réouverture Imagos/Larves, récapitulatif, fiche
   * de lecture). Ce test verrouille la présence de ces deux colonnes dans le SELECT.
   */
  it('sélectionne bien captures_nombre et temps_capture', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await getProspectionPopulation(BASE_INPUT.id, 'LMC', 'imago');

    const [sql] = getFirstAsync.mock.calls[0];
    expect(sql).toContain('captures_nombre');
    expect(sql).toContain('temps_capture');
    // #stades-imago-persistance : même régression, même verrou.
    expect(sql).toContain('stades_imago');
  });

  it('returns the matching row', async () => {
    const row = {
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 10,
      densite_groupee: 2,
      methode: 'battage',
      accouplement: 'rare',
      ponte: 'beaucoup',
    };
    getFirstAsync.mockResolvedValueOnce(row);

    const result = await getProspectionPopulation(BASE_INPUT.id, 'LMC', 'imago');

    expect(result).toEqual({
      ...row,
      essaim_observe: null,
      tache_larvaire: null,
      bande_larvaire: null,
      essaim_en_vol: null,
      essaim_pose: null,
    });
  });
});

describe('saveProspectionPopulation', () => {
  const ROW = {
    espece: 'LMC' as const,
    categorie: 'imago' as const,
    densite_diffuse: 10,
    densite_groupee: 2,
    methode: 'battage',
    accouplement: 'rare',
    ponte: 'beaucoup',
    // Colonnes extensives ajoutées
    captures_sol: null,
    captures_trans: null,
    captures_greg: null,
    captures_solitaro_transiens: null,
    stade_imago: null,
    stades_imago: null,
    essaim_observe: null,
    densites_larve: null,
    tache_larvaire: null,
    bande_larvaire: null,
    interdistance: null,
    deplacement: null,
    surface_contaminee_ha: null,
    type_cible: null,
    direction_de: null,
    direction_vers: null,
    etat: null,
    essaim_en_vol: null,
    essaim_pose: null,
  };

  it('inserts a new row when none exists for the espece/categorie', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    await saveProspectionPopulation(BASE_INPUT.id, ROW);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO prospection_population'),
      expect.arrayContaining([BASE_INPUT.id, 'LMC', 'imago', 10, 2, 'battage', 'rare', 'beaucoup'])
    );
  });

  it('updates the existing row when one already exists', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });

    await saveProspectionPopulation(BASE_INPUT.id, ROW);

    // 28 paramètres : 27 champs SET + 1 WHERE id
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection_population SET'),
      [
        null, null, null, // phase, captures_nombre, temps_capture
        10, 2,             // densite_diffuse, densite_groupee
        'battage', 'rare', 'beaucoup', // methode, accouplement, ponte
        null, null, null, null, // captures_sol, captures_trans, captures_greg, captures_solitaro_transiens
        null, null, null,  // stade_imago, stades_imago, essaim_observe
        null, null, null,  // densites_larve, tache_larvaire, bande_larvaire
        null, null,        // interdistance, deplacement
        null,              // surface_contaminee_ha
        null, null, null,  // type_cible, direction_de, direction_vers
        null, null, null,  // etat, essaim_en_vol, essaim_pose
        'existing-id'      // WHERE id
      ]
    );
  });
});

describe('listAllProspectionPopulations', () => {
  it('lists every espece/categorie row for the prospection', async () => {
    const rows = [{ espece: 'LMC', categorie: 'imago' }, { espece: 'NSE', categorie: 'larve' }];
    getAllAsync.mockResolvedValueOnce(rows);

    const result = await listAllProspectionPopulations(BASE_INPUT.id);

    expect(result).toEqual(
      rows.map((row) => ({
        ...row,
        essaim_observe: null,
        tache_larvaire: null,
        bande_larvaire: null,
        essaim_en_vol: null,
        essaim_pose: null,
      }))
    );
    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id]);
  });

  /** #nombre-de-capture-fiable — même régression que getProspectionPopulation
   * ci-dessus, pour le SELECT utilisé par le récapitulatif de saisie et la fiche
   * de lecture (extensive-recap.tsx, prospection-fiche-lecture.ts). */
  it('sélectionne bien captures_nombre et temps_capture', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listAllProspectionPopulations(BASE_INPUT.id);

    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain('captures_nombre');
    expect(sql).toContain('temps_capture');
    // #stades-imago-persistance : même régression, même verrou.
    expect(sql).toContain('stades_imago');
  });
});

describe('getProspectionInfestation', () => {
  it('returns null when no row matches the type_cible', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const result = await getProspectionInfestation(BASE_INPUT.id, 'essaim');

    expect(result).toBeNull();
    expect(getFirstAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'essaim']);
  });

  it('returns the matching row for that type_cible', async () => {
    const row = {
      espece: null,
      type_cible: 'essaim',
      taille_min: 1,
      taille_max: 2,
      taille_moy: 1.5,
      surface_totale: 5,
      densite_min: 1,
      densite_max: 3,
      densite_moy: 2,
      interdistance: 1,
      comportement: 'repos',
      direction_vers: 'N',
      vent_de: 'S',
      vent_vitesse: 10,
    };
    getFirstAsync.mockResolvedValueOnce(row);

    const result = await getProspectionInfestation(BASE_INPUT.id, 'essaim');

    expect(result).toEqual(row);
  });
});

describe('listAllProspectionInfestations', () => {
  it('lists every formation row for the prospection', async () => {
    const rows = [{ type_cible: 'essaim' }, { type_cible: 'vol_clair' }];
    getAllAsync.mockResolvedValueOnce(rows);

    const result = await listAllProspectionInfestations(BASE_INPUT.id);

    expect(result).toEqual(rows);
    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id]);
  });
});

describe('saveProspectionInfestation', () => {
  const ROW = {
    espece: null,
    type_cible: 'essaim',
    taille_min: 1,
    taille_max: 2,
    taille_moy: 1.5,
    surface_totale: 5,
    densite_min: 1,
    densite_max: 3,
    densite_moy: 2,
    interdistance: 1,
    comportement: 'repos',
    direction_de: null,
    direction_vers: 'N',
    vent_de: 'S',
    vent_vitesse: 10,
    pullulation_nb: null,
    taille_long: null,
    taille_large: null,
    taille_epaisseur: null,
    essaim_en_vol: null,
    essaim_pose: null,
    type_essaim: null,
    nb_taches_bandes: null,
    interdistance_m: null,
    interdistance_min: null,
    interdistance_max: null,
    interdistance_moy: null,
    surface_contaminee_ha: null,
    type_larve: null,
    surface_infestee_pourcent: null,
    stade_dominant: null,
    taille_groupe_m2: null,
    front_longueur_m: null,
    front_largeur_m: null,
    densite_max_front: null,
    densite_moy_arriere_front: null,
    heure_observation: null,
    densite_en_vol: null,
    dimension_ha: null,
  };

  it('inserts a new row when none exists for this prospection + type_cible', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    await saveProspectionInfestation(BASE_INPUT.id, 'essaim', ROW);

    expect(getFirstAsync).toHaveBeenCalledWith(expect.any(String), [BASE_INPUT.id, 'essaim']);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO prospection_infestation'),
      expect.arrayContaining([BASE_INPUT.id, null, 'essaim', 1, 2, 1.5, 5, 1, 3, 2, 1, 'repos', 'N', 'S', 10])
    );
  });

  it('updates the existing row for the same type_cible, leaving other formations untouched', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });

    await saveProspectionInfestation(BASE_INPUT.id, 'essaim', ROW);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection_infestation SET'),
      [
        null, 'essaim', 1, 2, 1.5, 5, 1, 3, 2, 1, 'repos',
        null, 'N', 'S', 10,
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null,
        null,
        null,
        null,
        'existing-id',
      ]
    );
  });
});

describe('deleteProspectionInfestation', () => {
  it('removes only the row for this prospection + type_cible, leaving other formations untouched', async () => {
    await deleteProspectionInfestation(BASE_INPUT.id, 'vol_clair');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM prospection_infestation'),
      [BASE_INPUT.id, 'vol_clair']
    );
  });
});

describe('countUnsyncedProspections', () => {
  it('counts rows whose statut_sync is not synced', async () => {
    getFirstAsync.mockResolvedValueOnce({ count: 3 });

    const result = await countUnsyncedProspections();

    expect(result).toBe(3);
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut_sync != 'synced'")
    );
  });

  /**
   * #dossier-brouillons : un brouillon n'est par construction jamais envoyé
   * (`listUnsyncedProspections` ne sélectionne que `statut = 'en_attente'`) —
   * le compter ici gonflerait à tort le badge « non synchronisé » de
   * l'accueil d'un nombre de fiches qui ne partiront jamais tant qu'elles ne
   * sont pas terminées.
   */
  it('exclut les fiches encore en brouillon de la requête', async () => {
    getFirstAsync.mockResolvedValueOnce({ count: 0 });

    await countUnsyncedProspections();

    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("statut != 'brouillon'")
    );
  });

  it('returns 0 when the query yields no row', async () => {
    getFirstAsync.mockResolvedValueOnce(undefined);

    const result = await countUnsyncedProspections();

    expect(result).toBe(0);
  });
});

describe('deleteProspection', () => {
  it('deletes the row and returns true when a row was removed', async () => {
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 });

    const result = await deleteProspection(BASE_INPUT.id);

    expect(result).toBe(true);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM prospection'),
      [BASE_INPUT.id]
    );
  });

  it('returns false when no row matched the id', async () => {
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 });

    const result = await deleteProspection('missing-id');

    expect(result).toBe(false);
  });
});