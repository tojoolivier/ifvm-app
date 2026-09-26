import {
  DDL_JOURNAL,
  PLAFOND_LIGNES,
  RETENTION_MS,
  creerTransportJournal,
  installerTransportJournal,
  lireJournal,
  lireSession,
  purgerJournal,
  estEnDev,
  resetJournalForTests,
  viderJournal,
} from '../src/lib/journal-db';
import { LocalReadError, LocalWriteError } from '../src/lib/errors';
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
const getFirstAsync = jest.fn().mockResolvedValue(null);
const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => {
  await fn();
});
const openDatabaseAsync = jest
  .fn()
  .mockResolvedValue({ execAsync, runAsync, getAllAsync, getFirstAsync, withTransactionAsync });

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

  it('garde le DDL, le INSERT et les arguments alignés — ils dérivent de la même liste', async () => {
    // L'invariant que protège `COLONNES` : quatre listes ordonnées tenues à la
    // main se désalignent silencieusement, et un `stack` finit dans `raison`.
    const colonnesDuDdl = [...DDL_JOURNAL.matchAll(/^\s{4}(\w+) /gm)]
      .map((m) => m[1])
      .filter((nom) => nom !== 'id');

    await creerTransportJournal().write([
      ligne({ err: { name: 'E', message: 'm', stack: 's' }, extra: 1 }),
    ]);

    expect(parametresInsert()).toHaveLength(colonnesDuDdl.length);
    // Et l'ordre est bien celui du DDL : `contexte` ferme la marche des deux côtés.
    expect(colonnesDuDdl.at(-1)).toBe('contexte');
    expect(parametresInsert().at(-1)).toBe('{"extra":1}');
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

    // Une transaction pour l'unique étape de migration (ouverture de la base), une pour le lot.
    expect(withTransactionAsync).toHaveBeenCalledTimes(2);
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

/** Remonte la chaîne des `cause` jusqu'à l'erreur d'origine. */
function racineDeLaCause(erreur: unknown): unknown {
  let courante = erreur;
  while (courante instanceof Error && courante.cause !== undefined) {
    courante = courante.cause;
  }
  return courante;
}

describe("l'échec d'écriture ne passe jamais par le logger", () => {
  it('propage le rejet, typé `LocalWriteError`, pour que `flush()` lève le drapeau', async () => {
    const cause = new Error('database is locked');
    runAsync.mockRejectedValue(cause);

    // Typé à la source comme partout ailleurs (décision 2) : avaler l'erreur
    // ici rendrait `journalFlushBroken` inatteignable.
    await expect(creerTransportJournal().write([ligne()])).rejects.toBeInstanceOf(LocalWriteError);

    // La cause traverse deux couches de typage — le handle de `getDb()` type
    // déjà ses écritures (#173), et le journal ajoute par-dessus combien de
    // lignes sont perdues. L'erreur du moteur reste la racine de la chaîne :
    // c'est elle que le support lira.
    const erreur = await creerTransportJournal()
      .write([ligne()])
      ?.catch((e: unknown) => e);
    expect(racineDeLaCause(erreur)).toBe(cause);
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

    await expect(transport.write([ligne()])).rejects.toBeInstanceOf(LocalWriteError);
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
    expect(RETENTION_MS.detail).toBeLessThan(RETENTION_MS.evenement);
    expect(RETENTION_MS.evenement).toBeLessThan(RETENTION_MS.echec);
  });

  it('purge `debug` à 24 h, `info` à 7 j et les échecs à 30 j', async () => {
    await purgerJournal({ verbeux: false, maintenant: MAINTENANT });

    const parNiveau = suppressions().filter((d) => d.sql.includes('level'));
    const borne = (n: number) => new Date(MAINTENANT.getTime() - n).toISOString();

    expect(parNiveau[0].params).toEqual(['debug', borne(RETENTION_MS.detail)]);
    expect(parNiveau[1].params).toEqual(['info', borne(RETENTION_MS.evenement)]);
    // `warn` et `error` partagent une tranche : un échec reste un échec, que
    // l'agent l'ait vu (INFORMER) ou non (JOURNAL).
    expect(parNiveau[2].params).toEqual(['warn', 'error', borne(RETENTION_MS.echec)]);
  });

  it("allonge la rétention des `detail` quand le mode verbeux est activé — le flag n'est plus un gate d'écriture", async () => {
    await purgerJournal({ verbeux: true, maintenant: MAINTENANT });

    const debug = suppressions().find((d) => d.params[0] === 'debug');
    expect(debug?.params[1]).toBe(
      new Date(MAINTENANT.getTime() - RETENTION_MS.detailVerbeux).toISOString()
    );
  });

  it('plafonne aussi en nombre de lignes : une rafale d’échecs remplirait le stockage avant 30 j', async () => {
    await purgerJournal({ verbeux: false, maintenant: MAINTENANT });

    const plafond = suppressions().find((d) => d.sql.includes('LIMIT'));
    expect(plafond).toBeDefined();
    expect(plafond?.params).toEqual([PLAFOND_LIGNES]);
  });
});

describe('le plafond en cours de session — pas seulement au démarrage', () => {
  function plafonnements(): unknown[][] {
    return runAsync.mock.calls.filter((c) => (c[0] as string).includes('LIMIT'));
  }

  it("ne plafonne pas à chaque lot : ce serait une sous-requête par flush, sur le chemin chaud", async () => {
    const transport = creerTransportJournal();

    await transport.write([ligne()]);
    await transport.write([ligne()]);

    expect(plafonnements()).toHaveLength(0);
  });

  it('plafonne périodiquement, sans quoi une rafale d’échecs court jusqu’au prochain lancement', async () => {
    const transport = creerTransportJournal();

    // La purge du démarrage ne protège que du passé ; une session qui dure la
    // journée écrirait sans borne entre deux lancements.
    for (let i = 0; i < 20; i++) await transport.write([ligne()]);

    expect(plafonnements()).toHaveLength(1);
    expect(plafonnements()[0].slice(1)).toEqual([PLAFOND_LIGNES]);
  });
});

describe('le flush asymétrique atteint bien SQLite', () => {
  it('un `failure` persiste tout le tampon immédiatement, pas au lot suivant', async () => {
    installerTransportJournal({ dev: false });

    logger.detail('contexte.avant.1');
    logger.detail('contexte.avant.2');
    expect(runAsync).not.toHaveBeenCalled();

    logger.failure('sync.failed', new Error('boum'));
    await new Promise((r) => setImmediate(r));

    // Vider TOUT le tampon sur un échec persiste le contexte qui le précède —
    // souvent plus utile que l'échec lui-même (ADR-012 décision 4).
    const evenements = runAsync.mock.calls
      .filter((c) => (c[0] as string).includes('INSERT INTO journal'))
      .map((c) => c[4]);
    expect(evenements).toEqual(['contexte.avant.1', 'contexte.avant.2', 'sync.failed']);
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

  // #176 : la tranche exportée est « depuis le dernier démarrage ». Le `cid` la
  // désigne exactement — il est posé une fois au chargement de `logger` — et il
  // le fait mieux qu'un filtre sur `at`, dont l'horloge de terrain peut sauter.
  it('rend la session courante en ordre chronologique croissant', async () => {
    const rangee = (id: number) => ({
      id,
      at: `2026-08-24T10:00:0${id}.000Z`,
      cid: 'ABC123',
      level: 'info' as const,
      event: `e${id}`,
      contexte: null,
    });
    // Le SQL rend les plus récentes d'abord ; l'export veut l'inverse.
    getAllAsync.mockResolvedValue([rangee(3), rangee(2), rangee(1)]);

    const { lignes } = await lireSession('ABC123');

    const select = getAllAsync.mock.calls.find((c) => (c[0] as string).includes('SELECT *'));
    expect(select?.[0]).toContain('WHERE cid = ?');
    expect(select?.[1]).toBe('ABC123');
    expect(lignes.map((l) => l.event)).toEqual(['e1', 'e2', 'e3']);
  });

  it('borne la session au plafond de lignes — le rapport ne peut pas tout porter', async () => {
    await lireSession('ABC123');

    const select = getAllAsync.mock.calls.find((c) => (c[0] as string).includes('SELECT *'));
    expect(select?.[2]).toBe(PLAFOND_LIGNES);
  });

  /**
   * Sans ce compte, la coupure faite **en SQL** serait invisible : l'export
   * calculerait ses « écartées » sur ce qu'il a reçu, et déclarerait complet un
   * rapport amputé de 20 000 lignes. C'est le silence que la décision 7
   * supprime, déplacé d'un cran plus bas.
   */
  it('dit combien la session compte réellement de lignes, pas seulement ce qu’elle rend', async () => {
    getAllAsync.mockImplementation(async (sql: string) =>
      sql.includes('COUNT(*)') ? [{ total: 12_000 }] : []
    );

    const { lignes, total } = await lireSession('ABC123');

    expect(lignes).toEqual([]);
    expect(total).toBe(12_000);
    const compte = getAllAsync.mock.calls.find((c) => (c[0] as string).includes('COUNT(*)'));
    expect(compte?.[0]).toContain('WHERE cid = ?');
    expect(compte?.[1]).toBe('ABC123');
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
