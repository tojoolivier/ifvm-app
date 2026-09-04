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
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as location from '@/lib/location';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

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

describe('ExtensiveReferenceScreen — restauration après hydratation tardive du draft', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(location.getCurrentPosition).mockClear();
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
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(prospectionRepository.listOperationsAeriennes).mockClear().mockResolvedValue([]);
    jest.mocked(prospectionRepository.saveOperationsAeriennes).mockClear();
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
    expect(screen.queryByText('Opérations')).toBeNull();
    expect(prospectionRepository.listOperationsAeriennes).not.toHaveBeenCalled();
  });

  it('restaure les infos équipe/aéronef et une opération déjà enregistrée, calcule le total, et réenregistre à l’identique', async () => {
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
        base: 'Tuléar',
        base_secondaire: 'Ihosy',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    await waitFor(() => expect(prospectionRepository.listOperationsAeriennes).toHaveBeenCalledWith('draft-123'));
    // Bloc visuel dédié (#ux-aerien) : titre + sous-groupes Aéronef/Équipe/Base.
    expect(screen.getByText('INFORMATIONS AÉRONEF / ÉQUIPE')).toBeVisible();
    expect(screen.getByText('Aéronef')).toBeVisible();
    expect(screen.getByText('Équipe')).toBeVisible();
    // « Base » est à la fois le sous-groupe et le label du champ « Base » lui-même.
    expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
    expect(await screen.findByDisplayValue('Air Acridien')).toBeVisible();
    expect(screen.getByDisplayValue('5R-ABC')).toBeVisible();
    expect(screen.getByDisplayValue('Jean Rakoto')).toBeVisible();

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
          base: 'Tuléar',
          baseSecondaire: 'Ihosy',
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
   * Prospection/Convoyage, et se sauvegarde uniquement quand le type final est Divers.
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
    await screen.findByText('Opérations');

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

    // Bascule vers Convoyage : le champ disparaît (mais la saisie n'est pas perdue
    // localement — cf. commentaire de `OperationDraft.motifDivers`).
    fireEvent.press(screen.getByText('Convoyage'));
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
