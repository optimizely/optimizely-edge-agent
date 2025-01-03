import { defineConfig } from 'vite';
import { resolve } from 'path';

// CDN-specific entry points
const entries = {
  cloudflare: resolve(__dirname, 'src/adapters/cloudflare/index.ts'),
  vercel: resolve(__dirname, 'src/adapters/vercel/index.ts'),
  fastly: resolve(__dirname, 'src/adapters/fastly/index.ts'),
  akamai: resolve(__dirname, 'src/adapters/akamai/index.ts'),
  cloudfront: resolve(__dirname, 'src/adapters/cloudfront/index.ts'),
};

export default defineConfig({
  build: {
    lib: {
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      input: entries,
      output: {
        dir: 'dist',
        format: 'es',
        entryFileNames: '[name]/index.js',
        chunkFileNames: '[name]-[hash].js',
      },
      external: [
        '@cloudflare/workers-types',
        '@vercel/edge',
        '@fastly/js-compute',
        '@akamai/edgeworkers',
      ],
    },
    target: 'esnext',
    sourcemap: true,
    minify: 'esbuild',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
  },
});
