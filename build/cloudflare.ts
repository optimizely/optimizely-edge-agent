import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, '../src/core/adapters/cloudflare/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['@cloudflare/workers-types'],
    },
    target: 'esnext',
    sourcemap: true,
    minify: 'esbuild',
    outDir: '../dist/cloudflare',
  },
});
