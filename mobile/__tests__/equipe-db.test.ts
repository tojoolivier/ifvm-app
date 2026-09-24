import {
  aujourdhuiIso,
  chargerListeEquipes,
  chargerResumeEquipe,
  listAeronefsActifs,
  listAnnuaire,
  listChefsDAutresEquipes,
  listAeronefsEquipe,
  listAffectationsEquipe,
  listParcAeronefs,
  listEquipesAvecChef,
  listMembresEquipe,
  listSitesEquipe,
} from '../src/lib/equipe-db';
import { derniereInterventionEquipe } from '../src/lib/prospection-repository';
import { getReferentielDb } from '../src/lib/referentiel-db';

jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));
jest.mock('../src/lib/prospection-repository', () => ({ derniereInterventionEquipe: jest.fn() }));

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
    expect(aujourdhuiIso(new Date(2026, 8, 24, 10, 0))).toBe('2026-09-24');
  });

  it('donne le jour du calendrier LOCAL, pas celui d’UTC (Madagascar : UTC+3)', () => {
    // 01h00 locale : en UTC (ou UTC+3 → 22h la veille) `toISOString()` rendrait le mauvais jour.
    expect(aujourdhuiIso(new Date(2026, 8, 24, 1, 0))).toBe('2026-09-24');
    expect(aujourdhuiIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24');
  });
});

describe('chargerResumeEquipe', () => {
  const SITES = [
    { id: 's1', parent_site_id: null, numero: 'n°03', localite: 'Isoanala', date_debut_position: '2026-09-12' },
    { id: 's2', parent_site_id: 's1', numero: 'n°01', localite: 'Isoanala', date_debut_position: null },
  ];

  it('équipe aérienne : site principal, sites secondaires et aéronef en service', async () => {
    getAllAsync
      .mockResolvedValueOnce(SITES)
      .mockResolvedValueOnce([{ id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188' }]);

    const resume = await chargerResumeEquipe({ id: 'eq-1', type: 'aerien' }, '2026-09-24');

    expect(resume).toEqual({
      sitePrincipal: SITES[0],
      sitesSecondaires: [SITES[1]],
      aeronef: { id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188' },
      derniereIntervention: null,
    });
    expect(derniereInterventionEquipe).not.toHaveBeenCalled();
  });

  it('équipe terrestre : dernière intervention rattachée, sans site ni aéronef', async () => {
    jest.mocked(derniereInterventionEquipe).mockResolvedValue('2026-09-20');

    const resume = await chargerResumeEquipe({ id: 'eq-3', type: 'terrestre' }, '2026-09-24');

    expect(resume).toEqual({
      sitePrincipal: null,
      sitesSecondaires: [],
      aeronef: null,
      derniereIntervention: '2026-09-20',
    });
    expect(getAllAsync).not.toHaveBeenCalled();
  });
});

describe('chargerListeEquipes', () => {
  it('joint à chaque équipe son résumé (position) pour l’écran Équipes', async () => {
    getAllAsync
      .mockResolvedValueOnce([
        { id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', nb_membres: 4, chef_nom: 'Rakoto', chef_prenom: 'Jean' },
        { id: 'eq-3', nom: 'EMT Toliara', type: 'terrestre', nb_membres: 5, chef_nom: 'Rabe', chef_prenom: 'Sophie' },
      ])
      .mockResolvedValueOnce([]) // sites eq-1
      .mockResolvedValueOnce([]); // aéronefs eq-1
    jest.mocked(derniereInterventionEquipe).mockResolvedValue('2026-09-20');

    const liste = await chargerListeEquipes('2026-09-24');

    expect(liste.map((e) => e.equipe.nom)).toEqual(['Équipe Sud', 'EMT Toliara']);
    expect(liste[1].resume.derniereIntervention).toBe('2026-09-20');
  });
});

describe('listAeronefsActifs', () => {
  it('liste les aéronefs actifs par immatriculation', async () => {
    await listAeronefsActifs();
    const [sql] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM aeronef');
    expect(sql).toContain('actif = 1');
  });
});

describe('listAnnuaire', () => {
  it('cherche par nom ou prénom parmi les utilisateurs actifs', async () => {
    await listAnnuaire('rak');
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM utilisateur_equipe');
    expect(sql).toContain('LIKE');
    expect(params).toEqual(['%rak%', '%rak%']);
  });

  it('filtre en plus par rôles quand on en donne', async () => {
    await listAnnuaire('', ['chef_de_base']);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('role IN (?)');
    expect(params).toEqual(['%%', '%%', 'chef_de_base']);
  });
});

describe('listChefsDAutresEquipes', () => {
  it('rend les utilisateurs déjà chefs d’une autre équipe', async () => {
    getAllAsync.mockResolvedValueOnce([{ user_id: 'u-2' }, { user_id: 'u-5' }]);

    expect(await listChefsDAutresEquipes('eq-1')).toEqual(new Set(['u-2', 'u-5']));
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("fonction = 'chef'");
    expect(sql).toContain('equipe_id <> ?');
    expect(params).toEqual(['eq-1']);
  });
});

describe('listParcAeronefs', () => {
  it('rend chaque aéronef actif avec l’équipe à laquelle il est affecté à la date donnée', async () => {
    await listParcAeronefs('2026-09-24');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM aeronef');
    expect(sql).toContain('LEFT JOIN equipe_aeronef');
    expect(sql).toContain('actif = 1');
    expect(sql).toContain('date_fin IS NULL OR');
    expect(sql).toContain('date_fin > ?');
    expect(params).toEqual(['2026-09-24', '2026-09-24']);
  });
});

describe('listAffectationsEquipe', () => {
  it('rend l’historique des affectations de l’équipe, la plus récente d’abord', async () => {
    await listAffectationsEquipe('eq-1', '2026-09-24');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM equipe_aeronef');
    expect(sql).toContain('JOIN aeronef');
    expect(sql).toMatch(/ORDER BY ea\.date_debut DESC/);
    expect(params).toEqual(['2026-09-24', '2026-09-24', 'eq-1']);
  });

  it('marque en_service avec la même règle d’intervalle que les autres requêtes', async () => {
    await listAffectationsEquipe('eq-1', '2026-09-24');
    const [affectations] = getAllAsync.mock.calls[0];
    await listAeronefsEquipe('eq-1', '2026-09-24');
    await listParcAeronefs('2026-09-24');
    const regle = 'ea.date_debut <= ? AND (ea.date_fin IS NULL OR ea.date_fin > ?)';

    for (const [sql] of getAllAsync.mock.calls) expect(sql).toContain(regle);
    expect(affectations).toContain('AS en_service');
  });
});
