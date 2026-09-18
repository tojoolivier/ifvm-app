/**
 * Récapitulatif (recap.tsx) — Terrestre (#recap-fiche-traitement-incomplet) :
 * cet écran n'affichait strictement AUCUNE carte de données pour le Terrestre
 * (seulement les signatures) — Équipe & Conditions, Moyens & produits, Moyens
 * & protection et Impacts & risque n'y apparaissaient jamais.
 */
import { render, screen } from '@testing-library/react-native';
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

const DRAFT_TERRESTRE = {
  id: 'trait-1',
  numero_fiche: 'CRT-2026-00099',
  type_traitement: 'TERRESTRE',
  mode_traitement: 'TOTAL',
  localite: 'Ambovombe',
  date_traitement: '2026-09-17',
  kit_combinaison: 2,
  kit_gants: 2,
  kit_lunettes: 2,
  kit_masques: 2,
  kit_botte: 2,
  zones_exposees: JSON.stringify({ cultures: false, paturages: true }),
  hauteur_strate_herbeuse_m: 0.8,
  hauteur_strate_arboree_m: null,
  recouvrement_percent: 60,
  empoisonnement: false,
  empoisonnement_type: null,
  empoisonnement_mode: null,
  empoisonnement_autre: null,
  evaluation_risque: JSON.stringify({}),
  comportement_anormal: false,
  comportement_non_cibles: JSON.stringify([]),
  mortalite: false,
  mortalite_familles: JSON.stringify([]),
  observations: null,
  cible: {
    traitement_id: 'trait-1',
    espece: 'MELANGE',
    petites_larves: 3,
    grandes_larves: 1,
    vols_clairs_essaims: null,
    repartition_population: 'Diffuse',
    surface_infestee_ha: 45,
    petites_larves_lmc: null,
    petites_larves_nse: null,
    grandes_larves_lmc: null,
    grandes_larves_nse: null,
    densite_diffuse_lmc: null,
    densite_groupee_lmc: null,
    densite_diffuse_nse: null,
    densite_groupee_nse: null,
  },
  terrestre: {
    chef_equipe_id: 'chef-2',
    agent_encadreur: 'Marie Rasoa',
    consultant_international: null,
    heure_debut: '06:00',
    heure_fin: '09:00',
    vitesse_vent_ms: 2.5,
    direction_vent: 'Nord',
    temperature_c: 26,
    taux_mortalite_pourcent: 88,
    evaluation_efficacite_heures_apres: 12,
    methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
    reprise_traitement: false,
    surface_atomiseur_ha: 10,
    surface_disque_rotatif_ha: 5,
    surface_atomiseur_autoporte_ha: null,
    surface_restante_abandonnee: true,
    motif_surface_restante_abandonnee: 'Zone inaccessible',
    essence_litres: 20,
    nb_piles: 8,
    surface_traitee_ha: 15,
    surface_cumulee_ha: 15,
    surface_restante_ha: 30,
    total_pesticide_l: 12,
    pesticide_recu_l: 20,
    pesticide_stock_restant_l: 8,
    produits: [
      { id: 'prod-1', traitement_terrestre_id: 'trait-1', numero: 1, produit_id: 'p1', quantite_l: 12, nom_commercial: 'Fyfanon' },
    ],
  },
  signatures: [],
  evaluations_risque_population: [],
} as any;

describe('RecapScreen — Terrestre : rien de saisi ne manque à la relecture', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { id: 'user-1' } as any });
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_TERRESTRE);
    jest.mocked(traitementRepository.countUnsyncedTraitements).mockReset().mockResolvedValue(0);
    jest.mocked(referentielDb.listUtilisateursByRole).mockReset().mockResolvedValue([
      { id: 'chef-2', prenom: 'Marc', nom: 'Andria' } as any,
    ]);
  });

  it('affiche la carte Cible (agrégée, sans détail par espèce)', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('MELANGE')).toBeVisible();
    expect(screen.getByText('Diffuse')).toBeVisible();
    expect(screen.getByText('45')).toBeVisible();
  });

  it('affiche la carte Équipe & Conditions (avant absente pour le Terrestre)', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Marie Rasoa')).toBeVisible();
    expect(screen.getByText('06:00')).toBeVisible();
    expect(screen.getByText('09:00')).toBeVisible();
    expect(screen.getByText('vers Nord')).toBeVisible();
    expect(screen.getByText('88')).toBeVisible();
    expect(screen.getByText('Comptages pré/post-traitement')).toBeVisible();
  });

  it('affiche la carte Moyens & produits (Terrestre), avec le produit utilisé et le motif d’abandon', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Fyfanon')).toBeVisible();
    expect(screen.getByText('12 l')).toBeVisible();
    expect(screen.getByText('Zone inaccessible')).toBeVisible();
  });

  it('affiche la carte Moyens & protection (kit, zones, végétation)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Combinaisons');
    expect(screen.getByText('Pâturages')).toBeVisible();
    expect(screen.getByText('0.8')).toBeVisible();
    expect(screen.getByText('60')).toBeVisible();
  });

  it('affiche la carte Impacts & risque même sans empoisonnement/comportement/mortalité (tout à Non)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Empoisonnement');
    expect(screen.getAllByText('Non').length).toBeGreaterThanOrEqual(3);
  });
});
