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
  // Le run CI est passe de 9m47s a un runner qui perd la connexion (~21-25min
  // sur "npm test") des que la fusion de main a fait grossir la suite
  // (154 suites, projet "screens" en jest-expo/RN, gourmand en memoire). Le
  // process Jest seul (hors workers) pese deja >1.3Go de RSS en local ; sur un
  // pod CI a quota memoire serre, les workers accumulent de la memoire suite
  // apres suite jusqu'a l'OOM-kill du runner. Recycle les workers avant qu'ils
  // ne grossissent trop plutot que de laisser grossir indefiniment.
  workerIdleMemoryLimit: '512MB',
  // 15000 puis 30000 restaient trop justes sous charge : plusieurs runs CI ont
  // chacun vu quelques suites différentes (jamais les mêmes d'un run à
  // l'autre) dépasser ce seuil, signature d'un runner ponctuellement
  // surchargé plutôt qu'un test cassé (le même run passe toujours en local,
  // largement sous la limite — souvent >10x plus vite qu'un run CI mesuré sur
  // cette même suite). Doublé une nouvelle fois par marge plutôt que retiré :
  // un vrai test qui boucle doit encore échouer, juste avec plus de marge
  // pour un runner starvé.
  testTimeout: 60000,
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
