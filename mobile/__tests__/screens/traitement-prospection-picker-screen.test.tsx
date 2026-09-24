/**
 * « Fiches de traitement → Consulter une fiche validée »
 * (#fiches-validees-multi-utilisateurs) — remplace le sélecteur mono-
 * utilisateur d'origine : affiche les fiches validées par N'IMPORTE QUEL
 * agent (extensive/intensive/signalement), rapatrie en local celle
 * sélectionnée avant de démarrer le traitement.
 */
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import TraitementProspectionPickerScreen from '@/app/(traitement)/prospection-picker';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as prospectionRepository from '@/lib/prospection-repository';
import { NetworkError } from '@/lib/errors';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadFichesDisponiblesPourTraitement: jest.fn(),
  assurerProspectionDisponibleLocalement: jest.fn().mockResolvedValue(undefined),
  materialiserFichesDisponibles: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/prospection-repository', () => ({
  listProspectionsDisponiblesPourTraitementLocal: jest.fn(),
  listProspectionIdsAvecTraitementLocal: jest.fn(),
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

/** Fiche de « Vérifier un signalement » (#nouvelle-fiche-validation-immediate) —
 * validée dès la création (jamais de brouillon/en attente), doit être pickable
 * au même titre qu'extensive/intensive, sans traitement spécial. */
const FICHE_VALIDATION_SIGNALEMENT = {
  id: 'presp-signalement',
  type_prospection: 'validation',
  n_fiche: null,
  n_message: 'MSG-2026-0042',
  date_prospection: '2026-09-14',
  region: 'Atsimo-Andrefana',
  district: 'Toliara II',
  commune: 'Betsinjaka',
  prospecteur_nom: 'Jean Dupont',
  validated_by_nom: 'Marie Admin',
  validated_at: '2026-09-14T00:00:00Z',
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
  jest.mocked(prospectionAccueil.materialiserFichesDisponibles).mockClear().mockResolvedValue(undefined);
  jest.mocked(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).mockReset();
  jest.mocked(prospectionRepository.listProspectionIdsAvecTraitementLocal).mockReset().mockResolvedValue(new Set());
  useAuthStore.setState({ user: { id: 'moi' } as any, token: 'token-1' } as any);
});

/**
 * #liste-nouveau-traitement-exclut-deja-traitees : le serveur n'exclut une fiche qu'une fois son
 * traitement synchronisé. Une fiche pour laquelle un traitement existe déjà sur cet appareil
 * (brouillon, enregistré hors ligne…) doit disparaître de la liste tout de suite, pour ne pas
 * être confondue avec une fiche encore à traiter.
 */
describe('TraitementProspectionPickerScreen — fiches déjà traitées sur cet appareil', () => {
  it('retire de la liste la fiche pour laquelle un traitement existe déjà, et garde les autres', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      FICHE_PROPRE_AGENT,
      FICHE_AUTRE_AGENT,
    ]);
    jest
      .mocked(prospectionRepository.listProspectionIdsAvecTraitementLocal)
      .mockResolvedValue(new Set([FICHE_PROPRE_AGENT.id]));

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Créée par Alice Autre/)).toBeVisible();
    expect(screen.queryByText(/Créée par Jean Dupont/)).toBeNull();
  });

  it('garde toute la liste serveur si aucune fiche n’a encore de traitement local', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      FICHE_PROPRE_AGENT,
      FICHE_AUTRE_AGENT,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Créée par Jean Dupont/)).toBeVisible();
    expect(screen.getByText(/Créée par Alice Autre/)).toBeVisible();
  });

  it('n’empêche jamais l’affichage : si la lecture locale échoue, la liste serveur s’affiche telle quelle', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([FICHE_PROPRE_AGENT]);
    jest.mocked(prospectionRepository.listProspectionIdsAvecTraitementLocal).mockRejectedValue(new Error('sqlite'));

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Créée par Jean Dupont/)).toBeVisible();
  });
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

  /** #nouvelle-fiche-validation-immediate : une fiche de type `validation`
   * (« Vérifier un signalement ») est pickable comme extensive/intensive,
   * étiquetée « Signalement » — pas de filtrage ni de traitement spécial. */
  it('affiche une fiche de signalement (type validation) au même titre que les autres', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      FICHE_VALIDATION_SIGNALEMENT,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Signalement · MSG-2026-0042/)).toBeVisible();
  });
});

/**
 * #fiches-disponibles-hors-ligne : une fiche validée par un AUTRE agent, VUE
 * en ligne dans cette liste mais jamais SÉLECTIONNÉE, devenait invisible dès
 * le passage hors ligne — `assurerProspectionDisponibleLocalement` n'était
 * appelée qu'au moment du choix (`choisir()`). Toute la liste doit désormais
 * être mise en cache local dès qu'elle apparaît en ligne.
 */
describe('TraitementProspectionPickerScreen — mise en cache hors ligne de toute la liste', () => {
  it('matérialise localement toutes les fiches reçues en ligne, pas seulement celle choisie', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      FICHE_PROPRE_AGENT,
      FICHE_AUTRE_AGENT,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    await waitFor(() =>
      expect(prospectionAccueil.materialiserFichesDisponibles).toHaveBeenCalledWith([
        FICHE_PROPRE_AGENT,
        FICHE_AUTRE_AGENT,
      ])
    );
  });

  it('ne matérialise rien en repli hors ligne (liste déjà locale)', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockRejectedValue(
      new NetworkError('Connexion au serveur impossible pour le moment.')
    );
    jest.mocked(prospectionRepository.listProspectionsDisponiblesPourTraitementLocal).mockResolvedValue([]);

    await render(<TraitementProspectionPickerScreen />);

    await waitFor(() => expect(screen.getByText(/Hors ligne/)).toBeVisible());
    expect(prospectionAccueil.materialiserFichesDisponibles).not.toHaveBeenCalled();
  });
});

/**
 * #nouvelle-fiche-validation-immediate : une fiche fraîchement créée et
 * synchronisée (typiquement un signalement vérifié) doit apparaître sans
 * attendre un redémarrage de l'app — l'écran doit redemander la liste à
 * chaque prise de focus, pas seulement au montage initial (cf. useFocusEffect,
 * même mécanisme que (app)/index.tsx, sync.tsx, prospection.tsx, fiches.tsx).
 */
describe('TraitementProspectionPickerScreen — rafraîchissement au focus', () => {
  it('redemande la liste au serveur à chaque reprise de focus de l’écran', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([]);

    const { rerender } = await render(<TraitementProspectionPickerScreen />);
    expect(await screen.findByText(/Aucune fiche validée disponible/)).toBeVisible();

    // La fiche de signalement vient d'être créée et synchronisée ailleurs dans
    // l'app pendant que cet écran restait monté plus bas dans la pile — seule
    // une reprise de focus (pas un remontage) doit suffire à la faire apparaître.
    jest
      .mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement)
      .mockResolvedValue([FICHE_VALIDATION_SIGNALEMENT]);
    await act(async () => {
      rerender(<TraitementProspectionPickerScreen />);
    });

    expect(await screen.findByText(/Signalement · MSG-2026-0042/)).toBeVisible();
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

/**
 * Régression : une fiche Extensive validée dont region/district/commune sont
 * vides (ces champs n'étaient jamais persistés côté Extensif avant le
 * correctif #brouillon-gps-persistance-immediate) affichait « localisation
 * non renseignée » alors que la localité était bien connue via
 * `station_libre` (texte libre saisi/auto-détecté à la création de la
 * fiche). L'écran doit s'y replier plutôt que de prétendre l'information
 * absente.
 */
describe('TraitementProspectionPickerScreen — repli sur station_libre', () => {
  it("affiche station_libre quand region/district/commune sont vides", async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([
      {
        id: 'presp-sans-region',
        type_prospection: 'extensive',
        n_fiche: 'F-300',
        n_message: null,
        date_prospection: '2026-09-10',
        region: null,
        district: null,
        commune: null,
        station_libre: 'Andasibe (bord de route)',
        prospecteur_nom: 'Jean Dupont',
        validated_by_nom: 'Marie Admin',
        validated_at: '2026-09-11T00:00:00Z',
      } as any,
    ]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Andasibe \(bord de route\)/)).toBeVisible();
    expect(screen.queryByText(/localisation non renseignée/)).toBeNull();
  });
});

describe('TraitementProspectionPickerScreen — aucune fiche disponible', () => {
  it('affiche un état vide explicite sans planter', async () => {
    jest.mocked(prospectionAccueil.loadFichesDisponiblesPourTraitement).mockResolvedValue([]);

    await render(<TraitementProspectionPickerScreen />);

    expect(await screen.findByText(/Aucune fiche validée disponible/)).toBeVisible();
  });
});
