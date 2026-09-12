/**
 * « Zones exposées » (écran Moyens & protection, Terrestre) — réduit à
 * Cultures et Pâturages ; Habitations, Points d'eau, Aire protégée et Ruchers
 * retirés du choix (décision produit). Champ JSONB freeform côté backend
 * (aucune contrainte) : changement mobile uniquement.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MoyensScreen from '@/app/(traitement)/moyens';
import * as traitementRepository from '@/lib/traitement-repository';
import * as prospectionRepository from '@/lib/prospection-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue(null),
}));

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    type_traitement: 'TERRESTRE',
    kit_combinaison: 0,
    kit_gants: 0,
    kit_lunettes: 0,
    kit_masques: 0,
    kit_botte: 0,
    zones_exposees: null,
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draft());
  jest.mocked(traitementRepository.updateTraitementMoyens).mockClear().mockResolvedValue({} as any);
  jest.mocked(prospectionRepository.getProspection).mockReset().mockResolvedValue(null);
});

/** Laisse un vrai tick s'écouler entre deux interactions — sinon le gestionnaire
 * suivant reste lié à la fermeture du rendu précédent (même prudence
 * qu'ailleurs dans ce module). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('MoyensScreen — Zones exposées réduites à Cultures/Pâturages', () => {
  afterEach(cleanup);

  it('affiche uniquement Cultures et Pâturages, jamais les autres zones', async () => {
    await render(<MoyensScreen />);

    await waitFor(() => expect(screen.getByText('Zones exposées')).toBeVisible());
    expect(screen.getByText('Cultures')).toBeVisible();
    expect(screen.getByText('Pâturages')).toBeVisible();
    expect(screen.queryByText('Habitations')).toBeNull();
    expect(screen.queryByText("Points d'eau")).toBeNull();
    expect(screen.queryByText('Aire protégée')).toBeNull();
    expect(screen.queryByText('Ruchers')).toBeNull();
  });

  it('coche Cultures et Pâturages puis les enregistre', async () => {
    await render(<MoyensScreen />);
    await screen.findByText('Zones exposées');

    fireEvent.press(screen.getByText('Cultures'));
    await settle();
    fireEvent.press(screen.getByText('Pâturages'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementMoyens).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ zones_exposees: { cultures: true, paturages: true } })
      )
    );
  });

  it('ignore une ancienne zone retirée déjà enregistrée (ex. habitations), sans planter', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({ zones_exposees: JSON.stringify({ habitations: true, cultures: true }) })
    );

    await render(<MoyensScreen />);

    await waitFor(() => expect(screen.getByText('Cultures')).toBeVisible());
    expect(screen.queryByText('Habitations')).toBeNull();
  });
});
