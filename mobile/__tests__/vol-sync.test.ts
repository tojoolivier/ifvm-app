import { apiClient } from '../src/lib/api-client';
import { NetworkError } from '../src/lib/errors';
import { getTraitement } from '../src/lib/traitement-repository';
import * as volDb from '../src/lib/vol-db';
import { synchroniserVols } from '../src/lib/vol-sync';

jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createVol: jest.fn(), updateVol: jest.fn() },
  statutHttpDe: (error: unknown) => (error as { status?: number } | null)?.status ?? null,
  versionServeurDe: () => null,
}));
jest.mock('../src/lib/traitement-repository', () => ({ getTraitement: jest.fn() }));
jest.mock('../src/lib/vol-db', () => ({
  listVolsEnAttente: jest.fn(),
  getVolDeOperation: jest.fn(),
  marquerVolSynchronise: jest.fn(),
  marquerVolEnEchec: jest.fn(),
}));

const vol = (surcharge: object = {}) => ({
  id: 'vol-1',
  categorie: 'application',
  origine: 'traitement',
  date_vol: '2026-09-23',
  heure_debut: '06:30',
  heure_fin: '09:15',
  lieu_depart: null,
  lieu_arrivee: null,
  libelle_lieu: 'Isoanala',
  statut_sync: 'local',
  equipe_id: 'eq-1',
  aeronef_id: 'ae-1',
  motif: null,
  site_principal_id: 'pr-1',
  stand_id: 'st-1',
  base_secondaire_id: null,
  traitement_id: 'tr-1',
  ...surcharge,
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(apiClient.createVol).mockResolvedValue({} as any);
  jest.mocked(apiClient.updateVol).mockResolvedValue({} as any);
});

describe('synchroniserVols', () => {
  it('envoie un vol de saisie directe, sans rattachement', async () => {
    jest.mocked(volDb.listVolsEnAttente).mockResolvedValue([
      vol({ id: 'v-conv', categorie: 'convoyage', origine: 'saisie_directe', traitement_id: null, motif: 'Transfert', lieu_depart: 'A', lieu_arrivee: 'B' }),
    ] as any);

    const resume = await synchroniserVols('tok');

    expect(apiClient.createVol).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ id: 'v-conv', type: 'convoyage', motif: 'Transfert', lieu_depart: 'A', lieu_arrivee: 'B' })
    );
    expect(apiClient.updateVol).not.toHaveBeenCalled();
    expect(volDb.marquerVolSynchronise).toHaveBeenCalledWith('v-conv');
    expect(resume.reussies).toHaveLength(1);
  });

  it('un vol d’application attend son traitement : reste dans la file, sans échec', async () => {
    jest.mocked(volDb.listVolsEnAttente).mockResolvedValue([vol()] as any);
    jest.mocked(getTraitement).mockResolvedValue({ statut_sync: 'local' } as any);

    const resume = await synchroniserVols('tok');

    expect(apiClient.createVol).not.toHaveBeenCalled();
    expect(volDb.marquerVolEnEchec).not.toHaveBeenCalled();
    expect(resume.reussies).toHaveLength(0);
    expect(resume.echouees).toEqual([expect.objectContaining({ id: 'vol-1', sort: 'file' })]);
  });

  it('une fois le traitement synchronisé, crée le vol puis le rattache (#610)', async () => {
    jest.mocked(volDb.listVolsEnAttente).mockResolvedValue([vol()] as any);
    jest.mocked(getTraitement).mockResolvedValue({ statut_sync: 'synced' } as any);

    await synchroniserVols('tok');

    expect(apiClient.createVol).toHaveBeenCalledWith('tok', expect.objectContaining({ id: 'vol-1', type: 'application', stand_id: 'st-1' }));
    expect(apiClient.updateVol).toHaveBeenCalledWith('tok', 'vol-1', { traitement_id: 'tr-1' });
    expect(volDb.marquerVolSynchronise).toHaveBeenCalledWith('vol-1');
  });

  it('si le rattachement échoue, le vol n’est pas marqué synchronisé (rejeu idempotent)', async () => {
    jest.mocked(volDb.listVolsEnAttente).mockResolvedValue([vol()] as any);
    jest.mocked(getTraitement).mockResolvedValue({ statut_sync: 'synced' } as any);
    jest.mocked(apiClient.updateVol).mockRejectedValue(new NetworkError('coupure'));

    await synchroniserVols('tok');

    expect(volDb.marquerVolSynchronise).not.toHaveBeenCalled();
  });
});
