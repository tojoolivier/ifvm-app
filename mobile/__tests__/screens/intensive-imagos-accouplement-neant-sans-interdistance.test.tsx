/**
 * intensive-imagos.tsx (B-Imagos) : #accouplement-neant-sans-interdistance —
 * un accouplement « Néant » n'a pas de sens accompagné d'une interdistance
 * (distance entre individus accouplés) : la section se masque et la valeur
 * déjà saisie est effacée, jamais envoyée au backend.
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

const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — Accouplement Néant masque l’Interdistance', () => {
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

  it('masque la section et efface la valeur déjà saisie quand Accouplement passe à Néant', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    // « Rare » : l'Interdistance est visible et saisissable.
    fireEvent.press(screen.getAllByText('Rare')[0]);
    await settle();
    expect(screen.getByTestId('interdistance-input')).toBeVisible();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '25.5');
    await settle();
    expect(screen.getByTestId('interdistance-input')).toHaveDisplayValue('25.5');

    // Repasser sur « Néant » masque la section et efface la valeur.
    fireEvent.press(screen.getAllByText('Néant')[0]);
    await settle();

    expect(screen.queryByTestId('interdistance-input')).toBeNull();

    // « Rare » reste doublé (chip Accouplement, désormais inactif, + chip Ponte) —
    // le second est celui de Ponte.
    fireEvent.press(screen.getByText('Repos'));
    fireEvent.press(screen.getAllByText('Rare')[1]);
    fireEvent.press(screen.getByText('Vol clair'));
    await settle();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, row] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(row).toMatchObject({ accouplement: 'Néant', interdistance: null });
  });
});
