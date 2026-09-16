/**
 * #brouillon-gps-persistance-immediate : pendant de
 * reference-screen-gps-persistance-immediate.test.tsx pour l'Extensif/
 * Validation (même écran extensive-reference.tsx pour les deux) — la position
 * GPS doit être immédiatement persistée dans le brouillon dès sa capture,
 * sans attendre « Suivant ».
 *
 * Fichier séparé (un seul montage d'écran par fichier), même mise en garde
 * que extensive-reference-screen-restore.test.tsx.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
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
    date_prospection: '2026-09-16',
  }),
  updateProspectionGpsPosition: jest.fn().mockResolvedValue({ id: 'draft-123', latitude: -18.9, longitude: 47.5 }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — persistance immédiate de la position GPS', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionGpsPosition).mockClear();
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-09-16' } as any,
      captures: [],
    });
  });

  it('persiste latitude/longitude dès la capture, sans attendre « Suivant »', async () => {
    await render(<ExtensiveReferenceScreen />);

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionGpsPosition).toHaveBeenCalledWith('draft-123', {
        latitude: -18.9,
        longitude: 47.5,
        altitude: null,
      })
    );

    // « Suivant » n'a jamais été pressé.
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
