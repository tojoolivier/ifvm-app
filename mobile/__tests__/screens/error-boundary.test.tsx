/**
 * `ErrorBoundary` — ADR-012 décision 5, issue #172.
 *
 * Deux décisions à protéger, et la seconde est contre-intuitive :
 *
 * 1. **Une boundary par route**, la racine restant en filet. Une boundary
 *    unique à la racine faisait disparaître l'écran *et* la navigation :
 *    l'agent se retrouvait devant un panneau sans issue — l'écran blanc
 *    silencieux sous un autre nom.
 * 2. **`reset()` est remplacé par un retour en arrière.** Remonter le même
 *    arbre avec les mêmes props ne peut pas réussir si la cause persiste, et
 *    elle persiste presque toujours puisqu'elle vient de la donnée. Le bouton
 *    s'appelait « Réessayer » et n'avait structurellement aucune chance.
 *    Quelqu'un voudra « restaurer le reset » : ces tests disent pourquoi non.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary, RouteErrorBoundary } from '@/components/error-boundary';
import { useErrorStore } from '@/lib/error-store';
import { useErrorLogStore } from '@/lib/error-log-store';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockPeutRevenir = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn(), canGoBack: () => mockPeutRevenir }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));

function Explose(): never {
  throw new Error('rendu impossible');
}

beforeEach(() => {
  useErrorStore.getState().dismissAll();
  useErrorLogStore.getState().clear();
  mockBack.mockClear();
  mockReplace.mockClear();
  mockPeutRevenir = true;
  // React journalise l'erreur capturée ; ce bruit n'apporte rien ici.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('la zone saine reste rendue', () => {
  it('laisse passer ses enfants tant que rien n’explose', async () => {
    await render(
      <ErrorBoundary zone="test">
        <Text>contenu</Text>
      </ErrorBoundary>
    );

    expect(screen.getByText('contenu')).toBeVisible();
  });
});

describe('quand le rendu explose', () => {
  it('remplace l’écran blanc par un message qui rassure sur les données', async () => {
    await render(
      <ErrorBoundary zone="test">
        <Explose />
      </ErrorBoundary>
    );

    expect(screen.getByText(/n’a pas pu s’afficher/)).toBeVisible();
    expect(screen.getByText(/données saisies sont conservées/)).toBeVisible();
  });

  it('n’offre aucun bouton « Réessayer » — il ne pourrait pas réussir', async () => {
    await render(
      <ErrorBoundary zone="test">
        <Explose />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Réessayer')).toBeNull();
  });

  it('signale l’erreur au store et la journalise avec sa pile', async () => {
    await render(
      <ErrorBoundary zone="prospection">
        <Explose />
      </ErrorBoundary>
    );

    // `errorBoundary` donne BLOQUER (décision 3), quelle que soit la classe.
    expect(useErrorStore.getState().erreurs[0]).toMatchObject({ traitement: 'BLOQUER' });
    expect(useErrorLogStore.getState().entries[0]).toMatchObject({
      screen: 'prospection',
      stack: expect.stringContaining('rendu impossible'),
    });
  });

  it('ne montre jamais le message JS brut à l’agent', async () => {
    await render(
      <ErrorBoundary zone="test">
        <Explose />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/rendu impossible/)).toBeNull();
  });
});

describe('la sortie est un retour en arrière, pas un remontage', () => {
  it('revient à l’écran précédent — revenir change les props, remonter non', async () => {
    await render(
      <RouteErrorBoundary zone="prospection">
        <Explose />
      </RouteErrorBoundary>
    );

    fireEvent.press(screen.getByText('Revenir en arrière'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('se replie sur l’accueil quand il n’y a nulle part où revenir', async () => {
    mockPeutRevenir = false;

    await render(
      <RouteErrorBoundary zone="prospection">
        <Explose />
      </RouteErrorBoundary>
    );

    fireEvent.press(screen.getByText('Revenir en arrière'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });
});
