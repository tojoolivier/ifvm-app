/**
 * « Prospections à revalider » (#revalidation-prospection) — liste les fiches
 * extensive/validation périmées (validées depuis plus de 5 jours sans
 * traitement), amorce une NOUVELLE fiche chaînée (`demarrerRevalidation`)
 * pré-remplie, et navigue vers le wizard extensif existant sans le modifier.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RevalidationListeScreen from '@/app/(prospection)/revalidation-liste';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as prospectionRepository from '@/lib/prospection-repository';
import { NetworkError } from '@/lib/errors';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadFichesARevalider: jest.fn(),
  assurerProspectionDisponibleLocalement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listProspectionsARevaliderLocal: jest.fn(),
  demarrerRevalidation: jest.fn(),
  // Consommées par le vrai `prospection-wizard-store.ts` (non mocké) via
  // `hydrateFromDraft` — indispensable pour que l'écran suivant
  // (extensive-reference.tsx) trouve le brouillon cloné pré-rempli.
  getProspection: jest.fn(),
  listAllProspectionCaptures: jest.fn(),
}));

const FICHE_PERIMEE = {
  id: 'presp-perimee',
  type_prospection: 'extensive',
  n_fiche: 'F-100',
  n_message: null,
  region: 'Atsimo-Andrefana',
  district: 'Toliara II',
  commune: 'Betsinjaka',
  validated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
} as any;

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  jest.mocked(prospectionAccueil.loadFichesARevalider).mockReset();
  jest.mocked(prospectionAccueil.assurerProspectionDisponibleLocalement).mockClear().mockResolvedValue(undefined);
  jest.mocked(prospectionRepository.listProspectionsARevaliderLocal).mockReset();
  jest.mocked(prospectionRepository.demarrerRevalidation).mockReset().mockResolvedValue({ draftId: 'draft-1' });
  jest
    .mocked(prospectionRepository.getProspection)
    .mockReset()
    .mockResolvedValue({ id: 'draft-1', n_fiche: 'F-100-CLONE' } as any);
  jest.mocked(prospectionRepository.listAllProspectionCaptures).mockReset().mockResolvedValue([]);
  useAuthStore.setState({ user: { id: 'moi' } as any, token: 'token-1' } as any);
});

describe('RevalidationListeScreen — affichage', () => {
  it('affiche les fiches périmées avec leur retard en jours', async () => {
    jest.mocked(prospectionAccueil.loadFichesARevalider).mockResolvedValue([FICHE_PERIMEE]);

    await render(<RevalidationListeScreen />);

    expect(await screen.findByText(/F-100/)).toBeVisible();
    expect(screen.getByText(/Validée il y a 7 jours/)).toBeVisible();
    // Renommé « Revalidation » (ex. « Prospections à revalider »).
    expect(screen.getByText('Revalidation')).toBeVisible();
    expect(screen.queryByText('Prospections à revalider')).toBeNull();
  });

  it('affiche un état vide explicite sans planter', async () => {
    jest.mocked(prospectionAccueil.loadFichesARevalider).mockResolvedValue([]);

    await render(<RevalidationListeScreen />);

    expect(await screen.findByText(/Aucune revalidation en attente/)).toBeVisible();
  });
});

describe('RevalidationListeScreen — sélection (démarre la revalidation)', () => {
  it("rapatrie la fiche, clone un nouveau brouillon chaîné, puis navigue vers le wizard extensif avec le nouveau draftId", async () => {
    jest.mocked(prospectionAccueil.loadFichesARevalider).mockResolvedValue([FICHE_PERIMEE]);

    await render(<RevalidationListeScreen />);
    fireEvent.press(await screen.findByText(/F-100/));

    await waitFor(() =>
      expect(prospectionAccueil.assurerProspectionDisponibleLocalement).toHaveBeenCalledWith(FICHE_PERIMEE)
    );
    await waitFor(() => expect(prospectionRepository.demarrerRevalidation).toHaveBeenCalledWith('presp-perimee'));
    // Indispensable : extensive-reference.tsx (écran suivant) lit
    // useProspectionWizardStore().draft, jamais directement la base — sans
    // cette hydratation avant la navigation, l'écran s'ouvrirait vide malgré
    // le brouillon déjà cloné en local (bug corrigé ici).
    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalledWith('draft-1'));
    await waitFor(() => expect(prospectionRepository.listAllProspectionCaptures).toHaveBeenCalledWith('draft-1'));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(prospection)/extensive-reference',
          params: { draftId: 'draft-1' },
        })
      )
    );
  });
});

describe('RevalidationListeScreen — hors ligne', () => {
  it('bascule sur le cache local avec un bandeau explicite quand le serveur est injoignable', async () => {
    jest
      .mocked(prospectionAccueil.loadFichesARevalider)
      .mockRejectedValue(new NetworkError('Connexion au serveur impossible pour le moment.'));
    jest.mocked(prospectionRepository.listProspectionsARevaliderLocal).mockResolvedValue([FICHE_PERIMEE]);

    await render(<RevalidationListeScreen />);

    expect(await screen.findByText(/F-100/)).toBeVisible();
    expect(screen.getByText(/Hors ligne/)).toBeVisible();
  });

  it("ne rapatrie pas la fiche (déjà locale) en sélectionnant depuis le repli hors ligne", async () => {
    jest
      .mocked(prospectionAccueil.loadFichesARevalider)
      .mockRejectedValue(new NetworkError('Connexion au serveur impossible pour le moment.'));
    jest.mocked(prospectionRepository.listProspectionsARevaliderLocal).mockResolvedValue([FICHE_PERIMEE]);

    await render(<RevalidationListeScreen />);
    fireEvent.press(await screen.findByText(/F-100/));

    await waitFor(() => expect(prospectionRepository.demarrerRevalidation).toHaveBeenCalledWith('presp-perimee'));
    expect(prospectionAccueil.assurerProspectionDisponibleLocalement).not.toHaveBeenCalled();
  });
});
