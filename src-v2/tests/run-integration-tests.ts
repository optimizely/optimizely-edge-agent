/**
 * Integration Test Runner
 * 
 * This script runs the Edge Mode and Agent Mode integration tests against a live
 * Cloudflare deployment of the Optimizely Edge Agent.
 * 
 * Usage:
 *   ts-node run-integration-tests.ts [--edge-only|--agent-only]
 * 
 * Environment variables:
 *   EDGE_AGENT_URL - The URL of the Edge Agent deployment to test against
 *     Example: "https://your-worker.workers.dev"
 *   SDK_KEY - The SDK key to use for testing
 *     Example: "FVxxxxxxxxxxxxxxxxxxxxxP"
 *   FEATURE_KEYS - Comma-separated list of feature keys to test
 *     Example: "flag_1,flag_2,my_experiment_flag"
 *   EXPERIMENT_KEYS - Comma-separated list of experiment keys to test
 *     Example: "ab_test_1,ab_test_2"
 * 
 * Testing against a live Cloudflare deployment:
 * 1. Deploy your Optimizely Edge Agent to a Cloudflare Workers environment
 * 2. Set the environment variables to point to your deployment
 * 3. Run this script to execute the tests against your live deployment
 * 
 * Example:
 *   EDGE_AGENT_URL=https://optimizely-edge-agent.my-account.workers.dev \
 *   SDK_KEY=FVxxxxxxxxxxxxxxxxxxxxxP \
 *   FEATURE_KEYS=my_flag,other_flag \
 *   EXPERIMENT_KEYS=my_experiment \
 *   npm run test:integration
 *
 * Note on mock vs. live testing:
 * - Tests can be run against either a mock environment or a live deployment
 * - For local development and CI/CD, mock testing is recommended
 * - For final verification, live testing against a real deployment is essential
 * - When testing against a live deployment, ensure your SDK_KEY has access to the
 *   feature flags and experiments referenced in the test environment variables
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const runEdgeTests = !args.includes('--agent-only');
const runAgentTests = !args.includes('--edge-only');

console.log('🚀 Starting Optimizely Edge Agent Integration Tests');
console.log('─────────────────────────────────────────────────────');

// Environment variables check
if (!process.env.EDGE_AGENT_URL) {
  console.warn('⚠️  EDGE_AGENT_URL environment variable not set. Using example URL for tests.');
  console.warn('   Tests will likely fail unless you set real environment variables.');
  console.warn('   Example: EDGE_AGENT_URL=https://your-worker.workers.dev SDK_KEY=your-sdk-key npm run test:integration');
}

if (!process.env.SDK_KEY) {
  console.warn('⚠️  SDK_KEY environment variable not set. Using example SDK key for tests.');
  console.warn('   Tests will likely fail unless you set a real SDK key.');
}

// Feature keys check
if (!process.env.FEATURE_KEYS) {
  console.warn('⚠️  FEATURE_KEYS environment variable not set. Tests will use default keys.');
  console.warn('   For proper testing, set FEATURE_KEYS to comma-separated feature flag keys in your project.');
}

// Experiment keys check
if (!process.env.EXPERIMENT_KEYS) {
  console.warn('⚠️  EXPERIMENT_KEYS environment variable not set. Tests will use default keys.');
  console.warn('   For proper testing, set EXPERIMENT_KEYS to comma-separated experiment keys in your project.');
}

// Check if this appears to be a live test
const isLiveTest = process.env.EDGE_AGENT_URL && 
                   (process.env.EDGE_AGENT_URL.includes('.workers.dev') || 
                    process.env.EDGE_AGENT_URL.includes('.cloudflare.com'));

if (isLiveTest) {
  console.log('🌐 Running tests against LIVE Cloudflare deployment');
  console.log(`   URL: ${process.env.EDGE_AGENT_URL}`);
  console.log(`   SDK Key: ${process.env.SDK_KEY ? '******' + process.env.SDK_KEY.slice(-4) : 'Not set'}`);
  console.log(`   Feature Keys: ${process.env.FEATURE_KEYS || 'Not set'}`);
  console.log(`   Experiment Keys: ${process.env.EXPERIMENT_KEYS || 'Not set'}`);
} else {
  console.log('🧪 Running tests against local or mock environment');
}

// Run Vitest for specific test files
const testDir = path.resolve(__dirname);

// Set this to true to skip most tests, useful for development and testing specific features
const SKIP_MOST_TESTS = false;

// Helper to run tests
function runTest(testFile: string) {
  try {
    console.log(`🧪 Running tests: ${testFile}`);
    execSync(`npx vitest run ${testFile} --config ./vitest.config.ts`, { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..')
    });
    return true;
  } catch (error) {
    console.error(`❌ Tests failed: ${testFile}`);
    return false;
  }
}

// Collection of test results
const results: Record<string, boolean> = {};

// Run Edge Mode tests
if (runEdgeTests) {
  console.log('\n📡 Running Edge Mode Tests (GET requests)');
  console.log('─────────────────────────────────────────');
  results['EdgeMode'] = runTest('tests/integration/EdgeMode.test.ts');
}

// Run Agent Mode tests
if (runAgentTests) {
  console.log('\n🤖 Running Agent Mode Tests (POST requests)');
  console.log('─────────────────────────────────────────');
  results['AgentMode'] = runTest('tests/integration/AgentMode.test.ts');
}

// Print summary
console.log('\n📋 Test Results Summary');
console.log('─────────────────────');
let allPassed = true;

Object.entries(results).forEach(([testName, success]) => {
  console.log(`${testName}: ${success ? '✅ PASS' : '❌ FAIL'}`);
  if (!success) allPassed = false;
});

console.log(`\n${allPassed ? '✅ All' : '❌ Some'} tests ${allPassed ? 'passed' : 'failed'}.`);

// Exit with appropriate code
process.exit(allPassed ? 0 : 1); 