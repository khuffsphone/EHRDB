import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sim': r('./src/sim'),
      '@ai': r('./src/ai'),
      '@career': r('./src/career'),
      '@data': r('./src/data'),
      '@save': r('./src/save'),
      '@art': r('./src/art'),
      '@audio': r('./src/audio'),
      '@input': r('./src/input'),
      '@ui': r('./src/ui'),
      '@util': r('./src/util'),
      '@scenes': r('./src/scenes'),
      '@game': r('./src/game'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 120_000,
    teardownTimeout: 120_000,
  },
});
