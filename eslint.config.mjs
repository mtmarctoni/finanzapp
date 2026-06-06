import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';

export default defineConfig([
  {
    extends: [...nextCoreWebVitals, ...nextTypescript, prettier],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'jest.config.mjs',
            'jest.setup.js',
            'next.config.mjs',
            'postcss.config.mjs',
            'prettier.config.mjs',
          ],
        },
      },
    },
    rules: {
      // react-hooks (from next)
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',

      // --- Tier 1: Safety ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'separate-type-imports' },
      ],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-template': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': 'error',

      // --- Tier 2: Quality ---
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'import-x/no-duplicates': 'error',
      'react/no-array-index-key': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
    },
  },
]);
