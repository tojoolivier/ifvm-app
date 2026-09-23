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
  region: 'Androy',
  district: 'Ambovombe',
  commune: 'Antaritarika',
  latitude: -25.1719,
  longitude: 46.0938,
  altitude: 120,
  nb_agents_permanents: 41,
  nb_agents_temporaires: 17,
  nb_personnel_local: 63,
  moyens_atomiseur_nb: 9,
  moyens_essence_litres: 77,
  moyens_disque_rotatif_nb: 22,
  moyens_piles_nb: 99,
  moyens_ulvamast_nb: 3,
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
    // "L" majuscule : #produits-unite-l-kg, repli par défaut d'une fiche sans
    // pesticide_unite explicite (créée avant cet ajout).
    expect(screen.getByText('12 L')).toBeVisible();
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

  it('affiche la répartition par espèce (densités diffuse/groupée) quand le détail par espèce est renseigné', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_TERRESTRE,
      cible: {
        ...DRAFT_TERRESTRE.cible,
        petites_larves_lmc: 22,
        densite_diffuse_lmc: 20,
        densite_groupee_lmc: 3,
      },
    });

    await render(<RecapScreen />);

    await screen.findByText('Répartition LMC');
    expect(screen.getByText('diffuse : 20 ind./ha · groupée : 3 ind./m²')).toBeVisible();
    expect(screen.queryByText('Répartition de la population')).toBeNull();
  });

  /** Migration backend 0083 : généralise au Terrestre la répartition traitée/
   * protégée déjà appliquée à l'Aérien (migration 0081) — même bascule de
   * libellé que l'écran « Surface traitée » aérien (#326). */
  it('affiche « Surface protégée » (et sa valeur) plutôt que « Surface traitée » en mode barrière', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_TERRESTRE,
      mode_traitement: 'BARRIERE',
      terrestre: {
        ...DRAFT_TERRESTRE.terrestre,
        surface_traitee_ha: 0,
        surface_protegee_ha: 6.5,
      },
    });

    await render(<RecapScreen />);

    await screen.findByText('Surface protégée (ha)');
    expect(screen.getByText('6.5')).toBeVisible();
    expect(screen.queryByText('Surface traitée (ha)')).toBeNull();
  });

  /**
   * #recap-terrestre-moyens-produits-vides : `surface_traitee_ha`/`surface_cumulee_ha`/
   * `surface_restante_ha`/`total_pesticide_l`/`pesticide_stock_restant_l` ne sont écrites
   * en base qu'à la synchronisation (dérivées côté serveur) — tant que la fiche est
   * encore locale, elles valaient toutes NULL et le récap affichait « non renseigné »
   * malgré une saisie complète. Il doit désormais retomber sur la même estimation que
   * l'écran « Équipe » (déjà montrée à l'agent pendant la saisie).
   */
  it('affiche l’estimation locale de Surface traitée/cumulée/restante et Total pesticide/Stock Final quand la fiche n’est pas encore synchronisée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_TERRESTRE,
      terrestre: {
        ...DRAFT_TERRESTRE.terrestre,
        surface_traitee_ha: null,
        surface_cumulee_ha: null,
        surface_restante_ha: null,
        total_pesticide_l: null,
        pesticide_stock_restant_l: null,
        stock_initial_l: null,
        produits: [
          { id: 'prod-1', traitement_terrestre_id: 'trait-1', numero: 1, produit_id: 'p1', quantite_l: 7, nom_commercial: 'Fyfanon' },
        ],
      },
    });

    await render(<RecapScreen />);

    // Surface traitée (ha) ET Surface cumulée (ha) : atomiseur (10) + disque (5),
    // pas de reprise — deux lignes affichent la même valeur.
    expect((await screen.findAllByText('15')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('30')).toBeVisible(); // Surface restante (ha) : 45 − 15
    expect(screen.getByText('7')).toBeVisible(); // Total pesticide (l) : somme des produits
    expect(screen.getByText('13')).toBeVisible(); // Stock Final (l) : 0 + 20 (reçu) − 7 (consommé)
  });

  /**
   * #recap-terrestre-moyens-produits-vides : dans une reprise, la surface cumulée
   * doit additionner celle de la fiche D'ORIGINE — jamais son propre champ
   * `surface_cumulee_ha`, qui reste toujours NULL avant sa propre synchronisation.
   */
  it("dans une reprise, la surface cumulée additionne celle de la fiche D'ORIGINE (pas son propre champ)", async () => {
    jest.mocked(traitementRepository.getTraitement).mockImplementation((id: string) =>
      id === 'trait-origine'
        ? Promise.resolve({ terrestre: { surface_cumulee_ha: 20 } } as any)
        : Promise.resolve({
            ...DRAFT_TERRESTRE,
            terrestre: {
              ...DRAFT_TERRESTRE.terrestre,
              reprise_traitement: true,
              traitement_origine_id: 'trait-origine',
              surface_atomiseur_ha: 10,
              surface_disque_rotatif_ha: 0,
              surface_traitee_ha: null,
              surface_cumulee_ha: null,
              surface_restante_ha: null,
            },
          })
    );

    await render(<RecapScreen />);

    expect(await screen.findByText('30')).toBeVisible(); // Surface cumulée : 10 (fiche) + 20 (origine)
    expect(screen.getByText('15')).toBeVisible(); // Surface restante : 45 − 30
  });

  /**
   * #recap-terrestre-moyens-produits-vides : « Essence (l) »/« Nombre de piles »
   * faisaient doublon dans « Moyens & produits (Terrestre) » avec la carte
   * « Moyens & protection », seule saisie réellement branchée sur un écran.
   */
  it("n'affiche plus « Essence (l) » en double dans « Moyens & produits (Terrestre) »", async () => {
    await render(<RecapScreen />);

    await screen.findByText('Fyfanon');
    expect(screen.queryByText('Essence (l)')).toBeNull();
    expect(screen.getByText('Essence (litres)')).toBeVisible();
    expect(screen.getAllByText('Nombre de piles')).toHaveLength(1);
  });

  it('affiche la carte Localisation (région/district/commune, coordonnées GPS, altitude)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Localisation');
    expect(screen.getByText('Androy · Ambovombe · Antaritarika')).toBeVisible();
    expect(screen.getByText('-25.1719, 46.0938')).toBeVisible();
    expect(screen.getByText('120')).toBeVisible();
  });

  /** #moyens-humains-materiels : ajoutés à l'écran Moyens (Humains/Matériels)
   * dans une session précédente, mais jamais reportés au récapitulatif —
   * revenir « voir ce qui a été saisi » les faisait paraître disparus. */
  it('affiche les sous-sections Humains et Matériels de Moyens & protection', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Humains');
    expect(screen.getByText('Matériels')).toBeVisible();
    expect(screen.getByText('41')).toBeVisible(); // Nb agents permanents
    expect(screen.getByText('17')).toBeVisible(); // Nb agents temporaires
    expect(screen.getByText('63')).toBeVisible(); // Nb personnel local
    expect(screen.getByText('9')).toBeVisible(); // Atomiseur
    expect(screen.getByText('77')).toBeVisible(); // Essence (litres)
    expect(screen.getByText('22')).toBeVisible(); // Disque rotatif
    expect(screen.getByText('99')).toBeVisible(); // Nombre de piles
    expect(screen.getByText('3')).toBeVisible(); // Ulvamast
  });
});
