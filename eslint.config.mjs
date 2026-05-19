import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  {
    extends: [...nextCoreWebVitals, ...nextTypescript, prettier],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
]);
