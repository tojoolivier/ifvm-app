import {
  aujourdhuiIso,
  listAeronefsEquipe,
  listEquipesAvecChef,
  listMembresEquipe,
  listSitesEquipe,
} from '../src/lib/equipe-db';
import { getReferentielDb } from '../src/lib/referentiel-db';

jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));

const getAllAsync = jest.fn();
const db = { getAllAsync } as unknown as Awaited<ReturnType<typeof getReferentielDb>>;

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getReferentielDb).mockResolvedValue(db);
  getAllAsync.mockResolvedValue([]);
});

describe('listEquipesAvecChef', () => {
  it('liste les équipes actives avec leur chef et leur effectif', async () => {
    const lignes = [
      { id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4, chef_nom: 'Rakoto', chef_prenom: 'Jean' },
    ];
    getAllAsync.mockResolvedValueOnce(lignes);

    expect(await listEquipesAvecChef()).toEqual(lignes);
    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM equipe');
    expect(sql).toContain('actif = 1');
    expect(sql).toContain("fonction = 'chef'");
  });
});

describe('listMembresEquipe', () => {
  it('rend les membres de l’équipe, chef en tête', async () => {
    await listMembresEquipe('eq-1');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM equipe_membre');
    expect(sql).toMatch(/ORDER BY[\s\S]*chef/);
    expect(params).toEqual(['eq-1']);
  });
});

describe('listSitesEquipe', () => {
  it('rend les sites portés par l’équipe et les secondaires rattachés à ses sites principaux', async () => {
    await listSitesEquipe('eq-1');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM site_aerien');
    expect(sql).toContain('parent_site_id');
    expect(sql).toContain('actif = 1');
    expect(params).toEqual(['eq-1', 'eq-1']);
  });
});

describe('listAeronefsEquipe', () => {
  it('rend les aéronefs dont l’affectation couvre la date donnée', async () => {
    await listAeronefsEquipe('eq-1', '2026-09-24');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM equipe_aeronef');
    expect(sql).toContain('date_debut <= ?');
    expect(sql).toContain('date_fin IS NULL OR');
    expect(params).toEqual(['eq-1', '2026-09-24', '2026-09-24']);
  });
});

describe('aujourdhui', () => {
  it('formate la date du jour au format ISO (AAAA-MM-JJ)', () => {
    expect(aujourdhuiIso(new Date('2026-09-24T10:00:00Z'))).toBe('2026-09-24');
  });
});
