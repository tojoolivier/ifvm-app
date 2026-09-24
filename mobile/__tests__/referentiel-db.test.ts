import { resetDbForTests } from '../src/lib/prospection-db';
import {
  getReferentielDb,
  resetReferentielDbForTests,
  listPesticides,
  listUtilisateursByRole,
  listCampagnesLocal,
  listCultures,
  listCodesStades,
  getStationById,
  listEquipesDeUtilisateur,
  listToutesEquipes,
  getEquipeLocale,
} from '../src/lib/referentiel-db';

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue([]);
const getFirstAsync = jest.fn().mockResolvedValue(null);
const runAsync = jest.fn().mockResolvedValue(undefined);
const withTransactionAsync = jest.fn(async (tache: () => Promise<void>) => tache());
const openDatabaseAsync = jest
  .fn()
  .mockResolvedValue({ execAsync, getAllAsync, getFirstAsync, runAsync, withTransactionAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  resetReferentielDbForTests();
  openDatabaseAsync.mockClear();
  execAsync.mockClear();
  getAllAsync.mockClear();
  getFirstAsync.mockClear().mockResolvedValue(null);
  runAsync.mockClear();
});

describe('referentiel-db', () => {
  it('creates the referentiel mirror tables and the sync cursor table', async () => {
    await getReferentielDb();

    const sqlCalls = execAsync.mock.calls.map((call) => call[0] as string).join('\n');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS poste_acridien');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS station_fixe');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS utilisateur_equipe');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS pesticide');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS culture');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS code_stade');
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS campagne');
    expect(sqlCalls).toContain(
      'CREATE TABLE IF NOT EXISTS referentiel_sync_meta (\n      entity_type TEXT PRIMARY KEY NOT NULL,\n      last_pull_at TEXT'
    );
  });

  it('each referentiel table carries updated_at and actif columns', async () => {
    await getReferentielDb();

    const sqlCalls = execAsync.mock.calls.map((call) => call[0] as string).join('\n');
    for (const table of ['poste_acridien', 'station_fixe', 'utilisateur_equipe', 'pesticide', 'culture', 'code_stade']) {
      const tableSql = sqlCalls.slice(sqlCalls.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`));
      const tableBlock = tableSql.slice(0, tableSql.indexOf(');'));
      expect(tableBlock).toContain('updated_at TEXT NOT NULL');
      expect(tableBlock).toContain('actif INTEGER NOT NULL');
    }
  });

  it('migrates the referentiel tables only once across calls', async () => {
    await getReferentielDb();
    const callsAfterFirst = execAsync.mock.calls.length;
    await getReferentielDb();

    expect(execAsync.mock.calls.length).toBe(callsAfterFirst);
  });

  it('ne migre qu’une fois même sur deux appels concurrents (#201)', async () => {
    // Deux `_layout` montent le pull automatique : `getReferentielDb` est appelé deux
    // fois en parallèle. Avec un drapeau posé après coup, la seconde migration rejouait
    // le `DROP TABLE code_stade` pendant que la première synchro écrivait ses lignes.
    await Promise.all([getReferentielDb(), getReferentielDb()]);

    const drops = execAsync.mock.calls.filter((call) =>
      String(call[0]).includes('DROP TABLE IF EXISTS code_stade')
    );
    // Premier démarrage (aucune version stockée) : une seule reconstruction, pas deux.
    expect(drops).toHaveLength(1);
  });

  it('reuses the single prospection SQLite database', async () => {
    await getReferentielDb();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
  });
});

describe('listPesticides', () => {
  it('lists active pesticides ordered by name, matière active, dose de référence et type de produit compris', async () => {
    // getDb() runs its own PRAGMA table_info(...) migration queries against the same
    // mocked getAllAsync — match on SQL content rather than call order.
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM pesticide')
        ? Promise.resolve([
            {
              id: 'p-1',
              code: 'DELTA',
              nom: 'Deltaméthrine',
              matiere_active: 'Deltaméthrine',
              dose_reference: '0.5 l/ha',
              type_produit: 'produit_choc',
            },
          ])
        : Promise.resolve([])
    );

    const result = await listPesticides();

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'SELECT id, code, nom, matiere_active, dose_reference, type_produit FROM pesticide'
      ),
      [null, null]
    );
    expect(result).toEqual([
      {
        id: 'p-1',
        code: 'DELTA',
        nom: 'Deltaméthrine',
        matiere_active: 'Deltaméthrine',
        dose_reference: '0.5 l/ha',
        type_produit: 'produit_choc',
      },
    ]);
  });

  it('sans mode de traitement (IRREGULIER ou non renseigné), ne filtre pas par type de produit', async () => {
    getAllAsync.mockResolvedValue([]);

    await listPesticides('IRREGULIER');

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), [null, null]);
  });

  it('mode BARRIERE : ne propose que les produits barrière', async () => {
    getAllAsync.mockResolvedValue([]);

    await listPesticides('BARRIERE');

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.any(String),
      ['produit_barriere', 'produit_barriere']
    );
  });

  it('mode TOTAL (couverture totale) : ne propose que les produits de choc', async () => {
    getAllAsync.mockResolvedValue([]);

    await listPesticides('TOTAL');

    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), ['produit_choc', 'produit_choc']);
  });
});

describe('listCampagnesLocal', () => {
  it('lists campagnes from the local référentiel mirror, most recent start_date first', async () => {
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM campagne')
        ? Promise.resolve([
            { id: 'camp-1', name: 'Campagne 2026', start_date: '2026-01-01', end_date: null },
          ])
        : Promise.resolve([])
    );

    const result = await listCampagnesLocal();

    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT id, name, start_date, end_date FROM campagne WHERE actif = 1 ORDER BY start_date DESC'
    );
    expect(result).toEqual([
      { id: 'camp-1', name: 'Campagne 2026', start_date: '2026-01-01', end_date: null },
    ]);
  });
});

describe('listCultures', () => {
  it('lists active cultures ordered by name', async () => {
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM culture')
        ? Promise.resolve([{ id: 'c-1', code: 'RIZ', nom: 'Riz' }])
        : Promise.resolve([])
    );

    const result = await listCultures();

    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT id, code, nom FROM culture WHERE actif = 1 ORDER BY nom'
    );
    expect(result).toEqual([{ id: 'c-1', code: 'RIZ', nom: 'Riz' }]);
  });
});

describe('listCodesStades', () => {
  it('lists active code_stade rows in référentiel order', async () => {
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM code_stade')
        ? Promise.resolve([
            {
              id: 's-1',
              code: 'L3',
              categorie: 'larve',
              sexe: null,
              espece: null,
              libelle: 'Larve L3',
              ordre: 3,
            },
          ])
        : Promise.resolve([])
    );

    const result = await listCodesStades();

    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT id, code, categorie, sexe, espece, libelle, ordre FROM code_stade WHERE actif = 1 ORDER BY ordre'
    );
    expect(result).toEqual([
      {
        id: 's-1',
        code: 'L3',
        categorie: 'larve',
        sexe: null,
        espece: null,
        libelle: 'Larve L3',
        ordre: 3,
      },
    ]);
  });
});

describe('listUtilisateursByRole', () => {
  it('lists active users filtered by role, ordered by name', async () => {
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM utilisateur_equipe')
        ? Promise.resolve([{ id: 'u-1', nom: 'Rakoto', prenom: 'Jean' }])
        : Promise.resolve([])
    );

    const result = await listUtilisateursByRole('chef_de_base');

    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT id, nom, prenom FROM utilisateur_equipe WHERE actif = 1 AND role = ? ORDER BY nom',
      ['chef_de_base']
    );
    expect(result).toEqual([{ id: 'u-1', nom: 'Rakoto', prenom: 'Jean' }]);
  });
});

/** #localite-traitement-poste-acridien-autre-agent : résout une station du
 * référentiel local par id, sans filtre `actif` (une station désactivée
 * depuis doit rester résolvable pour une prospection existante). */
describe('getStationById', () => {
  it('résout une station active ou non, sans filtrer sur actif', async () => {
    await getReferentielDb(); // la préparation du schéma lit déjà la version via getFirstAsync
    getFirstAsync.mockClear();
    getFirstAsync.mockResolvedValueOnce({
      id: 'station-1',
      code: 'ST01',
      nom: 'Poste Ambovombe',
      paId: 'pa-1',
      latitude: -25.1,
      longitude: 46.1,
      altitude: null,
      commune: 'Ambovombe',
      district: 'Ambovombe',
      region: 'Androy',
    });

    const result = await getStationById('station-1');

    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM station_fixe WHERE id = ?'),
      ['station-1']
    );
    expect(getFirstAsync.mock.calls[0][0]).not.toContain('actif');
    expect(result?.nom).toBe('Poste Ambovombe');
  });

  it('renvoie null si la station est introuvable', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    const result = await getStationById('station-inconnue');

    expect(result).toBeNull();
  });
});

describe('équipes de travail', () => {
  it('liste les équipes actives dont l’utilisateur est membre, avec leur effectif', async () => {
    const lignes = [{ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4 }];
    await getReferentielDb(); // ouvre la base : les PRAGMA de migration consomment leurs propres réponses
    getAllAsync.mockResolvedValueOnce(lignes);

    const equipes = await listEquipesDeUtilisateur('u-1');

    expect(equipes).toEqual(lignes);
    const [sql, params] = getAllAsync.mock.calls[getAllAsync.mock.calls.length - 1];
    expect(sql).toContain('FROM equipe');
    expect(sql).toContain('actif = 1');
    expect(sql).toContain('equipe_membre');
    expect(params).toEqual(['u-1']);
  });

  it('liste toutes les équipes actives, sans filtre d’appartenance (administrateur)', async () => {
    const lignes = [{ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4 }];
    await getReferentielDb();
    getAllAsync.mockResolvedValueOnce(lignes);

    expect(await listToutesEquipes()).toEqual(lignes);
    const [sql] = getAllAsync.mock.calls[getAllAsync.mock.calls.length - 1];
    expect(sql).toContain('actif = 1');
    expect(sql).not.toContain('EXISTS');
  });

  it('résout une équipe par id, active ou non, et renvoie null si elle est inconnue', async () => {
    await getReferentielDb();
    getFirstAsync.mockClear();
    getFirstAsync.mockResolvedValueOnce({ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4 });
    expect(await getEquipeLocale('eq-1')).toEqual({ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4 });

    getFirstAsync.mockResolvedValueOnce(null);
    expect(await getEquipeLocale('inconnue')).toBeNull();
  });
});
