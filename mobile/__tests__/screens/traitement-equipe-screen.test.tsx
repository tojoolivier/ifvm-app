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
  deleteAllProduitsForTraitementTerrestre: jest.fn().mockResolvedValue(undefined),
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
  listPesticides: jest.fn().mockResolvedValue([]),
}));

/**
 * `@react-native-community/datetimepicker` (#stand-base-secondaire-date-installation)
 * rend un calendrier natif : comme pour `@react-native-picker/picker` ci-dessus
 * (extensive-reference-screen-restore.test.tsx), aucun moyen public de « choisir
 * une date » dans l'arbre de rendu Jest. Remplacement minimal qui, une fois
 * affiché (après avoir pressé le champ `DateField`), déclenche `onValueChange`
 * avec une date fixe — le geste natif de sélection reste hors périmètre.
 */
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return function MockDateTimePicker({ onValueChange }: any) {
    return (
      <TouchableOpacity testID="mock-date-picker" onPress={() => onValueChange({}, new Date(2026, 6, 1))}>
        <Text>mock-date-picker</Text>
      </TouchableOpacity>
    );
  };
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
      stand_date_installation: null,
      base_secondaire: null,
      base_secondaire_date_installation: null,
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

describe('TraitementScreen (Équipe, Terrestre) — persistance des produits utilisés (#persistance-fiches-traitement)', () => {
  it('purge les produits déjà enregistrés avant de repousser la liste actuelle, pour ne pas les dupliquer à un nouveau passage sur cet écran', async () => {
    jest.mocked(traitementRepository.addProduitUtilise).mockClear();
    jest.mocked(traitementRepository.deleteAllProduitsForTraitementTerrestre).mockClear();
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      // 0 plutôt que non renseigné : évite de déclencher la validation "surface
      // restante abandonnée ?", hors périmètre de ce test.
      cible: { surface_infestee_ha: 0 },
      terrestre: {
        chef_equipe_id: 'chef-equipe-1',
        agent_encadreur: null,
        consultant_international: null,
        heure_debut: null,
        heure_fin: null,
        vitesse_vent_ms: null,
        direction_vent: null,
        temperature_c: null,
        reprise_traitement: false,
        traitement_origine_id: null,
        surface_atomiseur_ha: null,
        surface_disque_rotatif_ha: null,
        surface_ulvamast_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        essence_litres: null,
        nb_piles: null,
        pesticide_recu_l: null,
        produits: [{ produit_id: 'prod-1', quantite_l: 5, nom_commercial: 'Fyfanon' }],
      },
    } as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE, typeTraitement: 'TERRESTRE' });

    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-equipe-1'));

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.deleteAllProduitsForTraitementTerrestre).toHaveBeenCalledWith('trait-1')
    );
    await waitFor(() =>
      expect(traitementRepository.addProduitUtilise).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ produit_id: 'prod-1' })
      )
    );
    const ordrePurge = jest.mocked(traitementRepository.deleteAllProduitsForTraitementTerrestre).mock
      .invocationCallOrder[0];
    const ordreAjout = jest.mocked(traitementRepository.addProduitUtilise).mock.invocationCallOrder[0];
    expect(ordrePurge).toBeLessThan(ordreAjout);
  });
});

describe('TraitementScreen (Équipe) — date d\'installation du Stand/de la Base secondaire (#stand-base-secondaire-date-installation)', () => {
  it('restaure les dates d\'installation déjà enregistrées, indépendamment du texte libre associé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: {
        pilote: 'Jean Dupont',
        mecanicien: 'Marc Rabe',
        chef_de_base_id: 'chef-1',
        consultant_international: null,
        immatricule_aeronef: '5R-ABC',
        base_principale: 'Piste 12',
        stand: 'Stand Betioky',
        stand_date_installation: '2026-07-01',
        // Base secondaire vide alors que sa date est renseignée : les deux
        // champs sont indépendants l'un de l'autre.
        base_secondaire: null,
        base_secondaire_date_installation: '2026-07-15',
        rotations: [],
      },
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    expect(await screen.findByText('01/07/2026')).toBeVisible();
    expect(screen.getByText('15/07/2026')).toBeVisible();
  });

  it('enregistre une date d\'installation du Stand choisie via le sélecteur, sans toucher à la Base secondaire', async () => {
    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    fireEvent.changeText(screen.getByPlaceholderText('Nom de la base principale'), 'Base Betioky');
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du stand (facultatif)'), 'Stand Betioky');
    await settle();

    // Les deux DateField vides partagent le même placeholder ; celui du Stand
    // est le premier rendu (rangée Stand avant rangée Base secondaire).
    fireEvent.press(screen.getAllByLabelText('JJ/MM/AAAA')[0]);
    await settle();
    fireEvent.press(await screen.findByTestId('mock-date-picker'));
    await settle();

    expect(await screen.findByText('01/07/2026')).toBeVisible();
    // Base secondaire reste vide : la date d'installation du Stand est
    // indépendante du champ Base secondaire.
    expect(screen.getAllByLabelText('JJ/MM/AAAA')).toHaveLength(1);

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
          stand: 'Stand Betioky',
          standDateInstallation: '2026-07-01',
          baseSecondaire: null,
          baseSecondaireDateInstallation: null,
        })
      )
    );
  });

  it('accepte l\'enregistrement quand Stand/Base secondaire et leurs dates sont tous vides', async () => {
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
    // Stand, Base secondaire et leurs deux dates d'installation laissés vides.

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerien).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          stand: null,
          standDateInstallation: null,
          baseSecondaire: null,
          baseSecondaireDateInstallation: null,
        })
      )
    );
    expect(mockPush).toHaveBeenCalled();
  });

  it('ne crée jamais de champ « Base principale »-like pour les dates : seuls stand/base secondaire en portent une', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: {
        pilote: 'Jean Dupont',
        mecanicien: 'Marc Rabe',
        chef_de_base_id: 'chef-1',
        consultant_international: null,
        immatricule_aeronef: '5R-ABC',
        base_principale: 'Piste 12',
        stand: 'Stand Betioky',
        stand_date_installation: '2026-07-01',
        base_secondaire: 'Ambovombe',
        base_secondaire_date_installation: '2026-07-15',
        rotations: [],
      },
    } as any);

    await render(<TraitementScreen />);
    await screen.findByText('Sarah Ravelo');

    // Exactement 2 DateField affichées (Stand + Base secondaire) : aucune
    // troisième pour Base principale, qui reste hors périmètre.
    expect(await screen.findByText('01/07/2026')).toBeVisible();
    expect(screen.getByText('15/07/2026')).toBeVisible();
    expect(screen.getAllByText(/date d.installation/i)).toHaveLength(2);
  });
});
