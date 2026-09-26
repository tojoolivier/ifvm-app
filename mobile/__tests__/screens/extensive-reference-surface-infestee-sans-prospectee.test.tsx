/**
 * Validation / revalidation sans surface prospectée.
 * La surface infestée ne peut jamais dépasser la « Surface prospectée (ha) »
 * affichée sur cet écran (ADR-006). Ce champ est stocké dans `surface_station` —
 * la colonne `surface_prospectee` n'est jamais renseignée ici —, donc l'ancien
 * contrôle (qui ne regardait que la colonne héritée d'une revalidation) laissait
 * passer une infestée plus grande que le champ affiché. Un seul montage d'écran
 * par fichier, même mise en garde que extensive-reference-screen-restore.test.tsx.
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

describe('ExtensiveReferenceScreen — infestée saisie sans surface prospectée', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'validation', date_prospection: '2026-08-25', revalide_de_id: 'prospection-source' } as any,
      captures: [],
    });
  });

  it('bloque « Suivant » quand une surface infestée est saisie sans surface prospectée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.changeText(screen.getByPlaceholderText('0'), '3');

    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Surface infestée invalide',
        expect.stringContaining('Renseignez la surface prospectée')
      )
    );
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
