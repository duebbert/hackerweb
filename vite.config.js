import { defineConfig } from 'vite';

export default defineConfig({
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
