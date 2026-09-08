/**
 * Écran « Équipe » (traitement.tsx) — #equipe-slide-aerien, puis retour au texte
 * libre pour pilote/mécanicien/consultant (migration backend 0048). Chef de base
 * reste sélectionné dans le référentiel (FK) ; pilote/mécanicien/consultant sont
 * désormais de simples champs texte ; base principale/stand/base secondaire le
 * redeviennent également (migration backend 0054, #traitement-aerien-base-texte-libre,
 * ticket 4) : saisie libre, sans dépendre du référentiel `lieu_aerien`.
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
}));

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

function mockReferentiel({ chefsDeBase = [CHEF_DE_BASE] }: Partial<{ chefsDeBase: typeof CHEF_DE_BASE[] }> = {}) {
  const referentielDb = require('@/lib/referentiel-db');
  jest.mocked(referentielDb.listUtilisateursByRole).mockImplementation((role: string) => {
    if (role === 'chef_de_base') return Promise.resolve(chefsDeBase);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: { surface_infestee_ha: 100 },
    aerien: {
      pilote: null,
      mecanicien: null,
      chef_de_base_id: null,
      consultant_international: null,
      immatricule_aeronef: null,
      base_principale: null,
      stand: null,
      base_secondaire: null,
      rotations: [],
    },
  } as any);
  jest.mocked(traitementRepository.updateTraitementAerien).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
  useAuthStore.setState({ user: null, token: null } as any);
  mockReferentiel();
});

describe('TraitementScreen (Équipe) — champs base principale/stand/base secondaire en saisie libre', () => {
  it('accepte une saisie libre pour les trois champs, y compris une valeur absente du référentiel Web', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    // « Piste 12 » n'existe dans aucun référentiel — doit être accepté tel quel.
    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base principale'), 'Piste 12');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du stand (facultatif)'), 'Stand Betioky');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base secondaire (facultatif)'), 'Ambovombe');
    await settle();

    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Jean Dupont');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Marc Rabe');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-XYZ');
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          pilote: 'Jean Dupont',
          mecanicien: 'Marc Rabe',
          chefDeBaseId: 'chef-1',
          basePrincipale: 'Piste 12',
          stand: 'Stand Betioky',
          baseSecondaire: 'Ambovombe',
          immatriculeAeronef: '5R-XYZ',
        })
      )
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(traitement)/rotations' })
    );
  });

  it('bloque « Continuer » quand la base principale est vide, avec un message explicite', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Jean Dupont');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Marc Rabe');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-XYZ');
    await settle();
    // Base principale laissée vide.

    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText('La base principale est obligatoire')).toBeVisible();
    expect(traitementRepository.updateTraitementAerien).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('accepte l’enregistrement quand stand et base secondaire sont vides (facultatifs)', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base principale'), 'Base Betioky');
    await settle();
    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Jean Dupont');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Marc Rabe');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-XYZ');
    await settle();
    // Stand et base secondaire laissés vides.

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ basePrincipale: 'Base Betioky', stand: null, baseSecondaire: null })
      )
    );
    expect(mockPush).toHaveBeenCalled();
  });
});

describe('TraitementScreen (Équipe) — distinction obligatoire des rôles', () => {
  it('bloque « Continuer » quand la même personne (par le nom) est choisie pour deux rôles obligatoires', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base principale'), 'Base Betioky');
    await settle();
    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    // Même nom que le chef de base, saisi en texte libre pour le pilote.
    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Sarah Ravelo');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Marc Rabe');
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

  it('bloque « Continuer » quand pilote et mécanicien portent le même nom, casse et espaces ignorés', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base principale'), 'Base Betioky');
    await settle();
    fireEvent.press(screen.getByText('Sarah Ravelo'));
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Jean Dupont');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), '  jean   DUPONT  ');
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
  });
});

describe('TraitementScreen (Équipe) — restauration après enregistrement', () => {
  it('restaure chef de base/pilote/mécanicien/consultant/immatriculation/bases déjà enregistrés', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: {
        pilote: 'Jean Dupont',
        mecanicien: 'Marc Rabe',
        chef_de_base_id: 'chef-1',
        consultant_international: 'John Smith',
        immatricule_aeronef: '5R-ABC',
        base_principale: 'Piste 12',
        stand: 'Stand Betioky',
        base_secondaire: 'Ambovombe',
        rotations: [],
      },
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    expect(await screen.findByDisplayValue('5R-ABC')).toBeVisible();
    expect(screen.getByDisplayValue('Jean Dupont')).toBeVisible();
    expect(screen.getByDisplayValue('Marc Rabe')).toBeVisible();
    expect(screen.getByDisplayValue('John Smith')).toBeVisible();
    expect(screen.getByDisplayValue('Piste 12')).toBeVisible();
    expect(screen.getByDisplayValue('Stand Betioky')).toBeVisible();
    expect(screen.getByDisplayValue('Ambovombe')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          pilote: 'Jean Dupont',
          mecanicien: 'Marc Rabe',
          chefDeBaseId: 'chef-1',
          consultantInternational: 'John Smith',
          basePrincipale: 'Piste 12',
          stand: 'Stand Betioky',
          baseSecondaire: 'Ambovombe',
        })
      )
    );
  });
});
