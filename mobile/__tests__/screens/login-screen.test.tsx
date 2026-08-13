/**
 * Test de référence pour le rendu d'écran avec `jest-expo` +
 * `@testing-library/react-native` (voir #108). Sert de patron pour les
 * tests d'écran des tickets #97, #99, #101.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';

describe('LoginScreen', () => {
  it('affiche une bannière d\'erreur en ligne quand on soumet le formulaire vide', async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Se connecter'));

    expect(screen.getByText('Veuillez remplir tous les champs')).toBeVisible();
  });
});
