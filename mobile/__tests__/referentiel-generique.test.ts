import { REFERENTIEL_TABLES } from '../src/lib/referentiel-schema.generated';
import {
  CONFIGS_GENERIQUES,
  compterGenerique,
  formaterValeur,
  getLigneGenerique,
  listerGenerique,
  rechercherPartout,
} from '../src/lib/referentiel-generique';

const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();

jest.mock('../src/lib/referentiel-db', () => ({
  getReferentielDb: async () => ({
    getAllAsync: (...args: unknown[]) => getAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => getFirstAsync(...args),
  }),
}));

beforeEach(() => {
  getAllAsync.mockReset().mockResolvedValue([]);
  getFirstAsync.mockReset().mockResolvedValue(null);
});

const TROIS_DEDIEES = ['pesticide', 'station_fixe', 'code_stade'];
const FILTRE = { recherche: '', statut: 'tous' } as const;

describe('formaterValeur', () => {
  it.each([
    ['date', '2025-09-01', '01/09/2025'],
    ['date', null, '—'],
    ['role', 'chef_de_base', 'Chef de base'],
    ['role', 'consultant_international', 'Consultant international'],
    ['type_equipe', 'aerien', 'Aérienne'],
    ['type_equipe', 'terrestre', 'Terrestre'],
    ['litres', 500, '500 L'],
    ['metres', 712, '712 m'],
    ['nombre', 4, '4'],
    [undefined, 'Isoanala', 'Isoanala'],
    [undefined, null, '—'],
  ] as const)('%s : %s → %s', (format, valeur, attendu) => {
    expect(formaterValeur(valeur, format)).toBe(attendu);
  });

  it('une valeur absente peut porter son propre texte', () => {
    expect(formaterValeur(null, 'date', 'En cours')).toBe('En cours');
  });

  it('un rôle inconnu reste lisible', () => {
    expect(formaterValeur('agent_special', 'role')).toBe('Agent special');
  });
});

describe('configuration', () => {
  it('couvre les dix tables sans écran dédié, et elles seules', () => {
    const attendues = REFERENTIEL_TABLES.filter((t) => !TROIS_DEDIEES.includes(t)).sort();
    expect(Object.keys(CONFIGS_GENERIQUES).sort()).toEqual(attendues);
  });
});

describe('listerGenerique', () => {
  it('lit la table demandée, triée, sans filtre ni paramètre', async () => {
    await listerGenerique('culture', FILTRE);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM culture t');
    expect(sql).toContain('ORDER BY');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([]);
  });

  it('refuse une table qui n’est pas au catalogue (le nom finit dans du SQL)', async () => {
    await expect(listerGenerique('culture; DROP TABLE pesticide', FILTRE)).rejects.toThrow('inconnue');
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('la recherche est échappée et couvre toutes les colonnes de recherche', async () => {
    await listerGenerique('culture', { ...FILTRE, recherche: '50%' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(params.every((p: string) => p === '%50\\%%')).toBe(true);
    expect(params.length).toBe(CONFIGS_GENERIQUES.culture.recherche.length);
  });

  it('le statut filtre les tables qui ont un actif', async () => {
    await listerGenerique('culture', { ...FILTRE, statut: 'actifs' });
    expect(getAllAsync.mock.calls[0][0]).toContain('t.actif = 1');
    await listerGenerique('culture', { ...FILTRE, statut: 'inactifs' });
    expect(getAllAsync.mock.calls[1][0]).toContain('t.actif = 0');
  });

  it('le statut est ignoré pour une table sans actif (membres, affectations)', async () => {
    await listerGenerique('equipe_membre', { ...FILTRE, statut: 'actifs' });
    // Seul l'alias `NULL AS actif` reste : aucune condition sur le statut.
    expect(getAllAsync.mock.calls[0][0]).not.toMatch(/actif = /);
    expect(getAllAsync.mock.calls[0][0]).not.toContain('FROM equipe_membre t WHERE');
  });

  it('range les colonnes brutes en lignes prêtes à afficher', async () => {
    getAllAsync.mockResolvedValue([
      { cle: 'a1', titre: 'F-ZAA', code: null, sous_titre: 'Cessna', actif: 1, maj: '2026-09-20T05:12:00.000Z' },
      { cle: 'a2', titre: 'F-ZBB', code: null, sous_titre: null, actif: 0, maj: null },
    ]);

    const lignes = await listerGenerique('aeronef', FILTRE);

    expect(lignes[0]).toMatchObject({ cle: 'a1', titre: 'F-ZAA', sousTitre: 'Cessna', actif: true });
    expect(lignes[1]).toMatchObject({ actif: false, sousTitre: null });
  });

  it('une table sans actif rend actif = null (pas de badge)', async () => {
    getAllAsync.mockResolvedValue([{ cle: 'e|u', titre: 'Jean Rakoto', code: null, sous_titre: 'Pilote', actif: null, maj: null }]);
    const [ligne] = await listerGenerique('equipe_membre', FILTRE);
    expect(ligne.actif).toBeNull();
  });
});

describe('getLigneGenerique', () => {
  it('rend les champs de la fiche, formatés, avec leur libellé', async () => {
    getFirstAsync.mockResolvedValue({
      cle: 'a1',
      titre: 'F-ZAA',
      code: null,
      sous_titre: 'Cessna',
      actif: 1,
      maj: '2026-09-20T05:12:00.000Z',
      c0: 'F-ZAA',
      c1: 'Cessna',
      c2: 500,
    });

    const ligne = await getLigneGenerique('aeronef', 'a1');

    expect(ligne?.champs).toEqual([
      { libelle: 'Immatriculation', valeur: 'F-ZAA' },
      { libelle: 'Société', valeur: 'Cessna' },
      { libelle: 'Volume de cuve', valeur: '500 L' },
    ]);
    expect(getFirstAsync.mock.calls[0][1]).toEqual(['a1']);
  });

  it('une fiche disparue du cache rend null', async () => {
    expect(await getLigneGenerique('culture', 'inconnue')).toBeNull();
  });

  it('la fin d’une campagne ouverte s’écrit « En cours »', async () => {
    getFirstAsync.mockResolvedValue({ cle: 'c', titre: '2026', code: null, sous_titre: null, actif: 1, maj: null, c0: '2026', c1: '2025-09-01', c2: null });
    const ligne = await getLigneGenerique('campagne', 'c');
    expect(ligne?.champs.at(-1)).toEqual({ libelle: 'Fin', valeur: 'En cours' });
  });
});

describe('compterGenerique', () => {
  it('compte actifs et inactifs, et date la table', async () => {
    getAllAsync.mockResolvedValue([
      { actif: 1, n: 5, maj: '2026-09-20T05:12:00.000Z' },
      { actif: 0, n: 2, maj: '2026-09-22T05:12:00.000Z' },
    ]);
    expect(await compterGenerique('culture')).toEqual({ tous: 7, actifs: 5, inactifs: 2, majLe: '2026-09-22T05:12:00.000Z' });
  });

  it('une table sans actif compte ses lignes en bloc', async () => {
    getFirstAsync.mockResolvedValue({ n: 61 });
    expect(await compterGenerique('equipe_membre')).toEqual({ tous: 61, actifs: 61, inactifs: 0, majLe: null });
  });
});

describe('rechercherPartout', () => {
  it('ne cherche pas en dessous de deux caractères', async () => {
    expect(await rechercherPartout('a')).toEqual([]);
    expect(await rechercherPartout('  ')).toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('interroge les 13 tables, avec une limite, et échappe les jokers', async () => {
    await rechercherPartout('50%');

    expect(getAllAsync).toHaveBeenCalledTimes(13);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('LIMIT');
    expect(sql).toContain("ESCAPE '\\'");
    expect(params[0]).toBe('%50\\%%');
  });

  it('ne rend que les tables qui ont des résultats, rangées comme l’accueil', async () => {
    getAllAsync.mockImplementation(async (sql: string) =>
      sql.includes('FROM culture t') || sql.includes('FROM pesticide t')
        ? [{ cle: 'x1', titre: 'Maïs', code: 'CUL-01', sous_titre: null, actif: 1, maj: null }]
        : []
    );

    const groupes = await rechercherPartout('ma');

    expect(groupes.map((g) => g.table)).toEqual(['pesticide', 'culture']);
    expect(groupes[1].lignes[0]).toMatchObject({ cle: 'x1', titre: 'Maïs', code: 'CUL-01' });
  });

  it('les trois tables à écran dédié sont cherchées aussi (pesticide, station, code stade)', async () => {
    await rechercherPartout('ih');
    const requetes = getAllAsync.mock.calls.map((c) => c[0] as string).join('\n');
    expect(requetes).toContain('FROM pesticide t');
    expect(requetes).toContain('FROM station_fixe t');
    expect(requetes).toContain('FROM code_stade t');
  });
});
