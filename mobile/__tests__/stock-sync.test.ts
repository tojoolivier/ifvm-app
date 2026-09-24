import { apiClient } from '../src/lib/api-client';
import * as siteDb from '../src/lib/site-aerien-db';
import * as db from '../src/lib/stock-db';
import { synchroniserStock } from '../src/lib/stock-sync';

jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createMouvementPesticide: jest.fn(), getSoldesPesticide: jest.fn() },
  statutHttpDe: (error: unknown) => {
    const statut = (error as { status?: number } | null)?.status;
    return typeof statut === 'number' ? statut : null;
  },
  versionServeurDe: (error: unknown) => (error as { serverVersion?: unknown } | null)?.serverVersion ?? null,
}));
jest.mock('../src/lib/site-aerien-db', () => ({ getStatutSite: jest.fn() }));
jest.mock('../src/lib/stock-db', () => ({
  listMouvementsEnAttente: jest.fn(),
  marquerMouvementSynchronise: jest.fn(),
  marquerMouvementEnEchec: jest.fn(),
  remplacerSoldesServeur: jest.fn(),
}));

const mouvement = (surcharge: Partial<db.MouvementLocal> = {}): db.MouvementLocal => ({
  id: 'm-1',
  type: 'approvisionnement',
  pesticide_id: 'p-1',
  site_id: 's-1',
  site_destination_id: null,
  quantite: 200,
  unite: 'L',
  date_mouvement: '2026-09-24',
  statut_sync: 'local',
  ...surcharge,
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(siteDb.getStatutSite).mockResolvedValue('synced');
  jest.mocked(apiClient.getSoldesPesticide).mockResolvedValue([]);
});

describe('synchroniserStock', () => {
  it('envoie le mouvement avec son id client (idempotence) puis le marque synchronisé', async () => {
    jest.mocked(db.listMouvementsEnAttente).mockResolvedValue([mouvement()]);
    const resume = await synchroniserStock('tok');
    expect(apiClient.createMouvementPesticide).toHaveBeenCalledWith('tok', {
      id: 'm-1',
      type: 'approvisionnement',
      pesticide_id: 'p-1',
      site_id: 's-1',
      site_destination_id: null,
      quantite: 200,
      unite: 'L',
      date_mouvement: '2026-09-24',
    });
    expect(db.marquerMouvementSynchronise).toHaveBeenCalledWith('m-1');
    expect(resume.reussies).toHaveLength(1);
  });

  it('garde dans la file un mouvement dont le site n’est pas encore sur le serveur', async () => {
    jest.mocked(db.listMouvementsEnAttente).mockResolvedValue([mouvement()]);
    jest.mocked(siteDb.getStatutSite).mockResolvedValue('local');
    const resume = await synchroniserStock('tok');
    expect(apiClient.createMouvementPesticide).not.toHaveBeenCalled();
    expect(db.marquerMouvementEnEchec).not.toHaveBeenCalled();
    expect(resume.echouees[0]).toMatchObject({ sort: 'file' });
  });

  it('vérifie aussi le site destination d’un transfert', async () => {
    jest.mocked(db.listMouvementsEnAttente).mockResolvedValue([
      mouvement({ type: 'transfert', site_destination_id: 's-2' }),
    ]);
    jest.mocked(siteDb.getStatutSite).mockImplementation(async (id) => (id === 's-2' ? 'local' : 'synced'));
    await synchroniserStock('tok');
    expect(apiClient.createMouvementPesticide).not.toHaveBeenCalled();
  });

  it('range un refus 422 du serveur en échec (sort de la file)', async () => {
    jest.mocked(db.listMouvementsEnAttente).mockResolvedValue([mouvement()]);
    jest.mocked(apiClient.createMouvementPesticide).mockRejectedValue(
      Object.assign(new Error('pesticide_id introuvable'), { status: 422 })
    );
    const resume = await synchroniserStock('tok');
    expect(db.marquerMouvementEnEchec).toHaveBeenCalledWith('m-1');
    expect(resume.echouees[0]).toMatchObject({ sort: 'echec' });
  });

  it('rafraîchit ensuite le cache des soldes serveur', async () => {
    jest.mocked(db.listMouvementsEnAttente).mockResolvedValue([]);
    const soldes = [{ site_id: 's-1', pesticide_id: 'p-1', unite: 'L', quantite: 450 }];
    jest.mocked(apiClient.getSoldesPesticide).mockResolvedValue(soldes);
    await synchroniserStock('tok');
    expect(db.remplacerSoldesServeur).toHaveBeenCalledWith(soldes);
  });
});
