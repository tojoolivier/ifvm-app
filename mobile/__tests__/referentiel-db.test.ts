import { resetDbForTests } from '../src/lib/prospection-db';
import {
  getReferentielDb,
  resetReferentielDbForTests,
  listPesticides,
  listUtilisateursByRole,
  listCampagnesLocal,
} from '../src/lib/referentiel-db';

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue([]);
const openDatabaseAsync = jest.fn().mockResolvedValue({ execAsync, getAllAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  resetReferentielDbForTests();
  openDatabaseAsync.mockClear();
  execAsync.mockClear();
  getAllAsync.mockClear();
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
      expect(tableBlock).toContain('actif INTEGER NOT NULL DEFAULT 1');
    }
  });

  it('migrates the referentiel tables only once across calls', async () => {
    await getReferentielDb();
    const callsAfterFirst = execAsync.mock.calls.length;
    await getReferentielDb();

    expect(execAsync.mock.calls.length).toBe(callsAfterFirst);
  });

  it('reuses the single prospection SQLite database', async () => {
    await getReferentielDb();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
  });
});

describe('listPesticides', () => {
  it('lists active pesticides ordered by name, without a matière active column', async () => {
    // getDb() runs its own PRAGMA table_info(...) migration queries against the same
    // mocked getAllAsync — match on SQL content rather than call order.
    getAllAsync.mockImplementation((sql: string) =>
      sql.includes('FROM pesticide')
        ? Promise.resolve([{ id: 'p-1', code: 'DELTA', nom: 'Deltaméthrine' }])
        : Promise.resolve([])
    );

    const result = await listPesticides();

    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT id, code, nom FROM pesticide WHERE actif = 1 ORDER BY nom'
    );
    expect(result).toEqual([{ id: 'p-1', code: 'DELTA', nom: 'Deltaméthrine' }]);
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
      'SELECT id, name, start_date, end_date FROM campagne ORDER BY start_date DESC'
    );
    expect(result).toEqual([
      { id: 'camp-1', name: 'Campagne 2026', start_date: '2026-01-01', end_date: null },
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
