import { getReferentielDb } from '../src/lib/referentiel-db';
import { apiClient } from '../src/lib/api-client';
import { pullReferentiel } from '../src/lib/referentiel-sync';

jest.mock('../src/lib/referentiel-db', () => ({
  getReferentielDb: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { pullReferentiel: jest.fn() },
}));

const mockGetReferentielDb = jest.mocked(getReferentielDb);
const mockPullReferentiel = jest.mocked(apiClient.pullReferentiel);

const runAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn();
/** `count(*)` par table : un curseur ne vaut que si sa table locale est peuplée. */
const getFirstAsync = jest.fn();

const db = { runAsync, getAllAsync, getFirstAsync } as unknown as Awaited<
  ReturnType<typeof getReferentielDb>
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetReferentielDb.mockResolvedValue(db);
  getAllAsync.mockResolvedValue([]);
  getFirstAsync.mockResolvedValue({ n: 12 });
});

function emptyResponse(serverTime: string) {
  return {
    postes_acridiens: { upserts: [], server_time: serverTime },
    stations_fixes: { upserts: [], server_time: serverTime },
    utilisateurs_equipe: { upserts: [], server_time: serverTime },
    pesticides: { upserts: [], server_time: serverTime },
    cultures: { upserts: [], server_time: serverTime },
    codes_stades: { upserts: [], server_time: serverTime },
    campagnes: { upserts: [], server_time: serverTime },
    lieux_aeriens: { upserts: [], server_time: serverTime },
    equipes: { upserts: [], server_time: serverTime },
    equipe_membres: { upserts: [], server_time: serverTime },
    sites_aeriens: { upserts: [], server_time: serverTime },
    aeronefs: { upserts: [], server_time: serverTime },
    equipe_aeronefs: { upserts: [], server_time: serverTime },
  };
}

describe('pullReferentiel', () => {
  it('sends null cursors for every entity type when nothing has been synced yet', async () => {
    mockPullReferentiel.mockResolvedValue(emptyResponse('2026-08-02T00:00:00Z'));

    await pullReferentiel('token-1');

    expect(mockPullReferentiel).toHaveBeenCalledWith(
      'token-1',
      {
        postes_acridiens: null,
        stations_fixes: null,
        utilisateurs_equipe: null,
        pesticides: null,
        cultures: null,
        codes_stades: null,
        campagnes: null,
        lieux_aeriens: null,
        equipes: null,
        equipe_membres: null,
        sites_aeriens: null,
        aeronefs: null,
        equipe_aeronefs: null,
      },
      undefined
    );
  });

  it('ignore le curseur d’une table locale vide, pour sortir de l’impasse « synchro réussie, table vide » (#201)', async () => {
    getAllAsync.mockResolvedValue([
      { entity_type: 'codes_stades', last_pull_at: '2026-08-01T00:00:00Z' },
      { entity_type: 'pesticides', last_pull_at: '2026-08-01T00:00:00Z' },
    ]);
    // `code_stade` est vide (recréée par une migration) ; `pesticide` est peuplée.
    getFirstAsync.mockImplementation((sql: string) =>
      Promise.resolve({ n: sql.includes('code_stade') ? 0 : 12 })
    );
    mockPullReferentiel.mockResolvedValue(emptyResponse('2026-08-02T00:00:00Z'));

    await pullReferentiel('token-1');

    expect(mockPullReferentiel).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        codes_stades: null,
        pesticides: '2026-08-01T00:00:00Z',
      }),
      undefined
    );
  });

  it('sends each entity its own stored cursor, independently of the others', async () => {
    getAllAsync.mockResolvedValue([
      { entity_type: 'postes_acridiens', last_pull_at: '2026-08-01T00:00:00Z' },
      { entity_type: 'stations_fixes', last_pull_at: '2026-07-30T00:00:00Z' },
    ]);
    mockPullReferentiel.mockResolvedValue(emptyResponse('2026-08-02T00:00:00Z'));

    await pullReferentiel('token-1');

    expect(mockPullReferentiel).toHaveBeenCalledWith(
      'token-1',
      {
        postes_acridiens: '2026-08-01T00:00:00Z',
        stations_fixes: '2026-07-30T00:00:00Z',
        utilisateurs_equipe: null,
        pesticides: null,
        cultures: null,
        codes_stades: null,
        campagnes: null,
        lieux_aeriens: null,
        equipes: null,
        equipe_membres: null,
        sites_aeriens: null,
        aeronefs: null,
        equipe_aeronefs: null,
      },
      undefined
    );
  });

  it('upserts each équipe et chaque membre idempotently by clé', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      equipes: {
        upserts: [
          { id: 'eq-1', nom: 'Équipe Sud', type: 'aerien', actif: true, updated_at: '2026-08-01T00:00:00Z' },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
      equipe_membres: {
        upserts: [
          {
            equipe_id: 'eq-1',
            user_id: 'u-1',
            fonction: 'chef',
            nom: 'Rakoto',
            prenom: 'Jean',
            created_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    const appels = runAsync.mock.calls.map(([sql, params]) => [String(sql), params]);
    const equipe = appels.find(([sql]) => sql.includes('INSERT INTO equipe ('));
    expect(equipe?.[0]).toContain('ON CONFLICT(id) DO UPDATE');
    expect(equipe?.[1]).toEqual(['eq-1', 'Équipe Sud', 'aerien', 1, '2026-08-01T00:00:00Z']);
    const membre = appels.find(([sql]) => sql.includes('INSERT INTO equipe_membre'));
    expect(membre?.[0]).toContain('ON CONFLICT(equipe_id, user_id) DO UPDATE');
    expect(membre?.[1]).toEqual(['eq-1', 'u-1', 'chef', 'Rakoto', 'Jean']);
  });

  it('upserts les sites aériens (avec leur position active), les aéronefs et leurs affectations', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      sites_aeriens: {
        upserts: [
          {
            id: 'site-1',
            parent_site_id: null,
            equipe_id: 'eq-1',
            numero: 'n°03',
            localite: 'Isoanala',
            actif: true,
            latitude: -22.1,
            longitude: 46.2,
            altitude: null,
            date_debut_position: '2026-09-12',
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
      aeronefs: {
        upserts: [
          { id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188', volume_cuve_l: 800, actif: true, updated_at: '2026-08-01T00:00:00Z' },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
      equipe_aeronefs: {
        upserts: [
          { id: 'aff-1', equipe_id: 'eq-1', aeronef_id: 'ae-1', date_debut: '2026-08-01', date_fin: null, updated_at: '2026-08-01T00:00:00Z' },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    const appels = runAsync.mock.calls.map(([sql, params]) => [String(sql), params]);
    const site = appels.find(([sql]) => sql.includes('INSERT INTO site_aerien'));
    expect(site?.[0]).toContain('ON CONFLICT(id) DO UPDATE');
    expect(site?.[1]).toEqual(['site-1', null, 'eq-1', 'n°03', 'Isoanala', 1, -22.1, 46.2, null, '2026-09-12', '2026-08-01T00:00:00Z']);
    const aeronef = appels.find(([sql]) => sql.includes('INSERT INTO aeronef'));
    expect(aeronef?.[1]).toEqual(['ae-1', '5R-MHR', 'Cessna 188', 800, 1, '2026-08-01T00:00:00Z']);
    const affectation = appels.find(([sql]) => sql.includes('INSERT INTO equipe_aeronef'));
    expect(affectation?.[1]).toEqual(['aff-1', 'eq-1', 'ae-1', '2026-08-01', null, '2026-08-01T00:00:00Z']);
  });

  it('upserts each poste acridien idempotently by id', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      postes_acridiens: {
        upserts: [
          { id: 'pa-1', code: 'PA-01', nom: 'Bekily', za_id: 'za-1', actif: true, updated_at: '2026-08-01T00:00:00Z' },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO poste_acridien'),
      ['pa-1', 'PA-01', 'Bekily', 'za-1', 1, '2026-08-01T00:00:00Z']
    );
  });

  it('upserts each lieu aérien idempotently by id (#prospection-lieu-base)', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      lieux_aeriens: {
        upserts: [
          {
            id: 'lieu-1',
            type_lieu: 'principale',
            nom: 'Tuléar',
            latitude: -23.35,
            longitude: 43.67,
            altitude: 8,
            equipe_aerienne_id: 'equipe-1',
            actif: true,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO lieu_aerien'),
      ['lieu-1', 'principale', 'Tuléar', -23.35, 43.67, 8, 'equipe-1', 1, '2026-08-01T00:00:00Z']
    );
  });

  it("stocke NULL pour un lieu aérien pas encore rattaché à une équipe (migration 0074)", async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      lieux_aeriens: {
        upserts: [
          {
            id: 'lieu-2',
            type_lieu: 'stand',
            nom: 'Ancien stand',
            latitude: -22.4,
            longitude: 46.12,
            altitude: null,
            equipe_aerienne_id: null,
            actif: true,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO lieu_aerien'),
      ['lieu-2', 'stand', 'Ancien stand', -22.4, 46.12, null, null, 1, '2026-08-01T00:00:00Z']
    );
  });

  it('masks actif=false rows without deleting them (soft-delete upsert)', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      stations_fixes: {
        upserts: [
          {
            id: 'st-1',
            code: 'ST-01',
            nom: 'Station',
            pa_id: 'pa-1',
            latitude: -20,
            longitude: 45,
            altitude: null,
            commune: 'Bekily',
            district: 'Bekily',
            region: 'Androy',
            actif: false,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO station_fixe'),
      ['st-1', 'ST-01', 'Station', 'pa-1', -20, 45, null, 'Bekily', 'Bekily', 'Androy', 0, '2026-08-01T00:00:00Z']
    );
  });

  it('upserts each pesticide avec matière active, dose de référence et type de produit (#278)', async () => {
    // Ces trois colonnes existaient déjà en local et le pull les envoyait déjà, mais
    // upsertPesticides ne les écrivait pas — un pesticide déjà synchronisé les gardait
    // à NULL indéfiniment, y compris type_produit, dont dépend le filtrage du choix de
    // pesticide par mode de traitement (BARRIERE/TOTAL/IRREGULIER).
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      pesticides: {
        upserts: [
          {
            id: 'pest-1',
            code: 'DELTA',
            nom: 'Deltaméthrine',
            matiere_active: 'Deltaméthrine',
            dose_reference: '0.5 l/ha',
            type_produit: 'produit_barriere',
            actif: true,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pesticide'),
      [
        'pest-1',
        'DELTA',
        'Deltaméthrine',
        'Deltaméthrine',
        '0.5 l/ha',
        'produit_barriere',
        1,
        '2026-08-01T00:00:00Z',
      ]
    );
  });

  it('upserts each campagne idempotently by id', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      campagnes: {
        upserts: [
          {
            id: 'camp-1',
            name: 'Campagne 2026',
            start_date: '2026-01-01',
            end_date: null,
            actif: true,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO campagne'),
      ['camp-1', 'Campagne 2026', '2026-01-01', null, 1, '2026-08-01T00:00:00Z']
    );
  });

  it('propage la désactivation logique d\'une campagne (actif: false) au cache local', async () => {
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      campagnes: {
        upserts: [
          {
            id: 'camp-1',
            name: 'Campagne 2026',
            start_date: '2026-01-01',
            end_date: null,
            actif: false,
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        server_time: '2026-08-02T00:00:00Z',
      },
    });

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO campagne'),
      ['camp-1', 'Campagne 2026', '2026-01-01', null, 0, '2026-08-01T00:00:00Z']
    );
  });

  it('purge du cache local une ligne reçue avec deleted_at, sans la réinsérer (#674)', async () => {
    const vivant = {
      id: 'pa-vivant',
      code: 'PA-1',
      nom: 'Vivant',
      za_id: 'za-1',
      actif: true,
      updated_at: '2026-08-02T00:00:00Z',
      deleted_at: null,
    };
    const supprime = {
      ...vivant,
      id: 'pa-supprime',
      code: 'PA-2',
      deleted_at: '2026-08-02T00:00:00Z',
    };
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      postes_acridiens: { upserts: [vivant, supprime], server_time: '2026-08-02T00:00:00Z' },
    });

    await pullReferentiel('token-1');

    const suppressions = runAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('DELETE FROM poste_acridien')
    );
    expect(suppressions).toHaveLength(1);
    expect(suppressions[0][1]).toEqual(['pa-supprime']);

    const insertions = runAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO poste_acridien')
    );
    expect(insertions.map(([, params]) => params[0])).toEqual(['pa-vivant']);
  });

  it('supprime les enfants avant leur parent quand le pull contient les deux (#674)', async () => {
    const base = {
      actif: true,
      updated_at: '2026-08-02T00:00:00Z',
      deleted_at: '2026-08-02T00:00:00Z',
    };
    mockPullReferentiel.mockResolvedValue({
      ...emptyResponse('2026-08-02T00:00:00Z'),
      postes_acridiens: {
        upserts: [{ ...base, id: 'pa-1', code: 'PA', nom: 'PA', za_id: 'za' }],
        server_time: '2026-08-02T00:00:00Z',
      },
      stations_fixes: {
        upserts: [{ ...base, id: 'st-1', code: 'ST', nom: 'ST', pa_id: 'pa-1' }],
        server_time: '2026-08-02T00:00:00Z',
      },
    } as never);

    await pullReferentiel('token-1');

    const tables = runAsync.mock.calls
      .map(([sql]) => /DELETE FROM (\w+)/.exec(String(sql))?.[1])
      .filter(Boolean);
    expect(tables.indexOf('station_fixe')).toBeLessThan(tables.indexOf('poste_acridien'));
  });

  it('updates the sync cursor for every entity type to its own response server_time', async () => {
    mockPullReferentiel.mockResolvedValue(emptyResponse('2026-08-02T00:00:00Z'));

    await pullReferentiel('token-1');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referentiel_sync_meta'),
      ['postes_acridiens', '2026-08-02T00:00:00Z']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referentiel_sync_meta'),
      ['codes_stades', '2026-08-02T00:00:00Z']
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referentiel_sync_meta'),
      ['campagnes', '2026-08-02T00:00:00Z']
    );
  });

  it('propagates errors from the API without updating cursors', async () => {
    mockPullReferentiel.mockRejectedValue(new Error('network down'));

    await expect(pullReferentiel('token-1')).rejects.toThrow('network down');
    expect(runAsync).not.toHaveBeenCalledWith(expect.stringContaining('referentiel_sync_meta'), expect.anything());
  });

  /**
   * #referentiel-pull-entite-manquante : reproduit le plantage observé en production
   * (« TypeError: Cannot read property 'upserts' of undefined », dans purgerSupprimes) —
   * un serveur pas encore à jour avec une entité récente (ici equipe_aeronefs) omet sa clé
   * de la réponse. La synchro doit continuer les autres entités plutôt que tout faire échouer
   * avec le message générique « Un problème inattendu est survenu ».
   */
  it('ne plante pas quand une entité est absente de la réponse (serveur pas encore à jour)', async () => {
    const reponsePartielle = emptyResponse('2026-08-02T00:00:00Z') as Record<string, unknown>;
    delete reponsePartielle.equipe_aeronefs;
    mockPullReferentiel.mockResolvedValue(reponsePartielle as never);

    await expect(pullReferentiel('token-1')).resolves.toBeUndefined();

    // Les autres entités sont bien traitées normalement.
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referentiel_sync_meta'),
      ['postes_acridiens', '2026-08-02T00:00:00Z']
    );
    // L'entité absente n'avance pas son curseur — elle sera redemandée en entier au
    // prochain pull, une fois le serveur à jour.
    expect(runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO referentiel_sync_meta'),
      ['equipe_aeronefs', expect.anything()]
    );
  });

  it('ne plante pas non plus quand l’entité absente porte des suppressions à traiter pour une autre (#674)', async () => {
    // equipe_aeronefs est dans PURGE_ENFANTS_D_ABORD : vérifie que son absence n'empêche pas
    // la purge des autres entités de cette même liste.
    const supprime = {
      id: 'pa-supprime',
      code: 'PA-2',
      nom: 'PA',
      za_id: 'za',
      actif: true,
      updated_at: '2026-08-02T00:00:00Z',
      deleted_at: '2026-08-02T00:00:00Z',
    };
    const reponsePartielle = {
      ...emptyResponse('2026-08-02T00:00:00Z'),
      postes_acridiens: { upserts: [supprime], server_time: '2026-08-02T00:00:00Z' },
    } as Record<string, unknown>;
    delete reponsePartielle.equipe_aeronefs;
    mockPullReferentiel.mockResolvedValue(reponsePartielle as never);

    await expect(pullReferentiel('token-1')).resolves.toBeUndefined();

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM poste_acridien'),
      ['pa-supprime']
    );
  });
});
