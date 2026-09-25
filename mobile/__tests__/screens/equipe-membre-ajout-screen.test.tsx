/** Ajout d'un membre (#641, Figma « Ajouter un membre »). */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EquipeMembreAjoutScreen from '@/app/(app)/equipe-membre-ajout';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { listAnnuaire, listChefsDAutresEquipes, listMembresEquipe } from '@/lib/equipe-db';
import { pullReferentiel } from '@/lib/referentiel-sync';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'eq-sud' }),
}));
jest.mock('@/lib/api-client', () => ({ apiClient: { ajouterMembreEquipe: jest.fn() } }));
jest.mock('@/lib/referentiel-sync', () => ({ pullReferentiel: jest.fn() }));
jest.mock('@/lib/equipe-db', () => ({
  ...jest.requireActual('@/lib/equipe-db'),
  listAnnuaire: jest.fn(),
  listMembresEquipe: jest.fn(),
  listChefsDAutresEquipes: jest.fn(),
}));
jest.mock('@/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn().mockResolvedValue({ id: 'eq-sud', nom: 'Équipe Sud', type: 'aerien', nb_membres: 3 }) }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

beforeEach(() => {
  mockBack.mockReset();
  useAuthStore.setState({ token: 'tok', user: { id: 'u-1', role: 'chef_de_base' } } as any);
  jest.mocked(listAnnuaire).mockResolvedValue([{ id: 'u-7', nom: 'Rabe', prenom: 'Michel', role: 'mecanicien' }]);
  jest.mocked(listMembresEquipe).mockResolvedValue([{ user_id: 'u-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Jean' }]);
  jest.mocked(listChefsDAutresEquipes).mockResolvedValue(new Set());
  jest.mocked(apiClient.ajouterMembreEquipe).mockReset().mockResolvedValue({} as any);
  jest.mocked(pullReferentiel).mockReset().mockResolvedValue(undefined);
});

describe('EquipeMembreAjoutScreen', () => {
  it('ajoute un compte existant avec la fonction choisie, rafraîchit le référentiel puis revient', async () => {
    await render(<EquipeMembreAjoutScreen />);

    await fireEvent.press(await screen.findByLabelText('Ajouter Michel Rabe'));

    await waitFor(() =>
      expect(apiClient.ajouterMembreEquipe).toHaveBeenCalledWith('tok', 'eq-sud', { user_id: 'u-7', fonction: 'pilote' })
    );
    expect(pullReferentiel).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('refuse un second chef avec un message lisible, sans appeler le serveur', async () => {
    await render(<EquipeMembreAjoutScreen />);
    await fireEvent.press(screen.getByLabelText('Fonction'));
    await fireEvent.press(await screen.findByText('Chef'));

    await fireEvent.press(await screen.findByLabelText('Ajouter Michel Rabe'));

    expect(
      await screen.findByText('• Cette équipe a déjà un chef. Désignez un autre chef avant d’en ajouter un second.')
    ).toBeVisible();
    expect(apiClient.ajouterMembreEquipe).not.toHaveBeenCalled();
  });

  it('crée un compte à la volée : nom obligatoire, puis envoi sans user_id', async () => {
    await render(<EquipeMembreAjoutScreen />);
    await fireEvent.press(screen.getByText('Nouveau compte'));

    await fireEvent.press(screen.getByText('Créer et ajouter'));
    expect(await screen.findByText('• Le nom est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Le prénom est obligatoire.')).toBeVisible();

    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Dupont');
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'M.');
    await fireEvent.press(screen.getByText('Créer et ajouter'));

    await waitFor(() =>
      expect(apiClient.ajouterMembreEquipe).toHaveBeenCalledWith('tok', 'eq-sud', { nom: 'Dupont', prenom: 'M.', fonction: 'pilote' })
    );
  });
});
