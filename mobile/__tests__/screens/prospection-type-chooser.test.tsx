/**
 * Choix du type de prospection : seul écran conservé de l'ancien module (#726). Ses trois entrées
 * mènent à « En reconstruction » en attendant le nouveau wizard (#683).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import TypeChooserScreen from '@/app/(prospection)/type-chooser';
import EnReconstructionScreen from '@/app/(app)/en-reconstruction';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

describe('TypeChooserScreen — en attente du nouveau wizard', () => {
  beforeEach(() => mockPush.mockClear());

  it.each(['Intensive', '☑ Validation', 'Extensive'])('« %s » mène à « En reconstruction »', async (libelle) => {
    await render(<TypeChooserScreen />);

    fireEvent.press(screen.getByText(libelle));

    expect(mockPush).toHaveBeenCalledWith('/(app)/en-reconstruction');
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
