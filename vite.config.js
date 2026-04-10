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
  server: {
    open: true,
  },
});
