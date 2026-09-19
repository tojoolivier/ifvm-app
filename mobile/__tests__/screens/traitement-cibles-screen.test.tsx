/**
 * Écran « Cibles » — amélioration UI ciblée : titres légèrement agrandis,
 * valeurs plus visibles et centrées automatiquement (courtes, longues, ou
 * « non renseigné »). Purement visuel : `cible` reste le snapshot figé lu tel
 * quel depuis `getTraitement()`, jamais recalculé ici.
 */
import { render, screen } from '@testing-library/react-native';
import CiblesScreen from '@/app/(traitement)/cibles';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
}));

// Les fiches de ces tests n'ont pas de `prospection_id` -> le fetch live
// Phase/Stade est court-circuité, mais le module reste importé (import de
// valeur, pas seulement de type, dans cibles.tsx) : mocké comme partout
// ailleurs pour ne pas dépendre du vrai expo-sqlite en test.
jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

function draftAvecCible(cible: Record<string, unknown> | null) {
  return {
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset();
});

describe('CiblesScreen — hiérarchie et centrage (amélioration UI)', () => {
  it('centre le titre et la valeur de chaque champ, pour une valeur courte', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAvecCible({
        espece: 'LMC',
        petites_larves: 'faible',
        grandes_larves: 'forte',
        vols_clairs_essaims: 1,
        repartition_population: 'GROUPEE',
        surface_infestee_ha: 42.5,
      })
    );

    await render(<CiblesScreen />);

    const espece = await screen.findByText('LMC');
    expect(espece.props.style).toEqual(
      expect.objectContaining({ textAlign: 'center' })
    );
    expect(screen.getByText('Espèce').props.style).toEqual(
      expect.objectContaining({ textAlign: 'center' })
    );

    // La valeur "vedette" (Surface infestée) reste, elle aussi, centrée.
    expect(screen.getByText('42.5').props.style).toEqual(
      expect.objectContaining({ textAlign: 'center' })
    );
  });

  it('affiche « non renseigné » (valeur automatique absente) sans planter, toujours centré', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draftAvecCible(null));

    await render(<CiblesScreen />);

    const valeurs = await screen.findAllByText('non renseigné');
    expect(valeurs.length).toBeGreaterThan(0);
    for (const valeur of valeurs) {
      expect(valeur.props.style).toEqual(expect.objectContaining({ textAlign: 'center' }));
    }
  });

  it('affiche une valeur longue sans la tronquer (répartition de la population)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAvecCible({
        espece: 'LMC',
        petites_larves: null,
        grandes_larves: null,
        vols_clairs_essaims: null,
        repartition_population: 'GROUPEE ET DIFFUSE SUR PLUSIEURS ZONES DISTINCTES',
        surface_infestee_ha: null,
      })
    );

    await render(<CiblesScreen />);

    const valeurLongue = await screen.findByText('GROUPEE ET DIFFUSE SUR PLUSIEURS ZONES DISTINCTES');
    expect(valeurLongue.props.numberOfLines).toBeUndefined();
  });
});
