/**
 * Écran « Synthèse » (#326) — aérien uniquement, fusionne l'ancien écran « Cibles »
 * (lecture seule) et la section Végétation de moyens.tsx. Vérifie l'affichage de la
 * cible, la saisie/l'enregistrement de la végétation (round-trip kit/zones inclus)
 * et la navigation vers « Équipe ».
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SyntheseScreen from '@/app/(traitement)/synthese';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
}));

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: {
      espece: 'LMC',
      petites_larves: 'faible',
      grandes_larves: 'forte',
      vols_clairs_essaims: 1,
      repartition_population: 'GROUPEE',
      surface_infestee_ha: 42.5,
    },
    kit_combinaison: 2,
    kit_gants: 3,
    kit_lunettes: 0,
    kit_masques: 0,
    kit_botte: 0,
    zones_exposees: JSON.stringify({ habitations: true }),
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draft());
  jest.mocked(traitementRepository.updateTraitementMoyens).mockClear().mockResolvedValue({} as any);
});

describe('SyntheseScreen — cibles (lecture seule) + végétation', () => {
  it('affiche la cible telle quelle, snapshot figé', async () => {
    await render(<SyntheseScreen />);

    expect(await screen.findByText('LMC')).toBeVisible();
    expect(screen.getByText('42.5')).toBeVisible();
  });

  it('saisit la végétation puis l’enregistre avec le kit/zones déjà en base, inchangés (round-trip)', async () => {
    await render(<SyntheseScreen />);
    await screen.findByText('LMC');

    fireEvent.changeText(screen.getByPlaceholderText('Ex. 1,5'), '1,5');
    await waitFor(() => expect(screen.getByPlaceholderText('Ex. 1,5').props.value).toBe('1,5'));
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 80'), '75');
    await waitFor(() => expect(screen.getByPlaceholderText('Ex. 80').props.value).toBe('75'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementMoyens).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          kit_combinaison: 2,
          kit_gants: 3,
          zones_exposees: { habitations: true },
          hauteur_strate_herbeuse_m: 1.5,
          recouvrement_percent: 75,
        })
      )
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/traitement' })
      )
    );
  });

  it('bloque « Continuer » si le recouvrement est hors 0-100, sans enregistrer', async () => {
    await render(<SyntheseScreen />);
    await screen.findByText('LMC');

    fireEvent.changeText(screen.getByPlaceholderText('Ex. 80'), '150');
    await waitFor(() => expect(screen.getByPlaceholderText('Ex. 80').props.value).toBe('150'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText(/recouvrement doit être compris/)).toBeVisible();
    expect(traitementRepository.updateTraitementMoyens).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
