/**
 * Région / District / Commune (Prospection Extensive, slide Référence) —
 * purement informatifs, dérivés du géocodage inverse (`reverseGeocode`,
 * même mécanisme que reference.tsx côté Intensif) dès l'acquisition GPS,
 * affichés sous Latitude/Longitude. Ces colonnes étaient déjà persistées en
 * silence (`updateProspectionGpsPosition`, #localite-traitement-poste-acridien-
 * autre-agent) mais jamais montrées à l'agent avant cet ajout.
 *
 * Fichier séparé — même précaution que les autres suites extensive-reference-*
 * de ce dépôt (un seul montage d'écran par fichier, fuite de la chaîne de
 * promesses GPS entre tests d'un même fichier).
 */
import { render, screen, waitFor, within } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
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
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — Région / District / Commune (auto, informatif)', () => {
  beforeEach(() => {
    jest.mocked(location.reverseGeocode).mockReset().mockResolvedValue({ region: null, district: null, commune: null });
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });

  it("affiche Région/District/Commune dès qu'un fix GPS frais obtient un géocodage complet", async () => {
    jest.mocked(location.reverseGeocode).mockResolvedValue({
      region: 'Analamanga',
      district: 'Antananarivo Renivohitra',
      commune: 'Andasibe',
    });
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25', surface_infestee: 3.5 } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByText('Analamanga · Antananarivo Renivohitra · Andasibe')).toBeVisible();
  });

  it("restaure Région/District/Commune déjà connus sur une fiche rouverte, sans relancer de géocodage", async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        latitude: -18.9,
        longitude: 47.5,
        region: 'Analamanga',
        district: 'Antananarivo Renivohitra',
        commune: 'Andasibe',
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByText('Analamanga · Antananarivo Renivohitra · Andasibe')).toBeVisible();
    expect(location.reverseGeocode).not.toHaveBeenCalled();
  });

  it('affiche « — » quand le géocodage ne renvoie aucune localité (hors ligne, service en échec)', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25', surface_infestee: 3.5 } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    await waitFor(() => expect(location.reverseGeocode).toHaveBeenCalled());
    // `screen.findByText('—')` matcherait aussi « Prospecteur (connecté) »
    // (aucun utilisateur connecté dans ce test) — on scope donc la recherche au
    // bloc Région/District/Commune, identifié par son libellé.
    const label = await screen.findByText('Région / District / Commune');
    await waitFor(() => expect(within(label.parent!).getByText('—')).toBeVisible());
  });
});
