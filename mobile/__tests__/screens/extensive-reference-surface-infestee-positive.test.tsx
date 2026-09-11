/**
 * Surface infestée (ha) obligatoire — cf. extensive-reference-surface-infestee-vide.test.tsx
 * pour le contexte. Fichier séparé (un seul montage d'écran par fichier),
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
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — surface infestée obligatoire', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25' } as any,
      captures: [],
    });
  });

  it('laisse passer « Suivant » dès qu’une surface infestée positive est saisie', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.changeText(screen.getByPlaceholderText('0'), '2.5');
    // Laisse React réconcilier avant de presser « Suivant » — sinon son
    // gestionnaire reste lié à la fermeture du rendu précédent (surfaceInfestee
    // encore vide), même prudence que les autres tests de cet écran.
    expect(await screen.findByDisplayValue('2.5')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ surfaceInfestee: 2.5 })
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith('Surface infestée requise', expect.any(String));
  });
});
