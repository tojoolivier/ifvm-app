// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require('globals');

// ADR-012 décision 10 (issue #174) : jeu de règles anti-silence, bloquant
// (`error`, jamais `warn` — `expo lint` n'a pas de `--max-warnings 0`) et
// restreint par glob au périmètre migré. Le glob s'élargit à mesure que
// d'autres zones adoptent le logger unifié (`src/lib/logger.ts`) ; rien
// n'est jamais en `warning` — un fichier est protégé pour de bon, ou pas
// encore dans le périmètre.
const CATCH_SILENCIEUX_SELECTOR =
  "CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.object.name=/^(console|logger|log)$/])):not(:has(CallExpression[callee.name=/^(logger|log)$/]))";

const TRY_SANS_CATCH_SELECTOR = 'TryStatement[handler=null]';

// Un corps déjà passé par `JSON.stringify` est opaque au filtre d'expurgation
// par nom de clé — c'est l'erreur de granularité qui a fait fuiter des jetons
// (cf. `log-redaction.ts`). Cette règle n'est pas négociable : une dérogation
// y rouvre une fuite de credentials.
const JSON_STRINGIFY_DANS_LOGGER_SELECTOR =
  "CallExpression[callee.object.name=/^(log|logger)$/][callee.property.name=/^(event|detail|failure|ignore)$/] CallExpression[callee.object.name='JSON'][callee.property.name='stringify']";

const SELECTEUR_TRY_SANS_CATCH = {
  selector: TRY_SANS_CATCH_SELECTOR,
  message:
    "try/finally sans catch : l'erreur est avalée silencieusement (voir ADR-008/ADR-012). Ajoute un catch ou utilise useAsyncAction.",
};

const SELECTEUR_CATCH_SILENCIEUX = {
  selector: CATCH_SILENCIEUX_SELECTOR,
  message:
    'Catch silencieux : ajoute un throw, un log (logger unifié), ou passe par useAsyncAction (voir ADR-012 décision 3).',
};

const SELECTEUR_JSON_STRINGIFY_DANS_LOGGER = {
  selector: JSON_STRINGIFY_DANS_LOGGER_SELECTOR,
  message:
    "JSON.stringify dans un argument du logger : le corps devient opaque à l'expurgation par nom de clé (voir ADR-012, fuite de jetons corrigée par PR #164). Passe l'objet tel quel.",
};

const REGLES_ANTI_SILENCE = {
  'no-empty': ['error', { allowEmptyCatch: false }],
  'no-restricted-syntax': [
    'error',
    SELECTEUR_TRY_SANS_CATCH,
    SELECTEUR_CATCH_SILENCIEUX,
    SELECTEUR_JSON_STRINGIFY_DANS_LOGGER,
  ],
  '@typescript-eslint/no-floating-promises': 'error',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Périmètre 1 (ADR-012 décision 10) : lib/, migré par #173.
    files: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
    ignores: ['src/lib/logger.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      ...REGLES_ANTI_SILENCE,
      // `no-console` est ce qui donne son sens au mot « migré » : aucun
      // survivant `console.*` dans le périmètre. `logger.ts` lui-même est
      // exclu ci-dessous (il EST le mirroir console, par construction).
      'no-console': 'error',
    },
  },
  {
    // `logger.ts` est le cœur du logger unifié : son mirroir dev appelle
    // `console.*` par construction (pas un oubli — exclu de `no-console`),
    // et le `catch {}` de `flush()` est délibéré (anti-récursion : logger un
    // échec de flush depuis flush() ré-appellerait flush()). `no-empty` et le
    // sélecteur catch-silencieux sont donc omis ici pour la même raison — pas
    // recopiés depuis `REGLES_ANTI_SILENCE`. Documenté ici, en configuration,
    // plutôt qu'en `eslint-disable` local (ADR-012 : aucune dérogation locale).
    files: ['src/lib/logger.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        SELECTEUR_TRY_SANS_CATCH,
        SELECTEUR_JSON_STRINGIFY_DANS_LOGGER,
      ],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
