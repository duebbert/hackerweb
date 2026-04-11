import { defineConfig } from 'vite';
import { version } from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
  optimizeDeps: {
    rolldownOptions: {
      jsx: {
        mode: 'classic',
        factory: 'h',
        fragment: 'Fragment',
      },
    },
  },
  server: {
    open: true,
  },
});
