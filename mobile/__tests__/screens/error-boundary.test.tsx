/**
 * `ErrorBoundary` — ADR-012 décision 5, issue #172.
 *
 * Trois décisions à protéger, et les deux dernières sont contre-intuitives :
 *
 * 1. **Une frontière par route**, via l'export `ErrorBoundary` que `expo-router`
 *    reconnaît (`useScreens.js:141`) — pas une boundary posée au-dessus du
 *    `<Stack>`, qui ferait disparaître l'écran *et* la navigation : l'agent se
 *    retrouvait devant un panneau sans issue, l'écran blanc sous un autre nom.
 * 2. **Le `retry` d'expo-router est ignoré.** Remonter le même arbre avec les
 *    mêmes props ne peut pas réussir si la cause persiste, et elle persiste
 *    presque toujours puisqu'elle vient de la donnée. Quelqu'un voudra
 *    « rebrancher retry » : ces tests disent pourquoi non.
 * 3. **La frontière ne signale pas à `error-store`.** Elle est déjà une surface
 *    d'affichage ; signaler ferait surgir la modale BLOQUER par-dessus l'écran
 *    de repli — un incident, deux affichages concurrents.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary, RouteErrorBoundary } from '@/components/error-boundary';
import { useErrorStore } from '@/lib/error-store';
import * as loggerModule from '@/lib/logger';

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

const retryDExpoRouter = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  useErrorStore.getState().dismissAll();
  loggerModule.resetLoggerForTests();
  mockBack.mockClear();
  mockReplace.mockClear();
  retryDExpoRouter.mockClear();
  mockPeutRevenir = true;
  // React journalise l'erreur capturée ; ce bruit n'apporte rien ici.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('RouteErrorBoundary — la frontière d’une route', () => {
  it('remplace l’écran blanc par un message qui rassure sur les données', async () => {
    await render(<RouteErrorBoundary error={new Error('rendu impossible')} retry={retryDExpoRouter} />);

    expect(screen.getByText(/n’a pas pu s’afficher/)).toBeVisible();
    expect(screen.getByText(/données saisies sont conservées/)).toBeVisible();
  });

  it('ne montre jamais le message JS brut à l’agent', async () => {
    await render(<RouteErrorBoundary error={new Error('rendu impossible')} retry={retryDExpoRouter} />);

    expect(screen.queryByText(/rendu impossible/)).toBeNull();
  });

  it('n’offre aucun « Réessayer » et ne rejoue jamais le retry d’expo-router', async () => {
    await render(<RouteErrorBoundary error={new Error('boom')} retry={retryDExpoRouter} />);

    expect(screen.queryByText('Réessayer')).toBeNull();
    fireEvent.press(screen.getByText('Revenir en arrière'));
    expect(retryDExpoRouter).not.toHaveBeenCalled();
  });

  it('revient à l’écran précédent — revenir change les props, remonter non', async () => {
    await render(<RouteErrorBoundary error={new Error('boom')} retry={retryDExpoRouter} />);

    fireEvent.press(screen.getByText('Revenir en arrière'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('se replie sur l’accueil quand il n’y a nulle part où revenir', async () => {
    mockPeutRevenir = false;

    await render(<RouteErrorBoundary error={new Error('boom')} retry={retryDExpoRouter} />);

    fireEvent.press(screen.getByText('Revenir en arrière'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  it('journalise le crash en BLOQUER, sans faire surgir la modale', async () => {
    await render(<RouteErrorBoundary error={new Error('boom')} retry={retryDExpoRouter} />);

    expect(loggerModule.lignesEnAttente()).toContainEqual(
      expect.objectContaining({ event: 'render.crash', traitement: 'BLOQUER' })
    );
    expect(useErrorStore.getState().erreurs).toHaveLength(0);
  });
});

describe('ErrorBoundary — le filet racine', () => {
  it('laisse passer ses enfants tant que rien n’explose', async () => {
    await render(
      <ErrorBoundary>
        <Text>contenu</Text>
      </ErrorBoundary>
    );

    expect(screen.getByText('contenu')).toBeVisible();
  });

  it('attrape ce qui explose au-dessus du routeur et le journalise', async () => {
    await render(
      <ErrorBoundary zone="racine">
        <Explose />
      </ErrorBoundary>
    );

    expect(screen.getByText(/n’a pas pu s’afficher/)).toBeVisible();
    expect(loggerModule.lignesEnAttente()).toContainEqual(
      expect.objectContaining({ event: 'render.crash', zone: 'racine' })
    );
  });

  it('n’offre pas de retour en arrière : à la racine, il n’y a nulle part où revenir', async () => {
    await render(
      <ErrorBoundary>
        <Explose />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Revenir en arrière')).toBeNull();
  });
});
