import { getReferentielDb } from '../src/lib/referentiel-db';
import { enregistrerVolOperation, getVolDeOperation } from '../src/lib/vol-db';

jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));

const runAsync = jest.fn();
const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();
const db = {
  runAsync,
  getAllAsync,
  getFirstAsync,
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
} as unknown as Awaited<ReturnType<typeof getReferentielDb>>;

const demande = {
  categorie: 'application' as const,
  equipeType: 'aerien' as const,
  equipeId: 'eq-1',
  aeronefId: 'ae-1',
  date: '2026-09-23',
  debut: '06:30',
  fin: '09:15',
  sitePrincipalId: 'si-1',
  standId: 'st-1',
  baseSecondaireId: null,
  motif: '',
  lieuDepart: '',
  lieuArrivee: '',
  dependantIds: ['st-1'],
  liens: [{ type: 'traitement' as const, refId: 'tr-1' }],
  libelleLieu: 'Isoanala',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getReferentielDb).mockResolvedValue(db);
  getFirstAsync.mockResolvedValue(null);
});

describe('enregistrerVolOperation', () => {
  it('refuse un vol d’application sans stand, sans rien écrire', async () => {
    await expect(enregistrerVolOperation({ ...demande, standId: null })).rejects.toThrow('Choisissez le stand');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('refuse une équipe terrestre', async () => {
    await expect(enregistrerVolOperation({ ...demande, equipeType: 'terrestre' })).rejects.toThrow('équipe aérienne');
  });

  it('crée le vol local d’une opération et son lien', async () => {
    const id = await enregistrerVolOperation(demande);

    const insertions = runAsync.mock.calls.map(([sql]) => String(sql));
    expect(insertions[0]).toContain('INSERT INTO vol');
    expect(insertions[1]).toContain('INSERT INTO vol_lien');
    expect(runAsync.mock.calls[0][1]).toContain(id);
    expect(runAsync.mock.calls[0][1]).toContain('traitement');
    expect(runAsync.mock.calls[1][1]).toEqual([id, 'traitement', 'tr-1']);
  });

  it('met à jour le vol déjà lié à l’opération au lieu d’en créer un second', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'vol-existant', statut_sync: 'local' });

    const id = await enregistrerVolOperation(demande);

    expect(id).toBe('vol-existant');
    expect(String(runAsync.mock.calls[0][0])).toContain('UPDATE vol');
  });

  it('refuse de modifier un vol déjà synchronisé', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'vol-existant', statut_sync: 'synced' });
    await expect(enregistrerVolOperation(demande)).rejects.toThrow('déjà envoyé');
  });
});

describe('getVolDeOperation', () => {
  it('rend le vol lié à l’opération', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'v1' });
    expect(await getVolDeOperation('traitement', 'tr-1')).toEqual({ id: 'v1' });
    expect(String(getFirstAsync.mock.calls[0][0])).toContain('vol_lien');
  });
});
