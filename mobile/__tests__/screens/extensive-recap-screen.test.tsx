/**
 * Fidélité du récapitulatif Extensive (harmonisation avec le récapitulatif Intensif) :
 * le récapitulatif n'affichait que des totaux de captures et, en mode vérification de
 * signalement, deux chiffres arbitraires (LMC · Trans., NSE · Densité L) sans lien avec
 * les données réellement saisies — cf. règle « ne jamais afficher une donnée inventée ».
 */
import { render, screen } from '@testing-library/react-native';
import ExtensiveRecapScreen from '@/app/(prospection)/extensive-recap';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  concludeValidation: jest.fn(),
}));

const DRAFT_BASE = {
  id: 'draft-123',
  type_prospection: 'extensive',
  station_libre: 'Andasibe',
  type_station: 'xerophyle',
  surface_station: 12,
  n_message: '20260825-AB12',
  latitude: -18.9,
  longitude: 47.5,
  degats_cultures_pourcent: 30,
  verdure_strate: 'forte',
  hauteur_herbe_cm: 45,
  derniere_pluie: '2026-08-20',
  intensite_pluie: 'forte',
} as any;

const POPULATIONS = [
  {
    espece: 'LMC', categorie: 'imago', captures_nombre: 12, captures_sol: 5, captures_trans: 4, captures_greg: 3,
    densite_diffuse: 8, densite_groupee: 2, essaim_observe: true, methode: null, accouplement: null, ponte: null,
  },
  {
    espece: 'LMC', categorie: 'larve', captures_nombre: 6, captures_sol: 6, captures_trans: 0, captures_greg: 0,
    densite_diffuse: null, densite_groupee: null, methode: null, accouplement: null, ponte: null,
    densites_larve: JSON.stringify({ L1: 4, L2: 2 }), tache_larvaire: true, bande_larvaire: false,
    interdistance: 15, deplacement: 'perchee',
  },
] as any;

describe('ExtensiveRecapScreen — fidélité au récapitulatif', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue(POPULATIONS);
  });

  it('affiche les vraies données de référence, densités, infestation larvaire et observations — pas des totaux seuls', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText(/Station : Andasibe/)).toBeVisible();
    expect(screen.getByText(/Densité diffuse : 8 D\/ha/)).toBeVisible();
    expect(screen.getByText(/Densité groupée : 2 D\/m²/)).toBeVisible();
    expect(screen.getByText(/Type de capture : Essaim/)).toBeVisible();
    expect(screen.getByText(/Stades : L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText('Tache larvaire')).toBeVisible();
    expect(screen.getByText(/Interdistance : 15 m/)).toBeVisible();
    expect(screen.getByText(/Déplacement : Perchée/)).toBeVisible();
    expect(screen.getByText(/Dégâts sur les cultures : 30 %/)).toBeVisible();
    expect(screen.getByText(/Dernière pluie : 2026-08-20/)).toBeVisible();
  });

  it("le mode vérification de signalement affiche les mêmes données réelles, pas des chiffres arbitraires", async () => {
    useProspectionWizardStore.setState({
      draft: {
        ...DRAFT_BASE,
        type_prospection: 'validation',
        signalement_source: 'Rasoanaivo',
        signalement_date: '2026-08-24',
        signalement_description: 'Essaim visible près du village',
      },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText('Vérification du signalement')).toBeVisible();
    expect(screen.getByText(/Densité diffuse : 8 D\/ha/)).toBeVisible();
    expect(screen.getByText(/Stades : L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText(/Dégâts sur les cultures : 30 %/)).toBeVisible();
  });
});
