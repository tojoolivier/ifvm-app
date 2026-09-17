/**
 * Écran « Cibles » (Terrestre) — détail par espèce (LMC/NSE) des petites/grandes
 * larves et de la répartition diffuse/groupée, même contenu que l'écran
 * « Synthèse » côté Aérien (traitement-synthese-detail-par-espece.test.tsx) :
 * une prospection mélangeant LMC et NSE ne doit plus perdre le détail par
 * espèce au moment du traitement, quel que soit le type de traitement.
 *
 * Fichier séparé de traitement-cibles-screen.test.tsx — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { render, screen } from '@testing-library/react-native';
import CiblesScreen from '@/app/(traitement)/cibles';
import * as traitementRepository from '@/lib/traitement-repository';

const mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
}));

function draftAvecCible(cible: Record<string, unknown> | null) {
  return {
    id: 'trait-1',
    type_traitement: 'TERRESTRE',
    cible,
  } as any;
}

beforeEach(() => {
  jest.mocked(traitementRepository.getTraitement).mockReset();
});

describe('CiblesScreen (Terrestre) — détail par espèce', () => {
  it('affiche LMC et NSE séparément (Espèce, Petites/Grandes larves, Répartition) sur une fiche mélangée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAvecCible({
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

    await render(<CiblesScreen />);

    expect(await screen.findByText('LMC / NSE')).toBeVisible();
    expect(screen.getByText('LMC : 22 / NSE : 2')).toBeVisible();
    expect(screen.getByText('LMC : 3 / NSE : 5')).toBeVisible();
    expect(screen.getByText(/LMC — diffuse : 20 ind\.\/ha · groupée : 3 ind\.\/m²/)).toBeVisible();
    expect(screen.getByText(/NSE — diffuse : 5 ind\.\/ha · groupée : non renseigné ind\.\/m²/)).toBeVisible();
  });

  it('replie sur les totaux agrégés pour une fiche créée avant l’ajout du détail par espèce', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAvecCible({
        espece: 'LMC',
        petites_larves: '15',
        grandes_larves: '10',
        vols_clairs_essaims: 1,
        repartition_population: 'GROUPEE',
        surface_infestee_ha: 42.5,
        // Pas de detail par espece (snapshot ancien, colonnes ajoutees apres coup).
      })
    );

    await render(<CiblesScreen />);

    expect(await screen.findByText('LMC')).toBeVisible();
    // Petites/Grandes larves : aucun detail par espece -> repli "non renseigné".
    expect(screen.getAllByText('non renseigné')).toHaveLength(2);
    expect(screen.getByText('GROUPEE')).toBeVisible();
  });
});
