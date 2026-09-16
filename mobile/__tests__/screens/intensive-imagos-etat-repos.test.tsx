/**
 * intensive-imagos.tsx (B-Imagos) : État = Repos — pendant de
 * intensive-imagos-etat-deplacement.test.tsx, fichier séparé pour la même
 * raison (cf. intensive-imagos-densites-obligatoires.test.tsx).
 */
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

describe('IntensiveImagosScreen — État = Repos', () => {
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

  it('dérive Comportement = Posé et n’affiche jamais la Direction', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    fireEvent.press(screen.getByText('Repos'));
    await settle();

    expect(screen.queryByText('Direction du déplacement')).toBeNull();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, row] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(row).toMatchObject({
      etat: 'repos',
      essaim_en_vol: false,
      essaim_pose: true,
      direction_de: null,
      direction_vers: null,
    });
  });
});
