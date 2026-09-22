/**
 * intensive-larves.tsx (C-Larves) : #confirmation-espece-sans-donnee — même
 * garde-fou que côté Imagos (intensive-imagos-confirmation-avertit.test.tsx) :
 * le bouton du bas quitte l'écran en entier depuis n'importe quel onglet
 * d'espèce, sans jamais forcer à ouvrir l'autre.
 *
 * Fichier séparé des autres scénarios de cet écran (un test par fichier) — cf.
 * le commentaire d'intensive-larves-densites-obligatoires.test.tsx pour le
 * pourquoi.
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveLarvesScreen from '@/app/(prospection)/intensive-larves';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcAndNseLarve } from '../test-utils/intensive-larves-fixtures';

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
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveLarvesScreen — confirmation avant de quitter une espèce sans donnée', () => {
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
    mockPush.mockClear();
  });

  it('avertit avant de quitter l’écran si NSE n’a jamais été ouvert, alors qu’on est resté sur l’onglet LMC', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcAndNseLarve(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveLarvesScreen />);
    await screen.findByTestId('densite-diffuse-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    // Deux onglets larve (LMC index 0, NSE index 1) : on reste sur LMC, le
    // bouton du bas affiche donc « Suivant › », pas « Végétation & Sol › ».
    fireEvent.press(screen.getByText('Suivant  ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith(
      'Aucune donnée saisie',
      expect.stringContaining('NSE'),
      expect.anything()
    );
    expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
