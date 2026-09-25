import { checkAndSyncFiches } from '../src/hooks/use-fiches-auto-sync';
import { lignesEnAttente, resetLoggerForTests } from '../src/lib/logger';

const getNetworkStateAsync = jest.fn();
jest.mock('expo-network', () => ({
  getNetworkStateAsync: (...args: unknown[]) => getNetworkStateAsync(...args),
}));

// Même raison que use-referentiel-auto-sync.test.ts : le module porte aussi
// `useFichesAutoSync` (hook React), qui importe `AppState` au niveau du
// fichier — sous ts-jest (projet `logic`, node), un import non mocké de
// `react-native` casse au chargement.
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const listUnsyncedTraitements = jest.fn();
const syncAllTraitements = jest.fn();
jest.mock('@/lib/traitement-repository', () => ({
  listUnsyncedTraitements: (...args: unknown[]) => listUnsyncedTraitements(...args),
}));
jest.mock('@/lib/traitement-sync', () => ({
  syncAllTraitements: (...args: unknown[]) => syncAllTraitements(...args),
}));

const synchroniserSitesAeriens = jest.fn();
jest.mock('@/lib/site-aerien-sync', () => ({
  synchroniserSitesAeriens: (...args: unknown[]) => synchroniserSitesAeriens(...args),
}));

const synchroniserStock = jest.fn();
jest.mock('@/lib/stock-sync', () => ({
  synchroniserStock: (...args: unknown[]) => synchroniserStock(...args),
}));

function enLigne() {
  getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
}

const UN_TRAITEMENT = { id: 'trait-1' } as any;

beforeEach(() => {
  getNetworkStateAsync.mockReset();
  listUnsyncedTraitements.mockReset().mockResolvedValue([]);
  syncAllTraitements.mockReset().mockResolvedValue({ reussies: [], echouees: [], conflits: [] });
  synchroniserSitesAeriens.mockReset().mockResolvedValue({ reussies: [], echouees: [], conflits: [] });
  synchroniserStock.mockReset().mockResolvedValue({ reussies: [], echouees: [], conflits: [] });
  resetLoggerForTests();
});

describe('checkAndSyncFiches — sites aériens (#643)', () => {
  it('envoie les sites saisis sur le terrain quand la connectivité revient', async () => {
    enLigne();

    await checkAndSyncFiches('tok', false);

    expect(synchroniserSitesAeriens).toHaveBeenCalledWith('tok');
  });

  it('n’envoie rien quand la connectivité était déjà là', async () => {
    enLigne();

    await checkAndSyncFiches('tok', true);

    expect(synchroniserSitesAeriens).not.toHaveBeenCalled();
  });

  it('une panne côté sites n’empêche pas les traitements', async () => {
    enLigne();
    listUnsyncedTraitements.mockResolvedValue([UN_TRAITEMENT]);
    synchroniserSitesAeriens.mockRejectedValue(new Error('SQLite indisponible'));

    const apres = await checkAndSyncFiches('tok', false);

    expect(syncAllTraitements).toHaveBeenCalled();
    expect(apres).toBe(true);
  });
});

describe('checkAndSyncFiches — stock de pesticides (#645)', () => {
  it('envoie les mouvements de stock quand la connectivité revient', async () => {
    enLigne();
    await checkAndSyncFiches('tok', false);
    expect(synchroniserStock).toHaveBeenCalledWith('tok');
  });

  it('une panne côté stock n’empêche pas les traitements', async () => {
    enLigne();
    listUnsyncedTraitements.mockResolvedValue([UN_TRAITEMENT]);
    synchroniserStock.mockRejectedValue(new Error('réseau'));
    await checkAndSyncFiches('tok', false);
    expect(syncAllTraitements).toHaveBeenCalled();
  });
});

describe('checkAndSyncFiches — #synchronisation-automatique', () => {
  it('synchronise les traitements quand la connectivité revient, avec des fiches en attente', async () => {
    enLigne();
    listUnsyncedTraitements.mockResolvedValue([UN_TRAITEMENT]);

    const apres = await checkAndSyncFiches('tok', false);

    expect(syncAllTraitements).toHaveBeenCalledWith([UN_TRAITEMENT], 'tok');
    expect(apres).toBe(true);
  });

  it('ne synchronise rien quand la connectivité était déjà là', async () => {
    enLigne();

    await checkAndSyncFiches('tok', true);

    expect(listUnsyncedTraitements).not.toHaveBeenCalled();
    expect(syncAllTraitements).not.toHaveBeenCalled();
  });

  it('n’appelle pas syncAllTraitements quand il n’y a rien en attente', async () => {
    enLigne();

    await checkAndSyncFiches('tok', false);

    expect(listUnsyncedTraitements).toHaveBeenCalled();
    expect(syncAllTraitements).not.toHaveBeenCalled();
  });

  it('rend l’état de connectivité observé, même hors ligne', async () => {
    getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    const apres = await checkAndSyncFiches('tok', true);

    expect(apres).toBe(false);
    expect(syncAllTraitements).not.toHaveBeenCalled();
  });

  it('un échec de lecture des traitements est journalisé, sans rejeter', async () => {
    enLigne();
    listUnsyncedTraitements.mockRejectedValue(new Error('SQLite indisponible'));

    const apres = await checkAndSyncFiches('tok', false);

    expect(apres).toBe(true);
    const echecs = lignesEnAttente().filter((l) => l.event === 'sync.auto.traitements.failed');
    expect(echecs).toHaveLength(1);
  });

  it('ne redéclenche pas de synchronisation à chaque tour après un seul passage réussi', async () => {
    enLigne();
    listUnsyncedTraitements.mockResolvedValue([UN_TRAITEMENT]);

    const apres1 = await checkAndSyncFiches('tok', false);
    await checkAndSyncFiches('tok', apres1);

    expect(syncAllTraitements).toHaveBeenCalledTimes(1);
  });

  it('journalise même une panne du relevé de connectivité, sans jamais rejeter', async () => {
    getNetworkStateAsync.mockRejectedValue(new Error('module réseau indisponible'));

    await expect(checkAndSyncFiches('tok', false)).resolves.toBe(false);

    const echecs = lignesEnAttente().filter((l) => l.event === 'sync.auto.fiches.failed');
    expect(echecs).toHaveLength(1);
  });
});
