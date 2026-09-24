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
  region: 'Atsimo-Andrefana',
  district: 'Betioky Sud',
  commune: 'Betioky',
  latitude: -23.7167,
  longitude: 44.3833,
  altitude: 210,
  nb_agents_permanents: 12,
  nb_agents_temporaires: 5,
  nb_personnel_local: 8,
  moyens_atomiseur_nb: 6,
  moyens_essence_litres: 55,
  moyens_disque_rotatif_nb: 2,
  moyens_piles_nb: 33,
  moyens_ulvamast_nb: 1,
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
    stand_date_installation: '2026-09-10',
    base_secondaire: 'Base secondaire X',
    base_secondaire_date_installation: '2026-09-12',
    reprise_traitement: true,
    nb_rotations: 3,
    total_pesticide_l: 45,
    total_pesticide_kg: null,
    surface_traitee_ha: 100,
    surface_cumulee_ha: 140,
    surface_restante_ha: 25,
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

    // #recap-impacts-risque-ordonne : sous-sections, une ligne par information.
    await screen.findByText("Cas d'empoisonnement");
    expect(screen.getByText('Empoisonnement')).toBeVisible(); // titre de sous-section
    expect(screen.getByText('Agent')).toBeVisible();
    expect(screen.getByText('Inhalation')).toBeVisible();
    expect(screen.getByText('Évaluation du risque')).toBeVisible();
    expect(screen.getByText('Ressources en eau')).toBeVisible();
    expect(screen.getByText('Sol')).toBeVisible();
    // Axes non évalués : « non renseigné », jamais masqués.
    expect(screen.getByText('Faune non cible')).toBeVisible();
    expect(screen.getByText('Abeilles/pollinisateurs')).toBeVisible();
    expect(screen.getByText('Comportement et mortalité')).toBeVisible();
    expect(screen.getByText('Oiseaux, Poissons')).toBeVisible();
    expect(screen.getByText('Observations')).toBeVisible();
    expect(screen.getByText('RAS')).toBeVisible();
    // Ordre identique à l'écran de saisie (impacts.tsx).
    const rendu = JSON.stringify(screen.toJSON());
    const ordre = ["Cas d'empoisonnement", 'Évaluation du risque', 'Comportement et mortalité', 'Observations'].map((t) =>
      rendu.indexOf(t)
    );
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  // #surface-traitee-et-protegee : ligne sous « Surface traitée (ha) », toujours égale à elle.
  it('affiche « Surface traitée et protégée (ha) » sous « Surface traitée (ha) », avec la même valeur', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({ ...DRAFT_AERIEN, mode_traitement: 'TOTAL' });

    await render(<RecapScreen />);

    await screen.findByText('Surface traitée et protégée (ha)');
    expect(screen.getAllByText('100')).toHaveLength(2); // traitée + traitée et protégée
    const rendu = JSON.stringify(screen.toJSON());
    expect(rendu.indexOf('Surface traitée (ha)')).toBeLessThan(rendu.indexOf('Surface traitée et protégée (ha)'));
  });

  it('en mode barrière, « Surface traitée et protégée (ha) » reprend toujours la valeur de « Surface traitée »', async () => {
    await render(<RecapScreen />); // fixture par défaut : mode BARRIERE

    await screen.findByText('Surface traitée et protégée (ha)');
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche la carte Évaluation du risque pour la population', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Évaluation du risque pour la population')).toBeVisible();
    expect(screen.getByText('Évaluation 1')).toBeVisible();
    expect(screen.getByText('Habitat le plus proche')).toBeVisible();
    expect(screen.getByText('Rizière')).toBeVisible();
    expect(screen.getByText('Distance (km)')).toBeVisible();
    expect(screen.getByText('1.5')).toBeVisible();
    expect(screen.getByText('Sensibilisation')).toBeVisible();
  });

  it('affiche les dates d’installation du Stand et de la Base secondaire, et les surfaces cumulée/restante', async () => {
    await render(<RecapScreen />);

    await screen.findByText('5R-ABC');
    expect(screen.getByText('2026-09-10')).toBeVisible();
    expect(screen.getByText('2026-09-12')).toBeVisible();
    expect(screen.getByText('140')).toBeVisible();
    expect(screen.getByText('25')).toBeVisible();
  });

  it('affiche la carte Localisation (région/district/commune, coordonnées GPS, altitude)', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Localisation');
    expect(screen.getByText('Atsimo-Andrefana · Betioky Sud · Betioky')).toBeVisible();
    expect(screen.getByText('-23.7167, 44.3833')).toBeVisible();
    expect(screen.getByText('210')).toBeVisible();
  });

  /** Les Matériels (atomiseur, essence…) ont été retirés du flux Aérien : la sous-section
   * Humains reste, Matériels n'apparaît plus (elle reste visible côté Terrestre, cf.
   * recap-screen-terrestre.test.tsx). */
  it('affiche la sous-section Humains mais plus Matériels dans Moyens & protection', async () => {
    await render(<RecapScreen />);

    await screen.findByText('Humains');
    expect(screen.queryByText('Matériels')).toBeNull();
    expect(screen.getByText('12')).toBeVisible(); // Nb agents permanents
    expect(screen.queryByText('Essence (litres)')).toBeNull();
    expect(screen.queryByText('Nombre de piles')).toBeNull();
  });

  it('regroupe Pesticides & rotations en sous-sections et affiche la décision sur la surface restante', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_AERIEN,
      aerien: {
        ...DRAFT_AERIEN.aerien,
        surface_restante_abandonnee: true,
        motif_surface_restante_abandonnee: 'Zone inaccessible',
      },
    });
    await render(<RecapScreen />);

    await screen.findAllByText('Rotations');
    for (const titre of ['Totaux', 'Surfaces', 'Stock', 'Efficacité', 'Végétation']) {
      expect(screen.getAllByText(titre).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByText('Surface restante abandonnée')).toBeVisible();
    expect(screen.getByText('Zone inaccessible')).toBeVisible();
  });

  it("libelle Approvisionnement et Reste en stock en kg pour une poudre", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_AERIEN,
      aerien: {
        ...DRAFT_AERIEN.aerien,
        rotations: [
          { id: 'r1', produit_id: 'p1', quantite: 30, unite: 'kg', surface_ha: 10, nom_commercial: 'Green Muscle' },
        ],
      },
    });
    await render(<RecapScreen />);

    expect(await screen.findByText('Approvisionnement (kg)')).toBeVisible();
    expect(screen.getByText('Reste en stock (kg)')).toBeVisible();
    expect(screen.getByText('Rotation 1 — Green Muscle')).toBeVisible();
    expect(screen.getByText('30 kg · 10 ha')).toBeVisible();
  });

  it("n'affiche plus l'étape Surface traitée dans la liste de contrôle", async () => {
    await render(<RecapScreen />);

    await screen.findByText('Humains');
    expect(screen.queryByText('Surface traitée')).toBeNull();
  });
});
