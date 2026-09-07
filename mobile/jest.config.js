const roots = ['<rootDir>/__tests__'];

const moduleNameMapper = {
  // Avant l'alias `@/` : sinon `@/global.css` part vers `src/global.css` et
  // Jest tente d'exécuter du Tailwind comme du JavaScript.
  '\\.css$': '<rootDir>/__tests__/test-utils/style-mock.js',
  '^@/(.*)$': '<rootDir>/src/$1',
};

module.exports = {
  // Runner CI partagé (pool dind mutualisé, cf. .github/workflows/lint.yml) :
  // le nombre de workers par défaut de Jest (cœurs disponibles - 1) sur-souscrit
  // largement le peu de CPU réellement alloué, ce qui a déjà produit des
  // timeouts sporadiques (findBy*/waitFor) et un entrelacement de la sortie
  // console entre workers rendant les logs d'échec illisibles/trompeurs.
  // Fixe et modeste : priorise la stabilité sur la vitesse en CI comme en local.
  maxWorkers: 2,
  // 15000 restait trop juste sous charge : plusieurs runs CI ont chacun vu
  // exactement 3 suites différentes (jamais les mêmes) dépasser ce seuil,
  // signature d'un runner ponctuellement surchargé plutôt qu'un test cassé
  // (le même run passe toujours en local, largement sous la limite). Doublé
  // par marge plutôt que retiré : un vrai test qui boucle doit encore échouer.
  testTimeout: 30000,
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots,
      testMatch: ['**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper,
      transformIgnorePatterns: [
        'node_modules/(?!(expo-sqlite|expo|@expo|react-native|react-native-.*)/)',
      ],
    },
    {
      displayName: 'screens',
      preset: 'jest-expo',
      roots,
      testMatch: ['**/*.test.tsx'],
      moduleNameMapper,
      setupFiles: ['<rootDir>/jest.setup.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.after-env.js'],
    },
  ],
};
