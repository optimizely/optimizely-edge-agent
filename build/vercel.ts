import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, '../src/core/adapters/vercel/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['@vercel/edge'],
    },
    target: 'esnext',
    sourcemap: true,
    minify: 'esbuild',
    outDir: '../dist/vercel',
  },
});
