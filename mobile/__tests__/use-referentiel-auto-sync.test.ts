import { checkAndSyncReferentiel } from '../src/hooks/use-referentiel-auto-sync';
import {
  lignesEnAttente,
  resetLoggerForTests,
} from '../src/lib/logger';

const getNetworkStateAsync = jest.fn();
jest.mock('expo-network', () => ({
  getNetworkStateAsync: (...args: unknown[]) => getNetworkStateAsync(...args),
}));

// `checkAndSyncReferentiel` n'importe pas `react-native`, mais le module qui
// le porte importe aussi `AppState` au niveau du fichier, pour le hook React
// `useReferentielAutoSync` défini juste à côté — sous ts-jest (projet
// `logic`, node), un import non mocké de `react-native` casse au chargement.
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const pullReferentiel = jest.fn();
jest.mock('@/lib/referentiel-sync', () => ({
  pullReferentiel: (...args: unknown[]) => pullReferentiel(...args),
}));

function enLigne() {
  getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
}

beforeEach(() => {
  getNetworkStateAsync.mockReset();
  pullReferentiel.mockReset();
  resetLoggerForTests();
});

/*
 * C'est le hook VIVANT (celui que les deux `_layout.tsx` montent). Il a
 * longtemps eu un homonyme mort, `lib/referentiel-auto-sync.ts`, qu'aucun
 * écran n'importait (#187, supprimé en #188). Son `catch { console.warn }`
 * était le dernier échec avalé du chemin référentiel — trouvé en revue de
 * #173 précisément parce que le jumeau mort, lui, avait été soigné à sa place.
 */
describe('checkAndSyncReferentiel', () => {
  it('tire le pull quand la connectivité revient', async () => {
    enLigne();
    pullReferentiel.mockResolvedValue(undefined);

    const apres = await checkAndSyncReferentiel('tok', false);

    expect(pullReferentiel).toHaveBeenCalledWith('tok');
    expect(apres).toBe(true);
  });

  it('ne tire pas le pull quand la connectivité était déjà là', async () => {
    enLigne();

    await checkAndSyncReferentiel('tok', true);

    expect(pullReferentiel).not.toHaveBeenCalled();
  });

  it('journalise un pull en échec au lieu de l’avaler, sans jamais rejeter', async () => {
    enLigne();
    pullReferentiel.mockRejectedValue(new Error('serveur injoignable'));

    // `runTask` ne rejette jamais : la promesse du hook peut flotter sans
    // filet, c'est la définition même de la frontière (ADR-012 décision 1).
    // L'état rendu reste `true` : la connectivité, elle, a bien été observée
    // — seul le pull a échoué. Le confondre avec « hors ligne » ferait croire
    // à une déconnexion qui n'a pas eu lieu, et le prochain passage
    // redéclencherait un pull à chaque tour au lieu d'un seul.
    await expect(checkAndSyncReferentiel('tok', false)).resolves.toBe(true);

    const echecs = lignesEnAttente().filter((l) => l.event === 'sync.referentiel.failed');
    expect(echecs).toHaveLength(1);
    expect(echecs[0].traitement).toBe('JOURNAL');
  });

  it('rend l’état de connectivité observé, même sur échec du pull', async () => {
    getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    const apres = await checkAndSyncReferentiel('tok', true);

    expect(apres).toBe(false);
    expect(pullReferentiel).not.toHaveBeenCalled();
  });

  it('journalise même une panne du relevé de connectivité', async () => {
    getNetworkStateAsync.mockRejectedValue(new Error('module réseau indisponible'));

    // L'état rendu est « hors ligne » : la prochaine reconnexion re-déclenchera.
    await expect(checkAndSyncReferentiel('tok', false)).resolves.toBe(false);

    const echecs = lignesEnAttente().filter((l) => l.event === 'sync.referentiel.failed');
    expect(echecs).toHaveLength(1);
  });

  it('ne redéclenche pas un pull à chaque tour après un seul échec de pull', async () => {
    // Reproduit le bug trouvé pendant l'écriture de ce test : si un pull en
    // échec rendait `false`, l'appelant garderait `wasConnected = false` tout
    // en étant connecté, et chaque tour suivant redéclencherait un pull.
    enLigne();
    pullReferentiel.mockRejectedValueOnce(new Error('serveur injoignable'));
    pullReferentiel.mockResolvedValue(undefined);

    const apresEchec = await checkAndSyncReferentiel('tok', false);
    await checkAndSyncReferentiel('tok', apresEchec);

    expect(pullReferentiel).toHaveBeenCalledTimes(1);
  });
});
