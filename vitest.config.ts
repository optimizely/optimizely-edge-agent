import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    // Configure test environment
    poolOptions: {
      workers: {
        // Point to the compiled worker entry point for environment simulation
        // This might need adjustment based on actual test needs
        main: 'dist/v2/index.js',
        // Define bindings needed for tests (KV, vars, etc.)
        // Example:
        // kv_namespaces: [{ binding: 'TEST_KV', id: 'test-kv-id' }],
        // vars: { TEST_VAR: 'value' },
        // Add compatibility flags for Vitest
        miniflare: {
          compatibilityFlags: [
            "export_commonjs_default",
            "nodejs_compat"
          ]
        }
      },
    },
    // Specify directories containing test files
    // Include both if testing both implementations, or just src-v2 for now
    include: ['src-v2/**/*.test.ts'],
    // Exclude node_modules etc.
    exclude: ['node_modules/**'],
    // Setup files if needed (e.g., global mocks)
    // setupFiles: ['./vitest.setup.ts'],
    globals: true, // Optional: Use global APIs like describe, it
  },
}); 