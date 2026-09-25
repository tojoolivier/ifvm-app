import { resetDbForTests } from '../src/lib/db';
import { REFERENTIEL_SCHEMA_VERSION } from '../src/lib/referentiel-schema.generated';
import { remplacerReferentiel, resetReferentielDbForTests } from '../src/lib/referentiel-db';

const base = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue({ version: REFERENTIEL_SCHEMA_VERSION }),
  runAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn(async (tache: () => Promise<void>) => tache()),
  withExclusiveTransactionAsync: jest.fn(),
};
/** La connexion propre à la transaction exclusive : ce qui passe par elle, et par elle seule, est atomique. */
const txn = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => base }));

beforeEach(() => {
  resetDbForTests();
  resetReferentielDbForTests();
  for (const fn of [...Object.values(base), ...Object.values(txn)]) (fn as jest.Mock).mockClear();
  base.withExclusiveTransactionAsync.mockImplementation(async (tache: (t: typeof txn) => Promise<void>) => tache(txn));
});

describe('remplacerReferentiel', () => {
  it('jette et recrée les tables, puis écrit — tout sur la connexion de la transaction exclusive', async () => {
    const remplir = jest.fn(async (db: unknown) => {
      expect(db).toBe(txn);
    });

    await remplacerReferentiel(remplir);

    expect(base.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(remplir).toHaveBeenCalledWith(txn);
    const sqlTxn = txn.execAsync.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sqlTxn).toContain('DROP TABLE IF EXISTS pesticide');
    expect(sqlTxn).toContain('CREATE TABLE IF NOT EXISTS pesticide');
  });

  it('ne touche pas aux tables du cache depuis la connexion partagée', async () => {
    base.execAsync.mockClear();
    await remplacerReferentiel(async () => undefined);

    const sqlBase = base.execAsync.mock.calls.map((c) => c[0] as string).join('\n');
    // La migration de schéma (#726) jette des tables de saisie : seul le cache du référentiel compte ici.
    expect(sqlBase).not.toContain('DROP TABLE IF EXISTS pesticide');
  });

  it('vide avant d’écrire', async () => {
    const ordre: string[] = [];
    txn.execAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('DROP TABLE')) ordre.push('vidage');
    });

    await remplacerReferentiel(async () => {
      ordre.push('ecriture');
    });

    expect(ordre[0]).toBe('vidage');
    expect(ordre.at(-1)).toBe('ecriture');
  });

  it('un échec pendant l’écriture remonte : la transaction est annulée par expo-sqlite', async () => {
    await expect(
      remplacerReferentiel(async () => {
        throw new Error('disque plein');
      })
    ).rejects.toThrow('disque plein');
  });
});
