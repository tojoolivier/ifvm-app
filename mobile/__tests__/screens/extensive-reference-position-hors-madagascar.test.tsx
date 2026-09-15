/**
 * #position-hors-madagascar : « Suivant » refuse d'enregistrer une fiche
 * extensive/validation dont la position est hors de Madagascar, y compris en
 * pleine mer — même garde-fou que reference.tsx (Intensif), qui l'avait déjà.
 *
 * Fichier séparé (un seul montage d'écran par fichier), même mise en garde
 * que extensive-reference-screen-restore.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
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
}));

describe('ExtensiveReferenceScreen — position hors de Madagascar', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        // En pleine mer à ~90 km au large de la côte est — hors de l'ancien
        // rectangle englobant tout autant que du contour réel de l'île.
        latitude: -18,
        longitude: 50.2,
      } as any,
      captures: [],
    });
  });

  it('refuse « Suivant » et affiche le motif, sans jamais enregistrer', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('⚠️ Position GPS invalide', expect.stringContaining('hors de Madagascar'))
    );
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
