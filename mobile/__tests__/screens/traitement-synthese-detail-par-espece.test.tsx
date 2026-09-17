/**
 * Écran « Synthèse » — détail par espèce (LMC/NSE) des petites/grandes larves et
 * de la répartition diffuse/groupée (au lieu des seuls totaux agrégés) : demande
 * explicite pour qu'une prospection mélangeant LMC et NSE ne perde plus le détail
 * par espèce au moment du traitement.
 *
 * Fichier séparé de traitement-synthese-screen.test.tsx — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { render, screen } from '@testing-library/react-native';
import SyntheseScreen from '@/app/(traitement)/synthese';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ traitementId: 'trait-1' }),
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
}));

function draft(cible: Record<string, unknown>) {
  return {
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible,
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
  mockPush.mockClear();
});

describe('SyntheseScreen — détail par espèce', () => {
  it('affiche LMC et NSE séparément (Espèce, Petites/Grandes larves, Répartition) sur une fiche mélangée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        espece: 'MELANGE',
        petites_larves: '24',
        grandes_larves: '8',
        vols_clairs_essaims: null,
        repartition_population: 'DIFFUSE',
        surface_infestee_ha: 10,
        petites_larves_lmc: 22,
        petites_larves_nse: 2,
        grandes_larves_lmc: 3,
        grandes_larves_nse: 5,
        densite_diffuse_lmc: 20,
        densite_groupee_lmc: 3,
        densite_diffuse_nse: 5,
        densite_groupee_nse: null,
      })
    );

    await render(<SyntheseScreen />);

    expect(await screen.findByText('LMC / NSE')).toBeVisible();
    expect(screen.getByText('LMC : 22 / NSE : 2')).toBeVisible();
    expect(screen.getByText('LMC : 3 / NSE : 5')).toBeVisible();
    expect(screen.getByText(/LMC — diffuse : 20 ind\.\/ha · groupée : 3 ind\.\/m²/)).toBeVisible();
    expect(screen.getByText(/NSE — diffuse : 5 ind\.\/ha · groupée : non renseigné ind\.\/m²/)).toBeVisible();
  });

  it('n’affiche que l’espèce présente (LMC seul) sans mentionner NSE', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        espece: 'LMC',
        petites_larves: '22',
        grandes_larves: '3',
        vols_clairs_essaims: null,
        repartition_population: 'DIFFUSE',
        surface_infestee_ha: 10,
        petites_larves_lmc: 22,
        petites_larves_nse: null,
        grandes_larves_lmc: 3,
        grandes_larves_nse: null,
        densite_diffuse_lmc: 12,
        densite_groupee_lmc: null,
        densite_diffuse_nse: null,
        densite_groupee_nse: null,
      })
    );

    await render(<SyntheseScreen />);

    expect(await screen.findByText('LMC')).toBeVisible();
    expect(screen.queryByText('NSE')).toBeNull();
    expect(screen.getByText('LMC : 22')).toBeVisible();
    expect(screen.getByText('LMC : 3')).toBeVisible();
    expect(screen.getByText(/LMC — diffuse : 12 ind\.\/ha/)).toBeVisible();
    expect(screen.queryByText(/NSE — diffuse/)).toBeNull();
  });

  it('replie sur les totaux agrégés pour une fiche créée avant l’ajout du détail par espèce', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        espece: 'LMC',
        petites_larves: '15',
        grandes_larves: '10',
        vols_clairs_essaims: 1,
        repartition_population: 'GROUPEE',
        surface_infestee_ha: 42.5,
        // Pas de detail par espece (snapshot ancien, colonnes ajoutees apres coup).
      })
    );

    await render(<SyntheseScreen />);

    expect(await screen.findByText('LMC')).toBeVisible();
    // Petites/Grandes larves : aucun detail par espece -> repli "non renseigné"
    // pour les deux lignes (displayParEspece sans LMC/NSE detailles).
    expect(screen.getAllByText('non renseigné')).toHaveLength(2);
    expect(screen.getByText('GROUPEE')).toBeVisible();
  });
});
