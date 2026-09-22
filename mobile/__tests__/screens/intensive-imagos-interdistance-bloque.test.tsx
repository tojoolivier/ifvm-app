/**
 * intensive-imagos.tsx (B-Imagos) : #interdistance-obligatoire-si-accouplement-ou-ponte
 * — dès qu'un accouplement ou une ponte « Rare »/« Beaucoup » est signalé,
 * l'interdistance devient obligatoire (indépendamment du nombre de captures,
 * contrairement aux 4 choix obligatoires d'#accouplement-ponte-cible-etat-obligatoires) —
 * « Suivant » bloque tant qu'elle manque.
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

describe('IntensiveImagosScreen — interdistance obligatoire, bloque tant que manquante', () => {
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

  it('bloque « Suivant » tant que l’interdistance manque, alors même qu’il n’y a aucune capture', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    // Aucune capture saisie : la densité et les 4 choix « obligatoires » ne
    // bloquent pas — seule l'interdistance, elle, doit bloquer.
    fireEvent.press(screen.getAllByText('Rare')[0]);
    await settle();
    expect(screen.getByTestId('interdistance-input')).toBeVisible();

    fireEvent.press(screen.getByText('Végétation & Sol  ›'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Interdistance requise',
      expect.stringContaining("l'interdistance")
    );
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
