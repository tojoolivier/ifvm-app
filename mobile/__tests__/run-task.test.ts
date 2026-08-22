import { runTask } from '../src/lib/run-task';
import { demarrerApp } from '../src/lib/app-startup';
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
        name: 'tache',
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
      { name: 'ecriture', criticality: 'essential' }
    );

    expect(r.ok).toBe(false);
    expect(ecrites.at(-1)?.event).toBe('ecriture.failed');
    expect(ecrites.at(-1)?.err?.message).toBe('table is locked');
  });

  it('l’échec est discernable d’un succès — jamais un null muet', async () => {
    const succes = await runTask(() => Promise.resolve(null), {
      name: 'lecture',
      criticality: 'best-effort',
    });
    const echec = await runTask<null>(() => Promise.reject(new NetworkError('boom')), {
      name: 'lecture',
      criticality: 'best-effort',
    });

    expect(succes).toEqual({ ok: true, value: null });
    expect(echec.ok).toBe(false);
  });

  it('ne rejette jamais : un appel non attendu ne peut pas devenir un rejet flottant', async () => {
    // C'est la raison d'être de la frontière au démarrage de l'app.
    await expect(
      runTask(() => Promise.reject(new Error('boum')), {
        name: 'flottante',
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
      name: 'calcul',
      criticality: 'essential',
    });

    expect(r).toEqual({ ok: true, value: 42 });
    expect(ecrites).toHaveLength(0);
  });
});

describe('runTask — aucune échappatoire', () => {
  it('la criticité est obligatoire, sans valeur par défaut', async () => {
    // Le développeur doit se prononcer et la revue doit le voir : c'est le
    // type qui l'impose, pas une convention.
    // @ts-expect-error criticality manquante
    await runTask(() => Promise.resolve(), { name: 'tache' });
  });

  it('il n’existe pas de niveau silent', async () => {
    await runTask(() => Promise.reject(new Error('x')), {
      name: 'tache',
      // @ts-expect-error 'silent' rouvrirait la porte au silence total
      criticality: 'silent',
    });
  });
});

describe('demarrerApp — les premiers clients de essential', () => {
  const ok = () => Promise.resolve();

  it('remonte un échec de getDb()', async () => {
    // Aujourd'hui, un échec de migration SQLite au démarrage n'a aucun capteur.
    const r = await demarrerApp({
      ouvrirBase: () => Promise.reject(new LocalWriteError('migration failed')),
      initDebug: ok,
      installerFiletGlobal: () => {},
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
      installerFiletGlobal: () => {},
    });

    expect(r.base.ok).toBe(true);
    expect(r.debug.ok).toBe(false);
    expect(ecrites.some((l) => l.event === 'startup.debug.failed')).toBe(true);
  });

  it('un échec de la base n’empêche pas la pose du filet global', async () => {
    const pose = jest.fn();

    await demarrerApp({
      ouvrirBase: () => Promise.reject(new LocalWriteError('x')),
      initDebug: ok,
      installerFiletGlobal: pose,
    });

    expect(pose).toHaveBeenCalledTimes(1);
  });

  it('ne rejette jamais, même si les deux tâches échouent', async () => {
    await expect(
      demarrerApp({
        ouvrirBase: () => Promise.reject(new Error('a')),
        initDebug: () => Promise.reject(new Error('b')),
        installerFiletGlobal: () => {},
      })
    ).resolves.toBeDefined();
  });
});
