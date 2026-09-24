/**
 * TypeChooserScreen — #fiche-vol-creation-mobile : « Prospections à revalider »
 * a été déplacé depuis l'accès rapide du tableau de bord vers ce choix de
 * type de prospection, sous « Vérifier un signalement ».
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import TypeChooserScreen from '@/app/(prospection)/type-chooser';
import { useAuthStore } from '@/lib/auth-store';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

describe('TypeChooserScreen — Revalidation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useAuthStore.setState({
      user: { id: 'user-1', nom: 'Rakoto', prenom: 'Jean', role: 'prospecteur' } as any,
      token: 'token-test',
    });
  });

  it('affiche la carte sous « Vérifier un signalement » et navigue vers la liste à revalider', async () => {
    await render(<TypeChooserScreen />);

    expect(screen.getByText('🔁 Revalidation')).toBeTruthy();

    await fireEvent.press(screen.getByText('🔁 Revalidation'));

    expect(mockPush).toHaveBeenCalledWith('/(prospection)/revalidation-liste');
  });
});
