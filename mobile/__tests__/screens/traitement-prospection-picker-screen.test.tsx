/**
 * « Fiches de traitement → Consulter une fiche validée »
 * (#fiches-validees-multi-utilisateurs) — remplace le sélecteur mono-
 * utilisateur d'origine : affiche les fiches validées par N'IMPORTE QUEL
 * agent (extensive/intensive/signalement), rapatrie en local celle
 * sélectionnée avant de démarrer le traitement.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementProspectionPickerScreen from '@/app/(traitement)/prospection-picker';
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
  loadFichesDisponiblesPourTraitement: jest.fn(),
  assurerProspectionDisponibleLocalement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listProspectionsDisponiblesPourTraitementLocal: jest.fn(),
}));

const FICHE_PROPRE_AGENT = {
  id: 'presp-moi',
  type_prospection: 'extensive',
  n_fiche: 'F-100',
  n_message: null,
  date_prospection: '2026-08-01',
  region: 'Atsimo-Andrefana',
  district: 'Toliara II',
  commune: 'Betsinjaka',
  prospecteur_nom: 'Jean Dupont',
  validated_by_nom: 'Marie Admin',
  validated_at: '2026-08-03T00:00:00Z',
} as any;

const FICHE_AUTRE_AGENT = {
  id: 'presp-autre-agent',
  type_prospection: 'intensive',
  n_fiche: null,
  n_message: null,
  date_prospection: '2026-08-05',
  region: 'Menabe',
  district: 'Morondava',
  commune: 'Belo',
  prospecteur_nom: 'Alice Autre',
  validated_by_nom: 'Marie Admin',
  validated_at: '2026-08-06T00:00:00Z',
} as any;

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockReset();
  jest.mocked(prospectionAccueil.assurerProspectionDisponibleLocalement).mockClear().mockResolvedValue(undefined);
  jest.mocked(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).mockReset();
  useAuthStore.setState({ user: { id: 'moi' } as any, token: 'token-1' } as any);
});

describe('TraitementProspectionPickerScreen — visibilité multi-utilisateurs', () => {
  it('affiche les fiches validées de tous les agents (pas seulement celles de l’agent connecté)', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      FICHE_PROPRE_AGENT,
      FICHE_AUTRE_AGENT,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Créée par Jean Dupont/)).toBeVisible();
    expect(await screen.findByText(/Créée par Alice Autre/)).toBeVisible();
    expect(screen.getAllByText(/Validée par Marie Admin/).length).toBe(2);
  });

  it('interroge le serveur avec le jeton de l’agent connecté, sans filtrer par utilisateur', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([]);

    await render(<TraitementProspectionPickerScreen />);

    await waitFor(() =>
      expect(prospectionAccueil.loadFichesDisponiblesPourTraitement).toHaveBeenCalledWith('token-1')
    );
  });
});

describe('TraitementProspectionPickerScreen — sélection', () => {
  it('rapatrie la fiche localement puis navigue vers Références (fiche d’un autre agent)', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([FICHE_AUTRE_AGENT]);

    await render(<TraitementProspectionPickerScreen />);
    fireEvent.press(await screen.findByText(/Créée par Alice Autre/));

    await waitFor(() =>
      expect(prospectionAccueil.assurerProspectionDisponibleLocalement).toHaveBeenCalledWith(FICHE_AUTRE_AGENT)
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(traitement)/references',
          params: expect.objectContaining({ prospectionId: 'presp-autre-agent' }),
        })
      )
    );
  });
});

describe('TraitementProspectionPickerScreen — hors ligne', () => {
  it("bascule sur le cache local (surface infestée connue) quand le serveur est injoignable, avec un bandeau explicite", async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockRejectedValue(
      new NetworkError('Connexion au serveur impossible pour le moment.')
    );
    jest.mocked(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).mockResolvedValue([
      {
        id: 'presp-locale',
        type_prospection: 'extensive',
        n_fiche: 'F-200',
        n_message: null,
        date_prospection: '2026-09-01',
        region: 'Atsimo-Andrefana',
        district: 'Betioky',
        commune: 'Ambatry',
      } as any,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/F-200/)).toBeVisible();
    expect(screen.getByText(/Hors ligne/)).toBeVisible();
    // Pas de « Créée par »/« Validée par » : ces champs n'existent pas côté
    // cache local (dénormalisés serveur uniquement) — pas de valeur inventée.
    expect(screen.getByText('Créée par —')).toBeVisible();
  });

  it("ne rapatrie pas la fiche (déjà locale) en sélectionnant depuis le repli hors ligne", async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockRejectedValue(
      new NetworkError('Connexion au serveur impossible pour le moment.')
    );
    jest.mocked(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).mockResolvedValue([
      {
        id: 'presp-locale',
        type_prospection: 'extensive',
        n_fiche: 'F-200',
        n_message: null,
        date_prospection: '2026-09-01',
        region: 'Atsimo-Andrefana',
        district: 'Betioky',
        commune: 'Ambatry',
      } as any,
    ]);

    await render(<TraitementProspectionPickerScreen />);
    fireEvent.press(await screen.findByText(/F-200/));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(traitement)/references',
          params: expect.objectContaining({ prospectionId: 'presp-locale' }),
        })
      )
    );
    expect(prospectionAccueil.assurerProspectionDisponibleLocalement).not.toHaveBeenCalled();
  });

  it("reste bloquant (pas de repli) sur une erreur qui n'est pas un problème réseau", async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockRejectedValue(
      new Error('boom')
    );

    await render(<TraitementProspectionPickerScreen />);

    await waitFor(() =>
      expect(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).not.toHaveBeenCalled()
    );
    expect(screen.queryByText(/Hors ligne/)).toBeNull();
  });
});

describe('TraitementProspectionPickerScreen — aucune fiche disponible', () => {
  it('affiche un état vide explicite sans planter', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Aucune fiche validée disponible/)).toBeVisible();
  });
});
