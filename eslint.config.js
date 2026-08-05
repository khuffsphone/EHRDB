// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-single/**', 'node_modules/**', 'coverage/**', 'artifacts/**', 'references/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        AudioContext: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Gamepad: 'readonly',
        GamepadEvent: 'readonly',
        KeyboardEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // The deterministic simulation core may not reach for ambient nondeterminism.
    files: ['src/sim/**/*.ts', 'src/ai/**/*.ts', 'src/career/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Simulation code must not touch the DOM.' },
        { name: 'document', message: 'Simulation code must not touch the DOM.' },
        { name: 'localStorage', message: 'Simulation code must not touch storage.' },
        { name: 'performance', message: 'Simulation code must not read wall-clock time.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from @sim/rng.' },
        { object: 'Date', property: 'now', message: 'Simulation code must not read wall-clock time.' },
        { object: 'Math', property: 'sin', message: 'Transcendentals are not bit-reproducible; use @sim/fixed helpers.' },
        { object: 'Math', property: 'cos', message: 'Transcendentals are not bit-reproducible; use @sim/fixed helpers.' },
        { object: 'Math', property: 'hypot', message: 'Math.hypot is not bit-reproducible; use dist() from @sim/fixed.' },
      ],
    },
  },
);
