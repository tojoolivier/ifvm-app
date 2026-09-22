/**
 * intensive-larves.tsx (C-Larves) : #confirmation-espece-sans-donnee — pendant
 * de intensive-larves-confirmation-avertit.test.tsx : aucune confirmation
 * n'est demandée quand LMC et NSE ont chacun au moins une valeur.
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

describe('IntensiveLarvesScreen — confirmation, deux espèces déjà renseignées', () => {
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

  it('ne demande aucune confirmation quand LMC et NSE ont chacun une valeur', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcAndNseLarve(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveLarvesScreen />);
    await screen.findByTestId('densite-diffuse-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '7');
    await settle();

    // Sur NSE (dernier onglet larve), le bouton du bas devient « Végétation & Sol › ».
    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith('Aucune donnée saisie', expect.anything(), expect.anything());
  });
});
