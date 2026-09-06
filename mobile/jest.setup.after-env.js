const { configure } = require('@testing-library/react-native');

// Timeout par défaut de `findBy*`/`waitFor` (1000ms) : trop court sur un
// runner CI partagé/sous charge — plusieurs suites (rotations, larves,
// affichage-erreurs…) y timeoutent sporadiquement alors qu'elles passent
// systématiquement en local, jamais pour une vraie régression (rejoué seul,
// le test repasse toujours au vert). Aligné sur `testTimeout` (jest.config.js)
// moins une marge, pour qu'un vrai blocage lève quand même avant la limite Jest.
//
// Doit vivre dans `setupFilesAfterEnv`, pas `setupFiles` (jest.setup.js) :
// importer `@testing-library/react-native` étend automatiquement les
// matchers `expect` (`toBeVisible()`, etc.), qui n'existe pas encore à la
// phase `setupFiles` (avant l'installation du framework de test par Jest).
configure({ asyncUtilTimeout: 10000 });
