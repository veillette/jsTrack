import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        bundle: resolve(__dirname, 'ts/main.ts'),
        help: resolve(__dirname, 'ts/help.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].iife.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'ts'),
    },
  },
});
