import { AuthError, LocalWriteError, NetworkError } from '../src/lib/errors';
import { conflitSync, versionServeurDe } from '../src/lib/api-client';
import {
  LIBELLE_STATUT_FICHE,
  resumerEnPhrase,
  sortDeLEchec,
  statutFicheDe,
  syncAll,
  type LotSync,
} from '../src/lib/sync-lot';

jest.mock('../src/lib/logger', () => {
  const child = { failure: jest.fn(), event: jest.fn(), ignore: jest.fn() };
  return {
    logger: { child: jest.fn(() => child), failure: jest.fn(), event: jest.fn() },
    classeDe: (error: unknown) =>
      error instanceof Error ? error.constructor.name : '(bug)',
  };
});

/** Erreur telle que la fabrique `api-client` : classe typée + statut joint. */
function erreurHttp(status: number): Error {
  const erreur = status === 401 ? new AuthError('refus') : new NetworkError('refus');
  (erreur as unknown as { status: number }).status = status;
  return erreur;
}

interface Fiche {
  id: string;
  label: string;
}

function lot(overrides: Partial<LotSync<Fiche>> = {}): LotSync<Fiche> {
  return {
    nom: 'prospection',
    syncOne: jest.fn(async () => {}),
    idDe: (fiche) => fiche.id,
    labelDe: (fiche) => fiche.label,
    marquerEchec: jest.fn(async () => {}),
    marquerConflit: jest.fn(async () => {}),
    ...overrides,
  };
}

const fiche = (id: string): Fiche => ({ id, label: `Fiche ${id}` });

describe('sortDeLEchec — la classe et le statut décident du sort de la fiche', () => {
  it('laisse en file une NetworkError de transport (aucun statut HTTP)', () => {
    expect(sortDeLEchec(new NetworkError('serveur injoignable'))).toBe('file');
  });

  it('laisse en file un 5xx — la panne est du côté serveur, elle passera', () => {
    expect(sortDeLEchec(erreurHttp(500))).toBe('file');
    expect(sortDeLEchec(erreurHttp(503))).toBe('file');
  });

  it('sort de la file un 4xx : le serveur refuse, réessayer ne changera rien', () => {
    expect(sortDeLEchec(erreurHttp(400))).toBe('echec');
    expect(sortDeLEchec(erreurHttp(422))).toBe('echec');
  });

  it('laisse en file un 401 — c’est la session qu’il faut refaire, pas la fiche', () => {
    expect(sortDeLEchec(erreurHttp(401))).toBe('file');
    expect(sortDeLEchec(new AuthError('session expirée'))).toBe('file');
  });

  it('laisse en file ce qui n’est ni refus serveur ni panne réseau', () => {
    // Un bug de construction du payload disparaîtra avec le correctif : retirer
    // la fiche de la file la rendrait invisible pour toujours.
    expect(sortDeLEchec(new LocalWriteError('disque plein'))).toBe('file');
    expect(sortDeLEchec(new TypeError('undefined is not an object'))).toBe('file');
  });
});

describe('syncAll — le lot résume, il ne lève pas', () => {
  it('range les fiches passées dans `reussies`, par identifiant', async () => {
    const resume = await syncAll([fiche('a'), fiche('b')], 'token', lot());

    expect(resume.reussies).toEqual(['a', 'b']);
    expect(resume.echouees).toEqual([]);
    expect(resume.conflits).toEqual([]);
  });

  it('ne s’arrête pas à la première fiche en échec', async () => {
    const syncOne = jest.fn(async (f: Fiche) => {
      if (f.id === 'b') throw new NetworkError('coupure');
    });

    const resume = await syncAll([fiche('a'), fiche('b'), fiche('c')], 'token', lot({ syncOne }));

    expect(resume.reussies).toEqual(['a', 'c']);
    expect(resume.echouees).toHaveLength(1);
    expect(syncOne).toHaveBeenCalledTimes(3);
  });

  it('garde la classe et le libellé de chaque échec — l’action par classe s’y applique', async () => {
    const syncOne = jest.fn(async () => {
      throw new NetworkError('coupure');
    });

    const resume = await syncAll([fiche('a')], 'token', lot({ syncOne }));

    expect(resume.echouees[0]).toEqual({
      id: 'a',
      label: 'Fiche a',
      classe: 'NetworkError',
      message: 'Connexion au serveur impossible pour le moment.',
      action: 'reessayer',
      statutHttp: null,
      sort: 'file',
    });
  });

  it('ne laisse jamais le message brut atteindre le résumé', () => {
    // La règle de #172 : « undefined is not an object » reste au journal.
    return syncAll(
      [fiche('a')],
      'token',
      lot({
        syncOne: async () => {
          throw new TypeError('undefined is not an object');
        },
      })
    ).then((resume) => {
      expect(resume.echouees[0].message).not.toContain('undefined');
      expect(resume.echouees[0].action).toBe('signaler-support');
    });
  });

  it('marque `echec` en base la fiche que le serveur refuse, et elle seule', async () => {
    const marquerEchec = jest.fn(async () => {});
    const syncOne = jest.fn(async (f: Fiche) => {
      throw f.id === 'a' ? erreurHttp(422) : new NetworkError('coupure');
    });

    const resume = await syncAll([fiche('a'), fiche('b')], 'token', lot({ syncOne, marquerEchec }));

    expect(marquerEchec).toHaveBeenCalledTimes(1);
    expect(marquerEchec).toHaveBeenCalledWith('a');
    expect(resume.echouees.map((e) => e.sort)).toEqual(['echec', 'file']);
  });

  it('conserve la version serveur d’un conflit au lieu de l’aplatir', async () => {
    const versionServeur = { updated_at: '2026-08-20T10:00:00Z', statut: 'valide' };
    const marquerConflit = jest.fn(async () => {});
    const syncOne = jest.fn(async () => {
      throw conflitSync('fiche déjà validée sur le serveur', versionServeur);
    });

    const resume = await syncAll([fiche('a')], 'token', lot({ syncOne, marquerConflit }));

    expect(resume.conflits).toEqual([
      { id: 'a', label: 'Fiche a', serverVersion: versionServeur },
    ]);
    expect(resume.echouees).toEqual([]);
    expect(marquerConflit).toHaveBeenCalledWith('a', versionServeur);
  });

  it('traite un conflit comme un échec quand le lot ne sait pas le persister', async () => {
    // La prospection n’a pas d’écriture de conflit : mieux vaut un échec visible
    // qu’un conflit silencieusement rangé nulle part.
    const syncOne = jest.fn(async () => {
      throw conflitSync('déjà validée', { updated_at: 'x' });
    });

    const resume = await syncAll(
      [fiche('a')],
      'token',
      lot({ syncOne, marquerConflit: undefined })
    );

    expect(resume.conflits).toEqual([]);
    expect(resume.echouees[0].sort).toBe('echec');
  });

  it('n’avale pas l’échec de l’écriture du statut : la fiche reste dans le résumé', async () => {
    const syncOne = jest.fn(async () => {
      throw erreurHttp(422);
    });
    const marquerEchec = jest.fn(async () => {
      throw new LocalWriteError('base verrouillée');
    });

    const resume = await syncAll([fiche('a')], 'token', lot({ syncOne, marquerEchec }));

    expect(resume.echouees).toHaveLength(1);
    expect(resume.echouees[0].id).toBe('a');
  });

  it('rend un résumé vide sur un lot vide, sans toucher au réseau', async () => {
    const syncOne = jest.fn(async () => {});

    const resume = await syncAll([], 'token', lot({ syncOne }));

    expect(resume).toEqual({ reussies: [], echouees: [], conflits: [] });
    expect(syncOne).not.toHaveBeenCalled();
  });
});

describe('statutFicheDe — le badge se lit en base, il survit au départ de l’écran', () => {
  it('traduit les quatre valeurs de statut_sync', () => {
    expect(statutFicheDe('synced')).toBe('synchronisee');
    expect(statutFicheDe('echec')).toBe('echec');
    expect(statutFicheDe('conflict')).toBe('conflit');
    expect(statutFicheDe('local')).toBe('en-attente');
  });

  it('range en attente toute valeur inconnue plutôt que de masquer la fiche', () => {
    expect(statutFicheDe('valeur-d-une-version-future')).toBe('en-attente');
    expect(statutFicheDe('')).toBe('en-attente');
  });

  it('donne un libellé à chaque statut — l’écran ne les réécrit pas', () => {
    expect(Object.keys(LIBELLE_STATUT_FICHE).sort()).toEqual([
      'conflit',
      'echec',
      'en-attente',
      'synchronisee',
    ]);
  });
});

describe('resumerEnPhrase — un résultat partiel est un état, pas une alerte', () => {
  const vide = { reussies: [], echouees: [], conflits: [] };

  it('dit le tout-va-bien sans compter les zéros', () => {
    expect(resumerEnPhrase({ ...vide, reussies: ['a', 'b'] })).toBe('2 fiches synchronisées');
    expect(resumerEnPhrase({ ...vide, reussies: ['a'] })).toBe('1 fiche synchronisée');
  });

  it('sépare ce qui repartira tout seul de ce qui demande une action', () => {
    const phrase = resumerEnPhrase({
      reussies: ['a'],
      echouees: [
        {
          id: 'b',
          label: 'B',
          classe: 'NetworkError',
          message: 'coupure',
          action: 'reessayer' as const,
          statutHttp: null,
          sort: 'file' as const,
        },
        {
          id: 'c',
          label: 'C',
          classe: 'NetworkError',
          message: 'refus',
          action: 'reessayer' as const,
          statutHttp: 422,
          sort: 'echec' as const,
        },
      ],
      conflits: [{ id: 'd', label: 'D', serverVersion: {} }],
    });

    expect(phrase).toContain('1 synchronisée');
    expect(phrase).toContain('1 à réessayer');
    expect(phrase).toContain('1 en échec');
    expect(phrase).toContain('1 en conflit');
  });

  it('dit l’absence de travail plutôt que de rendre une phrase vide', () => {
    expect(resumerEnPhrase(vide)).toBe('Aucune fiche à synchroniser');
  });
});

describe('conflitSync — le conflit voyage sans huitième classe', () => {
  it('est une NetworkError portant le statut 409 et la version serveur', () => {
    const versionServeur = { updated_at: '2026-08-20T10:00:00Z' };
    const erreur = conflitSync('déjà validée', versionServeur);

    expect(erreur).toBeInstanceOf(NetworkError);
    expect((erreur as unknown as { status: number }).status).toBe(409);
    expect(versionServeurDe(erreur)).toBe(versionServeur);
  });

  it('rend `null` pour une erreur qui ne porte pas de version serveur', () => {
    expect(versionServeurDe(new NetworkError('coupure'))).toBeNull();
    expect(versionServeurDe(null)).toBeNull();
  });
});
