/**
 * Test runner for Edge Mode components
 * 
 * This script runs all the Edge Mode related tests for the Optimizely Edge Agent.
 * 
 * To run against a live worker:
 * EDGE_AGENT_URL=https://your-worker.workers.dev SDK_KEY=your-sdk-key npm run test:url-matching
 */

import { JSDOM } from 'jsdom';

/* Set up JSDom environment for browser-like globals */
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(global as any).document = dom.window.document;
(global as any).window = dom.window;

/**
 * Environment check - provide warning if required env vars are missing
 */
function checkEnvironment() {
  const missingVars = [];

  if (!process.env.EDGE_AGENT_URL) {
    missingVars.push('EDGE_AGENT_URL');
  }

  if (!process.env.SDK_KEY) {
    missingVars.push('SDK_KEY');
  }

  if (missingVars.length > 0) {
    console.warn(`⚠️ Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Tests will likely fail unless you set real environment variables.');
    console.warn('Example: EDGE_AGENT_URL=https://your-worker.workers.dev SDK_KEY=your-sdk-key npm run test:url-matching');
  } else {
    console.log('✅ Environment variables are set.');
  }
}

/**
 * Run the specified test file
 * 
 * @param testPath Path to the test file
 */
async function runTest(testPath: string) {
  try {
    // Dynamic import to handle ES modules
    await import(testPath);
    console.log(`✅ Successfully ran ${testPath}`);
  } catch (error) {
    console.error(`❌ Error running ${testPath}:`, error);
    process.exit(1);
  }
}

async function main() {
  checkEnvironment();

  console.log('🧪 Running Edge Mode component tests...');

  // Run the URLMatcher unit tests
  console.log('\n📋 Running URLMatcher unit tests...');
  await runTest('./services/URLMatcher.test.ts');

  // Run the EdgeModeHandler unit tests
  console.log('\n📋 Running EdgeModeHandler unit tests...');
  await runTest('./services/EdgeModeHandler.test.ts');
  
  // Run the ContentFetcher unit tests
  console.log('\n📋 Running ContentFetcher unit tests...');
  await runTest('./services/ContentFetcher.test.ts');
  
  // Run the CacheManager unit tests
  console.log('\n📋 Running CacheManager unit tests...');
  await runTest('./services/CacheManager.test.ts');

  // Run the ContentTransformer unit tests
  console.log('\n📋 Running ContentTransformer unit tests...');
  await runTest('./services/ContentTransformer.test.ts');

  // Run the RequestForwarder unit tests
  console.log('\n📋 Running RequestForwarder unit tests...');
  await runTest('./services/RequestForwarder.test.ts');
  
  // Run the EdgeModeIntegration integration tests
  console.log('\n📋 Running EdgeModeIntegration tests...');
  await runTest('./integration/EdgeModeIntegration.test.ts');

  // Run the Edge Mode integration tests
  console.log('\n📋 Running Edge Mode integration tests...');
  await runTest('./integration/EdgeMode.test.ts');

  console.log('\n✅ All tests completed successfully.');
}

// Run the tests
main().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});