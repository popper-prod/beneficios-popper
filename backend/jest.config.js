/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^../db$': '<rootDir>/src/__mocks__/db.ts',
    '^../services/naaloo$': '<rootDir>/src/__mocks__/naaloo.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  clearMocks: true,
};
