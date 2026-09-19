/**
 * EquipeAerienneField — sélecteur de l'équipe aérienne d'une fiche de vol (migration
 * backend 0075). Choisir l'équipe déduit l'en-tête de la fiche ; un chef de base a une
 * seule équipe, la sienne, présélectionnée dès le chargement.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { EquipeAerienneField } from '@/components/referentiel/EquipeAerienneField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

// Chargé automatiquement au montage — `useFocusEffect` exige un vrai NavigationContainer,
// absent ici : `useEffect(effect, [])` en tient lieu (cf. base-aerienne-field.test.tsx).
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listEquipesAeriennes: jest.fn(),
  },
}));

const EQUIPE_IHOSY = {
  id: 'equipe-1',
  nom: 'Équipe Ihosy',
  chef_de_base_id: 'chef-1',
  pilote: 'Jean Rakoto',
  mecanicien: 'Paul Andria',
  consultant_international: null,
  aeronef: { id: 'a-1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
  actif: true,
};
const EQUIPE_BETROKA = {
  id: 'equipe-2',
  nom: 'Équipe Betroka',
  chef_de_base_id: 'chef-2',
  actif: true,
};

describe('EquipeAerienneField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'pilote-1', role: 'pilote' } } as any);
    jest
      .mocked(apiClient.listEquipesAeriennes)
      .mockReset()
      .mockResolvedValue([EQUIPE_IHOSY, EQUIPE_BETROKA] as any);
  });

  it("liste les équipes et remonte l'équipe choisie avec son hélicoptère", async () => {
    const onChange = jest.fn();
    await render(<EquipeAerienneField value={null} onChange={onChange} />);

    await screen.findByText('Équipe Ihosy');
    fireEvent.press(screen.getByText('Équipe Ihosy'));

    expect(onChange).toHaveBeenCalledWith('equipe-1', {
      id: 'equipe-1',
      nom: 'Équipe Ihosy',
      chef_de_base_id: 'chef-1',
      pilote: 'Jean Rakoto',
      mecanicien: 'Paul Andria',
      consultant_international: null,
      aeronef: { id: 'a-1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
    });
  });

  it('normalise une équipe ancienne, sans pilote ni hélicoptère', async () => {
    const onChange = jest.fn();
    await render(<EquipeAerienneField value={null} onChange={onChange} />);

    await screen.findByText('Équipe Betroka');
    fireEvent.press(screen.getByText('Équipe Betroka'));

    expect(onChange).toHaveBeenCalledWith(
      'equipe-2',
      expect.objectContaining({ pilote: null, mecanicien: null, consultant_international: null, aeronef: null })
    );
  });

  it("présélectionne l'équipe du chef de base connecté", async () => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'chef-2', role: 'chef_de_base' } } as any);
    const onChange = jest.fn();
    await render(<EquipeAerienneField value={null} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('equipe-2', expect.objectContaining({ id: 'equipe-2' })));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ne présélectionne rien pour un rôle qui ne dirige aucune équipe", async () => {
    const onChange = jest.fn();
    await render(<EquipeAerienneField value={null} onChange={onChange} />);

    await screen.findByText('Équipe Ihosy');
    expect(onChange).not.toHaveBeenCalled();
  });

  it("invite à créer une équipe quand il n'y en a aucune", async () => {
    jest.mocked(apiClient.listEquipesAeriennes).mockResolvedValue([]);
    await render(<EquipeAerienneField value={null} onChange={jest.fn()} />);

    await screen.findByText('Aucune équipe aérienne — créez-en une depuis Référentiels aériens.');
  });
});
