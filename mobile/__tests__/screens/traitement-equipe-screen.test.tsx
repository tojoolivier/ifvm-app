/**
 * Écran « Équipe » (traitement.tsx) — #equipe-slide-aerien. Personnes (chef de base,
 * pilote, mécanicien, consultant), aéronef (immatriculation) et rattachement (base
 * principale/stand/base secondaire, référentiel lieu_aerien) — distincts du slide
 * « Traitement » (rotations.tsx) qui garde pesticides/rotations/opérations.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementAerien: jest.fn().mockResolvedValue({}),
  updateTraitementTerrestre: jest.fn().mockResolvedValue({}),
  addProduitUtilise: jest.fn().mockResolvedValue({}),
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
  listPesticides: jest.fn().mockResolvedValue([]),
  listLieuxAeriens: jest.fn().mockResolvedValue([]),
}));

/**
 * `@react-native-picker/picker` rend un contrôle natif : sous Jest, ses options
 * n'apparaissent pas dans l'arbre de rendu (cf. extensive-reference.tsx, même
 * constat). Remplacement fidèle au contrat du vrai composant (`children`/
 * `onValueChange` de `Picker.Item`), rendu en éléments pressables ordinaires — le
 * rendu et les gestes natifs réels restent hors périmètre, déjà couverts par la
 * bibliothèque.
 */
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  function Picker({ onValueChange, children }: any) {
    return (
      <View>
        {React.Children.toArray(children).map((item: any) => (
          <TouchableOpacity key={item.props.value} onPress={() => onValueChange(item.props.value)}>
            <Text>{item.props.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Picker };
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'AERIEN' as const,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

const CHEF_DE_BASE = { id: 'chef-1', nom: 'Ravelo', prenom: 'Sarah' };
const PILOTE = { id: 'pilote-1', nom: 'Rakoto', prenom: 'Jean' };
const MECANICIEN = { id: 'mecanicien-1', nom: 'Andria', prenom: 'Marc' };
const CONSULTANT = { id: 'consultant-1', nom: 'Smith', prenom: 'John' };

const LIEU_PRINCIPALE = { id: 'lieu-1', type_lieu: 'principale', nom: 'Tuléar' };
const LIEU_STAND = { id: 'lieu-2', type_lieu: 'stand', nom: 'Betioky' };
const LIEU_SECONDAIRE = { id: 'lieu-3', type_lieu: 'secondaire', nom: 'Ambovombe' };

function mockReferentiel({
  chefsDeBase = [CHEF_DE_BASE],
  pilotes = [PILOTE],
  mecaniciens = [MECANICIEN],
  consultants = [CONSULTANT],
  lieuxAeriens = [LIEU_PRINCIPALE, LIEU_STAND, LIEU_SECONDAIRE],
}: Partial<{
  chefsDeBase: typeof CHEF_DE_BASE[];
  pilotes: typeof PILOTE[];
  mecaniciens: typeof MECANICIEN[];
  consultants: typeof CONSULTANT[];
  lieuxAeriens: typeof LIEU_PRINCIPALE[];
}> = {}) {
  const referentielDb = require('@/lib/referentiel-db');
  jest.mocked(referentielDb.listUtilisateursByRole).mockImplementation((role: string) => {
    if (role === 'chef_de_base') return Promise.resolve(chefsDeBase);
    if (role === 'pilote') return Promise.resolve(pilotes);
    if (role === 'mecanicien') return Promise.resolve(mecaniciens);
    if (role === 'consultant_international') return Promise.resolve(consultants);
    return Promise.resolve([]);
  });
  jest.mocked(referentielDb.listLieuxAeriens).mockResolvedValue(lieuxAeriens);
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: { surface_infestee_ha: 100 },
    aerien: {
      pilote_id: null,
      mecanicien_id: null,
      chef_de_base_id: null,
      consultant_id: null,
      immatricule_aeronef: null,
      lieu_base_principale_id: null,
      lieu_stand_id: null,
      lieu_base_secondaire_id: null,
      rotations: [],
    },
  } as any);
  jest.mocked(traitementRepository.updateTraitementAerien).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
  useAuthStore.setState({ user: null, token: null } as any);
  mockReferentiel();
});

describe('TraitementScreen (Équipe) — champs base principale/stand/base secondaire', () => {
  it('propose les lieux du référentiel, chacun filtré par son type', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Tuléar');

    expect(screen.getByText('Betioky')).toBeVisible();
    expect(screen.getByText('Ambovombe')).toBeVisible();
  });

  it('sélectionne une base principale, un stand et une base secondaire puis les enregistre', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Tuléar');

    fireEvent.press(screen.getByText('Tuléar'));
    await settle();
    fireEvent.press(screen.getByText('Betioky'));
    await settle();
    fireEvent.press(screen.getByText('Ambovombe'));
    await settle();

    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    fireEvent.press(screen.getByText('Jean Rakoto'));
    await settle();
    fireEvent.press(screen.getByText('Marc Andria'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-XYZ');
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          lieuBasePrincipaleId: 'lieu-1',
          lieuStandId: 'lieu-2',
          lieuBaseSecondaireId: 'lieu-3',
          immatriculeAeronef: '5R-XYZ',
        })
      )
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(traitement)/rotations' })
    );
  });
});

describe('TraitementScreen (Équipe) — distinction obligatoire des rôles', () => {
  it('bloque « Continuer » quand la même personne est choisie pour deux rôles obligatoires', async () => {
    // Un seul utilisateur candidat sur tous les rôles : impossible d'éviter le
    // conflit sans que la règle de distinction s'applique.
    mockReferentiel({
      chefsDeBase: [CHEF_DE_BASE],
      pilotes: [CHEF_DE_BASE],
      mecaniciens: [MECANICIEN],
    });

    await render(<TraitementScreen />);
    await screen.findByText('Tuléar');

    fireEvent.press(screen.getByText('Tuléar'));
    await settle();
    fireEvent.press(screen.getAllByText('Sarah Ravelo')[0]);
    await settle();
    fireEvent.press(screen.getAllByText('Sarah Ravelo')[1] ?? screen.getAllByText('Sarah Ravelo')[0]);
    await settle();
    fireEvent.press(screen.getByText('Marc Andria'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-XYZ');
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(
      await screen.findByText(
        'Cette personne est déjà affectée à un autre rôle. Veuillez sélectionner une personne différente.'
      )
    ).toBeVisible();
    expect(traitementRepository.updateTraitementAerien).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('TraitementScreen (Équipe) — restauration après enregistrement', () => {
  it('restaure chef de base/pilote/mécanicien/consultant/immatriculation/bases déjà enregistrés', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: {
        pilote_id: 'pilote-1',
        mecanicien_id: 'mecanicien-1',
        chef_de_base_id: 'chef-1',
        consultant_id: 'consultant-1',
        immatricule_aeronef: '5R-ABC',
        lieu_base_principale_id: 'lieu-1',
        lieu_stand_id: 'lieu-2',
        lieu_base_secondaire_id: 'lieu-3',
        rotations: [],
      },
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Tuléar');

    expect(await screen.findByDisplayValue('5R-ABC')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          piloteId: 'pilote-1',
          mecanicienId: 'mecanicien-1',
          chefDeBaseId: 'chef-1',
          consultantId: 'consultant-1',
          lieuBasePrincipaleId: 'lieu-1',
          lieuStandId: 'lieu-2',
          lieuBaseSecondaireId: 'lieu-3',
        })
      )
    );
  });
});
