/**
 * Végétation du traitement — pré-remplie depuis la fiche de prospection liée,
 * côté Aérien (synthese.tsx). Même patron que moyens.tsx côté Terrestre (cf.
 * traitement-moyens-vegetation-prefill.test.tsx). N'anticipe pas #325 (lecture
 * seule de la cible/population depuis la prospection, bloqué par le ticket 6) :
 * `cible` reste le snapshot figé, seule la végétation est concernée ici.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import SyntheseScreen from '@/app/(traitement)/synthese';
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
  getProspection: jest.fn(),
}));

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    prospection_id: 'prosp-1',
    type_traitement: 'AERIEN',
    cible: {
      espece: 'LMC',
      petites_larves: 'faible',
      grandes_larves: 'forte',
      vols_clairs_essaims: 1,
      repartition_population: 'GROUPEE',
      surface_infestee_ha: 42.5,
    },
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
  jest.mocked(prospectionRepository.getProspection).mockReset();
});

describe('SyntheseScreen — végétation pré-remplie depuis la prospection liée', () => {
  it('pré-remplit Strate herbeuse (cm -> m) et Recouvrement, jamais Strate arborée', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: 150,
      verdissement_pourcent: 75,
    } as any);

    await render(<SyntheseScreen />);
    await screen.findByText('LMC');

    await waitFor(() => expect(screen.getByDisplayValue('1,5')).toBeVisible());
    expect(screen.getByDisplayValue('75')).toBeVisible();
    expect(screen.getByPlaceholderText('Ex. 2,5')).toHaveProp('value', '');
  });

  it("n'écrase jamais une valeur déjà enregistrée (fiche reprise)", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({ hauteur_strate_herbeuse_m: 2, recouvrement_percent: 40 })
    );
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: 150,
      verdissement_pourcent: 75,
    } as any);

    await render(<SyntheseScreen />);
    await screen.findByText('LMC');

    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalledWith('prosp-1'));
    expect(screen.getByDisplayValue('2')).toBeVisible();
    expect(screen.getByDisplayValue('40')).toBeVisible();
    expect(screen.queryByDisplayValue('1,5')).toBeNull();
  });
});
