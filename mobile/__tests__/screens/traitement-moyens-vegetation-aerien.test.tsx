/**
 * #326 — La section « Végétation » de l'écran « Moyens & protection » déménage sur
 * « Synthèse » côté Aérien (amont dans le nouveau flux) : elle ne doit plus
 * s'afficher ici pour ce type, mais reste visible et inchangée côté Terrestre.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import MoyensScreen from '@/app/(traitement)/moyens';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
}));

function draft(typeTraitement: 'AERIEN' | 'TERRESTRE') {
  return {
    id: 'trait-1',
    type_traitement: typeTraitement,
    kit_combinaison: 0,
    kit_gants: 0,
    kit_lunettes: 0,
    kit_masques: 0,
    kit_botte: 0,
    zones_exposees: null,
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset();
});

describe('MoyensScreen — Végétation masquée côté Aérien (#326)', () => {
  it('masque la section Végétation pour un traitement Aérien', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draft('AERIEN'));

    await render(<MoyensScreen />);

    await screen.findByText('Moyens & protection');
    expect(screen.queryByText('Végétation')).toBeNull();
    expect(screen.queryByPlaceholderText('Ex. 1,5')).toBeNull();
  });

  it('garde la section Végétation visible pour un traitement Terrestre, inchangé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draft('TERRESTRE'));

    await render(<MoyensScreen />);

    await screen.findByText('Moyens & protection');
    expect(await screen.findByText('Végétation')).toBeVisible();
    expect(screen.getByPlaceholderText('Ex. 1,5')).toBeVisible();
  });
});
