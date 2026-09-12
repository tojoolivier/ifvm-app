/**
 * intensive-larves.tsx (C-Larves) : enregistrement complet d'une grille —
 * densités, interdistance, tache/bande larvaire et déplacement (repris
 * d'extensive-larves.tsx ; surface contaminée délibérément exclue), puis
 * routage vers Infestation.
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
import { STADES_PAR_DEFAUT, draftLmcLarveOnly } from '../test-utils/intensive-larves-fixtures';

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

/** Enveloppé dans `act()` + `jest.useFakeTimers()` : le chrono de l'écran tourne
 * sur un vrai `setInterval` (1s) qui, laissé actif pendant plusieurs saisies
 * enchaînées dans le même test, interfère avec le suivi `act()` de React et fait
 * perdre silencieusement une mise à jour d'état — cf.
 * intensive-imagos-enregistrement.test.tsx pour le détail du diagnostic. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveLarvesScreen — enregistrement complet', () => {
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

  it('enregistre densités, interdistance, tache/bande larvaire et déplacement, puis route vers Infestation', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcLarveOnly(), captures: [] });

    await render(<IntensiveLarvesScreen />);
    await screen.findByText('Déplacement');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '40');
    fireEvent.changeText(screen.getByTestId('densite-groupee-input'), '9');
    await settle();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '14');
    await settle();

    // "Non" apparaît deux fois (Tache larvaire puis Bande larvaire) : le premier est
    // celui de Tache larvaire.
    fireEvent.press(screen.getAllByText('Non')[0]);
    await settle();
    fireEvent.press(screen.getByText('Perchée'));
    await settle();

    // Aucune "Surface contaminée" sur cet écran (exclue explicitement).
    expect(screen.queryByText('Surface contaminée (ha)')).toBeNull();

    fireEvent.press(screen.getByText('Infestation  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, row] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(row).toMatchObject({
      espece: 'LMC',
      categorie: 'larve',
      densite_diffuse: 40,
      densite_groupee: 9,
      interdistance: 14,
      tache_larvaire: true,
      deplacement: 'perchee',
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/infestation' }))
    );
  });
});
