/**
 * #revalidation-verrouillage-localisation : une fiche née de « Prospections
 * à revalider » (`demarrerRevalidation`) documente la MÊME localisation que
 * la fiche périmée qu'elle revalide — revérifier une situation ne veut pas
 * dire la déplacer. La Station (saisie libre) — seul champ de localisation
 * réellement modifiable sur cet écran, GPS et Région/District/Commune
 * n'étant que des affichages — devient donc non modifiable pour ce cas
 * précis, sans affecter une fiche neuve.
 *
 * Fichier séparé (un seul montage d'écran par fichier), même mise en garde
 * que extensive-reference-screen-restore.test.tsx.
 */
import { render, screen } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-09-22',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — verrouillage de la localisation (revalidation)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });

  it('verrouille le champ Station quand la fiche revalide une autre fiche', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-22',
        station_libre: 'Ankazoabo',
        revalide_de_id: 'presp-perimee',
        surface_infestee: 3.5,
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    const champ = await screen.findByDisplayValue('Ankazoabo');
    expect(champ.props.editable).toBe(false);
    expect(screen.getByText(/non modifiable/)).toBeVisible();
  });

  it("laisse le champ Station modifiable pour une fiche neuve (pas une revalidation)", async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-22',
        station_libre: 'Ankazoabo',
        revalide_de_id: null,
        surface_infestee: 3.5,
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    const champ = await screen.findByDisplayValue('Ankazoabo');
    expect(champ.props.editable).not.toBe(false);
    expect(screen.queryByText(/non modifiable/)).toBeNull();
  });
});
