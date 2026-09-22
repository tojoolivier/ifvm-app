/**
 * intensive-larves.tsx (C-Larves) : #confirmation-espece-sans-donnee — pendant
 * de intensive-larves-confirmation-avertit.test.tsx : « Continuer » referme le
 * modal et poursuit vers l'écran suivant.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-larves-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

describe('IntensiveLarvesScreen — confirmation, bouton Continuer', () => {
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

  it('« Continuer » referme le modal et poursuit vers l’écran suivant', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcAndNseLarve(), captures: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });

    await render(<IntensiveLarvesScreen />);
    await screen.findByTestId('densite-diffuse-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();
    fireEvent.press(screen.getByText('Suivant  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/veg' }))
    );
  });
});
