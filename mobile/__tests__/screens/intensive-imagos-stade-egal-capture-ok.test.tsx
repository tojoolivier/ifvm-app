/**
 * intensive-imagos.tsx (B-Imagos) : quand la somme des stades ♀+♂ égale
 * exactement le nombre total de captures (et les phases aussi), « Suivant »
 * enregistre normalement — pendant du blocage vérifié par
 * intensive-imagos-stade-bloque-suivant.test.tsx (somme supérieure) : ce test
 * confirme que la règle ne bloque pas à tort le cas nominal, égalité stricte.
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

/** cf. intensive-imagos-enregistrement.test.tsx : neutralise le chrono
 * (vrai `setInterval`), qui interfère avec `act()` sur plusieurs saisies
 * enchaînées dans le même test. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — Suivant accepte si stades = captures', () => {
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

  it('accepte et enregistre quand la somme des stades ♀+♂ égale exactement le nombre de captures', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '12');
    await settle();

    // #accouplement-ponte-cible-etat-obligatoires : dès qu'il y a des captures (3,
    // saisies plus bas), ces 4 choix deviennent obligatoires — sans rapport avec la
    // règle Stades = Captures que ce test vise, mais nécessaires pour l'atteindre.
    // #interdistance-obligatoire-si-accouplement-ou-ponte : Accouplement et Ponte
    // « Rare » l'exigent tous les deux désormais.
    // Renseignés AVANT le nombre de captures (et donc avant les compteurs de
    // phases/stades, qui n'apparaissent qu'une fois ce nombre saisi) : taper le
    // nombre de captures démonte/remonte les tableaux Phases et Stades, ce qui
    // rend les appuis sur les puces Accouplement/Ponte/État qui suivraient peu
    // fiables dans ce runner (`act()` qui se chevauchent, cf. les commentaires
    // « chrono de l'écran » des autres fichiers de ce dossier).
    // « Rare » apparaît deux fois avant toute sélection (chip Accouplement puis
    // chip Ponte, dans cet ordre de rendu) — le premier est celui d'Accouplement.
    fireEvent.press(screen.getAllByText('Rare')[0]);
    await settle();

    fireEvent.press(screen.getAllByText('Rare')[1]);
    await settle();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '5');
    await settle();
    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Repos'));
    await settle();

    // Le nombre de captures est saisi en dernier : il fait apparaître les
    // tableaux Phases et Stades ci-dessous.
    fireEvent.changeText(screen.getByPlaceholderText('Saisir le nombre de captures'), '3');
    await settle();

    // Ordre des « + » : 4 phases puis les stades ♀ — 3 captures = 3 phases
    // (solitaire, 1er « + ») = 3 stades ♀ (A1, 5ᵉ « + », index 4).
    const boutons = () => screen.getAllByText('+');
    for (let i = 0; i < 3; i++) {
      fireEvent.press(boutons()[0]);
      await settle();
    }
    for (let i = 0; i < 3; i++) {
      fireEvent.press(boutons()[4]);
      await settle();
    }

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionCaptures).toHaveBeenCalledTimes(1));
    const [, , , rows] = jest.mocked(prospectionRepository.saveProspectionCaptures).mock.calls[0];
    const totalEffectif = rows.reduce((sum: number, r: { effectif: number }) => sum + r.effectif, 0);
    expect(totalEffectif).toBe(3);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(prospection)/veg' }));
  });
});
