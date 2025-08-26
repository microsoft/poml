module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended', // Use recommended rules from eslint
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
    node: true,
  },
  rules: {
    // Disabled rules as requested
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-namespace': 'off',
    'prefer-const': 'off',
    'no-constant-condition': 'off',
    // '@typescript-eslint/naming-convention': [
    //   'warn',
    //   {
    //     selector: 'import',
    //     format: ['camelCase', 'PascalCase'],
    //   },
    // ],
    // '@typescript-eslint/semi': 'warn',
    // 'eqeqeq': 'off',
    
    // 'max-len': 'off',
    // 'quotes': 'off',
    // 'indent': 'off',
    // 'semi': 'off',
    // 'curly': 'warn',
    // 'eqeqeq': 'warn',
    // 'no-throw-literal': 'warn',
    // 'semi': ['warn', 'always'],
    // 'comma-dangle': ['warn', 'never'],
    // 'quotes': ['warn', 'single'],
    // 'max-len': ['warn', { code: 100 }],
    // 'indent': ['warn', 2],
  },
  ignorePatterns: ['out', 'dist', 'node_modules', '**/*.d.ts', 'assets', 'mlartifacts', 'mlrun', 'pomlrun'],
};
