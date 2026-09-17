/**
 * Menu d'entrée du parcours fiche de vol (#fiche-vol-menu-entree) — le
 * raccourci « Fiche de vol » du tableau de bord ouvre ce menu, qui propose
 * trois actions : créer un lieu aérien, nouvelle fiche de vol, mes fiches.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import FicheVolMenuScreen from '@/app/(fiche-vol)/menu';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));

describe('FicheVolMenuScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('navigue vers les référentiels aériens', async () => {
    await render(<FicheVolMenuScreen />);
    await fireEvent.press(screen.getByText('Créer un lieu aérien'));
    expect(mockPush).toHaveBeenCalledWith('/(fiche-vol)/referentiels');
  });

  it('navigue vers la création de fiche de vol', async () => {
    await render(<FicheVolMenuScreen />);
    await fireEvent.press(screen.getByText('Nouvelle fiche de vol'));
    expect(mockPush).toHaveBeenCalledWith('/(fiche-vol)/creation');
  });

  it('navigue vers la liste des fiches de vol', async () => {
    await render(<FicheVolMenuScreen />);
    await fireEvent.press(screen.getByText('Mes fiches de vol'));
    expect(mockPush).toHaveBeenCalledWith('/(fiche-vol)/mes-fiches');
  });
});
