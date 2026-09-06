const roots = ['<rootDir>/__tests__'];

const moduleNameMapper = {
  // Avant l'alias `@/` : sinon `@/global.css` part vers `src/global.css` et
  // Jest tente d'exécuter du Tailwind comme du JavaScript.
  '\\.css$': '<rootDir>/__tests__/test-utils/style-mock.js',
  '^@/(.*)$': '<rootDir>/src/$1',
};

module.exports = {
  
  testTimeout: 15000,
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
