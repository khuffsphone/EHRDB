import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: './',
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
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
