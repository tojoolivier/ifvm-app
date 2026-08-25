/**
 * L'écran de signalement — ADR-012 décision 7, issue #176.
 *
 * Ces tests protègent le parcours, pas le rendu : ils vérifient qu'il existe
 * **deux sorties** et que la sortie rapide ne demande rien. Rendre le
 * commentaire obligatoire — la tentation évidente, « on aura plus de contexte »
 * — convertirait l'agent pressé en agent qui ne signale pas.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignalementScreen from '@/app/(app)/signalement';

jest.mock('expo-router', () => require('../test-utils/mock-expo-router').expoRouterMock());

jest.mock('@/lib/signalement', () => ({ envoyerSignalement: jest.fn() }));
jest.mock('@/lib/signalement-natif', () => ({ depsSignalement: () => ({ marqueur: 'deps' }) }));

const { envoyerSignalement } = jest.requireMock('@/lib/signalement');

beforeEach(() => {
  jest.clearAllMocks();
  envoyerSignalement.mockResolvedValue(undefined);
});

describe('les deux sorties', () => {
  it('envoie le commentaire saisi', async () => {
    await render(<SignalementScreen />);

    await fireEvent.changeText(
      screen.getByLabelText('Commentaire (facultatif)'),
      'l’écran reste blanc'
    );
    await fireEvent.press(screen.getByText('Envoyer au support'));

    await waitFor(() =>
      expect(envoyerSignalement).toHaveBeenCalledWith(
        { commentaire: 'l’écran reste blanc' },
        { marqueur: 'deps' }
      )
    );
  });

  it('« Envoyer sans commentaire » part en un geste, même si le champ est rempli', async () => {
    await render(<SignalementScreen />);

    await fireEvent.changeText(screen.getByLabelText('Commentaire (facultatif)'), 'texte abandonné');
    await fireEvent.press(screen.getByText('Envoyer sans commentaire'));

    await waitFor(() =>
      expect(envoyerSignalement).toHaveBeenCalledWith({ commentaire: null }, { marqueur: 'deps' })
    );
  });

  it('n’exige aucun commentaire pour le bouton principal', async () => {
    await render(<SignalementScreen />);

    await fireEvent.press(screen.getByText('Envoyer au support'));

    await waitFor(() => expect(envoyerSignalement).toHaveBeenCalled());
  });
});

describe('ce que l’écran annonce', () => {
  it('dit ce qui part, sinon l’agent n’envoie pas', async () => {
    await render(<SignalementScreen />);

    expect(screen.getByText('Ce qui est envoyé')).toBeTruthy();
    expect(screen.getByText(/depuis son dernier démarrage/i)).toBeTruthy();
    expect(screen.getByText(/modèle de votre téléphone/i)).toBeTruthy();
    // Information rassurante, pas un filtre : l'expurgation est à l'écriture.
    expect(screen.getByText(/aucun mot de passe/i)).toBeTruthy();
  });
});

describe('l’échec ne passe pas en silence', () => {
  it('remonte l’erreur à la couche d’affichage via useAsyncAction', async () => {
    const { useErrorStore } = jest.requireActual('@/lib/error-store');
    useErrorStore.setState({ erreurs: [] });
    envoyerSignalement.mockRejectedValue(new Error('ENOSPC'));

    await render(<SignalementScreen />);
    await fireEvent.press(screen.getByText('Envoyer au support'));

    await waitFor(() => expect(useErrorStore.getState().erreurs).toHaveLength(1));
  });
});
