/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Allow pre-existing Buffer type cast in source-config.test.ts to run without fatal error
        // (Node 18+ tightened Buffer<ArrayBufferLike> vs NonSharedBuffer compatibility)
        diagnostics: { warnOnly: true },
      },
    ],
  },
}
