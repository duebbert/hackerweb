import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        'hw-unified': resolve(__dirname, 'assets/js/hw-unified.js'),
      },
      output: {
        dir: 'js',
        entryFileNames: '[name].min.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
    sourcemap: true,
    minify: true,
    // Don't clear the output directory
    emptyOutDir: false,
  },
  // Dev server serves from project root
  root: '.',
  publicDir: false,
  server: {
    open: '/index.html',
  },
});
