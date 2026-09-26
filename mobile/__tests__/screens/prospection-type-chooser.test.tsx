/**
 * Choix du type de prospection : seul écran conservé de l'ancien module (#726). Ses trois entrées
 * ouvrent le wizard unique (#683) avec le type choisi.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import TypeChooserScreen from '@/app/(prospection)/type-chooser';
import EnReconstructionScreen from '@/app/(app)/en-reconstruction';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

describe('TypeChooserScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it.each([
    ['Intensive', 'intensive'],
    ['☑ Validation', 'validation'],
    ['Extensive', 'extensive'],
  ])('« %s » ouvre le wizard avec le type %s', async (libelle, type) => {
    await render(<TypeChooserScreen />);

    fireEvent.press(screen.getByText(libelle));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(prospection)/wizard', params: { type } });
  });

  it('ne propose plus la revalidation (écran supprimé)', async () => {
    await render(<TypeChooserScreen />);

    expect(screen.queryByText(/Revalidation/)).toBeNull();
  });
});

describe('EnReconstructionScreen', () => {
  it('annonce que le parcours est indisponible', async () => {
    await render(<EnReconstructionScreen />);

    expect(screen.getByText('En reconstruction')).toBeVisible();
  });
});
