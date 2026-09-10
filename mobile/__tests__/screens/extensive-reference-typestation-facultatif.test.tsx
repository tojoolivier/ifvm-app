/**
 * #biotope-multi : « Type de station (biotope) » reste facultatif après le passage
 * en choix multiples — aucune sélection ne doit bloquer « Suivant ». Fichier séparé
 * de extensive-reference-typestation.test.tsx (un seul montage d'écran par fichier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — Type de station reste facultatif (#biotope-multi)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
      } as any,
      captures: [],
    });
  });

  it('aucune sélection : toujours facultatif, « Suivant » fonctionne sans blocage', async () => {
    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ typeStation: null })
      )
    );
  });
});
