/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
      },
      diagnostics: false,
    }],
  },
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: ['src/engine/**/*.ts'],
  coverageThreshold: {
    global: { statements: 60, branches: 50, functions: 70, lines: 60 },
  },
};
