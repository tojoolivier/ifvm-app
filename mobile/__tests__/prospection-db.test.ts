import { getDb, resetDbForTests } from '../src/lib/prospection-db';

const execAsync = jest.fn().mockResolvedValue(undefined);
const openDatabaseAsync = jest.fn().mockResolvedValue({ execAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  openDatabaseAsync.mockClear();
  execAsync.mockClear();
});

describe('prospection-db', () => {
  it('opens the local database by name', async () => {
    await getDb();

    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
  });

  it('creates the prospection, prospection_capture and prospection_population tables', async () => {
    await getDb();

    expect(execAsync).toHaveBeenCalledTimes(1);
    const sql = execAsync.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection_capture');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection_population');
    expect(sql).toContain("REFERENCES prospection(id) ON DELETE CASCADE");
  });

  it('memoizes the database across calls', async () => {
    const first = await getDb();
    const second = await getDb();

    expect(first).toBe(second);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
