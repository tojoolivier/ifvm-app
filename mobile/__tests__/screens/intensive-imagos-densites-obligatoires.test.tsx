/**
 * intensive-imagos.tsx (B-Imagos) : la densité diffuse/groupée reste obligatoire
 * (héritée de density.tsx) même une fois fusionnée dans le nouvel écran.
 *
 * Ce scénario vit dans son propre fichier — pas regroupé avec les autres tests de
 * cet écran — car un artefact de cet environnement de test (Windows, ce runner)
 * fait que monter/démonter ce composant plusieurs fois dans le MÊME fichier
 * corrompt le rendu des montages suivants (confirmé en isolant chaque scénario :
 * chacun passe seul, jamais une fois combiné). Jest isole complètement l'état
 * d'un fichier à l'autre, ce qui contourne le problème sans dépendre de son
 * origine exacte (React Test Renderer / Testing Library / timers réels).
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveImagosScreen from '@/app/(prospection)/intensive-imagos';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcOnly } from '../test-utils/intensive-imagos-fixtures';

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
 * du temps à se terminer (CI partagée) et empêche Jest de sortir proprement —
 * un des facteurs du job `lint-mobile` qui traînait en CI sur cette suite. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — densités obligatoires', () => {
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
  });

  it('bloque « Suivant » tant que les densités obligatoires manquent', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Densité diffuse (ind./ha) *');
    await settle();

    fireEvent.press(screen.getByText('Infestation  ›'));

    expect(alertSpy).toHaveBeenCalledWith('Densité diffuse requise', expect.stringContaining('ind./ha'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });
});
