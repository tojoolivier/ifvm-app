/**
 * Écran « Fiches de traitement » (select.tsx) — #boutons-fiches-de-traitement.
 *
 * "Mes fiches" ouvrait auparavant sa liste directement sur cet écran, mêlée
 * aux boutons (#liste-mes-fiches-melangee-boutons). Chacun des trois boutons
 * ouvre désormais son propre écran dédié : "Mes fiches" sur
 * /(traitement)/mes-fiches, comme "Zones à reprendre" le fait déjà sur
 * /(traitement)/zones-a-reprendre — ce fichier ne teste donc plus que la
 * navigation, le contenu de la liste étant couvert par
 * traitement-mes-fiches-screen.test.tsx.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import TraitementSelectScreen from '@/app/(traitement)/select';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockRouteParams = {};
});

describe('TraitementSelectScreen — boutons de la page « Fiches de traitement »', () => {
  it('affiche exactement 3 boutons : Nouvelle fiche de traitement, Mes fiches, Zones à reprendre', async () => {
    await render(<TraitementSelectScreen />);

    expect(screen.getByText('Nouvelle fiche de traitement')).toBeVisible();
    expect(screen.getAllByText('Mes fiches')).toHaveLength(1);
    expect(screen.getByText('Zones à reprendre')).toBeVisible();
  });

  it('« Nouvelle fiche de traitement » fonctionne toujours (sans prospectionId, mène à « En reconstruction »)', async () => {
    await render(<TraitementSelectScreen />);

    fireEvent.press(screen.getByText('Nouvelle fiche de traitement'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/en-reconstruction');
  });

  it('« Mes fiches » ouvre désormais son propre écran, sans afficher de liste ici', async () => {
    await render(<TraitementSelectScreen />);

    fireEvent.press(screen.getByText('Mes fiches'));

    expect(mockPush).toHaveBeenCalledWith('/(traitement)/mes-fiches');
  });

  it('« Zones à reprendre » fonctionne toujours', async () => {
    await render(<TraitementSelectScreen />);

    fireEvent.press(screen.getByText('Zones à reprendre'));

    expect(mockPush).toHaveBeenCalledWith('/(traitement)/zones-a-reprendre');
  });
});
