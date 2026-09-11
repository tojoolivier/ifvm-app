/**
 * Surface infestée (ha) obligatoire — s'applique aussi aux fiches de
 * « prospection de validation » (vérification d'un signalement), qui passent
 * par le même écran extensive-reference.tsx que l'extensive (seule
 * l'intensive, sur reference.tsx, en est exemptée). Fichier séparé (un seul
 * montage d'écran par fichier), même mise en garde que
 * extensive-reference-screen-restore.test.tsx.
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
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — surface infestée obligatoire (prospection de validation)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'validation', date_prospection: '2026-08-25' } as any,
      captures: [],
    });
  });

  it('bloque « Suivant » avec un message si la surface infestée est vide', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    expect(alertSpy).toHaveBeenCalledWith('Surface infestée requise', expect.any(String));
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
