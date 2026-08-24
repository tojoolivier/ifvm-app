/**
 * `error-store` — ADR-012 décision 5, issue #172.
 *
 * L'ancien store gardait `current: GlobalError | null` et **écrasait en
 * silence** : le dispositif chargé de rendre les erreurs visibles en avalait
 * une sur deux. Trois décisions le remplacent, et ces tests les protègent :
 *
 * 1. **Dédoublonnage par classe** — 5 échecs réseau font une bannière, pas cinq,
 *    et surtout pas une seule des cinq avec quatre disparues.
 * 2. **La plus grave gagne** — BLOQUER passe devant INFORMER, quelle que soit
 *    l'ordre d'arrivée.
 * 3. **Rien ne disparaît** — les autres restent comptées (« +N autres › ») et
 *    accessibles depuis le journal.
 */
import { NetworkError, AuthError, LocalReadError } from '@/lib/errors';
import { useErrorStore, autresNonAffichees, laPlusGrave } from '@/lib/error-store';

function signaler(error: unknown, frontiere: 'useAsyncAction' | 'global' = 'useAsyncAction') {
  useErrorStore.getState().signaler(error, frontiere);
}

beforeEach(() => useErrorStore.getState().dismissAll());

describe('dédoublonnage par classe', () => {
  it('cinq échecs réseau ne font qu’une entrée, comptée cinq fois', () => {
    for (let i = 0; i < 5; i += 1) signaler(new NetworkError('boom'));

    const { erreurs } = useErrorStore.getState();
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toMatchObject({ classe: 'NetworkError', occurrences: 5 });
  });

  it('deux classes différentes coexistent — aucune n’écrase l’autre', () => {
    signaler(new NetworkError('boom'));
    signaler(new LocalReadError('no such column'));

    expect(useErrorStore.getState().erreurs.map((e) => e.classe).sort()).toEqual([
      'LocalReadError',
      'NetworkError',
    ]);
  });

  it('un signalement sans reprise efface celle du geste précédent', () => {
    const premier = jest.fn();
    useErrorStore.getState().signaler(new NetworkError('a'), 'useAsyncAction', premier);
    useErrorStore.getState().signaler(new NetworkError('b'), 'useAsyncAction');

    // Garder l'ancien `retry` offrirait un « Réessayer » qui rejoue autre chose
    // que ce que l'agent vient de tenter.
    expect(useErrorStore.getState().erreurs[0].retry).toBeUndefined();
  });

  it('le dernier signalement d’une classe remplace son action de reprise', () => {
    const premier = jest.fn();
    const dernier = jest.fn();
    useErrorStore.getState().signaler(new NetworkError('a'), 'useAsyncAction', premier);
    useErrorStore.getState().signaler(new NetworkError('b'), 'useAsyncAction', dernier);

    useErrorStore.getState().erreurs[0].retry?.();
    expect(premier).not.toHaveBeenCalled();
    expect(dernier).toHaveBeenCalledTimes(1);
  });
});

describe('la plus grave gagne', () => {
  it('BLOQUER passe devant INFORMER même arrivé en premier', () => {
    signaler(new AuthError('401')); // BLOQUER à useAsyncAction
    signaler(new NetworkError('boom')); // INFORMER

    expect(laPlusGrave(useErrorStore.getState().erreurs)).toMatchObject({
      classe: 'AuthError',
      traitement: 'BLOQUER',
    });
  });

  it('à traitement égal, la plus récente gagne', () => {
    signaler(new NetworkError('boom'));
    signaler(new LocalReadError('no such column'));

    expect(laPlusGrave(useErrorStore.getState().erreurs)?.classe).toBe('LocalReadError');
  });

  it('sans erreur, il n’y a pas de plus grave', () => {
    expect(laPlusGrave([])).toBeNull();
  });
});

describe('« +N autres › » — rien ne disparaît en silence', () => {
  it('compte les classes restantes, pas les occurrences', () => {
    signaler(new NetworkError('a'));
    signaler(new NetworkError('b'));
    signaler(new LocalReadError('c'));
    signaler(new AuthError('d'));

    const { erreurs } = useErrorStore.getState();
    const montree = laPlusGrave(erreurs.filter((e) => e.traitement === 'INFORMER'));
    expect(autresNonAffichees(erreurs, [montree])).toBe(2);
  });

  it('vaut zéro quand une seule classe est en jeu', () => {
    signaler(new NetworkError('a'));
    const { erreurs } = useErrorStore.getState();
    expect(autresNonAffichees(erreurs, [erreurs[0]])).toBe(0);
  });

  it('n’oublie pas les BLOQUER en attente — compter sur une liste déjà filtrée les perdait', () => {
    signaler(new NetworkError('a')); // INFORMER, montré par la bannière
    signaler(new AuthError('b')); // BLOQUER, en attente
    const { erreurs } = useErrorStore.getState();
    const montree = laPlusGrave(erreurs.filter((e) => e.traitement === 'INFORMER'));

    expect(autresNonAffichees(erreurs, [montree])).toBe(1);
  });

  it('ne compte pas deux fois ce que les deux surfaces montrent déjà', () => {
    signaler(new NetworkError('a'));
    signaler(new AuthError('b'));
    const { erreurs } = useErrorStore.getState();
    const informante = laPlusGrave(erreurs.filter((e) => e.traitement === 'INFORMER'));
    const bloquante = laPlusGrave(erreurs.filter((e) => e.traitement === 'BLOQUER'));

    expect(autresNonAffichees(erreurs, [informante, bloquante])).toBe(0);
  });
});

describe('renvoi et fermeture', () => {
  it('signaler renvoie le traitement, pour que la frontière sache quoi montrer', () => {
    expect(useErrorStore.getState().signaler(new NetworkError('a'), 'useAsyncAction')).toBe(
      'INFORMER'
    );
    expect(useErrorStore.getState().signaler(new Error('bug'), 'global')).toBe('BLOQUER');
  });

  it('une erreur JOURNAL n’entre jamais dans le store — elle ne s’affiche pas', () => {
    useErrorStore.getState().signaler(new NetworkError('a'), 'runTask:best-effort');
    expect(useErrorStore.getState().erreurs).toHaveLength(0);
  });

  it('dismiss ne ferme que la classe visée', () => {
    signaler(new NetworkError('a'));
    signaler(new LocalReadError('b'));

    useErrorStore.getState().dismiss('NetworkError');

    expect(useErrorStore.getState().erreurs.map((e) => e.classe)).toEqual(['LocalReadError']);
  });

  it('un nouveau signalement après fermeture repart de un', () => {
    signaler(new NetworkError('a'));
    signaler(new NetworkError('b'));
    useErrorStore.getState().dismiss('NetworkError');
    signaler(new NetworkError('c'));

    expect(useErrorStore.getState().erreurs[0].occurrences).toBe(1);
  });
});

describe('le message affiché ne vient jamais du site d’appel', () => {
  it('porte le message et l’action de la classe', () => {
    signaler(new AuthError('HTTP 401 Unauthorized'));

    expect(useErrorStore.getState().erreurs[0]).toMatchObject({
      action: 'se-reconnecter',
      detail: 'HTTP 401 Unauthorized',
    });
    expect(useErrorStore.getState().erreurs[0].message).not.toContain('401 Unauthorized');
  });
});
