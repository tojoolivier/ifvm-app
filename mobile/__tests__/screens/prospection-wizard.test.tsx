/** Wizard de prospection (#683) : en-tête unique, badge du type, reprise d'un brouillon. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import WizardScreen from '@/app/(prospection)/wizard';
import { getFiche } from '@/lib/prospection-db';

let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/prospection-db', () => ({ getFiche: jest.fn() }));

describe('WizardScreen', () => {
  beforeEach(() => {
    mockParams = {};
    mockBack.mockClear();
    jest.mocked(getFiche).mockReset();
  });

  it.each([
    ['intensive', 'Intensive'],
    ['extensive', 'Extensive'],
    ['validation', 'Validation'],
  ])('affiche le badge du type « %s » et « Étape 1 sur 5 »', async (type, badge) => {
    mockParams = { type };
    await render(<WizardScreen />);

    expect(screen.getByText('Nouvelle prospection')).toBeVisible();
    expect(screen.getByText(badge)).toBeVisible();
    expect(screen.getByText('Étape 1 sur 5')).toBeVisible();
  });

  it('garde le type tout au long des étapes (aucune bascule)', async () => {
    mockParams = { type: 'extensive' };
    await render(<WizardScreen />);

    await fireEvent.press(screen.getByText('Suivant'));

    expect(screen.getByText('Étape 2 sur 5')).toBeVisible();
    expect(screen.getByText('Extensive')).toBeVisible();
  });

  it('rouvre un brouillon de revalidation sur la bonne étape', async () => {
    mockParams = { id: 'f1' };
    jest.mocked(getFiche).mockResolvedValue({
      fiche: {
        id: 'f1',
        type_prospection: 'extensive',
        revalide_de_id: 'src',
        n_fiche: 'FI-1-bis',
        station_id: 's',
        date_prospection: '2026-09-25',
      },
    } as never);
    await render(<WizardScreen />);

    await waitFor(() => expect(screen.getByText('Revalidation')).toBeVisible());
    expect(screen.getByText('Étape 2 sur 5')).toBeVisible();
    expect(screen.getByText('Fiche FI-1-bis')).toBeVisible();
  });

  it('signale un brouillon introuvable', async () => {
    mockParams = { id: 'nope' };
    jest.mocked(getFiche).mockResolvedValue(null);
    await render(<WizardScreen />);

    await waitFor(() => expect(screen.getByText(/introuvable/)).toBeVisible());
  });

  it('s’arrête sur le récapitulatif : plus de « Suivant » après l’étape 5', async () => {
    mockParams = { type: 'intensive' };
    await render(<WizardScreen />);

    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByText('Suivant'));

    expect(screen.getByText('Étape 5 sur 5')).toBeVisible();
    expect(screen.getByText('Récapitulatif')).toBeVisible();
    expect(screen.queryByText('Suivant')).toBeNull();
  });

  it('signale un brouillon illisible au lieu d’échouer en silence', async () => {
    mockParams = { id: 'casse' };
    jest.mocked(getFiche).mockRejectedValue(new Error('SQLite'));
    await render(<WizardScreen />);

    await waitFor(() => expect(screen.getByText(/introuvable/)).toBeVisible());
  });

  it('la flèche de l’en-tête revient à l’étape précédente, en gardant le type', async () => {
    mockParams = { type: 'validation' };
    await render(<WizardScreen />);
    await fireEvent.press(screen.getByText('Suivant'));

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(screen.getByText('Étape 1 sur 5')).toBeVisible();
    expect(screen.getByText('Validation')).toBeVisible();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('la flèche de l’en-tête quitte le wizard depuis la première étape', async () => {
    mockParams = { type: 'intensive' };
    await render(<WizardScreen />);

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
