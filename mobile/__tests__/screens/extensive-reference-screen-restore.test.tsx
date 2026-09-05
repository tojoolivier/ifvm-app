/**
 * Non-régression — harmonisation Extensive/Intensive : `extensive-reference.tsx` ne
 * s'auto-hydrate pas depuis `draftId` (cf. commentaire de `fiche-routing.ts`), et ses
 * champs (station saisie libre, type de station, surface, n° message) n'étaient
 * initialisés qu'une fois, via `useState(draft?.x)`. Si le store se peuple APRÈS le
 * montage de l'écran (deep-link, app relancée en plein parcours), ces champs restaient
 * vides indéfiniment et un « Continuer » sans y toucher écrasait les valeurs déjà
 * enregistrées par du vide — même classe de bug déjà corrigée côté intensif
 * (observations.tsx, veg.tsx, species.tsx).
 */
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as location from '@/lib/location';
import * as referentielDb from '@/lib/referentiel-db';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

/** Laisse un vrai tick s'écouler entre deux `fireEvent.press` consécutifs — un
 * `act(async () => {})` manuel imbriqué dans celui, déjà posé par `fireEvent`,
 * casse le suivi interne des scopes act() et corrompt les tests suivants. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
    station_libre: 'Andasibe',
    type_station: 'xerophyle',
    surface_station: 12,
    surface_infestee: 3.5,
    n_message: '20260825-AB12',
    latitude: -18.9,
    longitude: 47.5,
  }),
  // Mode aérien uniquement — jamais appelées pour un brouillon terrestre (garde
  // `isAerien` dans l'écran), donc sans effet sur les tests existants ci-dessous.
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listLieuxAeriens: jest.fn().mockResolvedValue([]),
}));

/**
 * `@react-native-picker/picker` (#prospection-lieu-base) rend un contrôle natif
 * (RNCPicker) : sous Jest, sa liste d'options n'apparaît pas dans l'arbre de
 * rendu et il n'existe pas de moyen public de « choisir une option » comme sur
 * l'appareil. On vérifie donc notre propre câblage (options passées, `onValueChange`)
 * via un remplacement fidèle au contrat du vrai composant (`onValueChange`/`children`
 * de `Picker.Item`), rendu en éléments pressables ordinaires — la sélection
 * effectivement restaurée se vérifie via le payload envoyé à l'enregistrement
 * (« Suivant »), pas via un rendu visuel de l'état sélectionné : le rendu et les
 * gestes natifs du composant réel restent hors périmètre de ce test (déjà
 * couverts par la bibliothèque elle-même).
 */
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  function Picker({ onValueChange, children }: any) {
    // `children` mélange un élément statique (l'option vide) et un tableau
    // (`lieuxBasePrincipale.map(...)`) : deux « slots » imbriqués, pas une liste
    // plate — `Children.toArray` aplatit les deux avant de les parcourir.
    return (
      <View>
        {React.Children.toArray(children).map((item: any) => (
          <TouchableOpacity key={item.props.value} onPress={() => onValueChange(item.props.value)}>
            <Text>{item.props.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Picker };
});

describe('ExtensiveReferenceScreen — restauration après hydratation tardive du draft', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(location.getCurrentPosition).mockClear();
    jest.mocked(referentielDb.listLieuxAeriens).mockClear().mockResolvedValue([]);
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });

  it("restaure station/type de station/surface/n° message quand le draft n'est disponible qu'après le montage", async () => {
    await render(<ExtensiveReferenceScreen />);

    // Rien à afficher tant que le draft n'est pas encore là.
    expect(screen.queryByDisplayValue('Andasibe')).toBeNull();

    // Hydratation tardive du store (deep-link / relance app) — après le montage.
    await act(async () => {
      useProspectionWizardStore.setState({
        draft: {
          id: 'draft-123',
          type_prospection: 'extensive',
          date_prospection: '2026-08-25',
          station_libre: 'Andasibe',
          type_station: 'xerophyle',
          surface_station: 12,
          surface_infestee: 3.5,
          n_message: '20260825-AB12',
          latitude: -18.9,
          longitude: 47.5,
        } as any,
        captures: [],
      });
    });

    await waitFor(() => expect(screen.getByDisplayValue('Andasibe')).toBeVisible());
    expect(screen.getByDisplayValue('12')).toBeVisible();
    expect(screen.getByDisplayValue('3.5')).toBeVisible();
    expect(screen.getByDisplayValue('20260825-AB12')).toBeVisible();
    // Suffixe « ✓ » (#biotope-multi, même convention que veg.tsx : la correspondance
    // exacte de texte échoue puisque le libellé actif porte désormais ce suffixe).
    expect(screen.getByText(/^Xerophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          stationLibre: 'Andasibe',
          // #biotope-multi : type_station scalaire pré-migration ('xerophyle') restauré
          // via parseSelectionMultiple en ['xerophyle'], puis ré-enregistré en JSON.
          typeStation: '["xerophyle"]',
          surfaceStation: 12,
          surfaceInfestee: 3.5,
          nMessage: '20260825-AB12',
          latitude: -18.9,
          longitude: 47.5,
        })
      )
    );
  });

  it('Surface infestée (ha) accepte une saisie décimale et la conserve exactement', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25', latitude: -18.9, longitude: 47.5 } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Surface infestée (ha)');

    // Station (saisie libre), Surface prospectée (ha) puis Surface infestée (ha) sont
    // les 3 champs vides, dans cet ordre.
    fireEvent.changeText(screen.getAllByDisplayValue('')[2], '0.5');
    expect(await screen.findByDisplayValue('0.5')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ surfaceInfestee: 0.5 })
      )
    );
  });

  /**
   * Heure d'observation (#227) : même mécanisme que observations.tsx côté Intensif
   * (`getCurrentPosition().timestamp`, colonne partagée `heure_observation_at`), mais
   * capturée ici sur Référence — l'écran où l'Extensif fait déjà son acquisition GPS.
   */
  it("renseigne automatiquement l'heure d'observation depuis le timestamp GPS (pas Date.now()) lors du premier fix, et l'enregistre", async () => {
    const timestampGps = new Date('2026-08-25T11:35:00.000Z').getTime();
    jest.mocked(location.getCurrentPosition).mockResolvedValue({
      latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: timestampGps,
    });
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25', latitude: null, longitude: null } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    const heureAttendue = formatHeureLocale(new Date(timestampGps).toISOString());
    expect(await screen.findByText(heureAttendue)).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ heureObservationAt: new Date(timestampGps).toISOString() })
      )
    );
  });

  it("restaure l'heure d'observation déjà enregistrée sans relancer d'acquisition GPS au remontage", async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        heure_observation_at: '2026-08-25T09:12:00.000Z',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByText(formatHeureLocale('2026-08-25T09:12:00.000Z'))).toBeVisible();
    expect(location.getCurrentPosition).not.toHaveBeenCalled();
  });
});

/**
 * Mode aérien (#regroupement-slides — ajout du mode aérien) : le bloc équipe/aéronef
 * et les opérations n'apparaissent que si `mode_extensif === 'aerien'`, se restaurent
 * depuis la base locale, et se réenregistrent avec la durée recalculée à l'identique.
 */
describe('ExtensiveReferenceScreen — mode aérien', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockClear().mockResolvedValue([]);
    jest.mocked(prospectionRepository.saveOperationsAeriennes).mockClear();
    jest.mocked(referentielDb.listLieuxAeriens).mockClear().mockResolvedValue([]);
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });

  it("n'affiche aucun champ aérien pour une fiche terrestre (mode_extensif absent)", async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25', latitude: -18.9, longitude: 47.5 } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Surface infestée (ha)');

    expect(screen.queryByText('INFORMATIONS AÉRONEF / ÉQUIPE')).toBeNull();
    expect(screen.queryByText('Informations sur les heures de vol')).toBeNull();
    expect(prospectionRepository.listOperationsAeriennes).not.toHaveBeenCalled();
  });

  /**
   * #prospection-lieu-base : référentiel `lieu_aerien` pas encore peuplé (ou pas
   * encore synchronisé sur l'appareil) — un champ sans aucun chip serait
   * indiscernable d'un bug. Le message doit orienter vers l'administration web,
   * seul endroit où un lieu aérien peut être créé (aucune création de
   * référentiel n'est possible depuis le mobile).
   */
  it('Base (mode aérien) : référentiel vide → message renvoyant vers l’administration web, aucun chip', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Base');

    expect(
      screen.getByText(/Aucune base disponible.*administration web.*Lieux aériens/s)
    ).toBeVisible();
  });

  /**
   * #prospection-lieu-base : sélection d'une base sur une fiche neuve (aucun
   * `lieu_base_id` déjà enregistré) — un seul lieu `principale` est proposé, jamais
   * les lieux `stand`/`secondaire` (aucune notion de base secondaire pour la
   * prospection).
   */
  it('Base (mode aérien) : sélectionne un lieu du référentiel, ne propose que les lieux « principale »', async () => {
    jest.mocked(referentielDb.listLieuxAeriens).mockResolvedValue([
      { id: 'lieu-1', type_lieu: 'principale', nom: 'Tuléar' },
      { id: 'lieu-2', type_lieu: 'principale', nom: 'Toliara' },
      // Type non « principale » — jamais proposé pour la prospection.
      { id: 'lieu-3', type_lieu: 'stand', nom: 'Betioky' },
    ]);
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Tuléar');
    // Laisse l'effet de restauration tardive du brouillon (`refHydratedRef`, qui
    // réapplique lieu_base_id depuis `draft` sur un timer microtâche) se stabiliser
    // avant d'interagir — sinon il peut écraser la sélection ci-dessous.
    await settle();

    // Option vide (généralisée) + les deux lieux « principale », jamais « Betioky ».
    expect(screen.getByText('— Aucune (généralisée) —')).toBeVisible();
    expect(screen.getByText('Toliara')).toBeVisible();
    expect(screen.queryByText('Betioky')).toBeNull();
    expect(screen.queryByText('Base secondaire')).toBeNull();

    fireEvent.press(screen.getByText('Tuléar'));
    // Laisse React réconcilier avant de presser « Suivant » — sinon son gestionnaire
    // reste lié à la fermeture du rendu précédent (lieuBaseId encore `null`), comme
    // pour toute paire de `fireEvent.press` consécutifs sur cet écran.
    await settle();
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ lieuBaseId: 'lieu-1' })
      )
    );
  });

  /**
   * #prospection-lieu-base : choisir l'option de tête (« Aucune (généralisée) »)
   * désélectionne la base — couvre l'opération aérienne « généralisée », non
   * rattachée à une base.
   */
  it('Base (mode aérien) : sélectionner « Aucune (généralisée) » désélectionne le lieu déjà enregistré', async () => {
    jest.mocked(referentielDb.listLieuxAeriens).mockResolvedValue([
      { id: 'lieu-1', type_lieu: 'principale', nom: 'Tuléar' },
    ]);
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
        lieu_base_id: 'lieu-1',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Tuléar');
    // Laisse l'effet de restauration tardive du brouillon se stabiliser avant
    // d'interagir (cf. commentaire du test précédent) — sinon il peut réappliquer
    // lieu_base_id APRÈS l'interaction ci-dessous et annuler la désélection.
    await settle();

    fireEvent.press(screen.getByText('— Aucune (généralisée) —'));
    // Laisse React réconcilier avant de presser « Suivant » — sinon son gestionnaire
    // reste lié à la fermeture précédente.
    await settle();
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ lieuBaseId: null })
      )
    );
  });

  it('restaure les infos équipe/aéronef et une opération déjà enregistrée, calcule le total, et réenregistre à l’identique', async () => {
    jest.mocked(referentielDb.listLieuxAeriens).mockResolvedValue([
      { id: 'lieu-1', type_lieu: 'principale', nom: 'Tuléar' },
    ]);
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockResolvedValue([
      {
        type_operation: 'prospection',
        motif_divers: null,
        debut_heure: '08:00',
        debut_temperature_c: 24,
        debut_vent_ms: 3.2,
        fin_heure: '10:30',
        fin_temperature_c: 26,
        fin_vent_ms: 4.1,
        duree_minutes: 150,
      },
    ]);

    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
        societe: 'Air Acridien',
        immatricule_aeronef: '5R-ABC',
        pilote: 'Jean Rakoto',
        mecanicien: 'Marc Andria',
        chef_de_base: 'Sarah Ravelo',
        lieu_base_id: 'lieu-1',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    await waitFor(() => expect(prospectionRepository.listOperationsAeriennes).toHaveBeenCalledWith('draft-123'));
    // Bloc visuel dédié (#ux-aerien) : titre + sous-groupes Aéronef/Équipe/Base.
    expect(screen.getByText('INFORMATIONS AÉRONEF / ÉQUIPE')).toBeVisible();
    expect(screen.getByText('Aéronef')).toBeVisible();
    expect(screen.getByText('Équipe')).toBeVisible();
    // « Base » est le sous-groupe ; le lieu déjà enregistré est présélectionné
    // dans la liste déroulante.
    expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
    expect(await screen.findByDisplayValue('Air Acridien')).toBeVisible();
    expect(screen.getByDisplayValue('5R-ABC')).toBeVisible();
    expect(screen.getByDisplayValue('Jean Rakoto')).toBeVisible();
    expect(screen.getByText('Tuléar')).toBeVisible();

    // Opération restaurée : heures affichées, total calculé sans re-saisie.
    expect(screen.getByText('08:00')).toBeVisible();
    expect(screen.getByText('10:30')).toBeVisible();
    // "02:30" apparaît deux fois : total de l'opération ET total jour (une seule opération).
    expect(screen.getAllByText('02:30')).toHaveLength(2);
    expect(screen.getByText('TOTAL JOUR')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          societe: 'Air Acridien',
          immatriculeAeronef: '5R-ABC',
          pilote: 'Jean Rakoto',
          mecanicien: 'Marc Andria',
          chefDeBase: 'Sarah Ravelo',
          lieuBaseId: 'lieu-1',
        })
      )
    );
    expect(prospectionRepository.saveOperationsAeriennes).toHaveBeenCalledWith('draft-123', [
      expect.objectContaining({
        type_operation: 'prospection',
        debut_heure: '08:00',
        fin_heure: '10:30',
        duree_minutes: 150,
      }),
    ]);
  });

  /**
   * « Motif du divers » (#ux-aerien) : n'apparaît que pour Divers, disparaît pour
   * Prospection, et se sauvegarde uniquement quand le type final est Divers.
   */
  it("« Motif du divers » n'apparaît que pour le type Divers, et se sauvegarde avec l'opération", async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Informations sur les heures de vol');

    // « Convoyage » retiré définitivement de la saisie (#operations-heures-vol),
    // et Température/Vent ne sont plus proposés — seules les heures restent.
    expect(screen.queryByText('Convoyage')).toBeNull();
    expect(screen.queryByText('Température (°C)')).toBeNull();
    expect(screen.queryByText('Vent (m/s)')).toBeNull();
    expect(screen.getByText('Heure début opération')).toBeVisible();
    expect(screen.getByText('Heure fin opération')).toBeVisible();

    // Aucun type choisi au départ : pas de champ Motif.
    expect(screen.queryByText('Motif du divers')).toBeNull();

    fireEvent.press(screen.getByText('Prospection'));
    await waitFor(() =>
      expect(screen.getByText('Prospection').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );
    expect(screen.queryByText('Motif du divers')).toBeNull();

    fireEvent.press(screen.getByText('Divers'));
    expect(await screen.findByText('Motif du divers')).toBeVisible();

    fireEvent.changeText(screen.getByPlaceholderText('Ex. Rinçage, maintenance, vérification…'), 'Rinçage');
    expect(await screen.findByDisplayValue('Rinçage')).toBeVisible();

    // Bascule vers Prospection : le champ disparaît (mais la saisie n'est pas perdue
    // localement — cf. commentaire de `OperationDraft.motifDivers`). « Convoyage »
    // n'est plus une option proposée (#operations-heures-vol), on retombe donc sur
    // l'autre type non-Divers déjà disponible.
    fireEvent.press(screen.getByText('Prospection'));
    await waitFor(() => expect(screen.queryByText('Motif du divers')).toBeNull());

    // Retour sur Divers : le motif précédemment saisi est bien retrouvé.
    fireEvent.press(screen.getByText('Divers'));
    expect(await screen.findByDisplayValue('Rinçage')).toBeVisible();
  });

  /** `saveOperationsAeriennes` n'envoie `motif_divers` que si le type final est Divers. */
  it('sauvegarde le motif du divers avec une opération déjà existante rebasculée sur Divers', async () => {
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockResolvedValue([
      {
        type_operation: 'prospection',
        motif_divers: null,
        debut_heure: '08:00',
        debut_temperature_c: null,
        debut_vent_ms: null,
        fin_heure: '10:30',
        fin_temperature_c: null,
        fin_vent_ms: null,
        duree_minutes: 150,
      },
    ]);
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        mode_extensif: 'aerien',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(prospectionRepository.listOperationsAeriennes).toHaveBeenCalledWith('draft-123'));
    await screen.findByText('08:00');

    fireEvent.press(screen.getByText('Divers'));
    expect(await screen.findByText('Motif du divers')).toBeVisible();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. Rinçage, maintenance, vérification…'), 'Rinçage');
    expect(await screen.findByDisplayValue('Rinçage')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveOperationsAeriennes).toHaveBeenCalledWith('draft-123', [
        expect.objectContaining({ type_operation: 'divers', motif_divers: 'Rinçage', debut_heure: '08:00', fin_heure: '10:30' }),
      ])
    );
  });
});
