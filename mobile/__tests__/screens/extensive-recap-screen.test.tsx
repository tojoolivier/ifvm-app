/**
 * Fidélité et complétude du récapitulatif Extensive (#227) : le récapitulatif doit
 * permettre de vérifier réellement les données saisies dans Imagos ET Larves (LMC/NSE
 * séparément), pas seulement les informations de référence — cf. règle « ne jamais
 * afficher une donnée inventée » et « ne jamais masquer silencieusement une donnée
 * renseignée ».
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveRecapScreen from '@/app/(prospection)/extensive-recap';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as prospectionReview from '@/lib/prospection-review';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  concludeValidation: jest.fn(),
  alignerNumeroFicheSurNumeroMessage: jest.fn(),
  // Vraie implémentation (pas de mock utile ici) : `buildPesticidesRows` en dépend
  // pour normaliser `pesticides_embarques` (0/1/null en SQLite).
  normalizeBoolean: (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return null;
  },
}));

jest.mock('@/lib/prospection-review', () => ({
  enregistrerEtSynchroniser: jest.fn().mockResolvedValue({ envoyees: [], echouees: [], conflits: [] }),
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
  degats_cultures: 'moyens',
  verdissement_pourcent: 65,
  hauteur_herbe_cm: 45,
  derniere_pluie: '2026-08-20',
  intensite_pluie: 'forte',
} as any;

const HEURE_ATTENDUE = formatHeureLocale(DRAFT_BASE.heure_observation_at);

const POPULATIONS = [
  {
    espece: 'LMC', categorie: 'imago', captures_nombre: 12, captures_sol: 5, captures_trans: 4, captures_greg: 3,
    captures_solitaro_transiens: 0, densite_diffuse: 8, densite_groupee: 2, essaim_observe: true,
    methode: null, accouplement: 'Rare', ponte: 'Beaucoup', interdistance: 25.5, type_cible: 'tres_dense',
    direction_de: 'Nord', direction_vers: 'Sud', etat: 'deplacement', essaim_en_vol: true, essaim_pose: false,
    stades_imago: JSON.stringify({ femelleA1: 5, femelleA2: 0, maleA234: 2 }),
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
    // #stades-imago-persistance : répartition réelle affichée (femelleA2 = 0 omis),
    // plus jamais le message d'indisponibilité.
    expect(screen.getByText('Stades')).toBeVisible();
    expect(screen.getByText(/femelleA1 5 · maleA234 2/)).toBeVisible();
    expect(screen.queryByText(/Non conservés en base/)).toBeNull();
    expect(screen.getByText('Accouplement')).toBeVisible();
    expect(screen.getByText('Rare')).toBeVisible();
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
    expect(screen.getByText('8 ind./ha')).toBeVisible();
    expect(screen.getAllByText('Densité groupée')[0]).toBeVisible();
    expect(screen.getByText('2 ind./m²')).toBeVisible();
  });

  /**
   * #stades-imago-persistance : une fiche enregistrée avant ce correctif a
   * `stades_imago = null` (colonne inexistante à l'époque) — la ligne « Stades »
   * doit afficher « — », jamais le message d'indisponibilité ni planter.
   */
  it('Imagos LMC : « Stades » affiche « — » pour une fiche enregistrée avant le correctif (stades_imago = null)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([
      { ...POPULATIONS[0], stades_imago: null },
    ] as any);
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Accouplement');

    expect(screen.getByText('Stades')).toBeVisible();
    expect(screen.queryByText(/Non conservés en base/)).toBeNull();
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

    expect(screen.getByText('6')).toBeVisible(); // Nombre de captures (captures_nombre)
    expect(screen.getByText(/L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText('Surface contaminée (ha)')).toBeVisible();
    expect(screen.getByText('12.75')).toBeVisible();
    expect(screen.getByText('15')).toBeVisible(); // interdistance
    expect(screen.getByText(/Tache larvaire · Déplacement : Perchée/)).toBeVisible();
  });

  /**
   * #nombre-de-capture-fiable : régression — le récapitulatif affichait un total
   * recalculé à partir des phases (imago) ou des stades (larve) au lieu de la valeur
   * réellement enregistrée (`captures_nombre`). Une fiche où ces deux nombres
   * divergent (ex. répartition incomplète, fiche déjà enregistrée avant la
   * persistance de `captures_solitaro_transiens`) faisait alors « disparaître » le
   * nombre de captures pourtant bien conservé en base — reproduit ici explicitement.
   */
  it('Nombre de captures : affiche la valeur réellement enregistrée, même si elle diverge de la somme des phases/stades', async () => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([
      {
        espece: 'LMC', categorie: 'imago', captures_nombre: 20, captures_sol: 5, captures_trans: 4, captures_greg: 3,
        captures_solitaro_transiens: 0, densite_diffuse: 8, densite_groupee: 2,
        methode: null, accouplement: null, ponte: null, type_cible: null, etat: null,
      },
      {
        espece: 'LMC', categorie: 'larve', captures_nombre: 15, captures_sol: 0, captures_trans: 0, captures_greg: 0,
        densite_diffuse: null, densite_groupee: null, methode: null, accouplement: null, ponte: null,
        densites_larve: JSON.stringify({ L1: 4, L2: 2 }), tache_larvaire: false, bande_larvaire: false,
      },
    ] as any);
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Accouplement');

    // 20 (captures_nombre), pas 12 (5+4+3 = somme des phases).
    expect(screen.getByText('20')).toBeVisible();
    expect(screen.queryByText('12')).toBeNull();
    // 15 (captures_nombre), pas 6 (4+2 = somme des stades).
    expect(screen.getByText('15')).toBeVisible();
    expect(screen.queryByText(/^6$/)).toBeNull();
    // Bandeau chiffre-clé LMC/NSE (B · Imagos / C · Larves) : mêmes valeurs réelles.
    expect(screen.getByText('B · Imagos — LMC 20 · NSE 0')).toBeVisible();
    expect(screen.getByText('C · Larves — LMC 15 · NSE 0')).toBeVisible();
  });

  it('Observations : dégâts, verdure, hauteur en mètres et pluie', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText(/Dégâts sur les cultures : Moyens/)).toBeVisible();
    expect(screen.getByText(/Verdure strate herbeuse : 65 %/)).toBeVisible();
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
    // Nombre de captures (#228) : bien la vraie valeur enregistrée (12), pas un total
    // recalculé ou un champ manquant — présent explicitement, pas seulement dans le
    // chiffre-clé LMC/NSE du bandeau.
    expect(screen.getAllByText('Nombre de captures')[0]).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getAllByText('Densité diffuse')[0]).toBeVisible();
    expect(screen.getByText('8 ind./ha')).toBeVisible();
    expect(screen.getByText(/L1 4 · L2 2/)).toBeVisible();
    expect(screen.getByText(/Dégâts sur les cultures : Moyens/)).toBeVisible();
    // H STR HERB (#228) : affiché en mètres, non arrondi à l'entier (45 cm → 0.45 m).
    expect(screen.getByText(/H\. strate herbeuse : 0.45 m/)).toBeVisible();
    expect(screen.getByText(new RegExp(`Heure d.observation : ${HEURE_ATTENDUE}`))).toBeVisible();
  });
});

/**
 * #numero-fiche-extensive-egal-n-message : le N° de fiche définitif doit
 * reprendre le N° de message déjà affiché pendant la saisie — bouton
 * « Enregistrer (hors-ligne) » uniquement (pas la branche Vérification de
 * signalement, `handleConclude`, hors périmètre de cette demande).
 */
describe('ExtensiveRecapScreen — N° de fiche = N° de message à l’enregistrement', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'tok-1' });
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([]);
    jest.mocked(prospectionRepository.alignerNumeroFicheSurNumeroMessage).mockClear();
  });

  it('aligne n_fiche sur n_message avant de synchroniser, pour une fiche Extensive', async () => {
    const draftAvecNFiche = { ...DRAFT_BASE, type_prospection: 'extensive', n_fiche: DRAFT_BASE.n_message };
    jest.mocked(prospectionRepository.alignerNumeroFicheSurNumeroMessage).mockResolvedValueOnce(draftAvecNFiche as any);
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);

    fireEvent.press(await screen.findByText('Enregistrer (hors-ligne) ✓'));

    await waitFor(() =>
      expect(prospectionRepository.alignerNumeroFicheSurNumeroMessage).toHaveBeenCalledWith(DRAFT_BASE.id)
    );
    // La fiche synchronisée est bien celle RENVOYÉE par l'alignement (avec n_fiche
    // désormais posé) — pas l'ancien brouillon du store, dont n_fiche est encore null.
    await waitFor(() =>
      expect(prospectionReview.enregistrerEtSynchroniser).toHaveBeenCalledWith(draftAvecNFiche, [], 'tok-1')
    );
  });

  it("n'aligne rien pour une fiche de vérification de signalement (handleConclude, hors périmètre)", async () => {
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
    await screen.findByText('Vérification du signalement');

    fireEvent.press(screen.getByText('✓ Confirmée'));

    await waitFor(() => expect(prospectionRepository.concludeValidation).toHaveBeenCalled());
    expect(prospectionRepository.alignerNumeroFicheSurNumeroMessage).not.toHaveBeenCalled();
  });
});

/**
 * Récapitulatif — mode aérien : pesticides embarqués + signatures (suite du mode
 * aérien #regroupement-slides). Doit afficher TOUTES les données aériennes —
 * Références équipe/aéronef, Opérations (avec Total heure de vol par opération et
 * Total jour), Pesticides embarqués et Signatures — jamais une valeur inventée ou
 * périmée quand Pesticides = NON (cf. `buildPesticidesRows`).
 */
describe('ExtensiveRecapScreen — mode aérien : pesticides embarqués + signatures', () => {
  const DRAFT_AERIEN = {
    ...DRAFT_BASE,
    mode_extensif: 'aerien',
    societe: 'Air Acridien',
    immatricule_aeronef: '5R-ABC',
    pilote: 'Jean Rakoto',
    mecanicien: 'Marc Andria',
    chef_de_base: 'Sarah Ravelo',
    base: 'Tuléar',
  };

  beforeEach(() => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([]);
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockResolvedValue([
      {
        type_operation: 'prospection',
        debut_heure: '08:00',
        debut_temperature_c: 24,
        debut_vent_ms: 3.2,
        fin_heure: '10:30',
        fin_temperature_c: 26,
        fin_vent_ms: 4.1,
        duree_minutes: 150,
      },
      {
        type_operation: 'convoyage',
        debut_heure: '23:00',
        debut_temperature_c: null,
        debut_vent_ms: null,
        fin_heure: '01:15',
        fin_temperature_c: null,
        fin_vent_ms: null,
        duree_minutes: 135,
      },
    ] as any);
  });

  it('une fiche terrestre ne montre aucun bloc « E · Aérien »', async () => {
    useProspectionWizardStore.setState({ draft: { ...DRAFT_BASE, type_prospection: 'extensive' }, captures: [] });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText(/Dégâts sur les cultures/);

    expect(screen.queryByText('E · Aérien')).toBeNull();
    expect(prospectionRepository.listOperationsAeriennes).not.toHaveBeenCalled();
  });

  it('Pesticides = NON : une seule ligne « NON », aucun champ dépendant affiché', async () => {
    useProspectionWizardStore.setState({
      draft: { ...DRAFT_AERIEN, type_prospection: 'extensive', pesticides_embarques: 0 },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('E · Aérien');

    expect(screen.getAllByText('Pesticides embarqués').length).toBeGreaterThan(0);
    expect(screen.getByText('NON')).toBeVisible();
    expect(screen.queryByText('Nom commercial')).toBeNull();
    expect(screen.queryByText(/Fûts —/)).toBeNull();
  });

  it('Pesticides = OUI : références, opérations (total jour inclus), pesticides et fûts sont tous affichés', async () => {
    useProspectionWizardStore.setState({
      draft: {
        ...DRAFT_AERIEN,
        type_prospection: 'extensive',
        pesticides_embarques: 1,
        pesticide_nom_commercial: 'Fyfanon ULV',
        pesticide_quantite_disponible: 500,
        pesticide_quantite_recue: 200,
        futs_disponible: 10,
        futs_pleins: 6,
        futs_vides: 4,
        futs_recues: 5,
        // VISA retiré (#signatures-numeriques-extensif-aerien) : ces colonnes
        // restent en base (historique) mais ne sont plus jamais affichées.
        signature_visa_nom: 'Rakoto V.',
        signature_visa_horodatage: '2026-09-01T09:00:00.000Z',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
      },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('E · Aérien');

    // Références aériennes
    expect(screen.getByText('Air Acridien')).toBeVisible();
    expect(screen.getByText('5R-ABC')).toBeVisible();
    expect(screen.getByText('Tuléar')).toBeVisible();
    expect(screen.queryByText('Base secondaire')).toBeNull();

    // Opérations + Total heure de vol par opération (150 min = 02:30, 135 min = 02:15,
    // franchissement de minuit 23:00 → 01:15 inclus) + Total jour = 285 min = 04:45.
    expect(screen.getByText('Opération 1')).toBeVisible();
    expect(screen.getByText('Opération 2')).toBeVisible();
    expect(screen.getAllByText('Total heure de vol')).toHaveLength(2);
    expect(screen.getByText('02:30')).toBeVisible();
    expect(screen.getByText('02:15')).toBeVisible();
    expect(screen.getByText('Total jour')).toBeVisible();
    expect(screen.getByText('04:45')).toBeVisible();

    // Non-régression (#operations-heures-vol) : « Convoyage » n'est plus proposé à la
    // saisie, mais une opération déjà enregistrée avec ce type — et ses températures/
    // vents — continue de s'afficher normalement dans le récap.
    expect(screen.getByText('Convoyage')).toBeVisible();
    expect(screen.getByText('Prospection')).toBeVisible();
    expect(screen.getByText('24 °C')).toBeVisible();
    expect(screen.getByText('3.2 m/s')).toBeVisible();
    expect(screen.getByText('26 °C')).toBeVisible();
    expect(screen.getByText('4.1 m/s')).toBeVisible();

    // Pesticides embarqués + fûts (valeurs de test 10/6/4/5 du prompt)
    expect(screen.getByText('OUI')).toBeVisible();
    expect(screen.getByText('Fyfanon ULV')).toBeVisible();
    expect(screen.getByText('500 L')).toBeVisible();
    expect(screen.getByText('200 L')).toBeVisible();
    expect(screen.getByText('Fûts — Disponible')).toBeVisible();
    expect(screen.getByText('10')).toBeVisible();
    expect(screen.getByText('Fûts — Pleins')).toBeVisible();
    expect(screen.getByText('6')).toBeVisible();
    expect(screen.getByText('Fûts — Vides')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('Fûts — Reçues')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();

    // Signatures — VISA n'apparaît plus (donnée historique préservée en base,
    // jamais réaffichée) ; Rakoto V. n'était que sa valeur. Pilote n'est plus une
    // ligne de Signatures non plus (« Pilote » reste affiché ailleurs, dans les
    // Références aériennes — cf. `draft.pilote` ci-dessus) : seul le format
    // combiné nom + horodatage propre à une ligne de signature est vérifié absent.
    expect(screen.queryByText('VISA')).toBeNull();
    expect(screen.queryByText(`Rakoto V. — ${formatHeureLocale('2026-09-01T09:00:00.000Z')}`)).toBeNull();
    expect(screen.queryByText(`Jean Rakoto — ${formatHeureLocale('2026-09-01T09:10:00.000Z')}`)).toBeNull();
    // Consultant FAO et Chef de Base non signés : ligne présente avec « — », pas absente.
    expect(screen.getByText('Consultant FAO')).toBeVisible();
    expect(screen.getByText('Chef de Base')).toBeVisible();
  });

  /**
   * « Vérifier un signalement » en mode aérien (#signalement-mode-choisi) : une fois
   * `mode_extensif` fixé sur un brouillon de vérification, le récap doit montrer le
   * même bloc aérien qu'une fiche extensive normale — la saisie (Références/Opérations/
   * Pesticides/Signatures) a bien lieu sur les mêmes écrans partagés (`isAerien` ne
   * dépend jamais de `type_prospection`), donc la revue avant Confirmée/Infirmée ne
   * doit rien en cacher.
   */
  it('une fiche de vérification (« Vérifier un signalement ») en mode aérien affiche aussi le bloc aérien', async () => {
    useProspectionWizardStore.setState({
      draft: {
        ...DRAFT_AERIEN,
        type_prospection: 'validation',
        signalement_source: 'Rasoanaivo',
        signalement_date: '2026-08-24',
        signalement_description: 'Essaim visible près du village',
        pesticides_embarques: 1,
        pesticide_nom_commercial: 'Fyfanon ULV',
      },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText('Vérification du signalement')).toBeVisible();
    expect(screen.getByText('Références aériennes')).toBeVisible();
    expect(screen.getByText('Air Acridien')).toBeVisible();
    expect(screen.getByText('Informations sur les heures de vol')).toBeVisible();
    expect(screen.getByText('Opération 1')).toBeVisible();
    expect(screen.getByText('Total jour')).toBeVisible();
    expect(screen.getByText('04:45')).toBeVisible();
    expect(screen.getAllByText('Pesticides embarqués').length).toBeGreaterThan(0);
    expect(screen.getByText('Fyfanon ULV')).toBeVisible();
    expect(screen.getByText('Signatures')).toBeVisible();
    // La conclusion de vérification reste présente, inchangée par l'ajout du bloc aérien.
    expect(screen.getByText('✓ Confirmée')).toBeVisible();
    expect(screen.getByText('✗ Infirmée')).toBeVisible();
  });

  it('une fiche de vérification en mode terrestre (par défaut) ne montre aucun bloc aérien', async () => {
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
    expect(screen.queryByText('Références aériennes')).toBeNull();
    expect(screen.queryByText('Informations sur les heures de vol')).toBeNull();
  });

  /** « Motif du divers » (#ux-aerien) : affiché uniquement pour l'opération Divers. */
  it('« Motif du divers » apparaît seulement pour l’opération de type Divers', async () => {
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockResolvedValue([
      {
        type_operation: 'divers',
        motif_divers: 'Rinçage',
        debut_heure: '11:00',
        debut_temperature_c: null,
        debut_vent_ms: null,
        fin_heure: '11:30',
        fin_temperature_c: null,
        fin_vent_ms: null,
        duree_minutes: 30,
      },
      {
        type_operation: 'prospection',
        motif_divers: null,
        debut_heure: '08:00',
        debut_temperature_c: null,
        debut_vent_ms: null,
        fin_heure: '09:00',
        fin_temperature_c: null,
        fin_vent_ms: null,
        duree_minutes: 60,
      },
    ] as any);
    useProspectionWizardStore.setState({
      draft: { ...DRAFT_AERIEN, type_prospection: 'extensive', pesticides_embarques: 0 },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);
    await screen.findByText('Opération 1');

    expect(screen.getByText('Motif')).toBeVisible();
    expect(screen.getByText('Rinçage')).toBeVisible();
    // Une seule ligne « Motif » — pas pour l'opération 2 (Prospection).
    expect(screen.getAllByText('Motif')).toHaveLength(1);
  });
});

/**
 * « Remarques » (#ux-aerien) : réutilise `prospection.observations`, affichée dans
 * la récapitulation D — Observations pour les deux modes (terrestre et aérien).
 */
describe('ExtensiveRecapScreen — Remarques', () => {
  it('affiche les remarques saisies, avec retours à la ligne conservés', async () => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([]);
    useProspectionWizardStore.setState({
      draft: { ...DRAFT_BASE, type_prospection: 'extensive', observations: 'Ligne 1.\nLigne 2.' },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);

    // Le contenu réel (avec le vrai saut de ligne) est vérifié à la saisie, côté
    // écran (`extensive-observations-screen-restore.test.tsx`, via
    // `getByDisplayValue`) — ici, le normaliseur de texte par défaut de RTL
    // aplatit les espaces/retours à la ligne pour la recherche, d'où le `\s+`.
    expect(await screen.findByText(/Remarques\s*:\s*Ligne 1\.\s*Ligne 2\./)).toBeVisible();
  });

  it('affiche « — » quand aucune remarque n’a été saisie', async () => {
    jest.mocked(prospectionRepository.listAllProspectionPopulations).mockResolvedValue([]);
    useProspectionWizardStore.setState({
      draft: { ...DRAFT_BASE, type_prospection: 'extensive' },
      captures: [],
    });

    await render(<ExtensiveRecapScreen />);

    expect(await screen.findByText('Remarques : —')).toBeVisible();
  });
});
