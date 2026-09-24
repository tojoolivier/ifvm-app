import { apiClient } from '../src/lib/api-client';
import { NetworkError } from '../src/lib/errors';
import * as db from '../src/lib/site-aerien-db';
import { synchroniserSitesAeriens } from '../src/lib/site-aerien-sync';

jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
// `sync-lot` lit le statut HTTP et la version serveur joints à l'erreur : implémentations pures,
// comme `traitement-sync.test.ts`, plutôt que d'importer le vrai client (et React Native) ici.
jest.mock('../src/lib/api-client', () => ({
  apiClient: {
    createSiteAerien: jest.fn(),
    updateSiteAerien: jest.fn(),
    deplacerSiteAerien: jest.fn(),
    createVol: jest.fn(),
  },
  statutHttpDe: (error: unknown) => {
    const statut = (error as { status?: number } | null)?.status;
    return typeof statut === 'number' ? statut : null;
  },
  versionServeurDe: (error: unknown) => (error as { serverVersion?: unknown } | null)?.serverVersion ?? null,
}));
// Fabrique explicite : l'automock chargerait le vrai module, donc `expo-sqlite`.
jest.mock('../src/lib/site-aerien-db', () => ({
  listSitesEnAttente: jest.fn(),
  listDeplacementsEnAttente: jest.fn(),
  getStatutSite: jest.fn(),
  marquerSiteSynchronise: jest.fn(),
  marquerSiteEnEchec: jest.fn(),
  marquerDeplacementSynchronise: jest.fn(),
  marquerDeplacementEnEchec: jest.fn(),
}));

const base = {
  parent_site_id: null,
  equipe_id: 'eq-1',
  numero: '03',
  localite: 'Isoanala',
  latitude: -21.8135,
  longitude: 46.0432,
  altitude: 893,
  date_debut_position: '2026-09-24',
  statut_sync: 'local' as const,
};
const principal = { ...base, id: 'pr-1' };
const stand = { ...base, id: 'st-1', parent_site_id: 'pr-1', equipe_id: null, numero: '01' };

const deplacement = {
  id: 'dp-1',
  site_id: 'pr-1',
  numero: '04',
  localite: 'Ambatobe',
  latitude: -22,
  longitude: 46.5,
  altitude: null,
  renomme: 1,
  dependants_json: JSON.stringify(['st-1']),
  vol_json: null as string | null,
  cree_le: '2026-09-24T08:00:00.000Z',
  statut_sync: 'local',
  erreur: null,
};

const avecStatut = (statut: number, message: string) => Object.assign(new NetworkError(message), { status: statut });

const statuts = new Map<string, string>();

beforeEach(() => {
  jest.resetAllMocks();
  statuts.clear();
  jest.mocked(db.listSitesEnAttente).mockResolvedValue([]);
  jest.mocked(db.listDeplacementsEnAttente).mockResolvedValue([]);
  jest.mocked(db.getStatutSite).mockImplementation(async (id) => (statuts.get(id) ?? 'synced') as 'synced');
  jest.mocked(db.marquerSiteSynchronise).mockImplementation(async (id) => void statuts.set(id, 'synced'));
  jest.mocked(apiClient.createSiteAerien).mockResolvedValue({} as never);
  jest.mocked(apiClient.deplacerSiteAerien).mockResolvedValue([] as never);
  jest.mocked(apiClient.updateSiteAerien).mockResolvedValue({} as never);
  jest.mocked(apiClient.createVol).mockResolvedValue({} as never);
});

describe('synchroniserSitesAeriens — création', () => {
  it('envoie le principal puis ses dépendants, avec id client, équipe et position initiale', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([principal, stand]);
    statuts.set('pr-1', 'local');

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.reussies).toEqual(['pr-1', 'st-1']);
    const [premier, second] = jest.mocked(apiClient.createSiteAerien).mock.calls;
    expect(premier[1]).toEqual({
      id: 'pr-1',
      numero: '03',
      localite: 'Isoanala',
      equipe_id: 'eq-1',
      position: { latitude: -21.8135, longitude: 46.0432, altitude: 893 },
    });
    expect(second[1]).toEqual({
      id: 'st-1',
      numero: '01',
      localite: 'Isoanala',
      parent_site_id: 'pr-1',
      position: { latitude: -21.8135, longitude: 46.0432, altitude: 893 },
    });
    expect(db.marquerSiteSynchronise).toHaveBeenNthCalledWith(1, 'pr-1');
  });

  it('un site sans position connue part sans position initiale', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([{ ...principal, latitude: null, longitude: null }]);

    await synchroniserSitesAeriens('jeton');

    expect(jest.mocked(apiClient.createSiteAerien).mock.calls[0][1]).not.toHaveProperty('position');
  });

  it('garde le dépendant dans la file tant que son principal n’est pas parti', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([principal, stand]);
    statuts.set('pr-1', 'local');
    jest.mocked(apiClient.createSiteAerien).mockRejectedValueOnce(avecStatut(503, 'indisponible'));

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.reussies).toEqual([]);
    expect(resume.echouees.map((f) => [f.id, f.sort])).toEqual([
      ['pr-1', 'file'],
      ['st-1', 'file'],
    ]);
    // Le dépendant n'a même pas été tenté : inutile de provoquer un 409 côté serveur.
    expect(apiClient.createSiteAerien).toHaveBeenCalledTimes(1);
    expect(db.marquerSiteEnEchec).not.toHaveBeenCalled();
  });

  it('rejoue un dépendant que le serveur dit « parent inconnu » (409) au lieu de le mettre en échec', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([stand]);
    jest
      .mocked(apiClient.createSiteAerien)
      .mockRejectedValueOnce(avecStatut(409, 'parent_site_id inconnu du serveur, à rejouer après son principal : pr-1'));

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.echouees[0]).toMatchObject({ id: 'st-1', sort: 'file' });
    expect(db.marquerSiteEnEchec).not.toHaveBeenCalled();
  });

  it('sort de la file un site refusé par le serveur (numéro déjà pris), avec le motif lisible', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([principal]);
    jest.mocked(apiClient.createSiteAerien).mockRejectedValueOnce(avecStatut(409, 'numero déjà pris : 03'));

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.echouees[0]).toMatchObject({ id: 'pr-1', sort: 'echec', message: 'numero déjà pris : 03' });
    expect(db.marquerSiteEnEchec).toHaveBeenCalledWith('pr-1');
  });
});

describe('synchroniserSitesAeriens — déplacement', () => {
  it('renomme si besoin, déplace le groupe puis envoie le vol de mise en place', async () => {
    const vol = { id: 'vo-1', type: 'mise_en_place', stand_id: 'st-1' };
    jest
      .mocked(db.listDeplacementsEnAttente)
      .mockResolvedValue([{ ...deplacement, vol_json: JSON.stringify(vol) }]);

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.reussies).toEqual(['dp-1']);
    expect(apiClient.updateSiteAerien).toHaveBeenCalledWith('jeton', 'pr-1', { numero: '04', localite: 'Ambatobe' });
    expect(apiClient.deplacerSiteAerien).toHaveBeenCalledWith('jeton', 'pr-1', {
      latitude: -22,
      longitude: 46.5,
      altitude: null,
      dependants: ['st-1'],
    });
    expect(apiClient.createVol).toHaveBeenCalledWith('jeton', vol);
    const ordre = [
      jest.mocked(apiClient.updateSiteAerien).mock.invocationCallOrder[0],
      jest.mocked(apiClient.deplacerSiteAerien).mock.invocationCallOrder[0],
      jest.mocked(apiClient.createVol).mock.invocationCallOrder[0],
    ];
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
    expect(db.marquerDeplacementSynchronise).toHaveBeenCalledWith('dp-1');
  });

  it('ne renomme pas quand numéro et localité sont inchangés, et sans vol n’en envoie pas', async () => {
    jest.mocked(db.listDeplacementsEnAttente).mockResolvedValue([{ ...deplacement, renomme: 0 }]);

    await synchroniserSitesAeriens('jeton');

    expect(apiClient.updateSiteAerien).not.toHaveBeenCalled();
    expect(apiClient.createVol).not.toHaveBeenCalled();
  });

  it('attend la création du site avant de le déplacer', async () => {
    jest.mocked(db.listDeplacementsEnAttente).mockResolvedValue([deplacement]);
    statuts.set('st-1', 'local');

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.echouees[0]).toMatchObject({ id: 'dp-1', sort: 'file' });
    expect(apiClient.deplacerSiteAerien).not.toHaveBeenCalled();
  });

  it('envoie les créations avant les déplacements dans le même passage', async () => {
    jest.mocked(db.listSitesEnAttente).mockResolvedValue([principal]);
    jest.mocked(db.listDeplacementsEnAttente).mockResolvedValue([{ ...deplacement, dependants_json: '[]' }]);
    statuts.set('pr-1', 'local');

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.reussies).toEqual(['pr-1', 'dp-1']);
  });

  it('un déplacement refusé (422) sort de la file avec son motif', async () => {
    jest.mocked(db.listDeplacementsEnAttente).mockResolvedValue([deplacement]);
    jest
      .mocked(apiClient.deplacerSiteAerien)
      .mockRejectedValueOnce(avecStatut(422, 'dependants invalide (inconnu ou rattaché à un autre principal)'));

    const resume = await synchroniserSitesAeriens('jeton');

    expect(resume.echouees[0]).toMatchObject({ id: 'dp-1', sort: 'echec' });
    expect(db.marquerDeplacementEnEchec).toHaveBeenCalledWith('dp-1');
    expect(apiClient.createVol).not.toHaveBeenCalled();
  });
});
