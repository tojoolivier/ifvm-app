/**
 * intensive-imagos.tsx (B-Imagos) : #confirmation-espece-sans-donnee — LMC et
 * NSE sont deux onglets d'un même écran ; le bouton du bas (« Suivant »/
 * « Végétation & Sol › ») quitte l'écran en entier depuis N'IMPORTE QUEL
 * onglet (les onglets d'espèce se changent par les boutons du haut, pas par ce
 * bouton) — rien n'empêche donc de l'appuyer sans jamais avoir ouvert l'autre
 * espèce. Un modal de confirmation avertit avant de partir si l'une des deux
 * (ou les deux) n'a strictement aucune valeur saisie.
 *
 * Fichier séparé des autres scénarios de cet écran (un test par fichier) — cf.
 * le commentaire d'intensive-imagos-densites-obligatoires.test.tsx pour le
 * pourquoi.
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveImagosScreen from '@/app/(prospection)/intensive-imagos';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcAndNseImago } from '../test-utils/intensive-imagos-fixtures';

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

describe('IntensiveImagosScreen — confirmation avant de quitter une espèce sans donnée', () => {
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

  it('avertit avant de quitter l’écran si NSE n’a jamais été ouvert, alors qu’on est resté sur l’onglet LMC', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcAndNseImago(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    // LMC porte une valeur (la densité) — seul NSE, jamais ouvert, reste vide.
    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    // Deux onglets imago (LMC index 0, NSE index 1) : on reste sur LMC, le
    // bouton du bas affiche donc « Suivant › », pas « Végétation & Sol › ».
    fireEvent.press(screen.getByText('Suivant  ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith(
      'Aucune donnée saisie',
      expect.stringContaining('NSE'),
      expect.anything()
    );
    // LMC est déjà enregistré (commit de son propre onglet) ; NSE ne l'est
    // jamais tant que rien n'a été ouvert dessus — mais la navigation, elle,
    // reste bloquée tant que le modal n'a pas été confirmé.
    expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
