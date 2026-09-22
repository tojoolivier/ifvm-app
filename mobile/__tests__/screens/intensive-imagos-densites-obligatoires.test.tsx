/**
 * intensive-imagos.tsx (B-Imagos) : la densité diffuse reste obligatoire dès
 * qu'il y a des captures — mais plus à 0 capture (cf.
 * intensive-imagos-densite-optionnelle-sans-capture.test.tsx, fichier séparé
 * pour la même raison qu'ici) depuis #densite-diffuse-zero-si-sans-capture
 * (demande explicite) : sans capture, la densité peut rester à 0/vide, comme
 * les règles Phases/Stades ci-dessus (« cohérent par défaut » à 0 capture).
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
 * du temps à se terminer (CI partagée) et empêche Jest de sortir proprement. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — densité diffuse obligatoire dès qu’il y a des captures', () => {
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

  it('bloque « Suivant » tant que la densité diffuse manque, dès qu’un nombre de captures est saisi', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByPlaceholderText('Saisir le nombre de captures'), '3');
    await settle();

    // Phases ET Stades cohérents avec les captures (règles bloquantes distinctes,
    // cf. intensive-imagos-stade-bloque-suivant.test.tsx) : sans ça, « Suivant »
    // est désactivé et n'atteint jamais la vérification de la densité diffuse.
    // Ordre des « + » : 4 phases puis les stades ♀ — le 1er est Phases/Solitaire,
    // le 5ᵉ (index 4) est Stades/A1.
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getAllByText('+')[0]);
      await settle();
    }
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getAllByText('+')[4]);
      await settle();
    }

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith('Densité diffuse requise', expect.stringContaining('ind./ha'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });
});
