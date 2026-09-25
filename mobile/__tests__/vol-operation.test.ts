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

describe('« Ce vol couvre aussi » sur une fiche qui a déjà un vol (#644)', () => {
  const prospection = {
    ...demande,
    categorie: 'prospection' as const,
    liens: [
      { type: 'prospection' as const, refId: 'p-1' },
      { type: 'prospection' as const, refId: 'p-2' },
    ],
  };

  it('rattache la fiche au vol courant et supprime l’ancien vol local devenu orphelin', async () => {
    getFirstAsync
      .mockResolvedValueOnce(null) // p-1 n'a pas de vol
      .mockResolvedValueOnce({ vol_id: 'vol-autre', statut_sync: 'local' }); // p-2 en a un
    getAllAsync.mockResolvedValueOnce([]); // plus aucun lien sur l'ancien vol

    const id = await enregistrerVolOperation(prospection);

    const sql = runAsync.mock.calls.map(([q]) => String(q));
    expect(sql).toContain('DELETE FROM vol_lien WHERE vol_id = ? AND ref_id = ?');
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM vol WHERE id = ?', ['vol-autre']);
    expect(runAsync).toHaveBeenCalledWith('INSERT INTO vol_lien (vol_id, type, ref_id) VALUES (?, ?, ?)', [id, 'prospection', 'p-2']);
  });

  it('refuse de reprendre une fiche dont le vol est déjà envoyé', async () => {
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ vol_id: 'vol-autre', statut_sync: 'synced' });

    await expect(enregistrerVolOperation(prospection)).rejects.toThrow('déjà envoyé');
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('getVolDeOperation', () => {
  it('rend le vol lié à l’opération', async () => {
    getFirstAsync.mockResolvedValueOnce({ id: 'v1' });
    expect(await getVolDeOperation('traitement', 'tr-1')).toEqual({ id: 'v1' });
    expect(String(getFirstAsync.mock.calls[0][0])).toContain('vol_lien');
  });
});
