/**
 * intensive-larves.tsx (C-Larves) : la densité diffuse reste obligatoire
 * (héritée de density.tsx), mais la densité groupée est redevenue
 * facultative (#densite-groupee-obligatoire retiré, demande explicite) —
 * elle ne bloque plus la progression, contrairement à avant.
 *
 * Fichier séparé des autres scénarios de cet écran — même précaution que côté
 * intensive-imagos (cf. intensive-imagos-densites-obligatoires.test.tsx) : un
 * artefact de cet environnement de test corrompt le rendu d'un montage suivant
 * dans le même fichier ; Jest isole complètement l'état d'un fichier à l'autre.
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveLarvesScreen from '@/app/(prospection)/intensive-larves';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcLarveOnly } from '../test-utils/intensive-larves-fixtures';

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

describe('IntensiveLarvesScreen — densités', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT as any);
  });

  it('bloque « Infestation » tant que la densité diffuse (toujours obligatoire) manque', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcLarveOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveLarvesScreen />);
    await screen.findByText('Densité diffuse (ind./ha) *');
    await settle();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    expect(alertSpy).toHaveBeenCalledWith('Densité diffuse requise', expect.stringContaining('ind./ha'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });

  it("#densite-groupee-obligatoire retiré : n'exige plus la densité groupée pour continuer", async () => {
    useProspectionWizardStore.setState({ draft: draftLmcLarveOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveLarvesScreen />);
    await screen.findByText('Densité diffuse (ind./ha) *');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '40');
    await settle();
    fireEvent.press(screen.getByText('Végétation & Sol  ›'));
    await settle();

    expect(alertSpy).not.toHaveBeenCalledWith('Densité groupée requise', expect.anything());
    expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalled();
  });
});
