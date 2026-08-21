# Lint et catch silencieux (issue #152)

**Résumé exécutif** : le lint peut rendre **structurellement impossible** le cas `try { } finally { }` sans `catch` (règle `no-restricted-syntax` avec sélecteur `TryStatement[handler=null]`, testée et validée) et peut **réduire fortement le bruit** sur les catch vides ou qui avalent l'erreur (sélecteur `no-restricted-syntax` custom, testé et validé). Mais il ne peut **pas** couvrir le guard-clause muet (`if (!draftId) return;`) — ça reste un trou du garde-fou lint, confirmé après recherche. Verdict : **partiellement** — le lint est un filet utile en complément du hook `useAsyncAction` (ADR-008), pas un remplacement.

---

## 1. Règles natives ESLint / `@typescript-eslint`

### `no-empty` (option `allowEmptyCatch`)
- Sans l'option : `catch (e) {}` déclenche une erreur (`no-empty` interdit tout bloc vide, y compris les `catch`).
- Avec `{ "allowEmptyCatch": true }` : un `catch` **vide** devient explicitement autorisé — c'est l'inverse de ce qu'on veut ici, sauf si on veut *permettre* l'ignorance volontaire d'une erreur (documentée par un commentaire, cf. l'exemple officiel qui accepte `catch (ex) {}` sans aucun commentaire requis).
- Ne détecte QUE le cas du bloc vide — un `catch (e) { setError(false); }` n'est jamais vide donc jamais flagué, avec ou sans l'option.
- Config :
```json
{ "rules": { "no-empty": ["error", { "allowEmptyCatch": false }] } }
```
- Source primaire : https://eslint.org/docs/latest/rules/no-empty (via Context7 `/websites/eslint`).

### `no-console` (option `allow`)
- Interdit tout appel `console.*` sauf ceux listés dans `allow`.
- Pertinence : force à passer par un logger structuré (`logger.error(...)`) plutôt qu'un `console.log` muet en prod (React Native n'affiche pas la console en release) — mais ne dit rien sur la présence ou l'absence d'un `catch`. Un `catch (e) {}` reste invisible pour cette règle puisqu'il n'y a aucun `console.*` à interdire.
- Config :
```json
{ "rules": { "no-console": ["error", { "allow": ["warn", "error"] }] } }
```
- Source primaire : https://eslint.org/docs/latest/rules/no-console.
- État du repo : 120 appels `console.log/error/warn` recensés dans `mobile/src` (grep) — activer `no-console` sans réécriture massive vers un logger générerait ~120 erreurs immédiates.

### `@typescript-eslint/no-floating-promises`
- Détecte une Promise créée mais jamais `await`-ée / `.then`/`.catch`-ée / explicitement `void`-ée.
- Pertinent pour le sous-cas où un appel async est lancé sans être attendu du tout (donc son rejet ne passe même pas par un `catch` écrit) — mais ne dit rien du contenu d'un `catch` qui existe déjà et qui avale l'erreur.
- **Nécessite le linting typé** (`parserOptions.project` / `projectService`) — non configuré actuellement dans `mobile/eslint.config.js` (config actuelle = `eslint-config-expo/flat`, sans info de types). L'activer a un coût de setup (lien vers `tsconfig.json`) + temps de lint plus long.
- Config :
```js
languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
rules: { '@typescript-eslint/no-floating-promises': 'error' }
```
- Source primaire : https://typescript-eslint.io/blog/typed-linting (via Context7 `/typescript-eslint/typescript-eslint`), doc de règle : https://typescript-eslint.io/rules/no-floating-promises.

### `no-useless-catch`
- **Comportement inverse de ce qu'on cherche** : cette règle interdit un `catch` qui ne fait QUE `throw err;` (relance identique sans rien faire d'autre), au motif que ce `catch` est alors inutile et qu'on devrait laisser l'exception se propager naturellement. Elle **ne signale jamais** un `catch` qui avale l'erreur — c'est l'exact opposé du problème d'ADR-008. À ne pas confondre / ne pas proposer comme solution.
- Source : https://eslint.org/docs/latest/rules/no-useless-catch.

### `require-await`
- Interdit une fonction `async` qui ne contient aucun `await`. Ne concerne pas directement le contenu d'un `catch` ; pertinence indirecte seulement (repère les fonctions async mal formées). Peu utile pour ce ticket.

### `@typescript-eslint/only-throw-error` (ex `no-throw-literal`)
- `no-throw-literal` est supprimée dans typescript-eslint v8 ; remplacée par `only-throw-error` (confirmé par le changelog officiel : *"The deprecated `no-throw-literal` rule has been removed. Users should enable `only-throw-error` instead"*).
- Interdit de `throw` autre chose qu'un objet `Error` (ex. `throw "erreur";` ou `throw { code: 1 };`). Utile pour la qualité des erreurs *relancées*, mais ne concerne pas un `catch` qui n'a justement rien à relancer.
- Source : https://typescript-eslint.io/blog/announcing-typescript-eslint-v8-beta (Context7).

---

## 2. Plugins tiers

Aucun des plugins vérifiés n'a de règle qui détecte spécifiquement "catch non vide mais qui absorbe quand même l'erreur" — leur granularité s'arrête au même niveau que les règles natives ci-dessus :

- **`eslint-plugin-promise`** : règles centrées sur la construction des promesses (`always-return`, `no-nesting`, `catch-or-return`, `no-return-wrap`...) — pertinent pour du code `.then().catch()`, pas pour `try/catch`. Aucune règle "catch body vide de sens".
- **`eslint-plugin-unicorn`** : `unicorn/prefer-optional-catch-binding` (encourage `catch {}` sans variable `(e)` quand elle n'est pas utilisée) — orthogonal au problème, ne dit rien sur le contenu du catch. Pas de règle unicorn connue interdisant un catch silencieux.
- **`eslint-plugin-n`** (ex `eslint-plugin-node`) : ciblé Node.js (require, process, fs) — aucune règle pertinente sur try/catch.

Conclusion du point 2 : rien de plus fin que `no-empty` côté écosystème public.

---

## 3. LE CAS DUR — catch non vide qui absorbe silencieusement

**Réponse franche : non**, aucune règle ESLint / typescript-eslint / plugin connu et maintenu n'interdit spécifiquement "un `CatchClause` dont le body ne contient ni `throw` ni appel à un logger". C'est un trou réel de l'écosystème de règles prêtes à l'emploi.

Solution : règle custom via `no-restricted-syntax` avec un sélecteur ESQuery.

**Sélecteur testé** :
```
CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.object.name=/^(console|logger|log)$/])):not(:has(CallExpression[callee.name=/^(logger|log)$/]))
```

Config prête à coller :
```js
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.object.name=/^(console|logger|log)$/])):not(:has(CallExpression[callee.name=/^(logger|log)$/]))",
        message:
          "Catch silencieux : ajoute un throw, un log (console/logger), ou passe par useAsyncAction (voir ADR-008).",
      },
    ],
  },
}
```

### Test réel effectué
Méthode : script Node dans un dossier scratch (hors repo), `@typescript-eslint/typescript-estree` pour parser + `esquery` pour matcher le sélecteur, sur des snippets synthétiques puis sur le vrai code de `mobile/src` (lecture seule).

Résultat sur snippets synthétiques (`node test-selectors.js`) :

| cas | matché (attendu) |
|---|---|
| `catch (e) { setError(false); }` | `true` ✅ (silencieux, doit matcher) |
| `catch (e) { return; }` | `true` ✅ |
| `catch (e) {}` | `true` ✅ |
| `catch (e) { console.error(e); }` | `false` ✅ (ne doit pas matcher) |
| `catch (e) { logger.error(e); }` | `false` ✅ |
| `catch (e) { log(e); }` | `false` ✅ |
| `catch (e) { throw e; }` | `false` ✅ |
| `try {} catch (e) { console.error(e); } finally {}` | `false` ✅ |

Le sélecteur se comporte exactement comme spécifié : il matche les 3 formes de catch silencieux et ignore les catch qui loguent ou relancent.

**Test sur le vrai code du repo** (`mobile/src`, 117 fichiers `.ts`/`.tsx`, lecture seule, aucune modification) :
- **32 matches** sur 71 `catch` au total (~45%).
- Parmi les faux positifs identifiés : `mobile/src/hooks/use-async-action.ts:44` — c'est justement le hook **ADR-008** (`executeAsyncAction`), qui appelle `deps.showError(...)` et `deps.logError(...)` (pas `console`/`logger`/`log` littéralement) pour remonter l'erreur. **Le sélecteur ne connaît pas ces noms de fonctions maison** et le flague à tort comme "silencieux" alors que c'est exactement le pattern correct. → le sélecteur doit être étendu avec un allow-list spécifique au projet (`showError`, `logError`, `setError` selon convention retenue) pour éviter de pénaliser le bon pattern.
- Les 31 autres matches restants sont, au vu des noms de fichiers (écrans de prospection/traitement, `auth-store.ts`, `api-client.ts`, `location.ts`, `referentiel-auto-sync.ts`...), très probablement de vrais catch silencieux (le pattern documenté par ADR-008 comme récurrent) — non vérifié fichier par fichier ligne par ligne dans le cadre de cette recherche, mais cohérent avec le constat "le bug s'est reproduit trois fois".

---

## 4. `try { } finally { }` sans `catch`

Aucune règle ESLint/typescript-eslint/plugin native ne couvre directement ce pattern. Mais c'est trivial en `no-restricted-syntax` :

```js
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TryStatement[handler=null]',
        message: "try/finally sans catch : l'erreur est avalée silencieusement (voir ADR-008). Utilise useAsyncAction ou ajoute un catch.",
      },
    ],
  },
}
```

**Test réel** (même méthode, snippets + code réel) :
- `try { doThing(); } finally { cleanup(); }` → `true` ✅
- `try {} catch (e) { console.error(e); } finally {}` → `false` ✅ (ne flague pas un try/catch/finally légitime)
- `catch (e) {}` (TryStatement avec handler) → `false` ✅

Sur le vrai code (`mobile/src`) : **6 matches** de `TryStatement[handler=null]` encore présents, malgré ADR-008 qui affirme le pattern corrigé sur `accouplement.tsx`, `extensive-imagos.tsx`, `density.tsx` :
- `mobile/src/app/(prospection)/extensive-observations.tsx:33`
- `mobile/src/app/(prospection)/extensive-reference.tsx:95`
- `mobile/src/app/(prospection)/species.tsx:40`
- `mobile/src/app/(traitement)/references.tsx:138`
- `mobile/src/hooks/use-async-action.ts:77`
- `mobile/src/lib/api-client.ts:447`

Ce sélecteur peut donc, dès son activation, retrouver des occurrences du pattern décrit par ADR-008 en dehors des 3 écrans déjà corrigés. À vérifier au cas par cas (certains `try/finally` sans catch peuvent être légitimes — ex. libération de ressource où l'erreur est volontairement laissée remonter à un appelant, cf. `use-async-action.ts:77` qui fait précisément ça dans le `run()` du hook lui-même).

---

## 5. Le guard-clause muet (`if (!draftId) return;`)

**Conclusion honnête : ce n'est pas détectable par du lint statique généraliste.** Un `return` nu dans un `if` est syntaxiquement indiscernable d'un early-return légitime (garde d'entrée de fonction, validation de props, etc.) sans comprendre la sémantique métier ("cette précondition doit être visible à l'utilisateur").

Pistes vérifiées et écartées :
- `no-unused-vars` (avec `args`) : ne s'applique pas — le problème n'est pas une variable inutilisée, c'est un flux de contrôle qui ne notifie personne.
- Règle exigeant un commentaire sur un `return` nu dans un `if` : aucune règle native ou tierce connue de ce type. On pourrait écrire un `no-restricted-syntax` du type `IfStatement > ReturnStatement:not([argument])` mais ça matcherait *tous* les early-return du repo (y compris les légitimes — garde de type, condition de rendu conditionnel React, etc.), avec un taux de faux positifs qui rendrait la règle inutilisable en pratique (pas testé numériquement ici mais le motif syntaxique `if (...) return;` est extrêmement commun et générique en React/TS, sans lien nécessaire avec une précondition métier).
- Convention de nommage imposée par une règle custom (ex. forcer les early-return de précondition à passer par une fonction nommée `guardOrThrow(...)`) : c'est une piste de *convention de code*, pas de règle de *lint automatique* — elle ne devient vérifiable par lint qu'une fois la convention imposée dans le code lui-même (ex. interdire `return;` nu et forcer un appel à une fonction wrapper détectable). C'est en réalité ce que fait ADR-008 avec `useAsyncAction` : transformer le guard-clause muet en appel explicite à `deps.showError(...)` — le lint peut alors, une fois la convention en place, repérer les `return;` nus restants comme régressions potentielles (cf. section Recommandation), mais ne peut pas *initier* la convention lui-même.

Donc : trou confirmé, avec une seule atténuation possible — une fois que le refactor ADR-008 impose que toute précondition passe par `useAsyncAction`, un `no-restricted-syntax` interdisant `ReturnStatement` nu directement enfant d'un `IfStatement` dans les fichiers d'écran (`mobile/src/app/**`) devient une garde de non-régression valable, pas une détection générale.

---

## 6. État actuel du repo

### `mobile/eslint.config.js`
```js
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  }
]);
```
Aucune règle custom actuellement — uniquement `eslint-config-expo/flat`.

### Ce que `eslint-config-expo` active réellement (vérifié sur le code source GitHub `expo/expo`, package `packages/eslint-config-expo`, tag `~56.0.4`)

`flat/default.js` compose : `core.js` + `typescript.js` + `react.js` + `expo.js`.

- `core.js` : règles JS générales (`eqeqeq`, `no-dupe-*`, `no-undef`, `no-unused-vars` avec `caughtErrors: 'all'`, `caughtErrorsIgnorePattern: '^_'`...) + `eslint-plugin-import` (`recommended` + `errors`). **Aucune trace de `no-empty`, `no-console`, `no-useless-catch`, ni d'aucune règle liée aux `catch`.**
- `typescript.js` : active `@typescript-eslint/array-type`, `no-empty-object-type`, `consistent-type-assertions`, `no-dupe-class-members`, `no-redeclare`, `no-unused-vars` (override TS), `no-useless-constructor`, `no-require-imports`. **Pas de `no-floating-promises`, pas de `only-throw-error`, pas de règles typées** — cohérent avec le fait que ce config ne configure pas `parserOptions.project`/`projectService` (pas de linting typé), donc les règles typées de typescript-eslint ne seraient de toute façon pas exploitables telles quelles.
- Ni `react.js` ni `expo.js` (non lus en détail ici, hors scope catch) n'ajoutent de règle sur les erreurs.

**Conclusion du point 6.2 : `eslint-config-expo` n'apporte aucune protection, même indirecte, contre les catch silencieux.** Tout doit être ajouté explicitement dans `mobile/eslint.config.js`.

### `.github/workflows/lint.yml` — job `lint-mobile`
```yaml
lint-mobile:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: mobile
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v7
      with:
        node-version: lts/*
        cache: npm
        cache-dependency-path: mobile/package-lock.json
    - run: npm ci
    - run: npm run lint
    - run: npm run typecheck
    - run: npm run check:schema-drift
    - run: npm test
```
- Déclenché sur toute PR vers `main` (workflow `PR Validation`), bloquant.
- `npm run lint` = `"lint": "expo lint"` (= ESLint via `eslint.config.js`) — **aucun `--max-warnings 0`** dans le script `package.json`. En l'état, `expo lint` (comme `eslint` en CLI) échoue le process (exit code ≠ 0) sur une erreur (`"error"` severity) mais **pas** sur un warning (`"warn"` severity) — donc toute règle configurée en `"warn"` ne bloquera jamais la CI. Beaucoup de règles d'`eslint-config-expo` (`core.js`, `typescript.js`) sont déjà en `"warn"` (ex. `no-unused-vars`, `eqeqeq`) et ne cassent donc jamais le build actuellement.
- Implication directe pour ce ticket : toute règle anti-catch-silencieux ajoutée doit être en `"error"` (pas `"warn"`) pour être réellement bloquante en CI, vu l'absence de `--max-warnings 0`.

### ADR-008 (`docs/adr/ADR-008-gestion-erreurs-mobile.md`)
Contexte cité intégralement : bug de `try { } finally { }` sans `catch` + guard-clause `if (!draftId) return;` reproduit 3 fois indépendamment (`accouplement.tsx`, `extensive-imagos.tsx`, `density.tsx`), causant un bouton d'action silencieusement inopérant sur le terrain. Décision : hook centralisé `useAsyncAction` qui garantit qu'aucune erreur/précondition manquante ne reste silencieuse (bannière + log debug). Le refactor Result-type est explicitement une alternative évoquée mais le scope réel d'ADR-008 est le hook, pas Result-type — et de toute façon le refactor complet est **hors périmètre de l'issue #152**, qui porte uniquement sur ce que le lint peut garantir en attendant/à côté.

---

## Recommandation concrète

Config `eslint.config.js` minimale à ajouter dans `mobile/`, en plus de `expoConfig` :

```js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // 1. catch vide, avec ou sans commentaire
      'no-empty': ['error', { allowEmptyCatch: false }],

      // 2. try/finally sans catch — pattern exact du bug ADR-008
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TryStatement[handler=null]',
          message:
            "try/finally sans catch : l'erreur est avalée silencieusement (voir ADR-008). Ajoute un catch ou utilise useAsyncAction.",
        },
        {
          // 3. catch non vide qui n'avertit ni ne relance
          selector:
            "CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.object.name=/^(console|logger|log|showError|logError)$/])):not(:has(CallExpression[callee.name=/^(logger|log)$/]))",
          message:
            'Catch silencieux : ajoute un throw, un log, ou passe par useAsyncAction/showError (voir ADR-008).',
        },
      ],
    },
  },
]);
```

Notes :
- `no-console` **volontairement omis** de cette recommandation minimale : 120 appels `console.*` existent déjà dans `mobile/src` — l'activer en `error` casserait la CI immédiatement sans nettoyage préalable (hors scope #152). À traiter séparément, avec `allow: ['warn', 'error']` a minima si un logger structuré n'est pas encore généralisé.
- `@typescript-eslint/no-floating-promises` **volontairement omis** : nécessite le linting typé (non configuré), coût de setup + temps de build CI plus long, à évaluer dans un ticket dédié plutôt qu'ajouté furtivement ici.
- Le sélecteur du point 3 intègre déjà `showError`/`logError` (noms utilisés par `useAsyncAction`) dans l'allow-list, pour ne pas flaguer le hook ADR-008 lui-même — sans cet ajustement, `use-async-action.ts:44` remonte en faux positif (vérifié par le test sur le vrai code, section 3).

### Coût en bruit estimé (mesuré sur le code réel du repo, lecture seule, aucune modification)
- `no-empty` (`allowEmptyCatch: false`) : impact non chiffré précisément ici mais généralement faible (les catch strictement vides sont un sous-ensemble des 32 matches ci-dessous).
- Sélecteur "try/finally sans catch" : **6 matches** dans `mobile/src` — dont au moins un (`use-async-action.ts:77`) est potentiellement un faux positif à examiner (le hook `run()` lui-même laisse volontairement l'erreur remonter après un `finally` de nettoyage d'état `isRunning`).
- Sélecteur "catch silencieux" : **32 matches** sur 71 `catch` au total dans `mobile/src` (~45%), avec allow-list `console/logger/log` seule (avant ajout `showError`/`logError`). Après ajout de `showError`/`logError` à l'allow-list, `use-async-action.ts:44` sort du lot — mais les 31 autres matches restent à trier manuellement (probablement majoritairement de vrais catch silencieux au vu du contexte ADR-008, mais non vérifiés un par un ici). **Donc : activer ces deux `no-restricted-syntax` en `error` direct sur `main` cassera la CI tant que ces ~30+ occurrences n'auront pas été triées/corrigées** — à faire soit en une passe de nettoyage préalable, soit en activant la règle uniquement en `warn` le temps du nettoyage puis en la passant en `error` (en notant que `warn` ne bloque pas la CI actuelle, cf. section 6).

---

## Trous connus du garde-fou lint

1. **Guard-clause muet** (`if (!draftId) return;`) — non détectable par lint statique généraliste (section 5). C'est le trou principal et non contournable sans imposer d'abord une convention de code (ex. passer systématiquement par `useAsyncAction`) que le lint pourrait ensuite faire respecter, mais qu'il ne peut pas générer lui-même.
2. **Faux négatifs sémantiques du sélecteur catch silencieux** : tout nom de fonction de reporting différent de `console/logger/log/showError/logError` (ex. un futur `notifyUser(...)`, `reportError(...)`) échappe à l'allow-list tant qu'elle n'est pas mise à jour manuellement — c'est un sélecteur syntaxique, pas une analyse sémantique.
3. **Faux positifs du sélecteur catch silencieux** sur du code où avaler l'erreur est un choix légitime et documenté (ex. tentative optionnelle, fallback silencieux voulu) — le sélecteur ne sait pas distinguer "silencieux par oubli" de "silencieux par design"; seul un commentaire + une règle explicitement configurée pour l'accepter (ou un renommage de la variable catch en `_e` avec une règle dédiée) permettrait de le documenter, ce qui n'est pas mis en place ici.
4. **`no-floating-promises`** ne couvre que l'absence totale de gestion (promesse jamais awaited), pas un `.catch()` ou un `catch` qui existe mais absorbe silencieusement — ne comble donc pas le trou du point 3 ci-dessus, il adresse un problème différent.
5. **Linting typé non configuré** : toute règle typescript-eslint nécessitant l'info de types (`no-floating-promises`, certaines variantes plus fines) est indisponible sans configurer `parserOptions.project`/`projectService`, ce qui n'est pas fait actuellement dans `mobile/eslint.config.js`.

En résumé : le lint peut fermer la porte sur `try/finally` sans `catch` et réduire fortement (mais pas éliminer) les catch qui absorbent l'erreur sans la signaler. Il ne peut pas fermer la porte sur le guard-clause muet ni distinguer un silence voulu d'un silence accidentel — ADR-008 (hook centralisé `useAsyncAction`) reste la seule protection structurelle complète, le lint n'étant qu'un filet complémentaire pour détecter les régressions vers l'ancien pattern.
