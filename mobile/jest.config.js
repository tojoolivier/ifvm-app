const roots = ['<rootDir>/__tests__'];

const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
};

module.exports = {
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
    },
  ],
};
