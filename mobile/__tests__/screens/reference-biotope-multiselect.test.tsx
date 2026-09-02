/**
 * #biotope-multi : le champ Biotopes de la fiche Intensive devient à choix multiples.
 * Un seul rendu par fichier — monter cet écran plusieurs fois dans le même fichier fait
 * fuiter la chaîne de promesses GPS d'un test vers l'autre (act() qui se chevauchent),
 * même mise en garde documentée par reference-screen-restore.test.tsx. Les scénarios
 * « sélection unique », « sélection multiple » et « décocher un élément » sont donc
 * couverts en une seule séquence d'interactions sur un seul montage — cf.
 * reference-biotope-requis.test.tsx et reference-biotope-restore.test.tsx pour les
 * deux autres scénarios (chacun son propre fichier, pour la même raison).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
  listProspectionsRecentesAutresProspecteurs: jest.fn().mockResolvedValue([]),
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

describe('ReferenceScreen — Biotopes à choix multiples (#biotope-multi)', () => {
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

  it('sélection unique, puis multiple, puis décocher un élément — seuls les biotopes encore cochés sont enregistrés', async () => {
    await render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    // 1. Sélection unique.
    fireEvent.press(screen.getByText('Xérophyle'));
    await settle();
    expect(screen.getByText(/^Xérophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    // 2. Sélection multiple : Mésophyle s'ajoute, Xérophyle reste coché.
    fireEvent.press(screen.getByText('Mésophyle'));
    await settle();
    fireEvent.press(screen.getByText('Hydrophyle'));
    await settle();
    expect(screen.getByText(/^Xérophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    // 3. Décoche uniquement Xérophyle — Mésophyle et Hydrophyle restent cochés.
    fireEvent.press(screen.getByText(/^Xérophyle/));
    await settle();
    expect(screen.getByText('Xérophyle')).toBeVisible(); // sans suffixe " ✓" : redevenu inactif
    expect(screen.getByText(/^Mésophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
    expect(screen.getByText(/^Hydrophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    const surfaceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(surfaceInputs[0], '10');
    fireEvent.changeText(surfaceInputs[1], '5');
    fireEvent.press(screen.getByText('Continuer  ›'));

    // Seuls mesophyle et hydrophyle sont conservés — xerophyle a bien été retiré.
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ biotope: JSON.stringify(['mesophyle', 'hydrophyle']) })
      )
    );
  });
});
