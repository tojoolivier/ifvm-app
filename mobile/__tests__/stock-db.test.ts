import { PreconditionError } from '../src/lib/errors';
import { generateId } from '../src/lib/id';
import { getReferentielDb } from '../src/lib/referentiel-db';
import { creerMouvement, listMouvementsPourSolde, remplacerSoldesServeur } from '../src/lib/stock-db';
import type { MouvementSaisi } from '../src/lib/stock-regles';

jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));
jest.mock('../src/lib/id', () => ({ generateId: jest.fn() }));

const runAsync = jest.fn();
const getAllAsync = jest.fn();
const withTransactionAsync = jest.fn(async (rappel: () => Promise<void>) => rappel());
const db = { runAsync, getAllAsync, withTransactionAsync } as unknown as Awaited<ReturnType<typeof getReferentielDb>>;

const appro: MouvementSaisi = {
  type: 'approvisionnement',
  pesticideId: 'p-1',
  siteId: 's-1',
  siteDestinationId: 's-2',
  quantite: '12,5',
  unite: 'kg',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getReferentielDb).mockResolvedValue(db);
  jest.mocked(generateId).mockReturnValue('m-1');
  withTransactionAsync.mockImplementation(async (rappel: () => Promise<void>) => rappel());
});

describe('creerMouvement', () => {
  it('écrit localement avec l’id client, la quantité numérique et le statut « local »', async () => {
    expect(await creerMouvement(appro)).toBe('m-1');
    const [sql, params] = runAsync.mock.calls[0];
    expect(String(sql)).toContain("'local'");
    expect(params.slice(0, 7)).toEqual(['m-1', 'approvisionnement', 'p-1', 's-1', null, 12.5, 'kg']);
  });

  it('garde la destination d’un transfert, pas celle d’un approvisionnement', async () => {
    await creerMouvement({ ...appro, type: 'transfert' });
    expect(runAsync.mock.calls[0][1][4]).toBe('s-2');
  });

  it('refuse une saisie invalide sans rien écrire', async () => {
    await expect(creerMouvement({ ...appro, quantite: '0' })).rejects.toBeInstanceOf(PreconditionError);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('listMouvementsPourSolde', () => {
  it('ne lit que les mouvements en attente (un refusé n’a pas eu lieu)', async () => {
    getAllAsync.mockResolvedValue([]);
    await listMouvementsPourSolde();
    expect(String(getAllAsync.mock.calls[0][0])).toContain("statut_sync = 'local'");
  });
});

describe('remplacerSoldesServeur', () => {
  it('remplace le cache dans une transaction', async () => {
    await remplacerSoldesServeur([{ site_id: 's-1', pesticide_id: 'p-1', unite: 'L', quantite: 450 }]);
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(String(runAsync.mock.calls[0][0])).toContain('DELETE FROM stock_solde');
    expect(runAsync.mock.calls[1][1]).toEqual(['s-1', 'p-1', 'L', 450]);
  });
});
