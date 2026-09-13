/**
 * intensive-imagos.tsx (B-Imagos) : changer d'onglet d'espèce (LMC/NSE) sauvegarde
 * la grille quittée avant d'afficher l'autre, sans mélanger leurs densités.
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
import { STADES_PAR_DEFAUT, draftLmcAndNseImago } from '../test-utils/intensive-imagos-fixtures';

const params: { draftId: string } = { draftId: 'draft-123' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
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

/** `jest.useFakeTimers()` neutralise le chrono de l'écran (vrai `setInterval`,
 * 1s) : laissé actif, il tourne au-delà de la fin du test si le processus met
 * du temps à se terminer (CI partagée) et empêche Jest de sortir proprement. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — onglets espèce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT);
  });

  it('changer d’onglet espèce sauvegarde LMC avant d’afficher NSE, sans mélanger leurs densités', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({ espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: 2, methode: null, accouplement: null, ponte: null } as any)
        : ({ espece: 'NSE', categorie: 'imago', densite_diffuse: 7, densite_groupee: 1, methode: null, accouplement: null, ponte: null } as any)
    );

    useProspectionWizardStore.setState({ draft: draftLmcAndNseImago(), captures: [] });

    await render(<IntensiveImagosScreen />);
    expect(await screen.findByDisplayValue('10')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('NSE'));
    await settle();

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', densite_diffuse: 10, densite_groupee: 2 });

    expect(await screen.findByDisplayValue('7')).toBeVisible();
  });
});
