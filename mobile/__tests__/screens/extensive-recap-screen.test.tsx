/**
 * Fidélité et complétude du récapitulatif Extensive (#227) : le récapitulatif doit
 * permettre de vérifier réellement les données saisies dans Imagos ET Larves (LMC/NSE
 * séparément), pas seulement les informations de référence — cf. règle « ne jamais
 * afficher une donnée inventée » et « ne jamais masquer silencieusement une donnée
 * renseignée ».
 */
import { render, screen } from '@testing-library/react-native';
import ExtensiveRecapScreen from '@/app/(prospection)/extensive-recap';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

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
  surface_infestee: 3.5,
  n_message: '20260825-AB12',
  date_prospection: '2026-08-25',
  latitude: -18.9,
  longitude: 47.5,
  heure_observation_at: '2026-08-25T14:35:00.000Z',
  degats_cultures_pourcent: 30,
  verdure_strate: 'forte',
  hauteur_herbe_cm: 45,
  derniere_pluie: '2026-08-20',
  intensite_pluie: 'forte',
} as any;

const HEURE_ATTENDUE = formatHeureLocale(DRAFT_BASE.heure_observation_at);

const POPULATIONS = [
  {
    espece: 'LMC', categorie: 'imago', captures_nombre: 12, captures_sol: 5, captures_trans: 4, captures_greg: 3,
    captures_solitaro_transiens: 0, densite_diffuse: 8, densite_groupee: 2, essaim_observe: true,
    methode: null, accouplement: 'Dominant', ponte: 'Beaucoup', interdistance: 25.5, type_cible: 'tres_dense',
    direction_de: 'Nord', direction_vers: 'Sud', etat: 'deplacement', essaim_en_vol: true, essaim_pose: false,
  },
  {
    espece: 'NSE', categorie: 'imago', captures_nombre: 0, captures_sol: 0, captures_trans: 0, captures_greg: 0,
    captures_solitaro_transiens: 0, densite_diffuse: null, densite_groupee: null,
    methode: null, accouplement: null, ponte: null, type_cible: 'vol_clair', etat: null,
  },
  {
    espece: 'LMC', categorie: 'larve', captures_nombre: 6, captures_sol: 6, captures_trans: 0, captures_greg: 0,
    densite_diffuse: null, densite_groupee: null, methode: null, accouplement: null, ponte: null,
    densites_larve: JSON.stringify({ L1: 4, L2: 2 }), tache_larvaire: true, bande_larvaire: false,
    interdistance: 15, deplacement: 'perchee', surface_contaminee_ha: 12.75,
  },
] as any;

describe('ExtensiveRecapScreen — récapitulatif complet (#227)', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue(POPULATIONS);
  });

  it('Référence : informations générales, station, surfaces et heure d’observation', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText(/Station : Andasibe/)).toBeVisible();
    expect(screen.getByText(/N° message : 20260825-AB12/)).toBeVisible();
    expect(screen.getByText(/Surface station : 12 ha/)).toBeVisible();
    expect(screen.getByText(/Surface infestée : 3.5 ha/)).toBeVisible();
    expect(screen.getByText(HEURE_ATTENDUE)).toBeVisible();
  });

  it('Imagos LMC : toutes les informations de la grille (captures, phases, accouplement, ponte, interdistance, type de cible, direction, état, comportement, densités)', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Accouplement');

    expect(screen.getAllByText('Nombre de captures')[0]).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByText(/Sol\. 5 · Trans\. 4 · Sol-Trans\. 0 · Grég\. 3/)).toBeVisible();
    expect(screen.getByText('Accouplement')).toBeVisible();
    expect(screen.getByText('Dominant')).toBeVisible();
    expect(screen.getByText('Ponte')).toBeVisible();
    expect(screen.getByText('Beaucoup')).toBeVisible();
    expect(screen.getAllByText('Interdistance (m)')[0]).toBeVisible();
    expect(screen.getByText('25.5')).toBeVisible();
    expect(screen.getByText('Type de cible')).toBeVisible();
    expect(screen.getByText('Très dense')).toBeVisible();
    expect(screen.getByText('Direction du déplacement')).toBeVisible();
    expect(screen.getByText('Nord → Sud')).toBeVisible();
    expect(screen.getByText('État')).toBeVisible();
    expect(screen.getByText('Déplacement')).toBeVisible();
    expect(screen.getByText('Comportement de l’essaim')).toBeVisible();
    expect(screen.getByText('En vol')).toBeVisible();
    expect(screen.getAllByText('Densité diffuse')[0]).toBeVisible();
    expect(screen.getByText('8 D/ha')).toBeVisible();
    expect(screen.getAllByText('Densité groupée')[0]).toBeVisible();
    expect(screen.getByText('2 D/m²')).toBeVisible();
  });

  it('Imagos NSE : sans aucune donnée saisie, le bloc NSE ne s’affiche pas (rien à vérifier, pas de mur de « — »)', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Accouplement');

    // NSE n'a aucune donnée saisie (ni imago, ni larve) : son bloc est masqué partout.
    expect(screen.queryByText('NSE')).toBeNull();
  });

  it('Larves LMC : captures, stades renseignés, interdistance, surface contaminée et autres informations', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Stades renseignés');

    expect(screen.getByText(/L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText('Surface contaminée (ha)')).toBeVisible();
    expect(screen.getByText('12.75')).toBeVisible();
    expect(screen.getByText('15')).toBeVisible(); // interdistance
    expect(screen.getByText(/Tache larvaire · Déplacement : Perchée/)).toBeVisible();
  });

  it('Observations : dégâts, verdure, hauteur en mètres et pluie', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText(/Dégâts sur les cultures : 30 %/)).toBeVisible();
    expect(screen.getByText(/H\. strate herbeuse : 0.45 m/)).toBeVisible();
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
    expect(screen.getAllByText('Densité diffuse')[0]).toBeVisible();
    expect(screen.getByText('8 D/ha')).toBeVisible();
    expect(screen.getByText(/L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText(/Dégâts sur les cultures : 30 %/)).toBeVisible();
    expect(screen.getByText(new RegExp(`Heure d.observation : ${HEURE_ATTENDUE}`))).toBeVisible();
  });
});
