import { PreconditionError } from '../src/lib/errors';
import { generateId } from '../src/lib/id';
import { getReferentielDb } from '../src/lib/referentiel-db';
import {
  creerSiteSecondaire,
  creerSitesGroupes,
  deplacerSites,
  marquerDeplacementEnEchec,
  listPositionsSite,
} from '../src/lib/site-aerien-db';
import type { SiteSaisi } from '../src/lib/site-aerien-regles';

jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));
jest.mock('../src/lib/id', () => ({ generateId: jest.fn() }));

const runAsync = jest.fn();
const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();
const withTransactionAsync = jest.fn(async (rappel: () => Promise<void>) => rappel());
const db = { runAsync, getAllAsync, getFirstAsync, withTransactionAsync } as unknown as Awaited<
  ReturnType<typeof getReferentielDb>
>;

const AUJOURDHUI = '2026-09-24';
const POSITION = { latitude: -21.8135, longitude: 46.0432, altitude: 893 };
const SANS_POSITION = { latitude: null, longitude: null, altitude: null };

const principal: SiteSaisi = {
  actif: true,
  numero: '03',
  localite: 'Isoanala',
  memePositionQuePrincipal: false,
  position: POSITION,
};
const stand: SiteSaisi = {
  actif: true,
  numero: '01',
  localite: 'Isoanala',
  memePositionQuePrincipal: true,
  position: SANS_POSITION,
};
const inactif: SiteSaisi = { ...stand, actif: false, numero: '', localite: '' };

/**
 * Les appels `runAsync` dont le SQL contient `fragment`, avec leurs paramètres. Le SQL est écrit sur
 * plusieurs lignes : on compare à espaces normalisés pour ne pas figer la mise en forme.
 */
const ecritures = (fragment: string) =>
  runAsync.mock.calls
    .filter(([sql]) => String(sql).replace(/\s+/g, ' ').includes(fragment))
    .map(([, params]) => params);

let compteur = 0;
beforeEach(() => {
  jest.resetAllMocks();
  compteur = 0;
  jest.mocked(getReferentielDb).mockResolvedValue(db);
  jest.mocked(generateId).mockImplementation(() => `id-${++compteur}`);
  withTransactionAsync.mockImplementation(async (rappel: () => Promise<void>) => rappel());
  getAllAsync.mockResolvedValue([]);
  getFirstAsync.mockResolvedValue(null);
});

describe('creerSitesGroupes', () => {
  it('crée un principal seul : une ligne site et une position, toutes deux en attente d’envoi', async () => {
    const ids = await creerSitesGroupes({
      equipeId: 'eq-1',
      principal,
      stand: inactif,
      baseSecondaire: inactif,
      aujourdhui: AUJOURDHUI,
    });

    expect(ids).toEqual({ principalId: 'id-1', standId: null, baseSecondaireId: null });
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    const sites = ecritures('INSERT INTO site_aerien (');
    expect(sites).toHaveLength(1);
    expect(sites[0]).toEqual(
      expect.arrayContaining(['id-1', null, 'eq-1', '03', 'Isoanala', -21.8135, 46.0432, 893, AUJOURDHUI])
    );
    const sqlEcrits = runAsync.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' '));
    expect(sqlEcrits.find((sql) => sql.includes('INSERT INTO site_aerien ('))).toContain("'local'");
    expect(sqlEcrits.find((sql) => sql.includes('INSERT INTO site_aerien_position'))).toContain("'local'");
    expect(ecritures('INSERT INTO site_aerien_position')).toHaveLength(1);
  });

  it('rattache les dépendants au principal, sans équipe propre, et leur donne la position du principal', async () => {
    const ids = await creerSitesGroupes({
      equipeId: 'eq-1',
      principal,
      stand,
      baseSecondaire: { ...stand, numero: '02', localite: 'Ihosy', memePositionQuePrincipal: false, position: { latitude: -22.4, longitude: 46.1, altitude: null } },
      aujourdhui: AUJOURDHUI,
    });

    expect(ids).toEqual({ principalId: 'id-1', standId: 'id-2', baseSecondaireId: 'id-3' });
    const [, standLigne, baseLigne] = ecritures('INSERT INTO site_aerien (');
    // id, parent_site_id, equipe_id, numero, localite, latitude, longitude
    expect(standLigne.slice(0, 3)).toEqual(['id-2', 'id-1', null]);
    expect(standLigne).toEqual(expect.arrayContaining([-21.8135, 46.0432]));
    expect(baseLigne.slice(0, 3)).toEqual(['id-3', 'id-1', null]);
    expect(baseLigne).toEqual(expect.arrayContaining([-22.4, 46.1]));
    expect(ecritures('INSERT INTO site_aerien_position')).toHaveLength(3);
  });

  it('refuse le lot avec les erreurs lisibles et n’écrit rien', async () => {
    const enErreur = creerSitesGroupes({
      equipeId: 'eq-1',
      principal,
      stand: { ...stand, numero: '', localite: '' },
      baseSecondaire: inactif,
      aujourdhui: AUJOURDHUI,
    });

    await expect(enErreur).rejects.toBeInstanceOf(PreconditionError);
    await expect(enErreur).rejects.toThrow('Stand : le numéro est obligatoire.');
    expect(withTransactionAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('refuse une latitude hors bornes avant toute écriture', async () => {
    await expect(
      creerSitesGroupes({
        equipeId: 'eq-1',
        principal: { ...principal, position: { latitude: 91, longitude: 46, altitude: null } },
        stand: inactif,
        baseSecondaire: inactif,
        aujourdhui: AUJOURDHUI,
      })
    ).rejects.toThrow('latitude');
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('creerSiteSecondaire', () => {
  const principalLocal = {
    id: 'pr-1',
    latitude: -21.8,
    longitude: 46,
    altitude: 12,
  };
  beforeEach(() => {
    getFirstAsync.mockResolvedValue(principalLocal);
  });

  it('rattache le secondaire à son principal, sans équipe propre, en attente d’envoi', async () => {
    const id = await creerSiteSecondaire({
      parentId: 'pr-1',
      site: { ...stand, memePositionQuePrincipal: false, position: POSITION },
      aujourdhui: AUJOURDHUI,
    });

    expect(id).toBe('id-1');
    const [ligne] = ecritures('INSERT INTO site_aerien (');
    expect(ligne.slice(0, 3)).toEqual(['id-1', 'pr-1', null]);
    expect(ligne).toEqual(expect.arrayContaining([-21.8135, 46.0432, 893]));
    expect(ecritures('INSERT INTO site_aerien_position')).toHaveLength(1);
  });

  it('reprend la position du principal quand « même position » est coché', async () => {
    await creerSiteSecondaire({ parentId: 'pr-1', site: stand, aujourdhui: AUJOURDHUI });

    const [ligne] = ecritures('INSERT INTO site_aerien (');
    expect(ligne).toEqual(expect.arrayContaining([-21.8, 46, 12]));
  });

  it('refuse un secondaire incomplet sans rien écrire', async () => {
    await expect(
      creerSiteSecondaire({ parentId: 'pr-1', site: { ...stand, numero: '' }, aujourdhui: AUJOURDHUI })
    ).rejects.toThrow('le numéro est obligatoire');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('refuse un principal inconnu de l’appareil', async () => {
    getFirstAsync.mockResolvedValue(null);
    await expect(
      creerSiteSecondaire({ parentId: 'pr-x', site: stand, aujourdhui: AUJOURDHUI })
    ).rejects.toBeInstanceOf(PreconditionError);
  });
});

describe('deplacerSites', () => {
  const site = {
    id: 'pr-1',
    parent_site_id: null,
    numero: '03',
    localite: 'Isoanala',
    latitude: -21.8,
    longitude: 46,
    altitude: null,
    date_debut_position: '2026-09-12',
  };
  const dependantA = { ...site, id: 'st-1', parent_site_id: 'pr-1', numero: '01', localite: 'Isoanala' };
  const dependantB = { ...site, id: 'bs-1', parent_site_id: 'pr-1', numero: '02', localite: 'Ihosy' };
  const demande = {
    siteId: 'pr-1',
    numero: '04',
    localite: 'Ambatobe',
    position: { latitude: -22, longitude: 46.5, altitude: null },
    dependantIds: ['st-1'],
    vol: null,
    aujourdhui: AUJOURDHUI,
  };

  beforeEach(() => {
    getFirstAsync.mockImplementation(async (sql: string) =>
      String(sql).includes('FROM site_aerien WHERE id') ? site : null
    );
    getAllAsync.mockImplementation(async (sql: string) =>
      String(sql).includes('parent_site_id = ?') ? [dependantA, dependantB] : []
    );
  });

  it('une nouvelle position par site coché, aucune pour les autres', async () => {
    await deplacerSites(demande);

    // Les nouvelles implantations commencent aujourd'hui ; les autres lignes insérées sont
    // l'ancienne implantation, matérialisée en historique (testée plus bas).
    const nouvelles = ecritures('INSERT INTO site_aerien_position').filter((p) => p[5] === AUJOURDHUI);
    expect(nouvelles).toHaveLength(2);
    expect(nouvelles.map((p) => p[1])).toEqual(['pr-1', 'st-1']);
    expect(nouvelles.every((p) => p.includes(-22) && p.includes(46.5))).toBe(true);
  });

  it('matérialise l’ancienne position d’un site synchronisé, close à J-1', async () => {
    await deplacerSites(demande);

    const anciennes = ecritures('INSERT INTO site_aerien_position').filter((p) => p.includes('2026-09-23'));
    expect(anciennes).toHaveLength(2);
    expect(anciennes[0]).toEqual(expect.arrayContaining(['pr-1', -21.8, 46, '2026-09-12', '2026-09-23']));
  });

  it('clôt à J-1 la position locale active ouverte avant aujourd’hui', async () => {
    getFirstAsync.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM site_aerien WHERE id')) return site;
      if (String(sql).includes('FROM site_aerien_position')) {
        return { id: 'po-9', date_debut: '2026-09-12', localite: 'Isoanala' };
      }
      return null;
    });

    await deplacerSites({ ...demande, dependantIds: [] });

    expect(ecritures('SET date_fin')).toEqual([['2026-09-23', 'po-9']]);
    expect(ecritures('INSERT INTO site_aerien_position')).toHaveLength(1);
  });

  it('corrige en place une position ouverte aujourd’hui (date_fin >= date_debut)', async () => {
    getFirstAsync.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM site_aerien WHERE id')) return site;
      if (String(sql).includes('FROM site_aerien_position')) {
        return { id: 'po-9', date_debut: AUJOURDHUI, localite: 'Isoanala' };
      }
      return null;
    });

    await deplacerSites({ ...demande, dependantIds: [] });

    expect(ecritures('SET date_fin')).toEqual([]);
    expect(ecritures('UPDATE site_aerien_position SET latitude')).toHaveLength(1);
    expect(ecritures('INSERT INTO site_aerien_position')).toHaveLength(0);
  });

  it('empile un déplacement à envoyer avec ses dépendants cochés, renommé si numéro/localité changent', async () => {
    await deplacerSites(demande);

    const [ligne] = ecritures('INSERT INTO site_aerien_deplacement');
    expect(ligne).toEqual(
      expect.arrayContaining(['id-1', 'pr-1', '04', 'Ambatobe', -22, 46.5, 1, JSON.stringify(['st-1']), null])
    );
  });

  it('ne marque pas « renommé » quand numéro et localité sont inchangés', async () => {
    await deplacerSites({ ...demande, numero: '03', localite: 'Isoanala' });

    const [ligne] = ecritures('INSERT INTO site_aerien_deplacement');
    expect(ligne).toEqual(expect.arrayContaining([0]));
    expect(ligne).not.toContain(1);
  });

  it('refuse un dépendant qui n’appartient pas au site déplacé', async () => {
    await expect(deplacerSites({ ...demande, dependantIds: ['etranger'] })).rejects.toThrow(
      'ne dépend pas du site'
    );
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('refuse le vol de mise en place si le site n’a aucun stand', async () => {
    getAllAsync.mockResolvedValue([]);

    await expect(
      deplacerSites({
        ...demande,
        dependantIds: [],
        vol: { debut: '07:30', fin: '08:45', standId: null, aeronefId: 'ae-1', equipeId: 'eq-1' },
      })
    ).rejects.toThrow('aucun stand');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('refuse un vol dont la fin précède le début', async () => {
    await expect(
      deplacerSites({
        ...demande,
        vol: { debut: '09:00', fin: '08:00', standId: 'st-1', aeronefId: 'ae-1', equipeId: 'eq-1' },
      })
    ).rejects.toThrow('postérieure');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('range le vol de mise en place dans la ligne à envoyer, avec son id client', async () => {
    await deplacerSites({
      ...demande,
      vol: { debut: '07:30', fin: '08:45', standId: 'st-1', aeronefId: 'ae-1', equipeId: 'eq-1' },
    });

    const [ligne] = ecritures('INSERT INTO site_aerien_deplacement');
    const volJson = ligne.find((v: unknown) => typeof v === 'string' && v.includes('"heure_debut"'));
    expect(JSON.parse(volJson)).toEqual({
      id: expect.any(String),
      type: 'mise_en_place',
      equipe_id: 'eq-1',
      aeronef_id: 'ae-1',
      date_vol: AUJOURDHUI,
      heure_debut: '07:30',
      heure_fin: '08:45',
      site_principal_id: 'pr-1',
      stand_id: 'st-1',
    });
  });

  it('refuse un site inconnu de l’appareil', async () => {
    getFirstAsync.mockResolvedValue(null);
    await expect(deplacerSites(demande)).rejects.toBeInstanceOf(PreconditionError);
  });
});

describe('listPositionsSite', () => {
  it('rend l’historique le plus récent d’abord', async () => {
    await listPositionsSite('pr-1');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('FROM site_aerien_position');
    expect(sql).toMatch(/ORDER BY date_debut DESC/);
    expect(params).toEqual(['pr-1']);
  });
});

describe('marquerDeplacementEnEchec (#644)', () => {
  it('marque aussi en échec le vol de mise en place du déplacement, pour « Mes vols »', async () => {
    getFirstAsync.mockResolvedValueOnce({ vol_json: JSON.stringify({ id: 'vol-1' }) });

    await marquerDeplacementEnEchec('dep-1');

    expect(ecritures("UPDATE vol SET statut_sync = 'echec'")).toEqual([['vol-1']]);
  });

  it('sans vol de mise en place, ne touche que le déplacement', async () => {
    getFirstAsync.mockResolvedValueOnce({ vol_json: null });

    await marquerDeplacementEnEchec('dep-1');

    expect(ecritures("UPDATE vol SET statut_sync = 'echec'")).toEqual([]);
  });
});
