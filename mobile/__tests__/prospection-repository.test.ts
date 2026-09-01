import {
  createDraftProspection,
  getProspection,
  listDraftProspections,
  listRecentProspections,
  listValidatedProspections,
  countUnsyncedProspections,
  updateProspectionReference,
  updateProspectionEspeces,
  updateProspectionVegetation,
  updateProspectionObservations,
  updateProspectionExtensiveReference,
  updateProspectionExtensiveObservations,
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

describe('listRecentProspections', () => {
  it('lists all statuses ordered by most recently updated, capped at the given limit', async () => {
    getAllAsync.mockResolvedValueOnce([STORED_ROW]);

    const result = await listRecentProspections(5);

    expect(result).toEqual([STORED_ROW]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY updated_at DESC'),
      [5]
    );
  });

  it('defaults the limit to 20', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await listRecentProspections();

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [20]);
  });
});

describe('listValidatedProspections', () => {
  it('lists only extensive/validation rows synced with the server, ordered by most recently updated', async () => {
    const eligibleRow = { ...STORED_ROW, type_prospection: 'extensive', statut_sync: 'synced' };
    getAllAsync.mockResolvedValueOnce([eligibleRow]);

    const result = await listValidatedProspections();

    expect(result).toEqual([eligibleRow]);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE type_prospection IN ('extensive', 'validation')")
    );
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining("AND statut_sync = 'synced'"));
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY updated_at DESC'));
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

  it('persists n° relevé quand fourni', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW, ...REFERENCE_INPUT, n_releve: 'REL-STA1-20260711' });

    await updateProspectionReference(BASE_INPUT.id, { ...REFERENCE_INPUT, nReleve: 'REL-STA1-20260711' });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      expect.arrayContaining(['REL-STA1-20260711'])
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
        // dans ce test), donc null : cf. les 7 champs équipe/aéronef ajoutés à
        // ExtensiveReferenceUpdateInput.
        null, null, null, null, null, null, null,
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
        null, // pesticidesEmbarques
        null, // pesticideNomCommercial
        null, // pesticideQuantiteDisponible
        null, // pesticideQuantiteRecue
        null, // futsDisponible
        null, // futsPleins
        null, // futsVides
        null, // futsRecues
        null, // signatureVisaNom
        null, // signatureVisaHorodatage
        null, // signatureConsultantFaoNom
        null, // signatureConsultantFaoHorodatage
        null, // signaturePiloteNom
        null, // signaturePiloteHorodatage
        null, // signatureChefBaseNom
        null, // signatureChefBaseHorodatage
        null, // observations (Remarques)
        expect.any(String),
        BASE_INPUT.id,
      ]
    );
  });

  it('writes pesticides embarqués + fûts + signatures columns (mode aérien)', async () => {
    getFirstAsync.mockResolvedValueOnce({ ...STORED_ROW });

    await updateProspectionExtensiveObservations(BASE_INPUT.id, {
      ...OBS_INPUT,
      pesticidesEmbarques: true,
      pesticideNomCommercial: 'Fyfanon ULV',
      pesticideQuantiteDisponible: 500,
      pesticideQuantiteRecue: 200,
      futsDisponible: 10,
      futsPleins: 6,
      futsVides: 4,
      futsRecues: 5,
      signatureVisaNom: 'Rakoto V.',
      signatureVisaHorodatage: '2026-09-01T09:00:00.000Z',
      signatureConsultantFaoNom: 'John Smith',
      signatureConsultantFaoHorodatage: '2026-09-01T09:05:00.000Z',
      signaturePiloteNom: 'Jean Rakoto',
      signaturePiloteHorodatage: '2026-09-01T09:10:00.000Z',
      signatureChefBaseNom: 'Sarah Ravelo',
      signatureChefBaseHorodatage: '2026-09-01T09:15:00.000Z',
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection SET'),
      [
        OBS_INPUT.degatsCultures,
        OBS_INPUT.verdissementPourcent,
        OBS_INPUT.hauteurHerbeCm,
        OBS_INPUT.dernierePluie,
        OBS_INPUT.intensitePluie,
        1, // pesticidesEmbarques stocké en 0/1 (SQLite n'a pas de type booléen natif)
        'Fyfanon ULV',
        500,
        200,
        10,
        6,
        4,
        5,
        'Rakoto V.',
        '2026-09-01T09:00:00.000Z',
        'John Smith',
        '2026-09-01T09:05:00.000Z',
        'Jean Rakoto',
        '2026-09-01T09:10:00.000Z',
        'Sarah Ravelo',
        '2026-09-01T09:15:00.000Z',
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

  it('returns the matching row', async () => {
    const row = {
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 10,
      densite_groupee: 2,
      methode: 'battage',
      accouplement: 'rare',
      ponte: 'peu',
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
    ponte: 'peu',
    // Colonnes extensives ajoutées
    captures_sol: null,
    captures_trans: null,
    captures_greg: null,
    captures_solitaro_transiens: null,
    stade_imago: null,
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
      expect.arrayContaining([BASE_INPUT.id, 'LMC', 'imago', 10, 2, 'battage', 'rare', 'peu'])
    );
  });

  it('updates the existing row when one already exists', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });

    await saveProspectionPopulation(BASE_INPUT.id, ROW);

    // 27 paramètres : 26 champs SET + 1 WHERE id
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE prospection_population SET'),
      [
        null, null, null, // phase, captures_nombre, temps_capture
        10, 2,             // densite_diffuse, densite_groupee
        'battage', 'rare', 'peu', // methode, accouplement, ponte
        null, null, null, null, // captures_sol, captures_trans, captures_greg, captures_solitaro_transiens
        null, null,        // stade_imago, essaim_observe
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