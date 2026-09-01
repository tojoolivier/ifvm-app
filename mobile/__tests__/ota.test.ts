import {
  deriverEtat,
  doitVerifierAuto,
  formatDateMaj,
  infosCourantes,
  formatDernierCheck,
  formatVersionBuild,
  infosTechniques,
  libelleEtat,
  parseDernierCheck,
  verifierMaintenant,
  type DernierCheck,
} from '../src/lib/ota';
import { lignesEnAttente, resetLoggerForTests } from '../src/lib/logger';

const checkForUpdateAsync = jest.fn();
const fetchUpdateAsync = jest.fn();
jest.mock('expo-updates', () => ({
  get isEnabled() {
    return true;
  },
  updateId: 'uuid-courant',
  channel: 'production',
  runtimeVersion: 'rt-1',
  checkForUpdateAsync: (...a: unknown[]) => checkForUpdateAsync(...a),
  fetchUpdateAsync: (...a: unknown[]) => fetchUpdateAsync(...a),
  reloadAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.0', ios: { buildNumber: '42' }, android: { versionCode: 42 } } },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
}));

const getItem = jest.fn();
const setItem = jest.fn();
jest.mock('@/lib/storage', () => ({
  storage: {
    getItem: (...a: unknown[]) => getItem(...a),
    setItem: (...a: unknown[]) => setItem(...a),
  },
}));

beforeEach(() => {
  checkForUpdateAsync.mockReset();
  fetchUpdateAsync.mockReset();
  getItem.mockReset().mockResolvedValue(null);
  setItem.mockReset().mockResolvedValue(undefined);
  resetLoggerForTests();
});

describe('deriverEtat', () => {
  const base = { isEnabled: true, isUpdateAvailable: false, isDownloading: false, isUpdatePending: false };

  it('indisponible quand expo-updates est désactivé', () => {
    expect(deriverEtat({ ...base, isEnabled: false })).toBe('indisponible');
  });
  it('prete prime sur telechargement', () => {
    expect(deriverEtat({ ...base, isDownloading: true, isUpdatePending: true })).toBe('prete');
  });
  it('telechargement quand ça télécharge', () => {
    expect(deriverEtat({ ...base, isDownloading: true })).toBe('telechargement');
  });
  it('disponible quand une maj est trouvée mais pas encore téléchargée', () => {
    expect(deriverEtat({ ...base, isUpdateAvailable: true })).toBe('disponible');
  });
  it('a-jour sinon', () => {
    expect(deriverEtat(base)).toBe('a-jour');
  });
});

describe('formatage', () => {
  it('formatVersionBuild avec et sans build', () => {
    expect(formatVersionBuild('1.2.0', '42')).toBe('Version 1.2.0 (build 42)');
    expect(formatVersionBuild('1.2.0', null)).toBe('Version 1.2.0');
    expect(formatVersionBuild(null, '42')).toBe('Version inconnue');
  });

  it('formatDateMaj : bundle embarqué => pas de date', () => {
    expect(formatDateMaj(new Date('2026-08-28'), true)).toContain("Version d'origine");
    expect(formatDateMaj(undefined, false)).toContain("Version d'origine");
  });

  it('formatDateMaj : bundle téléchargé => date FR', () => {
    // Midi local : la partie date est stable quel que soit le fuseau du CI.
    expect(formatDateMaj(new Date(2026, 7, 28, 12, 0, 0), false)).toBe('Mise à jour du 28/08/2026');
  });

  it('infosTechniques liste les cinq champs, avec repli lisible', () => {
    const txt = infosTechniques({
      version: '1.2.0',
      build: '42',
      updateId: null,
      runtimeVersion: 'rt-1',
      channel: undefined,
    });
    expect(txt).toContain('Update ID : (bundle embarqué)');
    expect(txt).toContain('Canal : —');
    expect(txt.split('\n')).toHaveLength(5);
  });

  it('libelleEtat couvre tous les états', () => {
    (['indisponible', 'a-jour', 'disponible', 'telechargement', 'prete'] as const).forEach((e) => {
      expect(libelleEtat(e).length).toBeGreaterThan(0);
    });
  });
});

describe('infosCourantes', () => {
  it('reprend les champs de currentlyRunning quand ils sont là', () => {
    const d = new Date(2026, 7, 28);
    expect(
      infosCourantes({ updateId: 'x', runtimeVersion: 'y', channel: 'z', createdAt: d, isEmbeddedLaunch: true })
    ).toEqual({ updateId: 'x', runtimeVersion: 'y', channel: 'z', createdAt: d, isEmbeddedLaunch: true });
  });

  it('retombe sur les constantes Updates.* quand currentlyRunning est vide', () => {
    expect(infosCourantes({ isEmbeddedLaunch: false })).toEqual({
      updateId: 'uuid-courant',
      runtimeVersion: 'rt-1',
      channel: 'production',
      createdAt: undefined,
      isEmbeddedLaunch: false,
    });
  });
});

describe('parseDernierCheck', () => {
  it('null sur entrée vide ou JSON cassé', () => {
    expect(parseDernierCheck(null)).toBeNull();
    expect(parseDernierCheck('{pas du json')).toBeNull();
  });
  it('null sur forme inattendue', () => {
    expect(parseDernierCheck('{"at":"x","resultat":"autre"}')).toBeNull();
    expect(parseDernierCheck('{"resultat":"a-jour"}')).toBeNull();
  });
  it('rend la valeur sur forme valide', () => {
    expect(parseDernierCheck('{"at":"2026-09-01T00:00:00Z","resultat":"echec"}')).toEqual({
      at: '2026-09-01T00:00:00Z',
      resultat: 'echec',
    });
  });
});

describe('formatDernierCheck', () => {
  const t0 = new Date('2026-09-01T12:00:00Z');
  it('« jamais » quand rien de persisté', () => {
    expect(formatDernierCheck(null, t0)).toBe('Dernière vérification : jamais');
  });
  it('minutes, heures, jours', () => {
    const min: DernierCheck = { at: '2026-09-01T11:45:00Z', resultat: 'a-jour' };
    const h: DernierCheck = { at: '2026-09-01T09:00:00Z', resultat: 'a-jour' };
    const j: DernierCheck = { at: '2026-08-29T12:00:00Z', resultat: 'a-jour' };
    expect(formatDernierCheck(min, t0)).toBe('Dernière vérification : il y a 15 min');
    expect(formatDernierCheck(h, t0)).toBe('Dernière vérification : il y a 3 h');
    expect(formatDernierCheck(j, t0)).toBe('Dernière vérification : il y a 3 j');
  });
  it('marque l’échec', () => {
    const e: DernierCheck = { at: '2026-09-01T09:00:00Z', resultat: 'echec' };
    expect(formatDernierCheck(e, t0)).toBe('Dernière vérification : échec il y a 3 h');
  });
});

describe('doitVerifierAuto', () => {
  const t0 = new Date('2026-09-01T12:00:00Z');
  it('vrai si jamais vérifié', () => {
    expect(doitVerifierAuto(null, t0, 1000)).toBe(true);
  });
  it('faux si dans la fenêtre, vrai au-delà', () => {
    const recent: DernierCheck = { at: '2026-09-01T11:59:00Z', resultat: 'a-jour' };
    const vieux: DernierCheck = { at: '2026-09-01T09:00:00Z', resultat: 'a-jour' };
    expect(doitVerifierAuto(recent, t0, 6 * 60 * 60 * 1000)).toBe(false);
    expect(doitVerifierAuto(vieux, t0, 60 * 60 * 1000)).toBe(true);
  });
});

describe('verifierMaintenant', () => {
  it('télécharge et persiste « maj-trouvee » quand une maj est disponible', async () => {
    checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    fetchUpdateAsync.mockResolvedValue({ isNew: true });

    const outcome = await verifierMaintenant();

    expect(fetchUpdateAsync).toHaveBeenCalled();
    expect(outcome).toEqual({ ok: true, value: expect.objectContaining({ resultat: 'maj-trouvee' }) });
    expect(setItem).toHaveBeenCalledWith('ota_dernier_check', expect.stringContaining('maj-trouvee'));
  });

  it('persiste « a-jour » et ne télécharge pas quand rien de neuf', async () => {
    checkForUpdateAsync.mockResolvedValue({ isAvailable: false });

    const outcome = await verifierMaintenant();

    expect(fetchUpdateAsync).not.toHaveBeenCalled();
    expect(outcome.ok && outcome.value.resultat).toBe('a-jour');
  });

  it('journalise l’échec sans rejeter, et persiste « echec »', async () => {
    checkForUpdateAsync.mockRejectedValue(new Error('réseau injoignable'));

    const outcome = await verifierMaintenant();

    expect(outcome.ok).toBe(false);
    expect(setItem).toHaveBeenCalledWith('ota_dernier_check', expect.stringContaining('echec'));
    const echecs = lignesEnAttente().filter((l) => l.event === 'ota.check.failed');
    expect(echecs).toHaveLength(1);
    expect(echecs[0].traitement).toBe('JOURNAL');
  });
});
