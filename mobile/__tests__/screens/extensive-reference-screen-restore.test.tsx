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
    expect(screen.getByText('Xerophyle').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          stationLibre: 'Andasibe',
          typeStation: 'xerophyle',
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

    // Station (saisie libre), Surf. (ha) puis Surface infestée (ha) sont les 3 champs
    // vides, dans cet ordre.
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
