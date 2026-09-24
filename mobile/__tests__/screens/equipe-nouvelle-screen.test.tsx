/** Création d'une équipe (#641, Figma « Nouvelle équipe »). */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EquipeNouvelleScreen from '@/app/(app)/equipe-nouvelle';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { listAeronefsActifs, listAnnuaire } from '@/lib/equipe-db';
import { pullReferentiel } from '@/lib/referentiel-sync';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('@/lib/api-client', () => ({ apiClient: { createEquipe: jest.fn() } }));
jest.mock('@/lib/referentiel-sync', () => ({ pullReferentiel: jest.fn() }));
jest.mock('@/lib/equipe-db', () => ({ listAeronefsActifs: jest.fn(), listAnnuaire: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));

beforeEach(() => {
  mockBack.mockReset();
  useAuthStore.setState({ token: 'tok', user: { id: 'u-1', role: 'chef_de_base' } } as any);
  jest.mocked(listAeronefsActifs).mockResolvedValue([{ id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna 188' }]);
  jest.mocked(listAnnuaire).mockResolvedValue([{ id: 'u-9', nom: 'Rakoto', prenom: 'Jean', role: 'chef_de_base' }]);
  jest.mocked(apiClient.createEquipe).mockReset().mockResolvedValue({} as any);
  jest.mocked(pullReferentiel).mockReset().mockResolvedValue(undefined);
});

describe('EquipeNouvelleScreen', () => {
  it('sans nom, sans aéronef et sans chef : liste toutes les erreurs et n’appelle pas le serveur', async () => {
    await render(<EquipeNouvelleScreen />);

    await fireEvent.press(screen.getByText('Créer l’équipe'));

    expect(screen.getByText('• Le nom de l’équipe est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Un aéronef est obligatoire pour une équipe aérienne.')).toBeVisible();
    expect(screen.getByText('• Un chef d’équipe est obligatoire (un compte existant).')).toBeVisible();
    expect(apiClient.createEquipe).not.toHaveBeenCalled();
  });

  it('crée une équipe aérienne, rafraîchit le référentiel local puis revient', async () => {
    await render(<EquipeNouvelleScreen />);

    await fireEvent.changeText(screen.getByLabelText("Nom de l'équipe"), 'Équipe Sud');
    await fireEvent.press(screen.getByLabelText('Aéronef'));
    await fireEvent.press(await screen.findByText('5R-MHR · Cessna 188'));
    await fireEvent.press(screen.getByLabelText('Chef'));
    await fireEvent.press(await screen.findByText('Jean Rakoto'));
    await fireEvent.press(screen.getByText('Créer l’équipe'));

    await waitFor(() =>
      expect(apiClient.createEquipe).toHaveBeenCalledWith('tok', {
        nom: 'Équipe Sud',
        type: 'aerien',
        aeronef_id: 'ae-1',
        membres: [{ user_id: 'u-9', fonction: 'chef' }],
      })
    );
    expect(pullReferentiel).toHaveBeenCalledWith('tok');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('passer à terrestre retire le champ aéronef et cherche les chefs d’équipe', async () => {
    await render(<EquipeNouvelleScreen />);

    await fireEvent.press(screen.getByText('Terrestre'));

    expect(screen.queryByText('AÉRONEF *')).toBeNull();
    await waitFor(() => expect(listAnnuaire).toHaveBeenLastCalledWith('', ['chef_equipe']));
  });
});
