/**
 * #brouillon-gps-persistance-immediate : demande explicite du 2026-09-16 — dès
 * qu'une position GPS est capturée, elle doit être immédiatement persistée
 * dans le brouillon (avant même que le reste de la fiche Références ne soit
 * rempli), pour ne jamais la perdre si l'agent quitte la fiche avant
 * « Continuer ». Avant ce correctif, la position ne survivait qu'en état React
 * local de l'écran, écrite en base une seule fois via `updateProspectionReference`,
 * au moment de « Continuer ».
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferenceScreen from '@/app/(prospection)/reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import { getCurrentPosition, reverseGeocode } from '@/lib/location';

const TEST_SAFE_AREA_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  updateProspectionGpsPosition: jest.fn().mockResolvedValue({ id: 'draft-123', latitude: -18.9, longitude: 47.5 }),
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: 1280, accuracy: 10, timestamp: 1_756_123_456_000 }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: 'Analamanga', district: 'Antananarivo', commune: 'Andasibe' }),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([]),
  listStationsByPoste: jest.fn().mockResolvedValue([]),
  findNearestStation: jest.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  jest.mocked(prospectionRepository.updateProspectionGpsPosition).mockClear();
  jest.mocked(prospectionRepository.updateProspectionReference).mockClear();
  useProspectionWizardStore.setState({
    draft: {
      id: 'draft-123',
      type_prospection: 'intensive',
      campagne_id: 'campagne-1',
      prospecteur_id: 'prospecteur-1',
      station_id: null,
    } as any,
    captures: [],
  });
});

describe('ReferenceScreen — persistance immédiate de la position GPS', () => {
  it('persiste latitude/longitude/altitude et la localité géocodée dès la capture, sans attendre « Continuer »', async () => {
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <ReferenceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalledWith(-18.9, 47.5));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionGpsPosition).toHaveBeenCalledWith('draft-123', {
        latitude: -18.9,
        longitude: 47.5,
        altitude: 1280,
        region: 'Analamanga',
        district: 'Antananarivo',
        commune: 'Andasibe',
      })
    );

    // « Continuer » n'a jamais été pressé : la persistance de la position ne
    // dépend pas de l'enregistrement complet de la fiche.
    expect(prospectionRepository.updateProspectionReference).not.toHaveBeenCalled();
  });
});
