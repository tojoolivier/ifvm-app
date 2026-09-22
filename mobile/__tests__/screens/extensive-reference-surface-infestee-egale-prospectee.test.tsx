/**
 * Pendant de extensive-reference-surface-infestee-superieure-prospectee.test.tsx :
 * une surface infestée égale à la surface prospectée héritée (revalidation)
 * reste acceptée — la règle ADR-006 est prospectée >= infestée, pas une
 * inégalité stricte. Fichier séparé (un seul montage d'écran par fichier),
 * même mise en garde que extensive-reference-screen-restore.test.tsx.
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
    type_prospection: 'validation',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — surface infestée égale à la surface prospectée héritée (revalidation)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'validation',
        date_prospection: '2026-08-25',
        revalide_de_id: 'prospection-source',
        surface_prospectee: 5,
      } as any,
      captures: [],
    });
  });

  it('laisse passer « Suivant » quand la surface infestée est égale à la surface prospectée héritée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.changeText(screen.getByPlaceholderText('0'), '5');
    expect(await screen.findByDisplayValue('5')).toBeVisible();
    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ surfaceInfestee: 5 })
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith('Surface infestée invalide', expect.any(String));
  });
});
