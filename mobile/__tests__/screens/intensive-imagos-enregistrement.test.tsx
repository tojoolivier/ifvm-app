/**
 * intensive-imagos.tsx (B-Imagos) : enregistrement complet d'une grille — densité,
 * interdistance (nouveau, repris d'extensive-imagos.tsx) et type de cible
 * (nouveau, Population — pas l'Infestation, plus riche, de infestation.tsx) —
 * multi-sélect, puis routage vers Infestation quand aucune larve n'est cochée.
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

/** Enveloppé dans `act()` + `jest.useFakeTimers()` : le chrono de l'écran tourne
 * sur un vrai `setInterval` (1s) qui, laissé actif pendant plusieurs saisies
 * enchaînées dans le même test, interfère avec le suivi `act()` de React et fait
 * perdre silencieusement une mise à jour d'état (confirmé en traçant chaque appel
 * de `setPopulationField` : celui de l'interdistance était bien appelé, mais
 * jamais appliqué avant la lecture suivante). Neutraliser le chrono avec de vrais
 * timers avancés à la demande règle le problème à la racine. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — enregistrement complet', () => {
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

  it('enregistre densité, interdistance et type de cible (multi-sélect) puis route vers Infestation quand aucune larve n’est cochée', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    fireEvent.changeText(screen.getByTestId('densite-groupee-input'), '3');
    await settle();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '25.5');
    await settle();
    expect(screen.getByTestId('interdistance-input')).toHaveDisplayValue('25.5');

    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Dense'));
    await settle();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(1));
    const [, row] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(row).toMatchObject({ espece: 'LMC', categorie: 'imago', densite_diffuse: 12, densite_groupee: 3, interdistance: 25.5 });
    expect(JSON.parse(row.type_cible as string).sort()).toEqual(['dense', 'vol_clair']);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/veg' }))
    );
  });
});
