/**
 * #prospection-distance-200m — la règle anti-doublon par proximité (#107,
 * §2.2 point 16 du manuel : moins de 200 m et 2 h d'une fiche soumise par un
 * autre prospecteur) est supprimée, pas seulement débloquée. Avant ce
 * correctif, elle n'empêchait déjà pas l'enregistrement (simple avertissement
 * non bloquant, cf. l'ancien test « ne bloque jamais l'enregistrement » sur
 * validateAntiDoublon) — mais elle reste désormais totalement absente : plus
 * aucune recherche de fiches proches, plus aucun avertissement à ce sujet, à
 * quelque distance que ce soit.
 *
 * Fichier séparé de reference-screen.test.tsx : ce dernier a un état encore
 * en observation avec plusieurs tests successifs (fireEvent + attente d'un
 * enregistrement réel) qui peut laisser des effets asynchrones du montage
 * (capture GPS) se résoudre après le démontage et perturber le rendu du test
 * suivant dans le même fichier — même prudence que les autres écrans de
 * prospection déjà scindés en plusieurs fichiers pour cette raison
 * (reference-gps-precision.test.tsx, reference-biotope-restore.test.tsx, etc.).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

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

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

describe('ReferenceScreen — plus aucune règle de distance entre prospections', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        campagne_id: 'campagne-1',
        prospecteur_id: 'prospecteur-1',
        station_id: null,
      } as any,
      captures: [],
    });
  });

  it('enregistre sans aucun avertissement de proximité — aucune recherche de fiche proche n’est même effectuée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10');
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Xérophyle'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionReference).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('vérifier'), expect.anything());
    expect(alertSpy).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Doublon'));
  });
});
