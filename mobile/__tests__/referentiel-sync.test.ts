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
      },
      undefined
    );
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
});
