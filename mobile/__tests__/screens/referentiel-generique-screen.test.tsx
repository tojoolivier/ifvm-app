/** Liste et fiche génériques des dix référentiels sans écran dédié. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferentielFicheScreen from '@/app/(app)/referentiel-fiche';
import ReferentielListeScreen from '@/app/(app)/referentiel-liste';
import { compterGenerique, getLigneGenerique, listerGenerique } from '@/lib/referentiel-generique';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { table: 'aeronef' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-generique', () => ({
  ...jest.requireActual('@/lib/referentiel-generique'),
  listerGenerique: jest.fn(),
  compterGenerique: jest.fn(),
  getLigneGenerique: jest.fn(),
}));

const ligne = (extra: object) => ({
  cle: 'a1',
  titre: 'F-ZAA',
  code: null,
  sousTitre: 'Cessna',
  actif: true,
  majLe: '2026-09-20T05:12:00.000Z',
  ...extra,
});

beforeEach(() => {
  mockPush.mockReset();
  mockParams = { table: 'aeronef' };
  jest.mocked(listerGenerique).mockReset().mockResolvedValue([ligne({}), ligne({ cle: 'a2', titre: 'F-ZBB', sousTitre: 'Airbus', actif: false })]);
  jest.mocked(compterGenerique).mockResolvedValue({ tous: 6, actifs: 5, inactifs: 1, majLe: '2026-09-20T05:12:00.000Z' });
});

describe('ReferentielListeScreen', () => {
  it('titre, sous-titre, statuts et lignes viennent de la configuration de la table', async () => {
    await render(<ReferentielListeScreen />);

    expect(await screen.findByText('F-ZAA')).toBeTruthy();
    expect(screen.getByText('Aéronefs')).toBeTruthy();
    expect(screen.getByText('6 entrées · màj 20/09')).toBeTruthy();
    expect(screen.getByText('Actifs 5')).toBeTruthy();
    expect(screen.getByText('Cessna')).toBeTruthy();
    expect(screen.getByText('ACTIF')).toBeTruthy();
    expect(screen.getByText('INACTIF')).toBeTruthy();
    expect(screen.getByText('2 RÉSULTATS')).toBeTruthy();
    expect(listerGenerique).toHaveBeenCalledWith('aeronef', { recherche: '', statut: 'tous' });
  });

  it('la recherche et le statut relancent la requête', async () => {
    await render(<ReferentielListeScreen />);
    await screen.findByText('F-ZAA');

    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'zaa');
    await waitFor(() => expect(listerGenerique).toHaveBeenLastCalledWith('aeronef', { recherche: 'zaa', statut: 'tous' }));

    await fireEvent.press(screen.getByTestId('liste-statut-inactifs'));
    await waitFor(() => expect(listerGenerique).toHaveBeenLastCalledWith('aeronef', { recherche: 'zaa', statut: 'inactifs' }));
  });

  it('une table sans statut (membres) n’a ni puces ni badge', async () => {
    mockParams = { table: 'equipe_membre' };
    jest.mocked(listerGenerique).mockResolvedValue([ligne({ cle: 'e|u', titre: 'Jean Rakoto', sousTitre: 'Pilote', actif: null })]);
    await render(<ReferentielListeScreen />);

    expect(await screen.findByText('Jean Rakoto')).toBeTruthy();
    expect(screen.queryByTestId('liste-statut-tous')).toBeNull();
    expect(screen.queryByText('ACTIF')).toBeNull();
  });

  it('le code d’une entrée s’affiche en police mono à côté du sous-titre', async () => {
    mockParams = { table: 'site_aerien' };
    jest.mocked(listerGenerique).mockResolvedValue([ligne({ cle: 's1', titre: 'Isoanala', code: '03', sousTitre: 'Équipe Sud' })]);
    await render(<ReferentielListeScreen />);

    expect(await screen.findByText('03')).toBeTruthy();
    expect(screen.getByText('Équipe Sud')).toBeTruthy();
  });

  it('ouvre la fiche avec la table et la clé', async () => {
    await render(<ReferentielListeScreen />);
    await fireEvent.press(await screen.findByTestId('ligne-a1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/referentiel-fiche', params: { table: 'aeronef', cle: 'a1' } });
  });

  it('table vide : invite à synchroniser ; filtre sans résultat : le dit autrement', async () => {
    jest.mocked(listerGenerique).mockResolvedValue([]);
    await render(<ReferentielListeScreen />);
    expect(await screen.findByText('Aucune entrée sur ce téléphone — synchronisez le référentiel.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'x');
    expect(await screen.findByText('Aucune entrée ne correspond à ces filtres.')).toBeTruthy();
  });
});

describe('ReferentielFicheScreen', () => {
  const fiche = {
    ...ligne({}),
    champs: [
      { libelle: 'Immatriculation', valeur: 'F-ZAA' },
      { libelle: 'Volume de cuve', valeur: '500 L' },
    ],
  };

  beforeEach(() => {
    mockParams = { table: 'aeronef', cle: '8f2c1d3e-0000-4000-8000-00000000a91d' };
  });

  it('affiche les champs de la configuration et les informations de synchronisation', async () => {
    jest.mocked(getLigneGenerique).mockResolvedValue({ ...fiche, cle: mockParams.cle });
    await render(<ReferentielFicheScreen />);

    expect(await screen.findByText('Aéronef')).toBeTruthy();
    expect(screen.getByText('Lecture seule')).toBeTruthy();
    expect(screen.getByText('500 L')).toBeTruthy();
    expect(screen.getByText('8f2c…a91d')).toBeTruthy();
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/ne peut pas être modifiée ici/)).toBeTruthy();
  });

  it('un membre n’a pas d’identifiant serveur ni de statut : pas de bloc de synchronisation', async () => {
    mockParams = { table: 'equipe_membre', cle: 'e|u' };
    jest.mocked(getLigneGenerique).mockResolvedValue({
      ...fiche,
      cle: 'e|u',
      titre: 'Jean Rakoto',
      actif: null,
      majLe: null,
      champs: [{ libelle: 'Fonction', valeur: 'Pilote' }],
    });
    await render(<ReferentielFicheScreen />);

    expect(await screen.findByText('Jean Rakoto')).toBeTruthy();
    expect(screen.queryByText('INFORMATIONS DE SYNCHRONISATION')).toBeNull();
    expect(screen.queryByText('Identifiant')).toBeNull();
  });

  it('une entrée disparue du cache le dit', async () => {
    jest.mocked(getLigneGenerique).mockResolvedValue(null);
    await render(<ReferentielFicheScreen />);
    expect(await screen.findByText('Cette entrée n’est plus dans le référentiel de ce téléphone.')).toBeTruthy();
  });
});
