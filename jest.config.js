/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  roots: ['<rootDir>/packages/poml/tests'],
  moduleDirectories: ['node_modules', 'packages'],

  // Handle the PDF parsing worker teardown issue
  forceExit: true,
  detectOpenHandles: true,
  // Increase timeout for async operations like PDF parsing
  testTimeout: 30000
};
