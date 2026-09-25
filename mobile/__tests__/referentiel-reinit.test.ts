import { apiClient } from '../src/lib/api-client';
import { getReferentielDb, remplacerReferentiel } from '../src/lib/referentiel-db';
import { reinitialiserReferentiel } from '../src/lib/referentiel-sync';

jest.mock('../src/lib/referentiel-db', () => ({
  getReferentielDb: jest.fn(),
  remplacerReferentiel: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { pullReferentiel: jest.fn() },
}));

const ordre: string[] = [];
const runAsync = jest.fn(async () => {
  ordre.push('ecriture');
});
const db = { runAsync, getAllAsync: jest.fn().mockResolvedValue([]), getFirstAsync: jest.fn() } as never;

function reponseVide() {
  const bloc = { upserts: [], server_time: '2026-09-22T05:12:00Z' };
  return {
    postes_acridiens: bloc,
    stations_fixes: bloc,
    utilisateurs_equipe: bloc,
    pesticides: bloc,
    cultures: bloc,
    codes_stades: bloc,
    campagnes: bloc,
    lieux_aeriens: bloc,
    equipes: bloc,
    equipe_membres: bloc,
    sites_aeriens: bloc,
    aeronefs: bloc,
    equipe_aeronefs: bloc,
  };
}

beforeEach(() => {
  ordre.length = 0;
  jest.clearAllMocks();
  jest.mocked(getReferentielDb).mockResolvedValue(db);
  // Le vrai `remplacerReferentiel` vide puis appelle `remplir` dans une transaction.
  jest.mocked(remplacerReferentiel).mockImplementation(async (remplir) => {
    ordre.push('vidage');
    await remplir(db);
  });
  jest.mocked(apiClient.pullReferentiel).mockImplementation(async () => {
    ordre.push('telechargement');
    return reponseVide() as never;
  });
});

describe('reinitialiserReferentiel', () => {
  it('télécharge avant de vider : un réseau qui tombe ne laisse jamais le cache vide', async () => {
    await reinitialiserReferentiel('token-1');

    expect(ordre.indexOf('telechargement')).toBeLessThan(ordre.indexOf('vidage'));
    expect(ordre.indexOf('vidage')).toBeLessThan(ordre.indexOf('ecriture'));
  });

  it('demande un pull complet : aucun curseur', async () => {
    await reinitialiserReferentiel('token-1');

    const curseurs = jest.mocked(apiClient.pullReferentiel).mock.calls[0][1];
    expect(Object.values(curseurs).every((c) => c === null)).toBe(true);
  });

  it('un échec de téléchargement laisse le cache intact', async () => {
    jest.mocked(apiClient.pullReferentiel).mockRejectedValue(new Error('réseau'));

    await expect(reinitialiserReferentiel('token-1')).rejects.toThrow('réseau');
    expect(remplacerReferentiel).not.toHaveBeenCalled();
  });

  it('la requête coupée par « Annuler » n’est pas un échec', async () => {
    const controleur = new AbortController();
    jest.mocked(apiClient.pullReferentiel).mockImplementation(async () => {
      controleur.abort();
      throw new Error('AbortError');
    });

    await expect(reinitialiserReferentiel('token-1', { signal: controleur.signal })).resolves.toBe('annule');
    expect(remplacerReferentiel).not.toHaveBeenCalled();
  });

  it('transmet le signal à la requête réseau', async () => {
    const controleur = new AbortController();
    await reinitialiserReferentiel('token-1', { signal: controleur.signal });
    expect(jest.mocked(apiClient.pullReferentiel).mock.calls[0][3]).toBe(controleur.signal);
  });

  it('annulé pendant le téléchargement : rien n’est vidé', async () => {
    const controleur = new AbortController();
    jest.mocked(apiClient.pullReferentiel).mockImplementation(async () => {
      controleur.abort();
      return reponseVide() as never;
    });

    const resultat = await reinitialiserReferentiel('token-1', { signal: controleur.signal });

    expect(resultat).toBe('annule');
    expect(remplacerReferentiel).not.toHaveBeenCalled();
  });

  it('compte les entrées écrites pour chaque table terminée', async () => {
    jest.mocked(apiClient.pullReferentiel).mockResolvedValue({
      ...reponseVide(),
      pesticides: { upserts: [{ id: 'a' }, { id: 'b' }, { id: 'c', deleted_at: '2026-09-01' }], server_time: 't' },
    } as never);
    const finis: Record<string, number> = {};

    await reinitialiserReferentiel('token-1', {
      surProgression: (e) => {
        if (e.etat === 'fini') finis[e.table] = e.lignes;
      },
    });

    expect(finis.pesticides).toBe(2);
    expect(finis.cultures).toBe(0);
  });

  it('annonce chaque table : 13 étapes, numérotées de 1 à 13, chacune commencée puis finie', async () => {
    const evenements: { table: string; index: number; total: number; etat: string }[] = [];

    const resultat = await reinitialiserReferentiel('token-1', {
      surProgression: (e) => evenements.push({ ...e }),
    });

    expect(resultat).toBe('termine');
    expect(evenements.filter((e) => e.etat === 'fini').map((e) => e.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(evenements.every((e) => e.total === 13)).toBe(true);
    expect(evenements[0]).toMatchObject({ etat: 'en_cours', index: 1 });
  });
});
