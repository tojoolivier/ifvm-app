/**
 * intensive-imagos.tsx (B-Imagos) : État / Comportement de l'essaim / Direction
 * du déplacement — nouveaux champs demandés pour l'Intensif, déjà présents côté
 * Extensif (extensive-imagos.tsx) sur les mêmes colonnes partagées de
 * `prospection_population` (etat, essaim_en_vol, essaim_pose, direction_de,
 * direction_vers) : aucune migration, seule l'UI manquait ici.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
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

describe('IntensiveImagosScreen — État = Déplacement', () => {
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

  it('dérive Comportement = En vol et affiche la Direction ; enregistre les 5 colonnes', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    // Direction masquée tant que l'État n'est pas Déplacement.
    expect(screen.queryByText('Direction du déplacement')).toBeNull();

    fireEvent.press(screen.getByText('Déplacement'));
    await settle();

    expect(screen.getByText('Direction du déplacement')).toBeVisible();
    fireEvent.press(screen.getByText('N'));
    await settle();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, row] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(row).toMatchObject({
      etat: 'deplacement',
      essaim_en_vol: true,
      essaim_pose: false,
      direction_de: 'N',
      direction_vers: 'S',
    });
  });
});
