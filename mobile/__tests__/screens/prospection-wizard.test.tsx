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
// L'écran Référence a ses propres tests (prospection-reference.test.tsx) : ici, un double qui publie son N° et poursuit.
jest.mock('@/components/prospection/ReferenceStep', () => {
  const { Text, Pressable } = require('react-native');
  const { useEffect } = require('react');
  return {
    ReferenceStep: ({ type, brouillon, onContinuer, onNumeroFiche }: { type: string; brouillon?: { id: string }; onContinuer: (id: string) => void; onNumeroFiche: (n: string) => void }) => {
      useEffect(() => onNumeroFiche('FI-20260925-ABCDEF'), [onNumeroFiche]);
      return (
        <Pressable onPress={() => onContinuer('brouillon-1')}>
          <Text>{`Référence ${type}${brouillon ? ` reprise ${brouillon.id}` : ''}`}</Text>
          <Text>Suivant</Text>
        </Pressable>
      );
    },
  };
});

// L'écran Végétation a ses propres tests (prospection-vegetation.test.tsx) : ici, un double qui montre sa fiche et poursuit.
jest.mock('@/components/prospection/VegetationStep', () => {
  const { Text, Pressable } = require('react-native');
  return {
    VegetationStep: ({ brouillon, onContinuer }: { brouillon: { id: string }; onContinuer: () => void }) => (
      <Pressable onPress={onContinuer}>
        <Text>{`Végétation ${brouillon.id}`}</Text>
        <Text>Continuer végétation</Text>
      </Pressable>
    ),
  };
});

// Idem pour l'étape Sol (prospection-sol.test.tsx) : le double montre le N° de la fiche qu'il reçoit et son lien « Modifier ».
jest.mock('@/components/prospection/SolStep', () => {
  const { Text, Pressable } = require('react-native');
  return {
    SolStep: ({ brouillon, onContinuer, onModifier }: { brouillon: { n_fiche?: string }; onContinuer: () => void; onModifier: () => void }) => (
      <>
        <Text>{`Sol ${brouillon.n_fiche}`}</Text>
        <Pressable onPress={onModifier}>
          <Text>Modifier végétation</Text>
        </Pressable>
        <Pressable onPress={onContinuer}>
          <Text>Continuer sol</Text>
        </Pressable>
      </>
    ),
  };
});

// Idem pour la Végétation extensive (prospection-vegetation-extensive.test.tsx).
jest.mock('@/components/prospection/VegetationExtensiveStep', () => {
  const { Text, Pressable } = require('react-native');
  return {
    VegetationExtensiveStep: ({ brouillon, onContinuer }: { brouillon: { id: string }; onContinuer: () => void }) => (
      <Pressable onPress={onContinuer}>
        <Text>{`Végétation extensive ${brouillon.id}`}</Text>
        <Text>Continuer végétation extensive</Text>
      </Pressable>
    ),
  };
});

describe('WizardScreen', () => {
  beforeEach(() => {
    mockParams = {};
    mockBack.mockClear();
    // Après « Continuer » de la Référence, le wizard relit la fiche enregistrée.
    jest.mocked(getFiche).mockReset().mockResolvedValue({
      fiche: { id: 'brouillon-1', type_prospection: 'intensive', revalide_de_id: null, n_fiche: 'FI-1', station_id: 's', date_prospection: '2026-09-25' },
    } as never);
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

  it('affiche l’écran Référence à l’étape 1 et reprend son N° de fiche dans l’en-tête', async () => {
    mockParams = { type: 'extensive' };
    await render(<WizardScreen />);

    expect(screen.getByText('Référence extensive')).toBeVisible();
    expect(screen.getByText('Fiche FI-20260925-ABCDEF')).toBeVisible();
  });

  it('garde le type tout au long des étapes (aucune bascule)', async () => {
    mockParams = { type: 'extensive' };
    await render(<WizardScreen />);

    await fireEvent.press(screen.getByText('Suivant'));

    expect(screen.getByText('Étape 2 sur 5')).toBeVisible();
    expect(screen.getByText('Extensive')).toBeVisible();
  });

  it('à l’étape 2, l’extensif monte l’écran Végétation extensive (pas l’intensif) et n’a plus de « Suivant » générique', async () => {
    mockParams = { type: 'extensive' };
    await render(<WizardScreen />);
    await fireEvent.press(screen.getByText('Suivant'));

    expect(await screen.findByText('Végétation extensive brouillon-1')).toBeVisible();
    expect(screen.queryByText('Végétation brouillon-1')).toBeNull();
    expect(screen.queryByTestId('wizard-suivant')).toBeNull();
    await fireEvent.press(screen.getByText('Continuer végétation extensive'));
    expect(screen.getByText('Étape 3 sur 5')).toBeVisible();
  });

  it('en intensif, l’étape 3 monte l’écran Sol avec la fiche relue après la Végétation ; « Modifier » revient à l’étape 2', async () => {
    mockParams = { type: 'intensive' };
    const fichePlus = (n_fiche: string) =>
      ({ fiche: { id: 'brouillon-1', type_prospection: 'intensive', revalide_de_id: null, n_fiche, station_id: 's', date_prospection: '2026-09-25' } }) as never;
    jest.mocked(getFiche).mockReset().mockResolvedValueOnce(fichePlus('FI-APRES-REFERENCE')).mockResolvedValueOnce(fichePlus('FI-APRES-VEGETATION'));
    await render(<WizardScreen />);
    await fireEvent.press(screen.getByText('Suivant'));
    await fireEvent.press(await screen.findByText('Continuer végétation'));

    expect(await screen.findByText('Sol FI-APRES-VEGETATION')).toBeVisible();
    expect(screen.getByText('Étape 3 sur 5')).toBeVisible();
    expect(screen.queryByTestId('wizard-suivant')).toBeNull();

    await fireEvent.press(screen.getByText('Modifier végétation'));
    expect(screen.getByText('Étape 2 sur 5')).toBeVisible();
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

  it('revenir à l’étape 1 sur un brouillon rouvre l’écran Référence avec sa fiche', async () => {
    mockParams = { id: 'f2' };
    jest.mocked(getFiche).mockResolvedValue({
      fiche: { id: 'f2', type_prospection: 'intensive', revalide_de_id: null, n_fiche: 'FI-2', station_id: 's', date_prospection: '2026-09-25' },
    } as never);
    await render(<WizardScreen />);
    await waitFor(() => expect(screen.getByText('Étape 2 sur 5')).toBeVisible());

    await fireEvent.press(screen.getByLabelText('Retour'));

    expect(screen.getByText('Référence intensive reprise f2')).toBeVisible();
  });

  it('signale un brouillon introuvable', async () => {
    mockParams = { id: 'nope' };
    jest.mocked(getFiche).mockResolvedValue(null);
    await render(<WizardScreen />);

    await waitFor(() => expect(screen.getByText(/introuvable/)).toBeVisible());
  });

  it('intensive : « Continuer » de la Référence relit la fiche enregistrée et ouvre l’écran Végétation dessus', async () => {
    mockParams = { type: 'intensive' };
    jest.mocked(getFiche).mockResolvedValue({
      fiche: { id: 'brouillon-1', type_prospection: 'intensive', revalide_de_id: null, n_fiche: 'FI-1', station_id: 's', date_prospection: '2026-09-25' },
    } as never);
    await render(<WizardScreen />);

    await fireEvent.press(screen.getByText('Suivant'));

    expect(await screen.findByText('Végétation brouillon-1')).toBeVisible();
    expect(screen.getByText('Étape 2 sur 5')).toBeVisible();
    expect(getFiche).toHaveBeenCalledWith('brouillon-1');
  });

  it('intensive : « Continuer » de la Végétation passe à l’étape 3', async () => {
    mockParams = { id: 'f3' };
    jest.mocked(getFiche).mockResolvedValue({
      fiche: { id: 'f3', type_prospection: 'intensive', revalide_de_id: null, n_fiche: 'FI-3', station_id: 's', date_prospection: '2026-09-25' },
    } as never);
    await render(<WizardScreen />);
    await fireEvent.press(await screen.findByText('Continuer végétation'));

    expect(screen.getByText('Étape 3 sur 5')).toBeVisible();
  });

  it('s’arrête sur le récapitulatif : plus de « Suivant » après l’étape 5', async () => {
    mockParams = { type: 'extensive' };
    await render(<WizardScreen />);

    await fireEvent.press(screen.getByText('Suivant'));
    await fireEvent.press(await screen.findByText('Continuer végétation extensive'));
    for (let i = 0; i < 2; i++) await fireEvent.press(screen.getByText('Suivant'));

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
