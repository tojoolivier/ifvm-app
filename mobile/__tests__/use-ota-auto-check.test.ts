import { INTERVALLE_CHECK_AUTO_MS, verifierOtaSiNecessaire } from '../src/hooks/use-ota-auto-check';

const otaActif = jest.fn();
const lireDernierCheck = jest.fn();
const verifierMaintenant = jest.fn();

// `doitVerifierAuto` (fonction pure) est couverte à part dans `ota.test.ts` ;
// ici on la remplace par sa vraie logique de fenêtre, sans charger la chaîne
// `expo-constants` que ce test n'a aucune raison de tirer.
jest.mock('@/lib/ota', () => ({
  otaActif: () => otaActif(),
  lireDernierCheck: () => lireDernierCheck(),
  verifierMaintenant: () => verifierMaintenant(),
  doitVerifierAuto: (dc: { at: string } | null, maintenant: Date, intervalle: number) =>
    !dc || maintenant.getTime() - new Date(dc.at).getTime() >= intervalle,
}));

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

beforeEach(() => {
  otaActif.mockReset().mockReturnValue(true);
  lireDernierCheck.mockReset().mockResolvedValue(null);
  verifierMaintenant.mockReset().mockResolvedValue({ ok: true, value: { at: '', resultat: 'a-jour' } });
});

describe('verifierOtaSiNecessaire', () => {
  it('ne fait rien si expo-updates est désactivé', async () => {
    otaActif.mockReturnValue(false);
    await verifierOtaSiNecessaire();
    expect(verifierMaintenant).not.toHaveBeenCalled();
  });

  it('vérifie quand aucun check antérieur', async () => {
    await verifierOtaSiNecessaire(new Date('2026-09-01T12:00:00Z'));
    expect(verifierMaintenant).toHaveBeenCalled();
  });

  it('ne revérifie pas dans la fenêtre de 6 h', async () => {
    lireDernierCheck.mockResolvedValue({ at: '2026-09-01T11:00:00Z', resultat: 'a-jour' });
    await verifierOtaSiNecessaire(new Date('2026-09-01T12:00:00Z'));
    expect(verifierMaintenant).not.toHaveBeenCalled();
  });

  it('revérifie au-delà de la fenêtre', async () => {
    const vieux = new Date(Date.now() - INTERVALLE_CHECK_AUTO_MS - 1000).toISOString();
    lireDernierCheck.mockResolvedValue({ at: vieux, resultat: 'a-jour' });
    await verifierOtaSiNecessaire();
    expect(verifierMaintenant).toHaveBeenCalled();
  });

  it('une lecture du dernier check en échec ne bloque pas la vérification', async () => {
    lireDernierCheck.mockRejectedValue(new Error('stockage HS'));
    await verifierOtaSiNecessaire();
    expect(verifierMaintenant).toHaveBeenCalled();
  });
});
