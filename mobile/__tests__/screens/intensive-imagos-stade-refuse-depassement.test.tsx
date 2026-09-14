/**
 * intensive-imagos.tsx (B-Imagos) : le « + » d'une ligne Stade (table ♀/♂) refuse
 * toute valeur qui ferait dépasser le nombre total de captures — demande
 * explicite du 2026-09-14 (« la somme des stades ne doit pas dépasser le nombre
 * de captures »). Ce garde-fou (`incrementStadeBySex` gaté par `currentTotal <
 * totalCaptures` dans l'écran) existe depuis la fusion des écrans (65492c2) mais
 * n'avait aucun test dédié.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
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

/** cf. intensive-imagos-enregistrement.test.tsx : le chrono (vrai `setInterval`)
 * interfère avec `act()` sur plusieurs saisies enchaînées dans le même test — une
 * mise à jour est bien déclenchée mais jamais appliquée avant la lecture
 * suivante. Neutraliser le chrono avec de vrais timers avancés à la demande
 * règle le problème à la racine. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — stade refuse le dépassement des captures', () => {
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

  it('le « + » du premier stade ♀ refuse une 4ᵉ capture quand le total est fixé à 3', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByPlaceholderText('Saisir le nombre de captures'), '3');
    await settle();

    // Ordre d'apparition des « + » : 4 phases (solitaire, solitaro_trans,
    // transiens, gregaire) puis les stades ♀ (A1, A2, A3) — le premier stade
    // ♀ (A1) est donc le 5ᵉ bouton « + » de l'écran (index 4).
    const stadeA1Plus = () => screen.getAllByText('+')[4];
    fireEvent.press(stadeA1Plus());
    await settle();
    fireEvent.press(stadeA1Plus());
    await settle();
    fireEvent.press(stadeA1Plus());
    await settle();

    expect(alertSpy).not.toHaveBeenCalled();

    fireEvent.press(stadeA1Plus());
    await settle();

    expect(alertSpy).toHaveBeenCalledWith('Limite atteinte', expect.stringContaining('3'));
  });
});
