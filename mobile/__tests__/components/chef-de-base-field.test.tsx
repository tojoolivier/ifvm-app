/**
 * ChefDeBaseField (#fiche-vol-creation-mobile) — sélecteur de chef de base
 * (`GET /users/chefs-de-base`), sans formulaire de création : `chef_de_base_id`
 * doit préexister (issue #319).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChefDeBaseField } from '@/components/referentiel/ChefDeBaseField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listChefsDeBase: jest.fn(),
  },
}));

const CHEF = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky', sigle: 'TR' };

describe('ChefDeBaseField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listChefsDeBase).mockReset().mockResolvedValue([CHEF] as any);
  });

  it('charge la liste et permet de sélectionner un chef de base', async () => {
    const onChange = jest.fn();
    await render(<ChefDeBaseField value={null} onChange={onChange} />);

    fireEvent.press(screen.getByText('Charger la liste ›'));
    await screen.findByText('Toky Rabe (TR)');

    fireEvent.press(screen.getByText('Toky Rabe (TR)'));
    expect(onChange).toHaveBeenCalledWith('chef-1', { id: 'chef-1', nom: 'Rabe', prenom: 'Toky', sigle: 'TR' });
  });

  it("affiche un message quand aucun chef de base n'est disponible", async () => {
    jest.mocked(apiClient.listChefsDeBase).mockResolvedValue([]);
    const onChange = jest.fn();
    await render(<ChefDeBaseField value={null} onChange={onChange} />);

    fireEvent.press(screen.getByText('Charger la liste ›'));
    await screen.findByText('Aucun chef de base actif.');
    expect(onChange).not.toHaveBeenCalled();
  });
});
