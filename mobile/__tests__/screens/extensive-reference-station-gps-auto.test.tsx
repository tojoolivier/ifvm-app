/**
 * #station-gps-auto : la Station (Prospection Extensive, slide Référence) est
 * un champ texte libre — jusqu'ici jamais pré-rempli automatiquement. Dès
 * qu'un fix GPS FRAIS est obtenu (jamais sur une fiche rouverte, cf.
 * extensive-reference-screen-restore.test.tsx pour ce cas), on tente un
 * géocodage inverse (`reverseGeocode`, même mécanisme déjà utilisé par
 * reference.tsx et (traitement)/references.tsx) et on ne pré-remplit que si
 * le champ est encore vide — jamais d'écrasement d'une saisie manuelle ni
 * d'une valeur déjà enregistrée.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as location from '@/lib/location';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({
    latitude: -18.9,
    longitude: 47.5,
    altitude: null,
    accuracy: 5,
    timestamp: Date.now(),
  }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

const freshDraft = () => ({
  id: 'draft-123',
  type_prospection: 'extensive',
  date_prospection: '2026-08-25',
  // Surface infestée obligatoire (#prospection-surface-infestee-obligatoire) —
  // sans lien avec ce que ce fichier teste (géocodage de la Station), mais
  // requise pour que « Suivant » ne soit pas bloqué dans le premier test.
  surface_infestee: 3.5,
});

describe('ExtensiveReferenceScreen — Station auto-remplie par géocodage inverse (#station-gps-auto)', () => {
  afterEach(cleanup);

  beforeEach(() => {
    jest.mocked(location.getCurrentPosition).mockClear();
    jest.mocked(location.reverseGeocode).mockReset().mockResolvedValue({ region: null, district: null, commune: null });
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    useProspectionWizardStore.setState({ draft: freshDraft() as any, captures: [] });
  });

  it('pré-remplit Station avec la commune détectée dès que le GPS obtient un fix', async () => {
    jest.mocked(location.reverseGeocode).mockResolvedValue({
      region: 'Analamanga',
      district: 'Antananarivo Renivohitra',
      commune: 'Andasibe',
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByDisplayValue('Andasibe')).toBeVisible();
    expect(location.reverseGeocode).toHaveBeenCalledWith(-18.9, 47.5);

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ stationLibre: 'Andasibe' })
      )
    );
  });

  it("retombe sur le district si la commune n'est pas rendue par le géocodage", async () => {
    jest.mocked(location.reverseGeocode).mockResolvedValue({
      region: 'Analamanga',
      district: 'Antananarivo Renivohitra',
      commune: null,
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByDisplayValue('Antananarivo Renivohitra')).toBeVisible();
  });

  it("n'écrase jamais une saisie manuelle déjà commencée pendant que le géocodage est en attente", async () => {
    let resoudre: (value: { region: null; district: null; commune: string }) => void = () => {};
    jest.mocked(location.reverseGeocode).mockReturnValue(
      new Promise((resolve) => {
        resoudre = resolve;
      })
    );

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Station (saisie libre)');

    // L'agent tape sa propre valeur avant que le géocodage ne réponde.
    fireEvent.changeText(screen.getByPlaceholderText('Nom du lieu-dit / repère local'), 'Repère personnel');

    resoudre({ region: null, district: null, commune: 'Andasibe' });

    // Attend la fin complète de l'effet (le témoin « Détection… » disparaît)
    // plutôt qu'un unique tick manuel — laisse `setIsDetectingStation(false)`
    // et `setIsLoadingGps(false)` se résoudre avant que le test ne rende la
    // main à `afterEach(cleanup)`, pour ne rien laisser fuiter sur le test
    // suivant sous charge (exécution complète de la suite, `maxWorkers: 2`).
    await waitFor(() => expect(screen.queryByText('Détection automatique de la localité…')).toBeNull());

    // La saisie de l'agent est conservée, jamais remplacée par la détection tardive.
    expect(screen.getByDisplayValue('Repère personnel')).toBeVisible();
    expect(screen.queryByDisplayValue('Andasibe')).toBeNull();
  });

  it('ne relance jamais le géocodage sur une fiche rouverte (coordonnées déjà connues)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        ...freshDraft(),
        latitude: -18.9,
        longitude: 47.5,
        station_libre: 'Andasibe',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Andasibe')).toBeVisible());

    expect(location.getCurrentPosition).not.toHaveBeenCalled();
    expect(location.reverseGeocode).not.toHaveBeenCalled();
  });

  it('un géocodage indisponible (hors ligne, service en échec) laisse Station vide, sans erreur affichée', async () => {
    jest.mocked(location.reverseGeocode).mockResolvedValue({ region: null, district: null, commune: null });

    await render(<ExtensiveReferenceScreen />);
    await screen.findByText('Station (saisie libre)');
    await waitFor(() => expect(location.reverseGeocode).toHaveBeenCalled());

    // Toujours éditable à la main, et aucun message d'erreur GPS déclenché par
    // l'échec du géocodage (best-effort : les coordonnées ont bien été acquises).
    expect(screen.getByPlaceholderText('Nom du lieu-dit / repère local')).toHaveProp('value', '');
    expect(screen.queryByText('Impossible de récupérer la position GPS')).toBeNull();
  });
});
