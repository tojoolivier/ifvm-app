/**
 * L'affichage des erreurs — ADR-012 décision 5, issue #172.
 *
 * Ces tests protègent des **décisions**, pas seulement du code :
 *
 * - la bannière montre la **plus grave**, pas la dernière arrivée, et ne perd
 *   jamais les autres (« +N autres › ») ;
 * - un « Réessayer » sans reprise à rejouer **n'est pas rendu** — c'est le même
 *   défaut que l'ancien `reset()` de l'`ErrorBoundary` ;
 * - un `BLOQUER` ne passe pas par la bannière, et un `INFORMER` pas par la
 *   modale : sinon les deux niveaux d'insistance deviennent indiscernables ;
 * - l'état vide **dit pourquoi il est vide** quand il l'est à cause d'une
 *   erreur — c'est toute la raison d'être du composant.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBanner } from '@/components/error-banner';
import { ModaleBloquante } from '@/components/erreurs/modale-bloquante';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { useErrorStore } from '@/lib/error-store';
import { useAuthStore } from '@/lib/auth-store';
import { AuthError, LocalReadError, NetworkError, PreconditionError } from '@/lib/errors';

// Préfixe `mock` obligatoire : `jest.mock` est hissé avant les const du module.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));

beforeEach(() => {
  useErrorStore.getState().dismissAll();
  // Le journal vit sous `(app)`, derrière le garde d'authentification : sans
  // session, les chemins qui y mènent sont volontairement absents.
  useAuthStore.setState({ isAuthenticated: true });
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe('ErrorBanner — la surface INFORMER', () => {
  it('n’affiche rien quand aucune erreur n’est ouverte', async () => {
    await render(<ErrorBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('montre le message de la classe, jamais le message brut', async () => {
    useErrorStore.getState().signaler(new NetworkError('Network request failed'), 'useAsyncAction');
    await render(<ErrorBanner />);

    expect(screen.getByText(/Connexion au serveur impossible/)).toBeVisible();
    expect(screen.queryByText(/Network request failed/)).toBeNull();
  });

  it('dit combien de fois la même erreur est survenue', async () => {
    for (let i = 0; i < 5; i += 1) {
      useErrorStore.getState().signaler(new NetworkError('boom'), 'useAsyncAction');
    }
    await render(<ErrorBanner />);

    expect(screen.getByText('5 fois')).toBeVisible();
  });

  it('compte les autres classes et mène au journal — rien ne disparaît', async () => {
    useErrorStore.getState().signaler(new NetworkError('a'), 'useAsyncAction');
    useErrorStore.getState().signaler(new LocalReadError('b'), 'useAsyncAction');
    useErrorStore.getState().signaler(new PreconditionError('c'), 'useAsyncAction');
    await render(<ErrorBanner />);

    fireEvent.press(screen.getByText('+2 autres ›'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/debug-logs');
  });

  it('laisse les BLOQUER à la modale', async () => {
    useErrorStore.getState().signaler(new AuthError('401'), 'useAsyncAction');
    await render(<ErrorBanner />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('propose l’action de la classe, pas un « Réessayer » universel', async () => {
    useErrorStore.getState().signaler(new LocalReadError('no such column'), 'useAsyncAction');
    await render(<ErrorBanner />);

    expect(screen.getByText('Signaler au support')).toBeVisible();
    expect(screen.queryByText('Réessayer')).toBeNull();
  });

  it('ne rend pas « Réessayer » quand aucune reprise n’a été fournie', async () => {
    useErrorStore.getState().signaler(new NetworkError('boom'), 'useAsyncAction');
    await render(<ErrorBanner />);

    expect(screen.queryByText('Réessayer')).toBeNull();
  });

  it('rejoue la reprise fournie par la frontière', async () => {
    const retry = jest.fn();
    useErrorStore.getState().signaler(new NetworkError('boom'), 'useAsyncAction', retry);
    await render(<ErrorBanner />);

    fireEvent.press(screen.getByText('Réessayer'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('fermer une classe laisse les autres visibles', async () => {
    useErrorStore.getState().signaler(new NetworkError('a'), 'useAsyncAction');
    useErrorStore.getState().signaler(new LocalReadError('b'), 'useAsyncAction');
    await render(<ErrorBanner />);

    fireEvent.press(screen.getByLabelText('Fermer l’alerte'));
    expect(useErrorStore.getState().erreurs).toHaveLength(1);
  });
});

describe('ModaleBloquante — la surface BLOQUER', () => {
  it('reste fermée tant qu’aucune erreur ne bloque', async () => {
    useErrorStore.getState().signaler(new NetworkError('boom'), 'useAsyncAction');
    await render(<ModaleBloquante />);

    expect(screen.queryByText('Action impossible')).toBeNull();
  });

  it('s’ouvre sur une AuthError et propose la reconnexion', async () => {
    useErrorStore.getState().signaler(new AuthError('401'), 'useAsyncAction');
    await render(<ModaleBloquante />);

    expect(screen.getByText('Action impossible')).toBeVisible();
    expect(screen.getByText('Se reconnecter')).toBeVisible();
  });

  it('laisse une sortie — une modale sans issue rendrait l’app inutilisable', async () => {
    useErrorStore.getState().signaler(new AuthError('401'), 'useAsyncAction');
    await render(<ModaleBloquante />);

    // Le libellé est « Fermer » et non « Continuer quand même » : sur un
    // `LocalWriteError`, inviter à continuer contredirait le message lui-même.
    fireEvent.press(screen.getByText('Fermer'));
    expect(useErrorStore.getState().erreurs).toHaveLength(0);
  });
});

describe('hors session, aucun chemin vers le journal n’est proposé', () => {
  it('cache « +N autres › » et « Signaler au support » — ils se feraient renvoyer', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    useErrorStore.getState().signaler(new LocalReadError('a'), 'useAsyncAction');
    useErrorStore.getState().signaler(new PreconditionError('b'), 'useAsyncAction');
    await render(<ErrorBanner />);

    expect(screen.queryByText('Signaler au support')).toBeNull();
    expect(screen.queryByText(/autres ›/)).toBeNull();
  });
});

describe('EtatVide — l’erreur s’affiche là où la donnée manque', () => {
  it('sans erreur, c’est un vide légitime et il le dit', async () => {
    await render(<EtatVide titreVide="Aucune fiche" sousTitreVide="Commencez une prospection." />);

    expect(screen.getByText('Aucune fiche')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avec erreur, il ne dit surtout PAS « aucune fiche »', async () => {
    await render(<EtatVide erreur={new LocalReadError('no such column: phase')} titreVide="Aucune fiche" />);

    expect(screen.queryByText('Aucune fiche')).toBeNull();
    expect(screen.getByText(/n’ont pas pu être relues/)).toBeVisible();
  });

  // #176 : « Signaler au support » est l'**entrée chaude** et mène désormais au
  // parcours de signalement, pas au journal brut — l'agent n'a rien à faire
  // d'une liste de lignes qu'il ne peut ni lire ni envoyer.
  it('porte l’action de la classe jusque dans la zone', async () => {
    await render(<EtatVide erreur={new LocalReadError('boom')} titreVide="Aucune fiche" />);

    await fireEvent.press(screen.getByText('Signaler au support'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/signalement');
  });

  it('n’offre pas « Réessayer » quand l’écran ne sait pas rejouer la lecture', async () => {
    await render(<EtatVide erreur={new NetworkError('boom')} titreVide="Aucune fiche" />);

    expect(screen.queryByText('Réessayer')).toBeNull();
  });

  it('offre « Réessayer » dès que l’écran fournit la reprise', async () => {
    const relire = jest.fn();
    await render(
      <EtatVide erreur={new NetworkError('boom')} titreVide="Aucune fiche" onReessayer={relire} />
    );

    fireEvent.press(screen.getByText('Réessayer'));
    expect(relire).toHaveBeenCalledTimes(1);
  });
});
