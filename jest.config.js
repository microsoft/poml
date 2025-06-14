/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  roots: ['<rootDir>/packages/poml/tests', '<rootDir>/packages/poml-vscode/tests'],
  moduleDirectories: ['node_modules', 'packages']
};
