/**
 * #retour-apres-creation-fiche : après l'enregistrement d'une fiche de prospection, l'agent doit
 * atterrir sur la liste des fiches (« Prospection »), et UN SEUL « Retour » doit ramener à
 * l'accueil.
 *
 * Reproduit avec le VRAI routeur d'expo-router (`renderRouter`) la structure de l'appli : deux
 * groupes de routes frères à la racine — `(app)` (index, prospection) et `(prospection)`
 * (type-chooser, …, recap). Un `router.replace('/(app)/prospection')` depuis le groupe
 * `(prospection)` remplaçait le groupe entier par une SECONDE instance de `(app)`, laissant la
 * première (avec sa liste) dessous : d'où deux clics sur « Retour ».
 *
 * `renderRouter` active les faux timers Jest et son rendu est asynchrone (RNTL 14) : chaque
 * navigation est donc jouée dans un `act` asynchrone qui avance l'horloge.
 */
import { act } from '@testing-library/react-native';
import { Stack, router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

const arborescence = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(app)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(app)/index': () => <Text>ACCUEIL</Text>,
  '(app)/prospection': () => <Text>LISTE</Text>,
  '(prospection)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(prospection)/type-chooser': () => <Text>TYPE</Text>,
  '(prospection)/reference': () => <Text>REFERENCE</Text>,
  '(prospection)/recap': () => <Text>RECAP</Text>,
};

async function naviguer(action: () => void) {
  await act(async () => {
    action();
    await jest.advanceTimersByTimeAsync(50);
  });
}

/** Accueil → Prospection (liste) → Nouvelle fiche (type-chooser → reference → recap). */
async function jusquAuRecap() {
  const vue = renderRouter(arborescence, { initialUrl: '/' });
  await vue;
  expect(vue.getPathname()).toBe('/');
  await naviguer(() => router.push('/(app)/prospection' as any));
  await naviguer(() => router.push('/(prospection)/type-chooser' as any));
  await naviguer(() => router.replace('/(prospection)/reference' as any));
  await naviguer(() => router.push('/(prospection)/recap' as any));
  expect(vue.getPathname()).toBe('/recap');
  // Objet neutre : retourner `vue` (un thenable) depuis une fonction async le résoudrait et
  // ferait perdre ses méthodes.
  return { pathname: () => vue.getPathname(), params: () => vue.getSearchParams() };
}

describe('fin de création d’une fiche — pile de navigation', () => {
  it('replace (ancien comportement) : il faut DEUX « Retour » pour revenir à l’accueil', async () => {
    const vue = await jusquAuRecap();

    await naviguer(() => router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } }));
    expect(vue.pathname()).toBe('/prospection');

    await naviguer(() => router.back());
    expect(vue.pathname()).toBe('/prospection'); // encore une liste, pas l'accueil
    await naviguer(() => router.back());
    expect(vue.pathname()).toBe('/');
  });

  it('dismissTo : la liste s’affiche (avec justSaved), puis UN seul « Retour » ramène à l’accueil', async () => {
    const vue = await jusquAuRecap();

    await naviguer(() => router.dismissTo({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } }));
    expect(vue.pathname()).toBe('/prospection');
    expect(vue.params()).toEqual({ justSaved: '1' });

    await naviguer(() => router.back());
    expect(vue.pathname()).toBe('/');
  });
});
