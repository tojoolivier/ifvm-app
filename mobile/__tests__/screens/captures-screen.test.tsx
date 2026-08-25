/**
 * Non-régression #201 : en rouvrant une grille de captures déjà remplie, le
 * « nombre total de captures » doit se recalculer depuis les captures enregistrées.
 * Tant qu'il vaut 0, les sections Phases et Stades restent masquées et la saisie
 * précédente paraît perdue.
 */
import { act, render, screen } from '@testing-library/react-native';
import CapturesScreen from '@/app/(prospection)/captures';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import { ErrorBanner } from '@/components/error-banner';
import { useErrorStore } from '@/lib/error-store';
import { useAuthStore } from '@/lib/auth-store';
import { ReferentialError } from '@/lib/errors';
import * as referentielDb from '@/lib/referentiel-db';

/** Paramètres de route mutables : un test change de grille demandée. */
const params: { draftId: string; grilleIndex: string } = {
  draftId: 'draft-123',
  grilleIndex: '0',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => params,
}));

jest.mock('@/lib/prospection-repository', () => ({
  markGrilleCompleted: jest.fn(),
  saveProspectionCaptures: jest.fn(),
  startCaptureTimer: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

// Les stades viennent du référentiel synchronisé, pas d'une liste dans l'écran.
const STADES_PAR_DEFAUT = (_espece: string, categorie: string, sexe: string | null) => {
  if (categorie === 'larve') {
    return Promise.resolve(['L1', 'L2', 'L3', 'L4', 'L5'].map((code) => ({ code, libelle: code })));
  }
  const codes = sexe === 'F' ? ['A1', 'A2', 'A3', 'A4', 'A5'] : ['A1', 'A234', 'A5'];
  return Promise.resolve(codes.map((code) => ({ code, libelle: code })));
};

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

const CAPTURES_LARVE = [
  { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'solitaire', stade: 'L1', effectif: 4 },
  { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L3', effectif: 6 },
] as any;

describe('CapturesScreen', () => {
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    useErrorStore.getState().dismissAll();
    useAuthStore.setState({ isAuthenticated: true });
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT);
    params.grilleIndex = '0';
  });

  it('recalcule le nombre total de captures d’une grille larvaire déjà remplie (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: CAPTURES_LARVE,
    });

    await render(<CapturesScreen />);

    expect(await screen.findByDisplayValue('10')).toBeVisible();
    // Sections déverrouillées : le total non nul les rend à nouveau visibles.
    expect(await screen.findByText('📊 2. Phases')).toBeVisible();
  });

  it('dit que le référentiel manque au lieu d’afficher une grille vide et muette (#201)', async () => {
    // Référentiel jamais synchronisé sur l'appareil : `listStadesGrille` lève.
    jest
      .mocked(referentielDb.listStadesGrille)
      .mockRejectedValue(new ReferentialError('Aucun stade larve connu pour LMC sur cet appareil.'));

    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: [],
    });

    await render(
      <>
        <ErrorBanner />
        <CapturesScreen />
      </>
    );

    expect(await screen.findByText(/absente du référentiel de l’appareil/)).toBeVisible();
  });

  it('charge le vocabulaire même quand l’écran « espèces » a déjà posé les grilles (#201)', async () => {
    // Parcours réel : species.tsx appelle `initGrilles` avant de naviguer ici. L'écran
    // ne doit pas en conclure qu'il n'a plus rien à charger — le vocabulaire, lui,
    // n'est pas encore connu.
    useProspectionCaptureStore
      .getState()
      .initGrilles([{ espece: 'LMC', categorie: 'larve' }], [], []);

    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: CAPTURES_LARVE,
    });

    await render(<CapturesScreen />);

    expect(await screen.findByText('L1')).toBeVisible();
    expect(screen.getByText('L5')).toBeVisible();
  });

  it('reste sur la grille demandée par la route, sans revenir sur la première (#201)', async () => {
    // Passage imago -> larve : la route demande la grille 1. `draft.grilles_completees`
    // est encore l'ancienne valeur (la complétion vient d'être écrite en base, le
    // brouillon du store n'a pas été rechargé) : l'écran ne doit pas s'y fier pour
    // décider quelle grille montrer.
    params.grilleIndex = '1';

    // Le store survit à la navigation : la grille précédente y a laissé son ordre, et
    // `currentGrilleIndex` pointe encore sur 0. C'est cet état — pas un store vierge —
    // que l'écran rencontre en enchaînant les grilles.
    useProspectionCaptureStore
      .getState()
      .initGrilles(
        [
          { espece: 'LMC', categorie: 'imago' },
          { espece: 'LMC', categorie: 'larve' },
        ],
        [],
        []
      );

    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: [],
    });

    await render(<CapturesScreen />);

    // Grille 1 = LMC larve — l'en-tête nomme la grille effectivement affichée.
    expect(await screen.findByText(/Larves/)).toBeVisible();
  });

  it('montre un chargement, jamais un écran vide, pendant la lecture du vocabulaire (#201)', async () => {
    let libere: (v: { code: string; libelle: string }[]) => void = () => {};
    jest
      .mocked(referentielDb.listStadesGrille)
      .mockImplementation(() => new Promise((resolve) => (libere = resolve)));

    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: [],
    });

    await render(<CapturesScreen />);

    // L'attente est visible, et un retour reste offert — pas une page morte.
    expect(await screen.findByText('Chargement de la grille…')).toBeVisible();
    expect(screen.getByText('‹')).toBeVisible();

    await act(async () => {
      libere([{ code: 'L1', libelle: 'L1' }]);
    });

    expect(await screen.findByText(/Larves/)).toBeVisible();
  });

  it('laisse le total vide sur une grille encore vierge', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
        grilles_completees: null,
        capture_started_at: '2026-08-25T08:00:00.000Z',
      } as any,
      captures: [],
    });

    await render(<CapturesScreen />);

    expect(await screen.findByPlaceholderText('Saisir le nombre de captures')).toHaveDisplayValue('');
  });
});
