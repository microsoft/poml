import stylistic from '@stylistic/eslint-plugin';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      'assets/**',
      'mlartifacts/**',
      'mlrun/**',
      'mlruns/**',
      'pomlrun/**',
      '*.context.json',
      '*.result.json',
      'python/poml/js/cli.js',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        browser: true,
        node: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      '@stylistic': stylistic,
    },
    rules: {
      'curly': ['error', 'all'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],

      // Disabled rules as requested
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'prefer-const': 'off',
      'no-constant-condition': 'off',
    },
  },
];
