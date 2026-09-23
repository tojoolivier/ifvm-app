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

// Mock partagé entre les deux `describe` de ce fichier — sans ce nettoyage,
// `.mock.calls[0]` d'un test du second `describe` retrouve l'appel du tout
// premier test du fichier, jamais le sien.
beforeEach(() => {
  jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
});

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

    // #biotope-multi : désormais obligatoire (au moins un sélectionné), non
    // testé ici — hors sujet de ce test (sigle dans le N° de message).
    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalled());
    const [, input] = jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mock.calls[0];
    // #numero-fiche-extensive-terr-aer : « -TERR » en fin de numéro — mode
    // terrestre implicite (pas de mode_extensif sur cette fiche).
    expect(input.nMessage).toBe('20260915-ADM-DRAF-TERR');
  });
});

/**
 * #numero-fiche-extensive-terr-aer : le numéro auto-généré d'une fiche de
 * prospection Extensive fraîchement créée porte désormais « -TERR »
 * (terrestre, y compris implicite) ou « -AER » (aérien) en toute fin — pour
 * distinguer les deux modes d'un coup d'œil sans ouvrir la fiche. Jamais pour
 * une vérification de signalement (`type_prospection = 'validation'`),
 * même en mode aérien.
 */
describe('ExtensiveReferenceScreen — suffixe -TERR/-AER du N° de message (#numero-fiche-extensive-terr-aer)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nom: 'Rabe',
        prenom: 'Ando',
        email: 'ando@test.mg',
        role: 'prospecteur',
        actif: true,
        created_at: '2026-01-01T00:00:00Z',
        sigle: null,
      } as any,
      token: 'token-test',
    });
  });

  it('ajoute « -AER » pour une prospection Extensive en mode aérien', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-15',
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalled());
    const [, input] = jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mock.calls[0];
    expect(input.nMessage).toBe('20260915-DRAF-AER');
  });

  it('n’ajoute aucun suffixe pour une vérification de signalement, même en mode aérien', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'validation',
        date_prospection: '2026-09-15',
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalled());
    const [, input] = jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mock.calls[0];
    expect(input.nMessage).toBe('20260915-DRAF');
  });
});
