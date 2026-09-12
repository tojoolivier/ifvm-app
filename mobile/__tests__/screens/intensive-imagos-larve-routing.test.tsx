/**
 * intensive-imagos.tsx (B-Imagos) : une fois la grille imago validée, la fiche
 * route vers C-Larves (intensive-larves.tsx) si des larves sont aussi cochées.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import IntensiveImagosScreen from '@/app/(prospection)/intensive-imagos';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcImagoAndLarve } from '../test-utils/intensive-imagos-fixtures';

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

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('IntensiveImagosScreen — routage vers C-Larves', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT);
    mockPush.mockClear();
  });

  it('route vers intensive-larves quand une grille larve est aussi cochée', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcImagoAndLarve(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Densité diffuse (ind./ha) *');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '10');
    fireEvent.changeText(screen.getByTestId('densite-groupee-input'), '2');
    await settle();

    fireEvent.press(screen.getByText('Larves  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/intensive-larves' }))
    );
  });
});
