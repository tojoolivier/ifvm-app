/**
 * « Évaluation du risque » (4 axes : Ressources en eau / Sol / Faune non cible /
 * Abeilles) — réduit à un simple Oui/Non par axe (retour arrière, était noté
 * FAIBLE/MOYEN/ÉLEVÉ). À ne pas confondre avec « Évaluation du risque pour la
 * population » (liste dynamique habitat/distance/sensibilisation, migration
 * backend 0055, couverte par traitement-impacts-evaluation-risque-population.test.tsx) —
 * section distincte, inchangée.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ImpactsScreen from '@/app/(traitement)/impacts';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementImpacts: jest.fn().mockResolvedValue({}),
}));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'TERRESTRE' as const,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

const DRAFT_BASE = {
  id: 'trait-1',
  type_traitement: 'TERRESTRE',
  evaluation_risque: null,
  comportement_non_cibles: null,
  mortalite_familles: null,
  empoisonnement: false,
  empoisonnement_type: null,
  empoisonnement_mode: null,
  empoisonnement_autre: null,
  comportement_anormal: false,
  mortalite: false,
  observations: null,
};

/** Laisse un vrai tick s'écouler entre deux interactions — sinon le gestionnaire
 * suivant reste lié à la fermeture du rendu précédent (même prudence qu'ailleurs
 * dans ce module). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ImpactsScreen — Évaluation du risque en Oui/Non', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1' };
    jest.mocked(traitementRepository.updateTraitementImpacts).mockClear().mockResolvedValue({} as any);
    useTraitementCaptureStore.setState({ ...RESET_STATE });
  });

  it('affiche Oui/Non pour chaque axe, jamais Faible/Moyen/Élevé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(DRAFT_BASE as any);

    await render(<ImpactsScreen />);
    await screen.findByText('Évaluation du risque');

    expect(screen.getAllByText('Oui').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('Non').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('Faible')).toBeNull();
    expect(screen.queryByText('Moyen')).toBeNull();
    expect(screen.queryByText('Élevé')).toBeNull();
  });

  it('sélectionne Oui pour Sol et Non pour Abeilles, et les enregistre tels quels', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(DRAFT_BASE as any);

    await render(<ImpactsScreen />);
    await screen.findByText('Sol');

    // « Oui »/« Non » apparaissent pour Empoisonnement (index 0), puis une fois par
    // axe dans l'ordre Ressources en eau/Sol/Faune non cible/Abeilles (index 1-4),
    // puis Comportement anormal et Mortalité (index 5-6) — Sol est donc le 3e « Oui »
    // (index 2), Abeilles le 5e « Non » (index 4).
    fireEvent.press(screen.getAllByText('Oui')[2]);
    await settle();
    fireEvent.press(screen.getAllByText('Non')[4]);
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementImpacts).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ evaluation_risque: { sol: true, abeilles: false } })
      )
    );
  });

  it('restaure une évaluation déjà enregistrée (true/false)', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_BASE,
      evaluation_risque: JSON.stringify({ ressources_eau: true, faune_non_cible: false }),
    } as any);

    await render(<ImpactsScreen />);
    await screen.findByText('Ressources en eau');

    await waitFor(() =>
      expect(useTraitementCaptureStore.getState().imp.evaluationRisque).toEqual({
        ressources_eau: true,
        faune_non_cible: false,
      })
    );
  });
});
