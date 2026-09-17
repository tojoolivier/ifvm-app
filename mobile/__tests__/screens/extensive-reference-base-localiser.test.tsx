/**
 * Base principale (mode aérien) — capture GPS manuelle indépendante de la Base
 * secondaire. Fichier séparé — cf. extensive-reference-base-affichage.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import { getCurrentPosition } from '@/lib/location';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-09-17',
  }),
  updateProspectionGpsPosition: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — Base principale/secondaire : localiser', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(getCurrentPosition).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-17',
        mode_extensif: 'aerien',
        surface_infestee: 3.5,
      } as any,
      captures: [],
    });
  });

  it('capture la position GPS de la Base principale sur pression de Localiser, indépendamment de la Base secondaire', async () => {
    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));

    jest.mocked(getCurrentPosition).mockResolvedValueOnce({
      latitude: -20.1234,
      longitude: 48.5678,
      altitude: null,
      accuracy: 5,
      timestamp: Date.now(),
    } as any);

    fireEvent.press(screen.getAllByText(/📍 Localiser/)[0]);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(2));

    expect(await screen.findByText('-20.12340, 48.56780')).toBeVisible();
    // Base secondaire reste non renseignée : la capture est indépendante par champ.
    expect(screen.getByText('Coordonnées non renseignées')).toBeVisible();
  });
});
