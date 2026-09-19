/**
 * LieuAerienField (#prospection-extensive-aerienne-lieu-aerien) — suggère les
 * lieux du référentiel `lieu_aerien` (lus hors-ligne) et permet d'en créer un
 * nouveau (`POST /lieux-aeriens`, en ligne), sans réintroduire de FK : choisir
 * ou créer un lieu ne fait que remplir le texte libre avec son nom.
 *
 * La création exige de choisir l'équipe aérienne propriétaire du lieu
 * (`equipe_aerienne_id`, migration backend 0074) : l'équipe existe avant ses lieux.
 */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LieuAerienField } from '@/components/referentiel/LieuAerienField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listLieuxAeriens } from '@/lib/referentiel-db';
import { getCurrentPosition } from '@/lib/location';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    createLieuAerien: jest.fn(),
    listEquipesAeriennes: jest.fn(),
  },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listLieuxAeriens: jest.fn(),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
}));

const LIEU_EXISTANT = { id: 'lieu-1', type_lieu: 'principale', nom: 'Ihosy' };
const EQUIPES = [
  { id: 'equipe-1', nom: 'Équipe Nord' },
  { id: 'equipe-2', nom: 'Équipe Sud' },
];

function Wrapper({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <LieuAerienField label="Base" value={value} onChangeText={setValue} focusedField={focused} setFocusedField={setFocused} />
  );
}

describe('LieuAerienField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(listLieuxAeriens).mockReset().mockResolvedValue([LIEU_EXISTANT] as any);
    jest.mocked(apiClient.createLieuAerien).mockReset();
    jest.mocked(apiClient.listEquipesAeriennes).mockReset().mockResolvedValue(EQUIPES as any);
    jest.mocked(getCurrentPosition)
      .mockReset()
      .mockResolvedValue({ latitude: -22.4, longitude: 46.1, altitude: 700, accuracy: 5, timestamp: 0 } as any);
  });

  it('charge la liste locale et remplit le texte libre au choix', async () => {
    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('Choisir un lieu existant ›'));
    await screen.findByText(/Ihosy/);

    await fireEvent.press(screen.getByText(/Ihosy/));
    expect(screen.getByDisplayValue('Ihosy')).toBeTruthy();
  });

  it("affiche un message quand le référentiel local est vide", async () => {
    jest.mocked(listLieuxAeriens).mockResolvedValue([]);
    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('Choisir un lieu existant ›'));
    await screen.findByText('Aucun lieu aérien enregistré.');
  });

  it('crée un nouveau lieu aérien avec la position GPS et remplit le texte libre', async () => {
    jest.mocked(apiClient.createLieuAerien).mockResolvedValue({
      id: 'lieu-2',
      type_lieu: 'secondaire',
      nom: 'Betroka',
      latitude: -22.4,
      longitude: 46.1,
      altitude: 700,
      actif: true,
    } as any);

    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('+ Nouveau lieu aérien'));
    await screen.findByPlaceholderText('Nom du lieu');
    await fireEvent.changeText(screen.getByPlaceholderText('Nom du lieu'), 'Betroka');
    await fireEvent.press(screen.getByText('Secondaire'));
    await fireEvent.press(await screen.findByText('Équipe Sud'));
    await screen.findByText('-22.4000, 46.1000');

    await fireEvent.press(screen.getByText('Créer'));

    expect(apiClient.createLieuAerien).toHaveBeenCalledWith('token-test', {
      type_lieu: 'secondaire',
      nom: 'Betroka',
      latitude: -22.4,
      longitude: 46.1,
      altitude: 700,
      equipe_aerienne_id: 'equipe-2',
    });
    expect(screen.getByDisplayValue('Betroka')).toBeTruthy();
  });

  it("charge les équipes aériennes en ligne à l'ouverture du formulaire de création", async () => {
    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('+ Nouveau lieu aérien'));

    await screen.findByText('Équipe Nord');
    expect(screen.getByText('Équipe Sud')).toBeTruthy();
    expect(apiClient.listEquipesAeriennes).toHaveBeenCalledWith('token-test');
  });

  it("ne crée pas le lieu tant qu'aucune équipe aérienne n'est choisie", async () => {
    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('+ Nouveau lieu aérien'));
    await screen.findByPlaceholderText('Nom du lieu');
    await fireEvent.changeText(screen.getByPlaceholderText('Nom du lieu'), 'Betroka');
    await screen.findByText('Équipe Nord');
    await screen.findByText('-22.4000, 46.1000');

    await fireEvent.press(screen.getByText('Créer'));

    expect(apiClient.createLieuAerien).not.toHaveBeenCalled();
  });

  it("signale qu'aucune équipe aérienne n'existe encore : elle doit précéder ses lieux", async () => {
    jest.mocked(apiClient.listEquipesAeriennes).mockResolvedValue([]);
    await render(<Wrapper />);

    await fireEvent.press(screen.getByText('+ Nouveau lieu aérien'));

    await screen.findByText(/Aucune équipe aérienne disponible/);
  });
});
