/**
 * Écran de création de l'en-tête d'une fiche de vol (#fiche-vol-creation-mobile) —
 * regroupe tous les vols d'un hélicoptère pour une date (ADR-011).
 *
 * L'équipe aérienne se choisit en premier (migration backend 0075) : le chef de base, le
 * pilote, le mécanicien, le consultant, l'immatriculation et la société de son hélicoptère
 * s'en déduisent (lecture seule), et seuls ses lieux (base, stand) sont proposés.
 *
 * `EquipeAerienneField`/`BaseAerienneField`/`StandRemplissageField` sont mockés : leur
 * propre comportement est couvert par leurs tests dédiés — ce test se concentre sur la
 * logique propre à cet écran (déduction de l'en-tête, filtrage des lieux, validation,
 * assemblage du payload, navigation post-création).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheVolCreationScreen from '@/app/(fiche-vol)/creation';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listCampagnesLocal } from '@/lib/referentiel-db';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: mockPush }),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    createFicheVol: jest.fn(),
    listChefsDeBase: jest.fn(),
  },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listCampagnesLocal: jest.fn(),
}));

const EQUIPE_COMPLETE = {
  id: 'equipe-1',
  nom: 'Équipe Ihosy',
  chef_de_base_id: 'chef-1',
  pilote: 'Jean Rakoto',
  mecanicien: 'Paul Andria',
  consultant_international: 'John Smith',
  aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
};

// Équipe créée avant les migrations 0072/0075 : ni pilote, ni mécanicien, ni hélicoptère.
const EQUIPE_ANCIENNE = {
  id: 'equipe-2',
  nom: 'Équipe Betroka',
  chef_de_base_id: 'chef-1',
  pilote: null,
  mecanicien: null,
  consultant_international: null,
  aeronef: null,
};

let mockEquipe: Record<string, unknown> = EQUIPE_COMPLETE;

jest.mock('@/components/referentiel/EquipeAerienneField', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    EquipeAerienneField: ({ onChange }: { onChange: (id: string, option: unknown) => void }) => (
      <TouchableOpacity onPress={() => onChange(mockEquipe.id as string, mockEquipe)}>
        <Text>[mock] choisir équipe</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/referentiel/BaseAerienneField', () => {
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    BaseAerienneField: ({ onChange, equipeId }: { onChange: (id: string) => void; equipeId?: string | null }) => (
      <View>
        <Text>{`[mock] bases de ${equipeId}`}</Text>
        <TouchableOpacity onPress={() => onChange('base-1')}>
          <Text>[mock] choisir base</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/components/referentiel/StandRemplissageField', () => {
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    StandRemplissageField: ({ onChange, equipeId }: { onChange: (id: string) => void; equipeId?: string | null }) => (
      <View>
        <Text>{`[mock] stands de ${equipeId}`}</Text>
        <TouchableOpacity onPress={() => onChange('stand-1')}>
          <Text>[mock] choisir stand-1</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

const CAMPAGNE = { id: 'campagne-1', name: '2026', start_date: '2026-01-01', end_date: null };
const CHEF = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky', sigle: null };

async function choisirEquipeBaseEtStand() {
  await fireEvent.press(screen.getByText('[mock] choisir équipe'));
  await fireEvent.press(await screen.findByText('[mock] choisir base'));
  await fireEvent.press(screen.getByText('[mock] choisir stand-1'));
  await screen.findByText('Toky Rabe');
}

describe('FicheVolCreationScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockEquipe = EQUIPE_COMPLETE;
    useAuthStore.setState({ token: 'token-test', user: { role: 'chef_de_base' } as any });
    jest.mocked(apiClient.createFicheVol).mockReset();
    jest.mocked(apiClient.listChefsDeBase).mockReset().mockResolvedValue([CHEF] as any);
    jest.mocked(listCampagnesLocal).mockReset().mockResolvedValue([CAMPAGNE] as any);
  });

  it("exige l'équipe, la base et le stand avant de créer", async () => {
    await render(<FicheVolCreationScreen />);

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await screen.findByText('Choisissez l’équipe aérienne.');
    expect(screen.getByText('Choisissez une base aérienne.')).toBeVisible();
    expect(screen.getByText('Choisissez un stand de remplissage.')).toBeVisible();
    expect(apiClient.createFicheVol).not.toHaveBeenCalled();
  });

  it("ne propose ni base ni stand tant qu'aucune équipe n'est choisie", async () => {
    await render(<FicheVolCreationScreen />);

    expect(screen.getByText("Choisissez l'équipe aérienne pour voir ses bases et ses stands.")).toBeVisible();
    expect(screen.queryByText('[mock] choisir base')).toBeNull();
    expect(screen.queryByText('[mock] choisir stand-1')).toBeNull();
  });

  it("déduit l'en-tête de l'équipe choisie, en lecture seule", async () => {
    await render(<FicheVolCreationScreen />);

    await fireEvent.press(screen.getByText('[mock] choisir équipe'));

    await screen.findByText('Toky Rabe'); // chef de base, résolu depuis l'équipe
    expect(screen.getByText('Jean Rakoto')).toBeVisible();
    expect(screen.getByText('Paul Andria')).toBeVisible();
    expect(screen.getByText('John Smith')).toBeVisible();
    expect(screen.getByText('5R-MJA')).toBeVisible();
    expect(screen.getByText('Heli Madagascar')).toBeVisible();
    expect(screen.getByText('800 L')).toBeVisible();
    // Rien à saisir : le serveur fait autorité, le mobile n'affiche que le résultat.
    expect(screen.queryByPlaceholderText(/Pilote/)).toBeNull();
    expect(screen.queryByPlaceholderText(/Immatriculation/)).toBeNull();
  });

  it("ne propose que les lieux de l'équipe choisie", async () => {
    await render(<FicheVolCreationScreen />);

    await fireEvent.press(screen.getByText('[mock] choisir équipe'));

    await screen.findByText('[mock] bases de equipe-1');
    expect(screen.getByText('[mock] stands de equipe-1')).toBeVisible();
  });

  it("efface la base et le stand choisis quand l'équipe change", async () => {
    await render(<FicheVolCreationScreen />);
    await choisirEquipeBaseEtStand();

    // Autre équipe : ses lieux diffèrent, les choix précédents ne valent plus.
    mockEquipe = EQUIPE_ANCIENNE;
    await fireEvent.press(screen.getByText('[mock] choisir équipe'));
    await fireEvent.changeText(screen.getByPlaceholderText(/Pilote/), 'P');
    await fireEvent.changeText(screen.getByPlaceholderText(/Mécanicien/), 'M');
    await fireEvent.changeText(screen.getByPlaceholderText(/Immatriculation/), '5R-X');
    await fireEvent.changeText(screen.getByPlaceholderText('Compagnie'), 'Air Test');
    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await screen.findByText('Choisissez une base aérienne.');
    expect(screen.getByText('Choisissez un stand de remplissage.')).toBeVisible();
    expect(apiClient.createFicheVol).not.toHaveBeenCalled();
  });

  it("crée la fiche avec l'en-tête de l'équipe et navigue vers le récapitulatif", async () => {
    jest.mocked(apiClient.createFicheVol).mockResolvedValue({
      id: 'fiche-1',
      numero_fiche: '001-2026-09-16-EQ-5RMJA',
      date_vol: '2026-09-16',
      immatriculation: '5R-MJA',
      compagnie: 'Heli Madagascar',
    } as any);

    await render(<FicheVolCreationScreen />);
    await choisirEquipeBaseEtStand();

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await waitFor(() =>
      expect(apiClient.createFicheVol).toHaveBeenCalledWith('token-test', {
        date_vol: expect.any(String),
        compagnie: 'Heli Madagascar',
        immatriculation: '5R-MJA',
        campagne_id: 'campagne-1',
        base_id: 'base-1',
        stand_id: 'stand-1',
        pilote: 'Jean Rakoto',
        mecanicien: 'Paul Andria',
        chef_de_base_id: 'chef-1',
        equipe_aerienne_id: 'equipe-1',
        prospection_id: null,
        consultant_international: 'John Smith',
        pesticide_nom_commercial: null,
        pesticide_quantite_disponible: null,
        pesticide_quantite_recue: null,
        futs_disponible: null,
        futs_recues: null,
        futs_pleins: null,
        futs_vides: null,
        observations: null,
      })
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(fiche-vol)/recap',
        params: {
          id: 'fiche-1',
          chefDeBaseNom: 'Toky Rabe',
        },
      })
    );
  });

  it("garde les champs saisissables quand l'équipe n'a ni pilote, ni mécanicien, ni hélicoptère", async () => {
    mockEquipe = EQUIPE_ANCIENNE;
    jest.mocked(apiClient.createFicheVol).mockResolvedValue({ id: 'fiche-2' } as any);

    await render(<FicheVolCreationScreen />);
    await fireEvent.press(screen.getByText('[mock] choisir équipe'));
    await fireEvent.press(await screen.findByText('[mock] choisir base'));
    await fireEvent.press(screen.getByText('[mock] choisir stand-1'));
    await fireEvent.changeText(screen.getByPlaceholderText(/Pilote/), 'Jean Rakoto');
    await fireEvent.changeText(screen.getByPlaceholderText(/Mécanicien/), 'Paul Rabe');
    await fireEvent.changeText(screen.getByPlaceholderText(/Immatriculation/), '5R-MXY');
    await fireEvent.changeText(screen.getByPlaceholderText('Compagnie'), 'Air Test');

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await waitFor(() =>
      expect(apiClient.createFicheVol).toHaveBeenCalledWith(
        'token-test',
        expect.objectContaining({
          compagnie: 'Air Test',
          immatriculation: '5R-MXY',
          pilote: 'Jean Rakoto',
          mecanicien: 'Paul Rabe',
          chef_de_base_id: 'chef-1',
          equipe_aerienne_id: 'equipe-2',
          consultant_international: null,
        })
      )
    );
  });

  it("bloque la création quand aucune campagne n'est disponible hors-ligne", async () => {
    jest.mocked(listCampagnesLocal).mockResolvedValue([]);

    await render(<FicheVolCreationScreen />);
    await choisirEquipeBaseEtStand();

    await fireEvent.press(screen.getByText('Créer la fiche  ›'));

    await waitFor(() => expect(listCampagnesLocal).toHaveBeenCalled());
    expect(apiClient.createFicheVol).not.toHaveBeenCalled();
  });

  // #fiche-vol-acces-roles : garde-fou si cet écran est atteint par lien
  // direct plutôt que depuis le menu (déjà filtré pour les autres rôles).
  it('affiche un accès refusé pour un rôle hors chef de base / équipe aérienne', async () => {
    useAuthStore.setState({ token: 'token-test', user: { role: 'prospecteur' } as any });

    await render(<FicheVolCreationScreen />);

    await screen.findByText('Accès réservé');
    expect(screen.queryByText('[mock] choisir équipe')).toBeNull();
  });
});
