/**
 * intensive-imagos.tsx (B-Imagos) : #densite-diffuse-zero-si-sans-capture
 * (demande explicite) — sans capture (0 par défaut), la densité diffuse n'est
 * plus obligatoire, l'astérisque de la maquette disparaît, et « Suivant »
 * n'est jamais bloqué de ce fait. Pendant de
 * intensive-imagos-densites-obligatoires.test.tsx (au moins une capture),
 * fichier séparé pour la même raison (cf. son en-tête).
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import IntensiveImagosScreen from '@/app/(prospection)/intensive-imagos';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcOnly } from '../test-utils/intensive-imagos-fixtures';

const params: { draftId: string } = { draftId: 'draft-123' };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => params,
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
  markGrilleCompleted: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  saveProspectionCaptures: jest.fn().mockResolvedValue(undefined),
  startCaptureTimer: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — densité diffuse facultative sans capture', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT);
    mockPush.mockClear();
  });

  it('n’exige pas la densité diffuse quand aucune capture n’est saisie, et n’affiche pas l’astérisque « obligatoire »', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    expect(screen.queryByText('Densité diffuse (ind./ha) *')).toBeNull();
    expect(screen.getByText('Densité diffuse (ind./ha)')).toBeVisible();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith('Densité diffuse requise', expect.anything());
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/veg' }));
  });
});
