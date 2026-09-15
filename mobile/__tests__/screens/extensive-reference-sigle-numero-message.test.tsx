/**
 * #sigle-utilisateur-numero-fiche : le sigle de l'utilisateur connecté
 * s'insère entre la date et le suffixe final du N° de message auto-généré
 * (`generateNumeroMessage`) — même règle que reference.tsx (Intensif), cf.
 * reference-screen-sigle-present.test.tsx.
 *
 * Fichier séparé (un seul montage d'écran par fichier), même mise en garde
 * que extensive-reference-screen-restore.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-09-15',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — sigle utilisateur dans le N° de message', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-09-15' } as any,
      captures: [],
    });
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nom: 'Rabe',
        prenom: 'Ando',
        email: 'ando@test.mg',
        role: 'prospecteur',
        actif: true,
        created_at: '2026-01-01T00:00:00Z',
        sigle: 'ADM',
      } as any,
      token: 'token-test',
    });
  });

  it('insère le sigle dans le N° de message auto-généré et enregistré', async () => {
    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalled());
    const [, input] = jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mock.calls[0];
    expect(input.nMessage).toBe('20260915-ADM-DRAF');
  });
});
