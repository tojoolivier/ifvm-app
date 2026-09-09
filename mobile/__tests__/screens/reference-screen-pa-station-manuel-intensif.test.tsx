/**
 * #manuel-referentiel-pa-station : en Prospection Intensive, le mode Manuel du
 * champ PA/Station bascule sur un sélecteur du référentiel (au lieu de la
 * saisie libre historique), avec filtrage Station selon le PA choisi. La
 * Prospection Extensive garde la saisie libre inchangée — non-régression
 * vérifiée en fin de fichier.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

// Laisse un vrai tick s'écouler entre une interaction et la suivante — un
// `act(async () => {})` manuel imbriqué dans celui déjà posé par `fireEvent`
// casse le suivi interne des scopes act() (leçon déjà tirée ailleurs dans ce
// dépôt, cf. traitement-rotations-screen.test.tsx).
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: 1200 }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
  LocationPermissionDeniedError: class LocationPermissionDeniedError extends Error {},
}));

const PA_MAHAJANGA = { id: 'pa-1', code: 'PA-MJA', nom: 'PA Mahajanga', zaId: 'za-1' };
const PA_MORONDAVA = { id: 'pa-2', code: 'PA-MOR', nom: 'PA Morondava', zaId: 'za-1' };
const STATION_A1 = {
  id: 'st-1', code: 'ST-A1', nom: 'Station A1', paId: 'pa-1',
  latitude: -15.7, longitude: 46.3, altitude: null, commune: 'Mahajanga I', district: 'Mahajanga I', region: 'Boeny',
};
const STATION_B1 = {
  id: 'st-2', code: 'ST-B1', nom: 'Station B1', paId: 'pa-2',
  latitude: -20.3, longitude: 44.3, altitude: null, commune: 'Morondava', district: 'Morondava', region: 'Menabe',
};

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn(),
  listStationsByPoste: jest.fn(),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

const draftIntensif = {
  id: 'draft-123',
  type_prospection: 'intensive',
  campagne_id: 'campagne-1',
  prospecteur_id: 'prospecteur-1',
  station_id: null,
};

function renderEcran() {
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <ReferenceScreen />
    </SafeAreaProvider>
  );
}

async function ouvrirManuelPa() {
  fireEvent.press(screen.getAllByText('Manuel', { exact: true })[0]);
  await settle();
}

async function ouvrirManuelStation() {
  fireEvent.press(screen.getAllByText('Manuel', { exact: true })[1]);
  await settle();
}

describe('ReferenceScreen — PA/Station en mode Manuel, Prospection Intensive', () => {
  beforeEach(() => {
    jest.mocked(referentielDb.listPostesAcridiens).mockResolvedValue([PA_MAHAJANGA, PA_MORONDAVA]);
    jest.mocked(referentielDb.listStationsByPoste).mockImplementation(async (paId: string) =>
      [STATION_A1, STATION_B1].filter((s) => s.paId === paId)
    );
    useProspectionWizardStore.setState({ draft: draftIntensif as any, captures: [] });
  });

  it('affiche un sélecteur (pas de saisie libre) pour PA en mode Manuel', async () => {
    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    await ouvrirManuelPa();

    expect(await screen.findByText('Sélectionner un poste acridien')).toBeVisible();
    expect(screen.queryByPlaceholderText('Saisir le nom du poste acridien')).toBeNull();
  });

  it('sélectionner un PA filtre la Station sur les stations qui lui sont rattachées', async () => {
    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    await ouvrirManuelPa();
    fireEvent.press(await screen.findByText('Sélectionner un poste acridien'));
    fireEvent.press(await screen.findByText('PA Mahajanga'));
    await settle();

    await waitFor(() => expect(referentielDb.listStationsByPoste).toHaveBeenCalledWith('pa-1'));

    await ouvrirManuelStation();
    fireEvent.press(await screen.findByText('Sélectionner une station'));

    expect(await screen.findByText('Station A1')).toBeVisible();
    expect(screen.queryByText('Station B1')).toBeNull();
  });

  it('changer de PA après avoir choisi une station la réinitialise (§8)', async () => {
    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    await ouvrirManuelPa();
    fireEvent.press(await screen.findByText('Sélectionner un poste acridien'));
    fireEvent.press(await screen.findByText('PA Mahajanga'));
    await settle();

    await ouvrirManuelStation();
    fireEvent.press(await screen.findByText('Sélectionner une station'));
    fireEvent.press(await screen.findByText('Station A1'));
    await settle();

    expect(await screen.findByText('Station A1')).toBeVisible();

    // Changement de PA — la station précédente n'est plus rattachée.
    fireEvent.press(screen.getByText('PA Mahajanga'));
    await settle();
    fireEvent.press(await screen.findByText('PA Morondava'));
    await settle();

    expect(screen.queryByText('Station A1')).toBeNull();
    expect(await screen.findByText('Sélectionner une station')).toBeVisible();
  });

  it('bloque la Station tant que le PA n’est pas choisi', async () => {
    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    await ouvrirManuelStation(); // Station seule, sans PA

    expect(await screen.findByText("Choisissez d'abord un poste acridien")).toBeVisible();
  });

  it('enregistre pa_code et stationId (pas null) une fois PA/Station choisis en manuel', async () => {
    await renderEcran();
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    await ouvrirManuelPa();
    fireEvent.press(await screen.findByText('Sélectionner un poste acridien'));
    fireEvent.press(await screen.findByText('PA Mahajanga'));
    await settle();

    await ouvrirManuelStation();
    fireEvent.press(await screen.findByText('Sélectionner une station'));
    fireEvent.press(await screen.findByText('Station A1'));
    await settle();

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10');
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Xérophyle'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionReference).toHaveBeenCalled());
    const payload = jest.mocked(prospectionRepository.updateProspectionReference).mock.calls[0][1];
    expect(payload.pa_code).toBe('PA-MJA');
    expect(payload.pa_nom).toBe('PA Mahajanga');
    expect(payload.stationId).toBe('st-1');
    expect(payload.station_nom).toBe('Station A1');

    // Laisse les effets déclenchés par les changements de PA/Station (fetch
    // referentiel-db) se résoudre avant le démontage — sans ce tick, leur
    // callback peut retomber pendant le rendu du test suivant et casser le
    // suivi act() de ce dernier (observé : la suite « Extensive » qui suit
    // dans ce fichier).
    await settle();
  });
});
