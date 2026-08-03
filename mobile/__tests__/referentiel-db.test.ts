import { resetDbForTests } from '../src/lib/prospection-db';
import { getReferentielDb, resetReferentielDbForTests } from '../src/lib/referentiel-db';

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
