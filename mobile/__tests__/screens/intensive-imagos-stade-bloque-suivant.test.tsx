/**
 * intensive-imagos.tsx (B-Imagos) : quand la somme des stades ♀+♂ dépasse le
 * nombre total de captures, « Suivant » devient inactif — demande explicite du
 * 2026-09-14. Le garde-fou de la saisie (cf.
 * intensive-imagos-stade-refuse-depassement.test.tsx) empêche d'y arriver en
 * tapant ; ce test introduit l'incohérence directement dans le store (ex. un
 * brouillon restauré dans un état incohérent) pour vérifier que le blocage à
 * l'enregistrement (`isConsistent`, qui désactive le bouton) tient aussi
 * indépendamment de la saisie normale — un appui sur un bouton désactivé
 * n'invoque pas `onPress`, donc rien n'est jamais persisté ni synchronisé.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
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

/** cf. intensive-imagos-enregistrement.test.tsx : neutralise le chrono
 * (vrai `setInterval`), qui interfère avec `act()` sur plusieurs saisies
 * enchaînées dans le même test. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — Suivant bloque si stades > captures', () => {
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

  it('désactive « Suivant » et n’enregistre rien si la somme des stades ♀+♂ dépasse le nombre de captures', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByPlaceholderText('Saisir le nombre de captures'), '3');
    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    // État incohérent introduit hors saisie normale (ex. brouillon restauré) :
    // 5 stades ♀ pour seulement 3 captures. Le garde-fou de l'input (testé par
    // ailleurs) empêche d'y arriver en tapant — celui-ci vérifie que la règle
    // tient aussi côté enregistrement, quelle que soit l'origine.
    act(() => {
      useProspectionCaptureStore.getState().updateStadeBySex('F', 'A1', 5);
    });
    await settle();

    expect(await screen.findByText('⚠️ INCOHÉRENCE')).toBeVisible();

    const bouton = screen.getByText('Végétation & Sol  ›').parent;
    expect(bouton?.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));
    await settle();

    // Un bouton désactivé n'invoque jamais `onPress` : rien n'est enregistré.
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(prospectionRepository.saveProspectionCaptures).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
