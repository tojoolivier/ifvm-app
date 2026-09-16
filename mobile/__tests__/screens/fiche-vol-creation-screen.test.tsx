/**
 * Écran de création de l'en-tête d'une fiche de vol (#fiche-vol-creation-mobile)
 * — regroupe tous les vols d'un hélicoptère pour une date (ADR-011).
 *
 * `BaseAerienneField`/`StandRemplissageField`/`ChefDeBaseField` sont mockés :
 * leur propre comportement (chargement, sélection) est déjà couvert par leurs
 * tests dédiés (`base-aerienne-field.test.tsx`, `stand-remplissage-field.test.tsx`,
 * `chef-de-base-field.test.tsx`) — ce test se concentre sur la logique propre à
 * cet écran (validation, assemblage du payload, navigation post-création).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheVolCreationScreen from '@/app/(fiche-vol)/creation';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listCampagnesLocal } from '@/lib/referentiel-db';

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    createFicheVol: jest.fn(),
  },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listCampagnesLocal: jest.fn(),
}));

jest.mock('@/components/referentiel/BaseAerienneField', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    BaseAerienneField: ({ onChange }: { onChange: (id: string, option: unknown) => void }) => (
      <TouchableOpacity onPress={() => onChange('base-1', { id: 'base-1' })}>
        <Text>[mock] choisir base-1</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/referentiel/StandRemplissageField', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    StandRemplissageField: ({ onChange }: { onChange: (id: string, option: unknown) => void }) => (
      <TouchableOpacity onPress={() => onChange('stand-1', { id: 'stand-1' })}>
        <Text>[mock] choisir stand-1</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/referentiel/ChefDeBaseField', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    ChefDeBaseField: ({ onChange }: { onChange: (id: string, option: unknown) => void }) => (
      <TouchableOpacity onPress={() => onChange('chef-1', { id: 'chef-1' })}>
        <Text>[mock] choisir chef-1</Text>
      </TouchableOpacity>
    ),
  };
});

const CAMPAGNE = { id: 'campagne-1', name: '2026', start_date: '2026-01-01', end_date: null };

async function remplirEtSelectionner() {
  await fireEvent.changeText(screen.getByPlaceholderText('Ex. Madagascar Hélicoptères'), 'Air Test');
  await fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-MXY'), '5R-MXY');
  await fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Jean Rakoto');
  await fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Paul Rabe');
  await fireEvent.press(screen.getByText('[mock] choisir base-1'));
  await fireEvent.press(screen.getByText('[mock] choisir stand-1'));
  await fireEvent.press(screen.getByText('[mock] choisir chef-1'));
}

describe('FicheVolCreationScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.createFicheVol).mockReset();
    jest.mocked(listCampagnesLocal).mockReset().mockResolvedValue([CAMPAGNE] as any);
  });

  it('affiche des erreurs de validation quand les champs requis sont vides', async () => {
    await render(<FicheVolCreationScreen />);

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await screen.findByText('Renseignez la compagnie.');
    expect(screen.getByText("Renseignez l'immatriculation.")).toBeVisible();
    expect(screen.getByText('Choisissez une base aérienne.')).toBeVisible();
    expect(screen.getByText('Choisissez un stand de remplissage.')).toBeVisible();
    expect(screen.getByText('Choisissez un chef de base.')).toBeVisible();
    expect(apiClient.createFicheVol).not.toHaveBeenCalled();
  });

  it('crée la fiche de vol avec la campagne en cours et navigue vers le récapitulatif', async () => {
    jest.mocked(apiClient.createFicheVol).mockResolvedValue({
      id: 'fiche-1',
      numero_fiche: '001-2026-09-16-EQ-5R-MXY',
      date_vol: '2026-09-16',
      immatriculation: '5R-MXY',
      compagnie: 'Air Test',
    } as any);

    await render(<FicheVolCreationScreen />);
    await remplirEtSelectionner();

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await waitFor(() =>
      expect(apiClient.createFicheVol).toHaveBeenCalledWith('token-test', {
        date_vol: expect.any(String),
        compagnie: 'Air Test',
        immatriculation: '5R-MXY',
        campagne_id: 'campagne-1',
        base_id: 'base-1',
        stand_id: 'stand-1',
        pilote: 'Jean Rakoto',
        mecanicien: 'Paul Rabe',
        chef_de_base_id: 'chef-1',
        consultant_international: null,
        observations: null,
      })
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(fiche-vol)/recap',
        params: {
          id: 'fiche-1',
          numeroFiche: '001-2026-09-16-EQ-5R-MXY',
          dateVol: '2026-09-16',
          immatriculation: '5R-MXY',
          compagnie: 'Air Test',
        },
      })
    );
  });

  it("bloque la création quand aucune campagne n'est disponible hors-ligne", async () => {
    jest.mocked(listCampagnesLocal).mockResolvedValue([]);

    await render(<FicheVolCreationScreen />);
    await remplirEtSelectionner();

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await waitFor(() => expect(listCampagnesLocal).toHaveBeenCalled());
    expect(apiClient.createFicheVol).not.toHaveBeenCalled();
  });
});
