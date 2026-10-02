import js from '@eslint/js';
import solid from 'eslint-plugin-solid';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'sdk/**',
      'examples/**',
      '.impeccable/**',
    ],
  },
  { files: ['**/*.{js,mjs,ts,tsx}'], ...js.configs.recommended },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    ...solid.configs['flat/typescript'],
  },
  {
    files: ['tests/**/*.{ts,tsx}', '*.{js,mjs,ts}', 'protocol/**/*.mjs', 'bin/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/trace/**/*.{ts,tsx}', 'src/runs/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'solid-js',
                'solid-js/*',
                '@tanstack/*',
                '@kobalte/*',
                '@corvu/*',
                '**/workspace/**',
                '**/presentations/**',
              ],
              message: 'ドメイン層は UI と framework に依存しないでください。',
            },
          ],
        },
      ],
    },
  },
);
