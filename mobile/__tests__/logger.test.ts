import {
  logger,
  configureLogger,
  resetLoggerForTests,
  lignesEnAttente,
  flush,
  estLeJournalCasse,
  traitementDe,
  classeDe,
  type LogLine,
  type Frontiere,
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

function transportQuiMarche() {
  return { write: (lignes: readonly LogLine[]) => { ecrites.push(...lignes); } };
}

beforeEach(() => {
  ecrites.length = 0;
  resetLoggerForTests();
});

describe('la matrice f(classe, frontière) — ADR-012 décision 3', () => {
  const CAS: [unknown, Frontiere, string][] = [
    [new NetworkError('x'), 'useAsyncAction', 'INFORMER'],
    [new AuthError('x'), 'useAsyncAction', 'BLOQUER'],
    [new LocalReadError('x'), 'useAsyncAction', 'INFORMER'],
    [new LocalWriteError('x'), 'useAsyncAction', 'BLOQUER'],
    [new ReferentialError('x'), 'useAsyncAction', 'INFORMER'],
    [new PermissionError('x'), 'useAsyncAction', 'INFORMER'],
    [new PreconditionError('x'), 'useAsyncAction', 'INFORMER'],
    [new Error('bug'), 'useAsyncAction', 'INFORMER'],
    [new Error('bug'), 'errorBoundary', 'BLOQUER'],
    [new Error('bug'), 'global', 'BLOQUER'],
  ];

  it.each(CAS)('%p à la frontière %s → %s', (error, frontiere, attendu) => {
    expect(traitementDe(error, frontiere)).toBe(attendu);
  });

  it('les deux seuls BLOQUER à l’écran sont AuthError et LocalWriteError', () => {
    const bloquants = CAS.filter(
      ([, f, t]) => f === 'useAsyncAction' && t === 'BLOQUER'
    ).map(([e]) => classeDe(e));

    expect(bloquants.sort()).toEqual(['AuthError', 'LocalWriteError']);
  });

  it('les colonnes de fond sont plates : la criticité écrase la classe', () => {
    // Au fond, c'est la criticité de la TÂCHE qui décide, pas la nature de
    // l'erreur — sans quoi il faudrait dupliquer les classes par contexte.
    for (const [error] of CAS) {
      expect(traitementDe(error, 'runTask:best-effort')).toBe('JOURNAL');
      expect(traitementDe(error, 'runTask:essential')).toBe('INFORMER');
    }
  });

  it('le même NetworkError se traite différemment selon la frontière', () => {
    // La preuve que croiser classe et frontière évite d'inventer deux classes.
    const net = new NetworkError('Connexion impossible.');

    expect(traitementDe(net, 'runTask:best-effort')).toBe('JOURNAL');
    expect(traitementDe(net, 'useAsyncAction')).toBe('INFORMER');
  });
});

describe('classeDe — non typée = bug, par définition', () => {
  it('nomme une classe du jeu fermé', () => {
    expect(classeDe(new LocalWriteError('x'))).toBe('LocalWriteError');
  });

  it.each([new Error('x'), 'chaîne', null, undefined, 42])('classe %p en (bug)', (v) => {
    expect(classeDe(v)).toBe('(bug)');
  });
});

describe('l’API — le développeur ne choisit jamais le niveau', () => {
  it('event et detail portent leur niveau, pas celui du développeur', () => {
    logger.event('migration.column.adding', { column: 'region' });
    logger.detail('camera.permission.checked', { status: 'granted' });

    const [a, b] = lignesEnAttente();
    expect(a.level).toBe('info');
    expect(a.event).toBe('migration.column.adding');
    expect(a.column).toBe('region');
    expect(b.level).toBe('debug');
  });

  it('failure nomme l’événement ET conserve la classe et le traitement', () => {
    // Le nom de l'événement est ce qui rend le journal greppable — le perdre
    // serait une régression par rapport au console.error qu'on remplace.
    const log = logger.child({ module: 'prospection-db' }, 'runTask:essential');
    const traitement = log.failure(
      'migration.column.failed',
      new LocalWriteError('table is locked'),
      { column: 'region' }
    );

    const ligne = lignesEnAttente()[0] ?? ecrites[0];
    expect(traitement).toBe('INFORMER');
    expect(ligne.event).toBe('migration.column.failed');
    expect(ligne.classe).toBe('LocalWriteError');
    expect(ligne.traitement).toBe('INFORMER');
    expect(ligne.module).toBe('prospection-db');
    expect(ligne.column).toBe('region');
    expect(ligne.err?.message).toBe('table is locked');
  });

  it('ignore écrit la raison DANS la ligne de journal', () => {
    // Pas seulement en commentaire : le support doit savoir que le silence
    // était prévu.
    configureLogger({ transport: transportQuiMarche() });
    logger.child({ module: 'auth-store' }).ignore(
      new LocalWriteError('SecureStore unavailable'),
      'nettoyage best-effort du token'
    );

    const ligne = ecrites[0];
    expect(ligne.event).toBe('ignored');
    expect(ligne.raison).toBe('nettoyage best-effort du token');
    expect(ligne.level).toBe('debug');
  });

  it('child fige le contexte et peut redéfinir la frontière', () => {
    configureLogger({ transport: transportQuiMarche() });
    const base = logger.child({ module: 'api-client' });
    const ecran = base.child({ screen: 'sync' }, 'useAsyncAction');

    base.failure('http.failed', new AuthError('401'));
    ecran.failure('http.failed', new AuthError('401'));

    expect(ecrites[0].traitement).toBe('JOURNAL');   // runTask:best-effort
    expect(ecrites[0].screen).toBeUndefined();
    expect(ecrites[1].traitement).toBe('BLOQUER');   // useAsyncAction
    expect(ecrites[1].screen).toBe('sync');
  });
});

describe('flush asymétrique — ADR-012 décision 4', () => {
  beforeEach(() => configureLogger({ transport: transportQuiMarche() }));

  it('met event et detail en tampon sans écrire', () => {
    logger.event('a');
    logger.detail('b');

    expect(ecrites).toHaveLength(0);
    expect(lignesEnAttente()).toHaveLength(2);
  });

  it('vide TOUT le tampon sur un failure, contexte compris', () => {
    // Vider tout le tampon persiste le contexte QUI PRÉCÈDE l'échec, souvent
    // plus utile que l'échec lui-même.
    logger.detail('http.request', { url: '/prospections' });
    logger.event('http.response', { status: 500 });
    logger.failure('sync.failed', new NetworkError('boom'));

    expect(ecrites.map((l) => l.event)).toEqual([
      'http.request',
      'http.response',
      'sync.failed',
    ]);
    expect(lignesEnAttente()).toHaveLength(0);
  });

  it('vide aussi sur ignore', () => {
    logger.event('a');
    logger.ignore(new Error('x'), 'raison');

    expect(ecrites).toHaveLength(2);
  });

  it('vide quand l’anneau est plein', () => {
    configureLogger({ tailleAnneau: 3 });
    logger.event('a');
    logger.event('b');
    expect(ecrites).toHaveLength(0);

    logger.event('c');
    expect(ecrites).toHaveLength(3);
  });
});

describe('le logger ne peut pas se journaliser lui-même', () => {
  it('lève un drapeau mémoire au lieu d’un log quand le flush échoue', async () => {
    // Un logger qui journaliserait ses propres échecs d'écriture via lui-même
    // partirait en récursion infinie sur un appareil déjà en difficulté.
    configureLogger({
      transport: {
        write: () => {
          throw new Error('SQLITE_FULL');
        },
      },
    });

    expect(estLeJournalCasse()).toBe(false);
    logger.failure('x', new NetworkError('y'));
    await flush();

    expect(estLeJournalCasse()).toBe(true);
  });

  it('sans transport, garde les lignes en mémoire sans rien perdre', async () => {
    logger.event('avant-init');
    await flush();

    expect(lignesEnAttente()).toHaveLength(1);
    expect(estLeJournalCasse()).toBe(false);
  });
});

describe('l’expurgation s’applique à toute ligne, sans exception', () => {
  it('masque un jeton passé en contexte', () => {
    configureLogger({ transport: transportQuiMarche() });
    logger.failure('auth.failed', new AuthError('401'), {
      body: { access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SIG' },
    });

    const rendu = JSON.stringify(ecrites[0]);
    expect(rendu).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(rendu).toContain('[redacted:');
  });

  it('chaque ligne porte un horodatage et le correlationId de la session', () => {
    configureLogger({ transport: transportQuiMarche() });
    logger.failure('a', new NetworkError('x'));
    logger.failure('b', new NetworkError('y'));

    expect(ecrites[0].cid).toBe(ecrites[1].cid);
    expect(ecrites[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
