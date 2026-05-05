/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-native',
    'prettier',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // Prettier as ESLint rule — formatting errors show as lint errors
    'prettier/prettier': 'warn',

    // React 19 — no need to import React in scope
    'react/react-in-jsx-scope': 'off',

    // Allow explicit any only with a comment; warn otherwise
    '@typescript-eslint/no-explicit-any': 'warn',

    // Unused variables: error on vars, warn on args (common in callbacks)
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'after-used', ignoreRestSiblings: true }],

    // No leftover console.log (use console.warn/error for intentional output)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // React Native: no inline styles (performance)
    'react-native/no-inline-styles': 'warn',

    // React prop-types not needed — TypeScript handles this
    'react/prop-types': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
  env: {
    browser: false,
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.expo/',
    '*.generated.ts',
    'src/lib/africa-city-data/',
    'src/lib/cultural-data/generated/',
  ],
};
