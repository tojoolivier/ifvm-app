/**
 * references.tsx (#traitement-cree-par-id) : la création d'une fiche de
 * traitement doit fixer `creeParId` à l'utilisateur connecté, même pattern
 * que `prospecteurId: user!.id` côté Prospection (extensive-mode-chooser.tsx,
 * type-chooser.tsx) — sans quoi « Mes fiches » ne retrouve jamais la fiche
 * pour un compte absent du référentiel de rôles chef_equipe/chef_de_base.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({
    params: { prospectionId: 'prospection-1' },
  })
);

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn().mockResolvedValue(null),
  createDraftTraitementAerien: jest.fn(),
  createDraftTraitementTerrestre: jest.fn(),
  updateTraitementReference: jest.fn().mockResolvedValue(undefined),
  saveCible: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn(),
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/traitement-cible', () => ({
  construireCible: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn(),
  reverseGeocode: jest.fn(),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const UTILISATEUR_CONNECTE = { id: 'user-1', prenom: 'Jean', nom: 'Rakoto' } as any;

describe('ReferencesScreen — création (#traitement-cree-par-id)', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(null);
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prospection-1',
      statut: 'validee',
      updated_at: '2026-08-01T00:00:00Z',
      date_prospection: '2026-08-01',
    } as any);
    useAuthStore.setState({ user: UTILISATEUR_CONNECTE, token: 'token-1' } as any);
  });

  it('passe creeParId = utilisateur connecté à createDraftTraitementTerrestre', async () => {
    jest.mocked(traitementRepository.createDraftTraitementTerrestre).mockResolvedValue({
      id: 'trait-nouveau',
    } as any);

    await render(<ReferencesScreen />);
    await settle();

    fireEvent.press(screen.getByText('Terrestre'));
    fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Betioky');
    await settle();

    fireEvent.press(screen.getByText('Continuer — Cibles ›'));

    await waitFor(() =>
      expect(traitementRepository.createDraftTraitementTerrestre).toHaveBeenCalledWith(
        expect.objectContaining({ creeParId: 'user-1' })
      )
    );
  });
});
