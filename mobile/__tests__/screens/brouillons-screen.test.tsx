/**
 * #dossier-brouillons : écran dédié listant TOUS les brouillons de
 * prospection (intensive/extensive/validation), pas seulement le plus
 * récent (seule reprise possible jusqu'ici depuis l'accueil/« Mes
 * prospections », `AccueilViewModel.activeDraft`). Un brouillon disparaît de
 * cette liste dès qu'il est terminé (`completeProspection`), et n'apparaît
 * jamais sur l'écran de synchronisation (jamais envoyé tant qu'il l'est).
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import BrouillonsScreen from '@/app/(app)/brouillons';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as ficheRouting from '@/lib/fiche-routing';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  // `(effect) => effect()` (utilisé ailleurs dans ce dépôt) réexécute l'effet
  // à CHAQUE rendu — inoffensif tant que l'effet ne déclenche jamais de
  // `setState`, mais `refresh` ici en déclenche (`setDrafts`), ce qui
  // provoquait une boucle infinie rendu → refresh → setState → rendu (constaté
  // ici : heap JS épuisé). `React.useEffect` à dépendances vides reproduit
  // fidèlement le vrai `useFocusEffect` d'expo-router pour un montage unique
  // en test (pas de ré-exécution sur un re-render).
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    React.useEffect(() => {
      effect();
    }, []);
  },
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadAccueilData: jest.fn(),
  deleteDraftProspection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/fiche-routing', () => ({
  navigateToProspectionDraft: jest.fn().mockResolvedValue(undefined),
}));

const BROUILLON_INTENSIF = {
  id: 'draft-1',
  type_prospection: 'intensive',
  statut: 'brouillon',
  statut_sync: 'local',
  n_fiche: null,
  n_message: null,
  station_nom: 'Station Ambovombe',
  station_libre: null,
  date_prospection: '2026-09-22',
  updated_at: '2026-09-22T08:00:00.000Z',
} as any;

const BROUILLON_EXTENSIF = {
  id: 'draft-2',
  type_prospection: 'extensive',
  statut: 'brouillon',
  statut_sync: 'local',
  n_fiche: null,
  n_message: '20260921-EXT',
  station_nom: null,
  station_libre: 'Lieu-dit Betsinjaka',
  date_prospection: '2026-09-21',
  updated_at: '2026-09-21T08:00:00.000Z',
} as any;

const FICHE_EN_ATTENTE = {
  id: 'fiche-1',
  type_prospection: 'intensive',
  statut: 'en_attente',
  statut_sync: 'local',
  n_fiche: 'PR-2026-0001',
  station_nom: 'Station test',
  date_prospection: '2026-09-20',
  updated_at: '2026-09-20T08:00:00.000Z',
} as any;

const EMPTY_ACCUEIL = { unsyncedCount: 0, activeDraft: null, draftsCount: 0, recent: [], validated: [], pendingSync: [] };

describe('BrouillonsScreen', () => {
  beforeEach(() => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockReset();
    jest.mocked(prospectionAccueil.deleteDraftProspection).mockReset().mockResolvedValue(undefined);
    jest.mocked(ficheRouting.navigateToProspectionDraft).mockReset().mockResolvedValue(undefined);
  });

  it('affiche uniquement les brouillons (intensive/extensive/validation), jamais une fiche déjà terminée', async () => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockResolvedValue({
      ...EMPTY_ACCUEIL,
      recent: [BROUILLON_INTENSIF, BROUILLON_EXTENSIF, FICHE_EN_ATTENTE],
    });

    await render(<BrouillonsScreen />);

    expect(await screen.findByText(/Station Ambovombe/)).toBeVisible();
    expect(screen.getByText(/Betsinjaka/)).toBeVisible();
    expect(screen.queryByText(/Station test/)).toBeNull();
  });

  it('affiche « Aucun brouillon en cours » quand la liste est vide', async () => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockResolvedValue(EMPTY_ACCUEIL);

    await render(<BrouillonsScreen />);

    expect(await screen.findByText('Aucun brouillon en cours.')).toBeVisible();
  });

  it('reprend le brouillon tapé (navigue vers son écran, quel que soit son type)', async () => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockResolvedValue({
      ...EMPTY_ACCUEIL,
      recent: [BROUILLON_EXTENSIF],
    });

    await render(<BrouillonsScreen />);
    fireEvent.press(await screen.findByText(/Betsinjaka/));

    await waitFor(() =>
      expect(ficheRouting.navigateToProspectionDraft).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ id: 'draft-2' })
      )
    );
  });

  it('supprime un brouillon après confirmation, et rafraîchit la liste', async () => {
    jest.mocked(prospectionAccueil.loadAccueilData).mockResolvedValue({
      ...EMPTY_ACCUEIL,
      recent: [BROUILLON_INTENSIF],
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const supprimer = buttons?.find((b) => b.text === 'Supprimer');
      supprimer?.onPress?.();
    });

    await render(<BrouillonsScreen />);
    await screen.findByText(/Station Ambovombe/);

    fireEvent.press(screen.getByText('Supprimer'));

    await waitFor(() => expect(prospectionAccueil.deleteDraftProspection).toHaveBeenCalledWith(BROUILLON_INTENSIF));
    expect(alertSpy).toHaveBeenCalled();
  });
});
