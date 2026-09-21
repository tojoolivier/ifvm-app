/**
 * Écran « Cibles » (Terrestre) — tableaux Phase/Stade lus EN DIRECT depuis la
 * prospection liée (#cibles-phase-stade-en-direct), en remplacement de
 * « Petites larves »/« Grandes larves » (retirées) et du bandeau
 * « Snapshot figé à la création » (retiré : cette section-là n'est plus figée).
 *
 * Le calcul précis (unification Extensif/Intensif, cumul par code) est couvert
 * par traitement-cible.test.ts::construireDetailPhaseStade — ce fichier ne
 * vérifie que le branchement écran (fetch sur `prospection_id`, rendu des 4
 * groupes, disparition des éléments retirés).
 *
 * Fichier séparé de traitement-cibles-screen.test.tsx/
 * traitement-cibles-detail-par-espece.test.tsx (qui couvrent le reste, toujours
 * figé, de cet écran) — même convention que les autres fichiers de cet écran.
 */
import { render, screen } from '@testing-library/react-native';
import CiblesScreen from '@/app/(traitement)/cibles';
import * as traitementRepository from '@/lib/traitement-repository';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionPopulations: jest.fn(),
  listAllProspectionCaptures: jest.fn(),
  getProspection: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(traitementRepository.getTraitement).mockReset();
  jest.mocked(prospectionRepository.listAllProspectionPopulations).mockReset();
  jest.mocked(prospectionRepository.listAllProspectionCaptures).mockReset();
  jest.mocked(prospectionRepository.getProspection).mockReset().mockResolvedValue({ type_prospection: 'intensive' } as any);
});

describe('CiblesScreen (Terrestre) — Phase/Stade en direct', () => {
  it("récupère les populations/captures de la prospection liée et n'affiche plus le bandeau de snapshot ni Petites/Grandes larves", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      prospection_id: 'prosp-1',
      cible: { espece: 'LMC', vols_clairs_essaims: 1, repartition_population: 'DIFFUSE', surface_infestee_ha: 12.5 },
    } as any);
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([
      {
        espece: 'LMC',
        categorie: 'imago',
        densite_diffuse: null,
        densite_groupee: null,
        methode: null,
        accouplement: null,
        ponte: null,
        captures_sol: 5,
        captures_trans: 0,
        captures_greg: 2,
        captures_solitaro_transiens: 0,
        stades_imago: JSON.stringify({ femelleA1: 3, maleA1: 4 }),
      } as any,
    ]);
    jest.mocked(prospectionRepository.listAllProspectionCaptures).mockResolvedValue([
      { espece: 'NSE', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L2', effectif: 6 },
    ]);

    await render(<CiblesScreen />);

    // Les 4 groupes s'affichent toujours, avec ou sans donnée pour ce groupe précis.
    await screen.findByText('LMC Imagos');
    expect(screen.getByText('LMC Larves')).toBeVisible();
    expect(screen.getByText('NSE Imagos')).toBeVisible();
    expect(screen.getByText('NSE Larves')).toBeVisible();

    // Contenu LMC Imagos (population Extensif) et NSE Larves (capture Intensif) bien remonté à l'écran.
    expect(screen.getByText('Solitaire')).toBeVisible();
    expect(screen.getByText('femelleA1')).toBeVisible();
    expect(screen.getByText('maleA1')).toBeVisible();
    expect(screen.getByText('L2')).toBeVisible();

    expect(prospectionRepository.listAllProspectionPopulations).toHaveBeenCalledWith('prosp-1');
    expect(prospectionRepository.listAllProspectionCaptures).toHaveBeenCalledWith('prosp-1');

    expect(screen.queryByText('⚠ Snapshot figé à la création')).toBeNull();
    expect(screen.queryByText('Petites larves (stades L1 à L3)')).toBeNull();
    expect(screen.queryByText('Grandes larves (LMC : L4-L5 · NSE : L4-L7)')).toBeNull();
  });

  it("n'appelle pas le fetch Phase/Stade quand la fiche n'a pas de prospection_id", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { espece: 'LMC', vols_clairs_essaims: 1, repartition_population: 'DIFFUSE', surface_infestee_ha: 12.5 },
    } as any);

    await render(<CiblesScreen />);

    // Sans prospection_id, aucun des 4 groupes ne s'affiche (pas de fetch possible) :
    // on attend simplement que l'écran ait fini de se résoudre avant de vérifier.
    await screen.findByText('Répartition de la population');
    expect(screen.queryByText('LMC Imagos')).toBeNull();
    expect(prospectionRepository.listAllProspectionPopulations).not.toHaveBeenCalled();
    expect(prospectionRepository.listAllProspectionCaptures).not.toHaveBeenCalled();
  });
});
