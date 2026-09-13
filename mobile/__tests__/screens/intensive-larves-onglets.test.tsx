/**
 * intensive-larves.tsx (C-Larves) : changer d'onglet d'espèce (LMC/NSE) sauvegarde
 * la grille quittée avant d'afficher l'autre.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-larves-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import IntensiveLarvesScreen from '@/app/(prospection)/intensive-larves';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcAndNseLarve } from '../test-utils/intensive-larves-fixtures';

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
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

/** `jest.useFakeTimers()` neutralise le chrono de l'écran (vrai `setInterval`,
 * 1s) : laissé actif, il tourne au-delà de la fin du test si le processus met
 * du temps à se terminer (CI partagée) et empêche Jest de sortir proprement. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveLarvesScreen — onglets espèce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT as any);
  });

  it('changer d’onglet espèce sauvegarde LMC avant d’afficher NSE', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({ espece: 'LMC', categorie: 'larve', densite_diffuse: 40, densite_groupee: 9, methode: null } as any)
        : ({ espece: 'NSE', categorie: 'larve', densite_diffuse: 25, densite_groupee: 5, methode: null } as any)
    );

    useProspectionWizardStore.setState({ draft: draftLmcAndNseLarve(), captures: [] });

    await render(<IntensiveLarvesScreen />);
    expect(await screen.findByDisplayValue('40')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('NSE'));
    await settle();

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', densite_diffuse: 40, densite_groupee: 9 });

    expect(await screen.findByDisplayValue('25')).toBeVisible();
  });
});
