import {
  DDL_JOURNAL,
  PLAFOND_LIGNES,
  RETENTION_MS,
  creerTransportJournal,
  installerTransportJournal,
  lireJournal,
  purgerJournal,
  estEnDev,
  resetJournalForTests,
  viderJournal,
} from '../src/lib/journal-db';
import { LocalReadError } from '../src/lib/errors';
import {
  configureLogger,
  estLeJournalCasse,
  flush,
  logger,
  resetLoggerForTests,
  type LogLine,
} from '../src/lib/logger';
import { resetDbForTests } from '../src/lib/prospection-db';

const execAsync = jest.fn().mockResolvedValue(undefined);
const runAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue([]);
const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => {
  await fn();
});
const openDatabaseAsync = jest
  .fn()
  .mockResolvedValue({ execAsync, runAsync, getAllAsync, withTransactionAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

function ligne(partiel: Partial<LogLine> = {}): LogLine {
  return {
    at: '2026-08-24T10:00:00.000Z',
    cid: 'ABC123',
    level: 'info',
    event: 'test.event',
    ...partiel,
  };
}

/**
 * `getDb()` joue toute la migration de `prospection` sur le même handle : le
 * journal n'est jamais seul à parler à la base. On filtre donc sur son SQL.
 */
function sqlDuJournal(): string[] {
  return execAsync.mock.calls
    .map((c) => c[0] as string)
    // `PRAGMA journal_mode = WAL` de `prospection-db` contient aussi « journal ».
    .filter((sql) => sql.includes('CREATE TABLE IF NOT EXISTS journal'));
}

/** Les paramètres du n-ième INSERT dans `journal`, sans le SQL. */
function parametresInsert(n = 0): unknown[] {
  const inserts = runAsync.mock.calls.filter((c) => (c[0] as string).includes('INSERT INTO journal'));
  return inserts[n].slice(1) as unknown[];
}

beforeEach(() => {
  jest.clearAllMocks();
  execAsync.mockResolvedValue(undefined);
  runAsync.mockResolvedValue(undefined);
  getAllAsync.mockResolvedValue([]);
  resetDbForTests();
  resetJournalForTests();
  resetLoggerForTests();
});

describe('le schéma de la table journal — ADR-012 décision 4', () => {
  it('crée la table dans ifvm.db, pas dans un fichier à part', async () => {
    await creerTransportJournal().write([ligne()]);

    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
    expect(sqlDuJournal().join('\n')).toContain('CREATE TABLE IF NOT EXISTS journal');
  });

  it('prend le rowid pour clé primaire : monotone, et plus fin que la milliseconde de `at`', () => {
    expect(DDL_JOURNAL).toContain('id INTEGER PRIMARY KEY');
    // `AUTOINCREMENT` coûterait une écriture de `sqlite_sequence` par ligne,
    // sur le chemin le plus chaud du logger, pour une garantie dont la purge
    // n'a pas besoin — elle retire les plus anciens, jamais le maximum.
    expect(DDL_JOURNAL).not.toContain('AUTOINCREMENT');
  });

  it('borne le domaine de `level` dans le schéma plutôt que dans le code appelant', () => {
    expect(DDL_JOURNAL).toContain("CHECK (level IN ('debug', 'info', 'warn', 'error'))");
  });

  it("n'ouvre la base qu'une fois pour plusieurs écritures", async () => {
    const transport = creerTransportJournal();
    await transport.write([ligne()]);
    await transport.write([ligne()]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(sqlDuJournal()).toHaveLength(1);
  });
});

describe("l'écriture d'un lot", () => {
  it('écrit une ligne par entrée, dans une seule transaction', async () => {
    await creerTransportJournal().write([ligne(), ligne(), ligne()]);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(3);
  });

  it('promeut en colonnes ce sur quoi on purge, trie ou filtre', async () => {
    await creerTransportJournal().write([
      ligne({
        level: 'error',
        event: 'sync.failed',
        classe: 'NetworkError',
        traitement: 'INFORMER',
        raison: null as unknown as string,
      }),
    ]);

    const [at, cid, level, evenement, classe, traitement] = parametresInsert();
    expect(at).toBe('2026-08-24T10:00:00.000Z');
    expect(cid).toBe('ABC123');
    expect(level).toBe('error');
    expect(evenement).toBe('sync.failed');
    expect(classe).toBe('NetworkError');
    expect(traitement).toBe('INFORMER');
  });

  it("éclate `err` en trois colonnes atomiques plutôt qu'en un objet imbriqué", async () => {
    await creerTransportJournal().write([
      ligne({ err: { name: 'NetworkError', message: 'injoignable', stack: 'ligne 1' } }),
    ]);

    const params = parametresInsert();
    expect(params).toContain('NetworkError');
    expect(params).toContain('injoignable');
    expect(params).toContain('ligne 1');
  });

  it('range le contexte libre en JSON opaque, sans en perdre les clés', async () => {
    await creerTransportJournal().write([ligne({ task: 'startup.db', tentative: 2 })]);

    const contexte = parametresInsert().at(-1) as string;
    expect(JSON.parse(contexte)).toEqual({ task: 'startup.db', tentative: 2 });
  });

  it('laisse le contexte à NULL quand il est vide, plutôt que d’écrire "{}" par ligne', async () => {
    await creerTransportJournal().write([ligne()]);

    expect(parametresInsert().at(-1)).toBeNull();
  });

  it("ne réécrit pas les colonnes de première classe dans le contexte", async () => {
    await creerTransportJournal().write([ligne({ classe: 'AuthError', task: 'x' })]);

    const contexte = JSON.parse(parametresInsert().at(-1) as string);
    expect(contexte).toEqual({ task: 'x' });
  });

  it('ne fait rien du tout sur un lot vide', async () => {
    await creerTransportJournal().write([]);

    expect(openDatabaseAsync).not.toHaveBeenCalled();
  });
});

describe("l'échec d'écriture ne passe jamais par le logger", () => {
  it('propage le rejet, pour que `flush()` lève le drapeau', async () => {
    runAsync.mockRejectedValue(new Error('database is locked'));

    await expect(creerTransportJournal().write([ligne()])).rejects.toThrow('database is locked');
  });

  it('rend `estLeJournalCasse()` vrai sans se journaliser lui-même', async () => {
    runAsync.mockRejectedValue(new Error('disk I/O error'));
    configureLogger({ transport: creerTransportJournal() });

    logger.event('quelque.chose');
    await flush();

    expect(estLeJournalCasse()).toBe(true);
  });

  it("réessaie de créer la table au flush suivant plutôt que de rester cassé à vie", async () => {
    let premierEssai = true;
    execAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS journal') && premierEssai) {
        premierEssai = false;
        throw new Error('SQLITE_BUSY');
      }
    });
    const transport = creerTransportJournal();

    await expect(transport.write([ligne()])).rejects.toThrow('SQLITE_BUSY');
    await expect(transport.write([ligne()])).resolves.toBeUndefined();
  });
});

describe('la rétention par niveau — pas la séparation des flux', () => {
  const MAINTENANT = new Date('2026-08-24T12:00:00.000Z');

  function suppressions(): { sql: string; params: unknown[] }[] {
    return runAsync.mock.calls
      .filter((c) => (c[0] as string).includes('DELETE'))
      .map((c) => ({ sql: c[0] as string, params: c.slice(1) as unknown[] }));
  }

  it('garde les échecs bien plus longtemps que les détails', () => {
    expect(RETENTION_MS.debug).toBeLessThan(RETENTION_MS.info);
    expect(RETENTION_MS.info).toBeLessThan(RETENTION_MS.echec);
  });

  it('purge `debug` à 24 h, `info` à 7 j et les échecs à 30 j', async () => {
    await purgerJournal({ verbeux: false, maintenant: MAINTENANT });

    const parNiveau = suppressions().filter((d) => d.sql.includes('level'));
    const borne = (n: number) => new Date(MAINTENANT.getTime() - n).toISOString();

    expect(parNiveau[0].params).toEqual(['debug', borne(RETENTION_MS.debug)]);
    expect(parNiveau[1].params).toEqual(['info', borne(RETENTION_MS.info)]);
    expect(parNiveau[2].sql).toContain("level IN ('warn', 'error')");
    expect(parNiveau[2].params).toEqual([borne(RETENTION_MS.echec)]);
  });

  it("allonge la rétention des `detail` quand le mode verbeux est activé — le flag n'est plus un gate d'écriture", async () => {
    await purgerJournal({ verbeux: true, maintenant: MAINTENANT });

    const debug = suppressions().find((d) => d.params[0] === 'debug');
    expect(debug?.params[1]).toBe(
      new Date(MAINTENANT.getTime() - RETENTION_MS.debugVerbeux).toISOString()
    );
  });

  it('plafonne aussi en nombre de lignes : une rafale d’échecs remplirait le stockage avant 30 j', async () => {
    await purgerJournal({ verbeux: false, maintenant: MAINTENANT });

    const plafond = suppressions().find((d) => d.sql.includes('LIMIT'));
    expect(plafond).toBeDefined();
    expect(plafond?.params).toEqual([PLAFOND_LIGNES]);
  });
});

describe('la lecture du journal', () => {
  it('rend les lignes de la plus récente à la plus ancienne', async () => {
    await lireJournal(10);

    const select = getAllAsync.mock.calls.find((c) => (c[0] as string).includes('FROM journal'));
    expect(select?.[0]).toContain('ORDER BY id DESC');
    expect(select?.[1]).toBe(10);
  });

  it('recompose la ligne : contexte remis à plat, `err` reconstitué', async () => {
    getAllAsync.mockResolvedValue([
      {
        id: 7,
        at: '2026-08-24T10:00:00.000Z',
        cid: 'ABC123',
        level: 'error',
        event: 'sync.failed',
        classe: 'NetworkError',
        traitement: 'INFORMER',
        raison: null,
        err_name: 'NetworkError',
        err_message: 'injoignable',
        err_stack: null,
        contexte: '{"task":"sync"}',
      },
    ]);

    const [ligneLue] = await lireJournal();

    expect(ligneLue).toMatchObject({
      id: 7,
      level: 'error',
      event: 'sync.failed',
      classe: 'NetworkError',
      task: 'sync',
      err: { name: 'NetworkError', message: 'injoignable' },
    });
    expect(ligneLue).not.toHaveProperty('err_name');
    expect(ligneLue).not.toHaveProperty('contexte');
  });

  it('lève `LocalReadError` sur un contexte corrompu au lieu de rendre un objet vide', async () => {
    getAllAsync.mockResolvedValue([
      { id: 1, at: 'x', cid: 'y', level: 'info', event: 'e', contexte: '{pas du json' },
    ]);

    await expect(lireJournal()).rejects.toBeInstanceOf(LocalReadError);
  });

  it('vide la table sur demande', async () => {
    await viderJournal();

    expect(runAsync.mock.calls.some((c) => (c[0] as string).includes('DELETE FROM journal'))).toBe(
      true
    );
  });
});

describe("l'installation au démarrage", () => {
  it('branche le transport SQLite sur le logger', async () => {
    installerTransportJournal();

    logger.failure('demarrage.rate', new Error('boum'));
    // `failure` déclenche un flush immédiat mais non attendable — `sink()` fait
    // `void flush()`. On laisse donc la boucle d'événements le terminer.
    await new Promise((r) => setImmediate(r));

    expect(runAsync).toHaveBeenCalled();
    expect(parametresInsert()[3]).toBe('demarrage.rate');
  });

  it('reflète vers la console en dev', () => {
    const espion = jest.spyOn(console, 'log').mockImplementation(() => {});
    installerTransportJournal({ dev: true });

    logger.event('visible.en.dev');

    expect(espion).toHaveBeenCalledTimes(1);
    espion.mockRestore();
  });

  it('se tait sur la console en release — `console.*` n’y a aucun lecteur', () => {
    const espion = jest.spyOn(console, 'log').mockImplementation(() => {});
    installerTransportJournal({ dev: false });

    logger.event('invisible.en.release');

    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
  });

  it('se rabat sur `__DEV__` par défaut, sans planter là où il n’existe pas', () => {
    expect(estEnDev()).toBe(typeof __DEV__ !== 'undefined' && __DEV__ === true);
  });
});
