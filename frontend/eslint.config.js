const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

// @react-native/eslint-config still ships an eslintrc-style config with a hard
// peer dependency on eslint-plugin-react-native@^4, which only supports ESLint
// <=8 — incompatible with the ESLint 9 flat config used here. Hand-rolling the
// equivalent (react + hooks + TS + prettier) avoids that peer-dependency dead end.
module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'build.log',
      '.cxx/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals['react-native'],
        __DEV__: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Apostrophes in RN <Text> are plain string content, not HTML — there is no
      // entity to escape and the suggested &apos; would render literally.
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Config/tooling files in this project (eslint.config.js, metro.config.js, scripts/**)
      // are plain CommonJS run directly under Node, not bundled — require() is correct there.
      '@typescript-eslint/no-require-imports': 'off',
      // Guardrail for the frontend UI/UX polish pass: catch raw hex colors slipping
      // back into screen styles instead of theme.ts tokens.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Use a theme.ts color token instead of a raw hex literal.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**', 'jest.setup.js', 'tests/**'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
  {
    // theme.ts is where color tokens are legitimately defined as hex literals.
    files: ['src/theme.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  prettierConfig,
);
