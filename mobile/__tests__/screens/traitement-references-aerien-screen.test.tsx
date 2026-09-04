/**
 * references.tsx (#traitement-cree-par-id), branche Aérien — voir
 * traitement-references-terrestre-screen.test.tsx pour le contexte complet.
 * Fichier séparé (un seul rendu) : ce module réutilise le même pattern de
 * fuite de promesse GPS/prospection entre rendus déjà rencontré côté
 * Prospection (reference.tsx / extensive-reference.tsx).
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

describe('ReferencesScreen — création Aérien (#traitement-cree-par-id)', () => {
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

  it('passe creeParId = utilisateur connecté à createDraftTraitementAerien', async () => {
    jest.mocked(traitementRepository.createDraftTraitementAerien).mockResolvedValue({
      id: 'trait-nouveau',
    } as any);

    await render(<ReferencesScreen />);
    await settle();

    fireEvent.press(screen.getByText('Aérien'));
    fireEvent.changeText(screen.getByPlaceholderText('Localité'), 'Betioky');
    await settle();

    fireEvent.press(screen.getByText('Continuer — Cibles ›'));

    await waitFor(() =>
      expect(traitementRepository.createDraftTraitementAerien).toHaveBeenCalledWith(
        expect.objectContaining({ creeParId: 'user-1' })
      )
    );
  });
});
