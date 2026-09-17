/**
 * Base principale/secondaire (mode aérien) — restauration du numéro, de la date
 * d'installation et des coordonnées GPS déjà enregistrés, sans relance de
 * capture GPS. Fichier séparé — cf. extensive-reference-base-affichage.test.tsx.
 */
import { render, screen } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import { getCurrentPosition } from '@/lib/location';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-09-17',
  }),
  updateProspectionGpsPosition: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — Base principale/secondaire : restauration', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(getCurrentPosition).mockClear();
  });

  it('restaure numéro/date/coordonnées déjà enregistrés au remontage', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-17',
        mode_extensif: 'aerien',
        latitude: -18.9,
        longitude: 47.5,
        surface_infestee: 3.5,
        base: 'Antsirabe',
        base_numero: 12,
        base_date_installation: '2026-08-20',
        base_latitude: -19.8667,
        base_longitude: 47.0333,
        base_secondaire: 'Ambositra',
        base_secondaire_date_installation: '2026-08-22',
        base_secondaire_latitude: -20.5333,
        base_secondaire_longitude: 47.25,
      } as any,
      captures: [],
    });

    await render(<ExtensiveReferenceScreen />);

    expect(await screen.findByDisplayValue('12')).toBeVisible();
    expect(screen.getByDisplayValue('Ambositra')).toBeVisible();
    expect(screen.getByText('-19.86670, 47.03330')).toBeVisible();
    expect(screen.getByText('-20.53330, 47.25000')).toBeVisible();
    // Une fiche déjà localisée (latitude/longitude de la fiche elle-même
    // renseignées) ne relance jamais de capture GPS automatique au remontage.
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
