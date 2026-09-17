/**
 * Récapitulatif (recap.tsx) — Aérien (#recap-fiche-traitement-incomplet) :
 * l'écran n'affichait que "Équipe" et "Pesticides & rotations" — Cibles/
 * Synthèse, Moyens & protection, Impacts & risque et l'efficacité
 * n'apparaissaient jamais, donnant l'impression que ces informations avaient
 * disparu en revenant relire la fiche avant enregistrement, alors qu'elles
 * sont bien enregistrées localement.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import RecapScreen from '@/app/(traitement)/recap';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as referentielDb from '@/lib/referentiel-db';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { traitementId: 'trait-1' } })
);

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  countUnsyncedTraitements: jest.fn().mockResolvedValue(0),
  markTraitementValidee: jest.fn(),
}));

jest.mock('@/lib/traitement-sync', () => ({
  enregistrerEtSynchroniserTraitement: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: { validerTraitement: jest.fn() },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
}));

const DRAFT_AERIEN = {
  id: 'trait-1',
  numero_fiche: 'CRT-2026-00042',
  type_traitement: 'AERIEN',
  mode_traitement: 'BARRIERE',
  localite: 'Betioky',
  date_traitement: '2026-09-17',
  kit_combinaison: 4,
  kit_gants: 4,
  kit_lunettes: 3,
  kit_masques: 4,
  kit_botte: 4,
  zones_exposees: JSON.stringify({ cultures: true, paturages: false }),
  hauteur_strate_herbeuse_m: 1.2,
  hauteur_strate_arboree_m: 3.5,
  recouvrement_percent: 80,
  empoisonnement: true,
  empoisonnement_type: 'AGENT',
  empoisonnement_mode: 'INHALATION',
  empoisonnement_autre: null,
  evaluation_risque: JSON.stringify({ ressources_eau: true, sol: false }),
  comportement_anormal: true,
  comportement_non_cibles: JSON.stringify(['Oiseaux', 'Poissons']),
  mortalite: false,
  mortalite_familles: JSON.stringify([]),
  observations: 'RAS',
  cible: {
    traitement_id: 'trait-1',
    espece: null,
    petites_larves_lmc: 4,
    petites_larves_nse: null,
    grandes_larves_lmc: 2,
    grandes_larves_nse: null,
    vols_clairs_essaims: 1,
    repartition_population: null,
    surface_infestee_ha: 120,
    densite_diffuse_lmc: 5,
    densite_groupee_lmc: 2,
    densite_diffuse_nse: null,
    densite_groupee_nse: null,
  },
  aerien: {
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    chef_de_base_id: 'chef-1',
    consultant_international: 'Paul Andria',
    immatricule_aeronef: '5R-ABC',
    base_principale: 'Base Betioky',
    stand: 'Stand 1',
    base_secondaire: 'Base secondaire X',
    reprise_traitement: true,
    nb_rotations: 3,
    total_pesticide_l: 45,
    total_pesticide_kg: null,
    surface_traitee_ha: 100,
    pesticide_recu_l: 60,
    pesticide_stock_restant_l: 15,
    taux_mortalite_pourcent: 92,
    evaluation_efficacite_heures_apres: 24,
    methode_evaluation_efficacite: 'ESTIMATION_VISUELLE',
    rotations: [],
  },
  signatures: [],
  evaluations_risque_population: [
    { id: 'erp-1', habitat_proche: 'Rizière', distance_km: 1.5, sensibilisation: true },
  ],
} as any;

describe('RecapScreen — Aérien : rien de saisi ne manque à la relecture', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'user-1' } as any });
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_AERIEN);
    jest.mocked(traitementRepository.countUnsyncedTraitements).mockReset().mockResolvedValue(0);
    jest.mocked(referentielDb.listUtilisateursByRole).mockReset().mockResolvedValue([
      { id: 'chef-1', prenom: 'Alice', nom: 'Randria' } as any,
    ]);
  });

  it('affiche la carte Cible avec le détail par espèce', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Cible')).toBeVisible();
    expect(screen.getByText('LMC')).toBeVisible();
    expect(screen.getByText('LMC : 4')).toBeVisible();
    expect(screen.getByText('LMC : 2')).toBeVisible();
    expect(screen.getByText('120')).toBeVisible();
  });

  it('affiche la reprise de traitement et l’efficacité sur les cartes Équipe / Pesticides & rotations', async () => {
    await render(<RecapScreen />);

    // « Équipe » et « Moyens & protection »/« Impacts & risque » apparaissent aussi
    // dans la checklist en tête d'écran (controlLabels) — on attend une valeur propre
    // à la carte de données plutôt qu'un titre/libellé de section, ambigu.
    await screen.findByText('5R-ABC');
    expect(screen.getByText('92')).toBeVisible();
    expect(screen.getByText('24')).toBeVisible();
    expect(screen.getByText('Estimation visuelle')).toBeVisible();
  });

  it('affiche la carte Moyens & protection (kit, zones, végétation)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Combinaisons');
    expect(screen.getByText('Cultures')).toBeVisible();
    expect(screen.getByText('1.2')).toBeVisible();
    expect(screen.getByText('3.5')).toBeVisible();
    expect(screen.getByText('80')).toBeVisible();
  });

  it('affiche la carte Impacts & risque (empoisonnement, évaluation, comportement, observations)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Empoisonnement');
    expect(screen.getByText('Agent')).toBeVisible();
    expect(screen.getByText('Inhalation')).toBeVisible();
    expect(screen.getByText('Ressources en eau : Oui · Sol : Non')).toBeVisible();
    expect(screen.getByText('Oiseaux, Poissons')).toBeVisible();
    expect(screen.getByText('RAS')).toBeVisible();
  });

  it('affiche la carte Évaluation du risque pour la population', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Rizière · 1.5 km · sensibilisée')).toBeVisible();
  });
});
