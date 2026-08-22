# Filet global des rejets de promesse en React Native 0.85 / Hermes (issue #160)

**Résumé exécutif** : l'hypothèse de départ est **confirmée** — la branche `global.addEventListener('unhandledrejection', …)` de `mobile/src/lib/global-error-handler.ts` est **morte en permanence** : ni React Native 0.85.3, ni Expo 56, ni Hermes ne définissent `addEventListener` sur `global`. Mais la recherche remonte **trois nuances plus graves que l'hypothèse initiale** :

1. Le mécanisme « correct » suggéré dans le ticket (`require('promise/setimmediate/rejection-tracking').enable(...)`) est lui aussi **inopérant sous Hermes** — il patche une implémentation `Promise` en JS que l'app n'utilise pas. La bonne API est `global.HermesInternal.enablePromiseRejectionTracker(...)`.
2. Le tracker de rejets de RN comme celui d'Expo sont **tous les deux sous `if (__DEV__)`**. En build release, **aucun** tracker n'est actif : un rejet non géré est purement et simplement perdu, sans console.error, sans LogBox, sans remontée native.
3. Même en dev, quand le tracker est actif, il **ne passe pas par `ErrorUtils`** : il appelle directement `ExceptionsManager.handleException`. Donc le handler custom installé par l'app ne verrait jamais les rejets de promesse, **même si** `addEventListener` avait existé.

Conséquence : le filet global ne couvre **que** les exceptions synchrones non rattrapées. Les rejets de promesse n'ont **aucun** filet en release. Voir la dernière section.

Version installée vérifiée : `mobile/node_modules/react-native/package.json` → `"version": "0.85.3"`. Hermes : `mobile/node_modules/react-native/sdks/.hermesversion` → `hermes-v0.16.0`.

---

## Q1 — `global.addEventListener('unhandledrejection', …)` s'exécute-t-il en RN 0.85 / Hermes ?

**Réponse : NON. La branche est morte en permanence.** Le `typeof global.addEventListener === 'function'` est toujours `false`, le listener n'est jamais enregistré.

**Certitude : très élevée — vérifié dans le code installé.**

### Preuve 1 — RN ne définit nulle part `addEventListener` sur `global`

Recherche exhaustive dans `mobile/node_modules/react-native/Libraries/` :

```
grep -rn "unhandledrejection" .          → 0 résultat
grep -rn "global\.addEventListener" .    → 0 résultat
grep -rn "globalThis\.addEventListener"  → 0 résultat
```

### Preuve 2 — la liste exhaustive des globals installés par RN 0.85

`mobile/node_modules/react-native/src/private/setup/setUpDefaultReactNativeEnvironment.js` énumère tout ce que RN pose sur `global` au démarrage :

```js
require('../../../Libraries/Core/setUpGlobals');
require('./setUpDOM').default();
require('../../../Libraries/Core/setUpPerformance');
require('../../../Libraries/Core/polyfillPromise');
require('../../../Libraries/Core/setUpTimers');
require('../../../Libraries/Core/setUpErrorHandling');
require('../../../Libraries/Core/setUpRegeneratorRuntime');
require('../../../Libraries/Core/setUpXHR');
// ... setUpAlert, setUpNavigator, setUpBatchedBridge, setUpSegmentFetcher
```

RN 0.85 introduit bien un `setUpDOM` — c'est le point qui aurait pu invalider l'hypothèse, puisque des APIs web arrivent progressivement dans RN. Vérification faite, `mobile/node_modules/react-native/src/private/setup/setUpDOM.js` polyfille exactement : `DOMRect`, `DOMRectReadOnly`, `DOMRectList`, `HTMLCollection`, `NodeList`, `Node`, `Document`, `CharacterData`, `Text`, `Element`, `HTMLElement`. **Aucun `EventTarget`, aucun `addEventListener` sur `global`.**

### Preuve 3 — Expo non plus

Les seules occurrences de `unhandledrejection` dans les paquets Expo installés sont **web-only** :

- `mobile/node_modules/expo/src/async-require/setupHMR.ts:33` → `window.addEventListener('unhandledrejection', …)`, dans une branche gardée par `window` (bundle web / HMR).
- `mobile/node_modules/@expo/log-box/src/toast/ErrorToast.tsx:179` → même chose, code du LogBox **web**.

Sur `.native`, Expo utilise l'API Hermes (voir Q2), jamais `addEventListener`.

### Nuance importante — le typage TypeScript actuel masque le problème

`mobile/src/lib/global-error-handler.ts:6-9` déclare la propriété **à la main** :

```ts
declare const global: typeof globalThis & {
  ErrorUtils?: RNErrorUtils;
  addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void;
};
```

C'est cette déclaration optionnelle qui fait passer le code au typecheck : le compilateur croit l'API plausible, le `typeof … === 'function'` fait échouer silencieusement à l'exécution. Le code est **syntaxiquement correct et sémantiquement mort** — exactement le profil d'erreur silencieuse que la carte #150 traque.

---

## Q2 — Quel est le mécanisme correct en RN pour intercepter un rejet non géré ?

**Réponse : `global.HermesInternal.enablePromiseRejectionTracker({ allRejections, onUnhandled, onHandled })` — et uniquement celui-là sous Hermes.**

**Certitude : très élevée — vérifié dans le code installé (RN et Expo utilisent tous les deux cette API).**

### `promise/setimmediate/rejection-tracking` : piste à écarter sous Hermes

Le ticket proposait `require('promise/setimmediate/rejection-tracking').enable(...)`. **Cette piste ne marche pas dans cette app**, et c'est le point qui nuance le plus l'énoncé de départ.

`mobile/node_modules/promise/setimmediate/rejection-tracking.js` (paquet `promise@8.3.0`) fonctionne en patchant deux hooks internes de l'implémentation JS de `promise` :

```js
var Promise = require('./core');
// ...
function enable(options) {
  // ...
  Promise._B = function (promise) { /* onHandled */ };
  Promise._C = function (promise, err) { /* onUnhandled, via setTimeout */ };
}
```

`Promise._B` / `Promise._C` sont des propriétés de la classe `Promise` du paquet npm `promise`. Or `mobile/node_modules/react-native/Libraries/Core/polyfillPromise.js` montre que sous Hermes **cette implémentation n'est jamais installée** :

```js
// If global.Promise is provided by Hermes, we are confident that it can provide
// all the methods needed by React Native, so we can directly use it.
if (global?.HermesInternal?.hasPromise?.()) {
  const HermesPromise = global.Promise;
  if (__DEV__) {
    global.HermesInternal?.enablePromiseRejectionTracker?.(
      require('../promiseRejectionTrackingOptions').default,
    );
  }
} else {
  polyfillGlobal('Promise', () => require('../Promise').default);
}
```

Le `else` (qui installerait le `Promise` JS, et avec lui la voie `rejection-tracking`) n'est atteint **que si Hermes ne fournit pas de `Promise`**. Sur RN 0.85 avec Hermes, `hasPromise()` est vrai. Donc appeler `rejection-tracking.enable(...)` depuis l'app installerait des hooks sur une classe `Promise` que **personne n'utilise** : zéro effet, échec silencieux — le même piège que `addEventListener`.

Symétriquement, `mobile/node_modules/react-native/Libraries/Promise.js` (la voie JSC / non-Hermes) confirme que `rejection-tracking` est réservé à ce chemin-là :

```js
import Promise from 'promise/setimmediate/es6-extensions';
require('promise/setimmediate/finally');
if (__DEV__) {
  require('promise/setimmediate/rejection-tracking').enable(
    require('./promiseRejectionTrackingOptions').default,
  );
}
```

### L'API Hermes, signature exacte

`mobile/node_modules/react-native/flow/HermesInternalType.js:86-102` :

```js
/** Query the VM to see whether or not it enabled Promise. */
+hasPromise?: () => boolean,

/**
 * Enable promise rejection tracking with the given options.
 * The API mirrored the `promise` npm package, therefore it's typed same as
 * the `enable` function of module `promise/setimmediate/rejection-tracking`
 */
+enablePromiseRejectionTracker?: (
  options: ?{
    whitelist?: ?Array<unknown>,
    allRejections?: ?boolean,
    onUnhandled?: ?(number, unknown) => void,
    onHandled?: ?(number, unknown) => void,
  },
) => void,
```

Sémantique identique à celle du paquet `promise` (c'est explicite dans le commentaire), mais implémentée dans la VM Hermes — donc valable pour les vraies promesses de l'app.

### Deux implémentations concurrentes installées, toutes deux dev-only

**(a) React Native** — `mobile/node_modules/react-native/Libraries/promiseRejectionTrackingOptions.js`, activée par `polyfillPromise.js` sous `if (__DEV__)` :

```js
const rejectionTrackingOptions = {
  allRejections: true,
  onHandled: id => { console.warn(`Promise rejection handled (id: ${id})\n…`); },
  onUnhandled: (id, rejection) => {
    // …formatage du message…
    ExceptionsManager.handleException(
      new Error(`Uncaught (in promise, id: ${id})…`, { cause: rejection }),
      false /* isFatal */,
    );
  },
};
```

**(b) Expo** — `mobile/node_modules/@expo/metro-runtime/src/promiseRejectionTracking.native.ts`, quasi identique, avec un early-return défensif :

```ts
export function enablePromiseRejectionTracking() {
  const global = globalThis as unknown as GlobalThis;
  if (
    !global?.HermesInternal?.hasPromise?.() ||
    !global?.HermesInternal?.enablePromiseRejectionTracker
  ) {
    return;
  }
  global.HermesInternal.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (id, rejection) => { /* … */ ExceptionsManager.handleException(rejectionError); },
    onHandled: (id) => { console.warn(`Promise rejection handled (id: ${id})…`); },
  });
}
```

Son unique appelant, `mobile/node_modules/@expo/metro-runtime/src/index.ts:12-17` :

```ts
if (__DEV__) {
  require('./metroServerLogs').captureStackForServerLogs();
  // TODO: Remove when fixed upstream. Expected in RN 0.82.
  // https://github.com/facebook/react-native/commit/c4082c9ce208a324c2d011823ca2ba432411aafc
  require('./promiseRejectionTracking').enablePromiseRejectionTracking();
}
```

### Différence dev vs release — le point critique

| | dev (`__DEV__ === true`) | release |
|---|---|---|
| Tracker Hermes activé | oui (par `polyfillPromise.js`, et le cas échéant par `@expo/metro-runtime`) | **non — jamais** |
| Rejet non géré → | `ExceptionsManager.handleException(err, false)` → `console.error` + LogBox | **rien du tout** |
| Visible par le dev / l'utilisateur | oui (LogBox) | **non** |

`__DEV__` est inliné à la compilation et le bloc `if` qu'il garde est **entièrement supprimé** du bundle minifié — c'est documenté explicitement côté RN (`docs/global-__DEV__.md` : *« It is inlined during compilation and gets completely stripped out with the `if` blocks it guards in the minified build »*, via Context7 `/react/react-native-website`). Donc en release, l'appel à `enablePromiseRejectionTracker` n'existe même pas dans le binaire.

### Nuance vérifiée : le blog RN 0.82 ne contredit pas ce constat

Le post officiel *React Native 0.82* annonce une section « **Uncaught promise rejections will now raise `console.error`** » :

> *« Following the improvement of reporting uncaught JavaScript errors in the previous version, we will now be reporting uncaught promises through that mechanism as well. […] Due to a bug, these were completely swallowed and ignored previously »*
> — https://reactnative.dev/blog/2025/10/08/react-native-0.82

Lu vite, ça semble dire que les rejets remontent désormais partout. Vérification faite du commit référencé par Expo (`facebook/react-native@c4082c9`) : il ne touche **qu'un seul fichier**, `Libraries/promiseRejectionTrackingOptions.js`, et il change **ce que fait le tracker quand il détecte un rejet** (LogBox → `ExceptionsManager.handleException`), **pas la condition d'activation du tracker**. Le garde `if (__DEV__)` de `polyfillPromise.js` reste en place — vérifié à la fois dans le code installé et sur la branche amont `0.85-stable` (`packages/react-native/Libraries/Core/polyfillPromise.js`). Le blog ne précise nulle part que ça s'applique en release ; le code, lui, est sans ambiguïté.

**Amélioration dev/release non couverte** : aucune. Si on veut un filet release, il faut appeler `enablePromiseRejectionTracker` **soi-même**, hors `__DEV__`.

---

## Q3 — `ErrorUtils.setGlobalHandler` fonctionne-t-il en release ?

**Réponse : OUI, `ErrorUtils.setGlobalHandler` fonctionne en release. Mais il ne capture que les exceptions synchrones non rattrapées — pas les rejets de promesse, même en dev.**

**Certitude : très élevée pour la partie « fonctionne en release » et pour « ne capture pas les rejets » — vérifié dans le code installé.**

### Preuve — aucun garde `__DEV__` sur l'installation

`mobile/node_modules/react-native/Libraries/Core/setUpErrorHandling.js`, fichier entier :

```js
if (global.RN$useAlwaysAvailableJSErrorHandling !== true) {
  const ExceptionsManager = require('./ExceptionsManager').default;
  ExceptionsManager.installConsoleErrorReporter();

  if (!global.__fbDisableExceptionsManager) {
    const handleError = (e, isFatal) => {
      try {
        ExceptionsManager.handleException(e, isFatal);
      } catch (ee) { /* … */ }
    };
    const ErrorUtils = require('../vendor/core/ErrorUtils').default;
    ErrorUtils.setGlobalHandler(handleError);
  }
}
```

Aucun `__DEV__`. Le flag `RN$useAlwaysAvailableJSErrorHandling` vaut `false` par défaut (`ReactCommon/react/featureflags/ReactNativeFeatureFlagsDefaults.h:342` → `bool useAlwaysAvailableJSErrorHandling() override { return false; }`), donc le bloc s'exécute. `global.ErrorUtils` lui-même vient de `@react-native/js-polyfills/error-guard.js` (un simple `_globalHandler` en variable de module, `setGlobalHandler` / `getGlobalHandler` / `reportError` / `reportFatalError`), installé avant tout le reste du bundle — sans conditionnement dev.

Le chaînage fait par `global-error-handler.ts:36-40` est donc **correct** : `previousHandler` récupéré via `getGlobalHandler()` est bien le `handleError` de RN, et le rappeler préserve le reporting natif.

### Ce que le handler capture — et ce qu'il ne capture pas

**Capturé** : toute exception qui remonte au global handler du runtime — erreurs de rendu React non rattrapées par un `ErrorBoundary`, throws dans un callback de `setTimeout`/`setInterval`, throws dans un event handler natif, throws au niveau module pendant le require. C'est la voie `ErrorUtils.reportError` / `reportFatalError` de `error-guard.js`.

**NON capturé — les rejets de promesse, y compris en dev.** C'est le point le plus contre-intuitif du dossier. Le tracker de rejets appelle `ExceptionsManager.handleException(err, false)` **directement** (cf. `promiseRejectionTrackingOptions.js` et le fichier Expo cités en Q2). Or `handleException` ne repasse jamais par `ErrorUtils` — `mobile/node_modules/react-native/Libraries/Core/ExceptionsManager.js:151-177` :

```js
function handleException(e: unknown, isFatal: boolean) {
  const reportToConsole = true;
  if (!global.RN$handleException || !global.RN$handleException(e, isFatal, reportToConsole)) {
    let error: Error;
    // … normalisation en Error …
    try {
      inExceptionHandler = true;
      reportException(error, isFatal, reportToConsole);
    } finally {
      inExceptionHandler = false;
    }
  }
}
```

Le flux est **`tracker → ExceptionsManager → console.error / LogBox`**, unidirectionnel. `ErrorUtils` est en amont (`ErrorUtils → ExceptionsManager`), jamais en aval. Un handler custom posé sur `ErrorUtils` est donc **structurellement incapable** de voir un rejet de promesse, quel que soit le mode de build.

Corollaire : même si l'on avait « corrigé » la ligne `addEventListener` par un `rejection-tracking.enable(...)`, sans changer le reste, le handler custom n'aurait **toujours** rien reçu. Le seul point d'accroche exploitable est le callback `onUnhandled` qu'on passe soi-même à `enablePromiseRejectionTracker`.

### Comportement de `handleException` en release

`ExceptionsManager.js:104-133` — en release, la branche `__DEV__`/LogBox est remplacée par :

```js
} else if (isFatal || e.type !== 'warn') {
  const NativeExceptionsManager = require('./NativeExceptionsManager').default;
  if (NativeExceptionsManager) {
    if (isFatal) {
      if (global.RN$hasHandledFatalException?.()) return;
      global.RN$notifyOfFatalException?.();
    }
    NativeExceptionsManager.reportException(data);
  }
}
```

Donc en release une exception synchrone remonte bien au natif (crash report / log natif), mais **rien n'est affiché à l'utilisateur** — d'où l'intérêt du handler custom de l'app pour alimenter `error-store` / `error-log-store`.

---

## Q4 — Coût et risque d'activer `enablePromiseRejectionTracker`

**Certitude : élevée sur le mécanisme (lu dans la référence `promise@8.3.0`, dont l'implémentation Hermes est explicitement calquée) ; moyenne sur les délais exacts côté Hermes** — l'implémentation Hermes est en C++ dans la VM, non lisible dans `node_modules` ; on s'appuie sur le commentaire de `HermesInternalType.js` qui affirme que l'API « mirrored the `promise` npm package ».

### Le cycle onUnhandled → onHandled, mécaniquement

`mobile/node_modules/promise/setimmediate/rejection-tracking.js` donne la référence sémantique :

```js
Promise._C = function (promise, err) {
  if (promise._x === 0) { // not yet handled
    promise._E = id++;
    rejections[promise._E] = {
      displayId: null, error: err,
      timeout: setTimeout(
        onUnhandled.bind(null, promise._E),
        // For reference errors and type errors, this almost always
        // means the programmer made a mistake, so log them after just 100ms
        // otherwise, wait 2 seconds to see if they get handled
        matchWhitelist(err, DEFAULT_WHITELIST) ? 100 : 2000
      ),
      logged: false
    };
  }
};
```

Points structurants :

1. **Ce n'est pas « au tick suivant »** — c'est un `setTimeout` de **2000 ms** pour un rejet ordinaire (100 ms seulement pour `ReferenceError` / `TypeError` / `RangeError`, réputés être des bugs programmeur). Une promesse rattrapée dans ce délai ne déclenche **jamais** `onUnhandled` : le hook `_B` fait `clearTimeout` avant.
2. **`onHandled` n'est appelé que si `onUnhandled` a déjà tiré** (`if (rejections[id].logged)`), donc uniquement pour les rattrapages arrivant **après** la fenêtre de 2 s.
3. **`allRejections: true` désactive la whitelist** : tout rejet est signalé, pas seulement les trois classes d'erreurs par défaut. C'est le réglage retenu par RN et par Expo.

### Le vrai risque de faux positifs, et comment le neutraliser

Le faux positif réaliste n'est pas « une promesse rattrapée 3 s plus tard » (rare et généralement un vrai bug de conception), c'est plutôt :

- une promesse stockée puis `await`-ée conditionnellement plus tard (cache, promesse partagée entre écrans) ;
- une requête annulée / un `AbortError` volontairement ignoré ;
- une promesse dont le `.catch()` est attaché après un `await` intermédiaire long.

Le paramètre `id` fourni aux deux callbacks est un **identifiant stable** entre `onUnhandled` et `onHandled` — c'est le seul mécanisme de corrélation disponible, et il suffit. Le motif recommandé :

- **ne rien afficher immédiatement** dans `onUnhandled` ; enregistrer l'entrée dans `error-log-store` avec son `id`, et armer un délai de grâce supplémentaire (500–1000 ms) avant d'appeler `showError` ;
- dans `onHandled`, retrouver l'entrée par `id`, **annuler le délai de grâce** et marquer l'entrée comme « rattrapée tardivement » (utile en debug, invisible pour l'utilisateur) ;
- si le délai de grâce expire sans `onHandled`, alors seulement remonter à l'utilisateur.

Le comportement par défaut de RN/Expo (`onHandled` → `console.warn("…you can ignore any previous messages…")`) est l'aveu explicite que le cycle est géré **a posteriori** et non annulable : un message déjà affiché ne peut pas être repris. D'où l'intérêt du délai de grâce côté app, qui n'existe pas dans l'implémentation de référence.

### Coûts

- **Perf** : négligeable — un `setTimeout` par promesse rejetée, aucun coût sur le chemin nominal. Pas de coût sur les promesses résolues.
- **Compatibilité** : `enablePromiseRejectionTracker` est **optionnel** dans le typage (`+enablePromiseRejectionTracker?:`). Il faut reproduire l'early-return défensif d'Expo (`!hasPromise?.() || !enablePromiseRejectionTracker` → return) sinon crash au démarrage sur un runtime non-Hermes.
- **Double activation en dev** : en dev, RN a déjà appelé `enablePromiseRejectionTracker` via `polyfillPromise.js`. Le rappeler **remplace** les options précédentes (le `enable()` de référence commence par `if (enabled) disable();`). En dev on perdrait donc le report LogBox natif au profit du nôtre — à compenser en rappelant `ExceptionsManager.handleException` depuis notre `onUnhandled`, ou en n'installant le nôtre qu'en `!__DEV__`. **Point non vérifié expérimentalement** : le comportement exact de Hermes en cas de second appel (remplacement vs. empilement) est supposé identique à la référence JS, mais l'implémentation C++ n'a pas pu être lue.
- **Volume** : `allRejections: true` sur une base de ~70 sites d'appel async non migrés peut faire remonter un volume inconnu de rejets préexistants — exactement l'avertissement du blog RN 0.82 (*« expect some pre-existing errors to surface […] and create a surge in new reports »*). À activer d'abord en mode journalisation seule (`error-log-store`), sans `showError`, le temps de mesurer.

---

## Ce qui reste non établi

- Le comportement de Hermes 0.16 sur un **second** appel à `enablePromiseRejectionTracker` (remplacement des options vs. empilement) : déduit de la référence JS, non vérifié dans la VM ni testé sur device.
- Les **délais exacts** (100 ms / 2000 ms) côté Hermes : ce sont ceux de `promise@8.3.0`. Le commentaire de `HermesInternalType.js` affirme le miroir de l'API, pas nécessairement des constantes de temporisation.
- Aucun test runtime n'a été exécuté sur un build release réel pour confirmer empiriquement le silence total ; la conclusion repose sur la lecture du code et sur la sémantique documentée de `__DEV__` (élimination du bloc au build).

---

## Conséquences pour la carte #150

**Le filet global ne couvre PAS les rejets de promesse.** En release il n'en couvre aucun, et en dev il n'en verrait aucun non plus tant qu'il passe par `ErrorUtils`. Le seul filet réel aujourd'hui, c'est `ErrorUtils.setGlobalHandler` sur les **exceptions synchrones**.

Or dans une app React Native, la quasi-totalité des erreurs métier qui comptent — appel réseau, lecture/écriture SQLite, sync du référentiel, upload — vit dans du code `async`. **Ces erreurs-là tombent intégralement dans l'angle mort.** Le raisonnement « on migre les sites les plus visibles, le filet global attrapera le reste » est **factuellement faux** : il n'y a rien derrière.

Ce que ça change concrètement pour les trois frontières décidées en #154 :

**1. `runTask` doit être étanche, pas « best effort ».** `runTask` n'existe pas encore dans `mobile/src` (vérifié : zéro occurrence). Il est encore temps de le concevoir comme une frontière **totale** : aucun chemin de code ne doit pouvoir en sortir sans que l'erreur soit soit remontée à l'utilisateur, soit explicitement et visiblement journalisée. Concrètement — pas de paramètre `silent` optionnel, pas de `catch` interne qui « décide » de ne rien faire, et le `finally` de nettoyage d'état ne doit jamais devenir un `try/finally` sans `catch` (le pattern exact d'ADR-008, déjà repéré 6 fois par la recherche #152). Toute échappatoire ajoutée à `runTask` est une erreur définitivement perdue en production, pas une erreur dégradée.

**2. La migration des ~70 sites devient bloquante, pas opportuniste.** Tant qu'un site d'appel async n'est pas passé par `useAsyncAction` / `runTask`, son échec est **invisible en release** — pas de log, pas de crash report, pas de LogBox. Il n'y a pas de « queue lente » acceptable : un site non migré est un trou noir, pas un site « moins bien couvert ». La couverture doit donc être vérifiable mécaniquement (le lint de #152 : `TryStatement[handler=null]` + le sélecteur catch silencieux, plus idéalement `@typescript-eslint/no-floating-promises` qui attrape la promesse jamais attendue — le cas le plus proche du problème traité ici), et non estimée à l'œil.

**3. `ErrorBoundary` ne rattrape pas ce que l'on croit.** Un `ErrorBoundary` React n'intercepte que les throws survenus **pendant le rendu / les lifecycles**. Une exception levée dans un `useEffect` async, dans un handler `onPress` async, ou dans un callback de `setTimeout`, ne l'atteint pas. `mobile/src/components/error-boundary.tsx` couvre donc la troisième frontière, pas les deux autres — il ne peut en aucun cas servir de rattrapage pour les sites non migrés.

**4. Il reste un choix à trancher, hors périmètre de cette recherche.** Deux options non exclusives :
   - (a) accepter que les trois frontières soient la seule protection, et investir tout l'effort dans leur étanchéité + le lint qui la garantit ;
   - (b) ajouter un **vrai** filet release en appelant nous-mêmes `global.HermesInternal.enablePromiseRejectionTracker` hors `__DEV__`, avec le motif `id` + délai de grâce décrit en Q4, alimentant `error-log-store` en journalisation seule dans un premier temps.

   L'option (b) est techniquement viable et peu coûteuse, mais elle reste un **filet de rattrapage tardif** (2 s de latence minimum, message générique, pas de contexte métier) : elle ne dispense pas de (a), elle donne juste de la visibilité sur ce que (a) a raté. **Recommandation : (a) en priorité, (b) en instrumentation.**

**Dernier point, immédiat** : les lignes 43-47 de `mobile/src/lib/global-error-handler.ts` (et la déclaration `addEventListener?` ligne 8 qui les fait passer au typecheck) doivent être supprimées ou remplacées. Les laisser en l'état entretient exactement l'illusion que la carte #150 cherche à éliminer — un garde-fou qui a l'air d'exister, qui compile, qui ne s'exécute jamais.
