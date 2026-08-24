import { runTask, type TaskOptions } from '../src/lib/run-task';
import { demarrerApp, messageDeDemarrageManque } from '../src/lib/app-startup';
import {
  configureLogger,
  resetLoggerForTests,
  lignesEnAttente,
  type LogLine,
} from '../src/lib/logger';
import {
  NetworkError,
  AuthError,
  LocalReadError,
  LocalWriteError,
  ReferentialError,
  PermissionError,
  PreconditionError,
} from '../src/lib/errors';

const ecrites: LogLine[] = [];

beforeEach(() => {
  ecrites.length = 0;
  resetLoggerForTests();
  configureLogger({
    transport: {
      write: (lignes) => {
        ecrites.push(...lignes);
      },
    },
  });
});

/**
 * Les huit cas de la colonne « classe » d'ADR-012 : les sept classes du jeu
 * fermé, plus l'erreur non typée — qui n'est pas une huitième classe mais
 * l'absence de classe.
 */
const HUIT_CAS: [string, unknown][] = [
  ['NetworkError', new NetworkError('x')],
  ['AuthError', new AuthError('x')],
  ['LocalReadError', new LocalReadError('x')],
  ['LocalWriteError', new LocalWriteError('x')],
  ['ReferentialError', new ReferentialError('x')],
  ['PermissionError', new PermissionError('x')],
  ['PreconditionError', new PreconditionError('x')],
  ['(bug)', new Error('non typée')],
];

describe('runTask — la criticité décide, pas la classe (ADR-012 décision 3)', () => {
  it.each(HUIT_CAS)('best-effort : %s → JOURNAL', async (classe, error) => {
    const r = await runTask(() => Promise.reject(error), {
      name: 'sync.referentiel',
      criticality: 'best-effort',
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.traitement).toBe('JOURNAL');
    expect(ecrites.at(-1)?.classe).toBe(classe);
  });

  it.each(HUIT_CAS)('essential : %s → INFORMER', async (classe, error) => {
    const r = await runTask(() => Promise.reject(error), {
      name: 'startup.db',
      criticality: 'essential',
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.traitement).toBe('INFORMER');
    expect(ecrites.at(-1)?.classe).toBe(classe);
  });
});

describe('runTask — la frontière n’avale jamais rien', () => {
  it('un job qui lève ne laisse jamais l’anneau vide', async () => {
    // Le cœur de la décision 1 : il n'y a RIEN derrière cette frontière.
    for (const [, error] of HUIT_CAS) {
      resetLoggerForTests();
      await runTask(() => Promise.reject(error), {
        name: 'sync.referentiel',
        criticality: 'best-effort',
      });
      expect(lignesEnAttente().length + ecrites.length).toBeGreaterThan(0);
    }
  });

  it('capture aussi une exception synchrone du job', async () => {
    // `job()` est appelé DANS le try : sinon un throw avant le premier await
    // traverserait la frontière.
    const r = await runTask(
      () => {
        throw new LocalWriteError('table is locked');
      },
      { name: 'db.ecriture', criticality: 'essential' }
    );

    expect(r.ok).toBe(false);
    expect(ecrites.at(-1)?.event).toBe('db.ecriture.failed');
    expect(ecrites.at(-1)?.err?.message).toBe('table is locked');
  });

  it('l’échec est discernable d’un succès — jamais un null muet', async () => {
    const succes = await runTask(() => Promise.resolve(null), {
      name: 'db.lecture',
      criticality: 'best-effort',
    });
    const echec = await runTask<null>(() => Promise.reject(new NetworkError('boom')), {
      name: 'db.lecture',
      criticality: 'best-effort',
    });

    expect(succes).toEqual({ ok: true, value: null });
    expect(echec.ok).toBe(false);
  });

  it('ne rejette jamais : un appel non attendu ne peut pas devenir un rejet flottant', async () => {
    // C'est la raison d'être de la frontière au démarrage de l'app.
    await expect(
      runTask(() => Promise.reject(new Error('boum')), {
        name: 'sync.flottante',
        criticality: 'best-effort',
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it('journalise le nom de la tâche et le contexte figé', async () => {
    await runTask(() => Promise.reject(new NetworkError('x')), {
      name: 'sync.referentiel',
      criticality: 'best-effort',
      context: { campagne: 'C-2026' },
    });

    const ligne = ecrites.at(-1);
    expect(ligne?.event).toBe('sync.referentiel.failed');
    expect(ligne?.task).toBe('sync.referentiel');
    expect(ligne?.campagne).toBe('C-2026');
  });

  it('un succès ne journalise aucun échec', async () => {
    const r = await runTask(() => Promise.resolve(42), {
      name: 'stats.calcul',
      criticality: 'essential',
    });

    expect(r).toEqual({ ok: true, value: 42 });
    expect(ecrites).toHaveLength(0);
  });
});

describe('runTask — aucune échappatoire', () => {
  /** Les clés de `T` que l'appelant peut omettre. */
  type Optionnelles<T> = {
    [K in keyof T]-?: object extends Pick<T, K> ? K : never;
  }[keyof T];

  it('la criticité est obligatoire, sans valeur par défaut', () => {
    // Assertion de TYPE, vérifiée à la compilation : `context` est la seule
    // option omissible. Donner un défaut à `criticality` la rendrait
    // optionnelle et ferait échouer cette ligne — le développeur doit se
    // prononcer, et c'est le type qui l'impose, pas une convention.
    const seuleOptionnelle: Optionnelles<TaskOptions> extends 'context' ? true : false = true;

    expect(seuleOptionnelle).toBe(true);
  });

  it('il n’existe pas de niveau silent — et une criticité inconnue montre', async () => {
    const r = await runTask(() => Promise.reject(new Error('x')), {
      name: 'sync.referentiel',
      // @ts-expect-error 'silent' rouvrirait la porte au silence total
      criticality: 'silent',
    });

    // Même forcée par un `as`, une criticité hors union ne produit pas un
    // traitement `undefined` : en cas de doute, on montre.
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.traitement).toBe('BLOQUER');
    expect(ecrites.at(-1)?.event).toBe('sync.referentiel.failed');
  });
});

describe('demarrerApp — les premiers clients de essential', () => {
  const ok = () => Promise.resolve();

  it('remonte un échec de getDb()', async () => {
    // Aujourd'hui, un échec de migration SQLite au démarrage n'a aucun capteur.
    const r = await demarrerApp({
      ouvrirBase: () => Promise.reject(new LocalWriteError('migration failed')),
      initDebug: ok,
      purgerJournal: ok,
    });

    expect(r.base.ok).toBe(false);
    if (r.base.ok) return;
    expect(r.base.traitement).toBe('INFORMER');

    const ligne = ecrites.find((l) => l.event === 'startup.db.failed');
    expect(ligne?.classe).toBe('LocalWriteError');
    expect(ligne?.traitement).toBe('INFORMER');
  });

  it('remonte un échec de l’init du mode debug sans empêcher la base', async () => {
    const r = await demarrerApp({
      ouvrirBase: ok,
      initDebug: () => Promise.reject(new LocalReadError('storage illisible')),
      purgerJournal: ok,
    });

    expect(r.base.ok).toBe(true);
    expect(r.debug.ok).toBe(false);
    expect(ecrites.some((l) => l.event === 'startup.debug.failed')).toBe(true);
  });

  it('ne rejette jamais, même si les deux tâches échouent', async () => {
    // Rien dans `demarrerApp` ne vit hors d'un `runTask` : un rejet ferait du
    // `void demarrerApp(...)` de `_layout` un rejet flottant, et #160 a établi
    // qu'aucun filet ne le rattraperait en release.
    await expect(
      demarrerApp({
        ouvrirBase: () => Promise.reject(new Error('a')),
        initDebug: () => Promise.reject(new Error('b')),
        purgerJournal: ok,
      })
    ).resolves.toBeDefined();
  });
});

describe('demarrerApp — la purge du journal', () => {
  const ok = () => Promise.resolve();

  it('purge après l’init du mode debug, qui décide de la verbosité', async () => {
    const ordre: string[] = [];

    await demarrerApp({
      ouvrirBase: ok,
      initDebug: async () => {
        ordre.push('debug');
      },
      purgerJournal: async () => {
        ordre.push('purge');
      },
    });

    // La rétention des `detail` dépend du flag, qui n'est relu qu'à l'init :
    // purger avant, ce serait purger selon la verbosité de la session passée.
    expect(ordre).toEqual(['debug', 'purge']);
  });

  it('la traite en best-effort — un stockage un peu plus plein n’alarme pas l’agent', async () => {
    const r = await demarrerApp({
      ouvrirBase: ok,
      initDebug: ok,
      purgerJournal: () => Promise.reject(new LocalWriteError('purge impossible')),
    });

    expect(r.journal.ok).toBe(false);
    if (r.journal.ok) return;
    expect(r.journal.traitement).toBe('JOURNAL');
    expect(messageDeDemarrageManque(r)).toBeNull();

    const ligne = ecrites.find((l) => l.event === 'startup.journal.purge.failed');
    expect(ligne?.classe).toBe('LocalWriteError');
  });

  it('purge quand même si la base a échoué — c’est `runTask` qui décide, pas nous', async () => {
    const purge = jest.fn(ok);

    await demarrerApp({
      ouvrirBase: () => Promise.reject(new LocalWriteError('x')),
      initDebug: ok,
      purgerJournal: purge,
    });

    expect(purge).toHaveBeenCalled();
  });
});

describe('messageDeDemarrageManque — le INFORMER atteint l’agent', () => {
  const ok = () => Promise.resolve();

  it('ne dit rien quand tout s’est ouvert', async () => {
    const r = await demarrerApp({ ouvrirBase: ok, initDebug: ok, purgerJournal: ok });

    expect(messageDeDemarrageManque(r)).toBeNull();
  });

  it.each([
    [
      'la base',
      { ouvrirBase: () => Promise.reject(new LocalWriteError('x')), initDebug: ok, purgerJournal: ok },
    ],
    [
      'le mode debug',
      { ouvrirBase: ok, initDebug: () => Promise.reject(new LocalReadError('x')), purgerJournal: ok },
    ],
  ])('produit un message quand %s échoue', async (_quoi, deps) => {
    // Sans ça, le capteur est posé mais l'alarme n'est reliée à rien : l'agent
    // ne verrait toujours rien, exactement comme avec la promesse flottante.
    const message = messageDeDemarrageManque(await demarrerApp(deps));

    expect(message).toContain('stockage de l’appareil');
    // Message métier, jamais le brut technique — ADR-012 décision 2.
    expect(message).not.toContain('LocalWriteError');
  });
});
