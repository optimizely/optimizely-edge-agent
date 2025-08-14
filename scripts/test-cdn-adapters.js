#!/usr/bin/env node

/**
 * CDN Adapter Test Runner
 * 
 * This script executes the CDN adapter tests in a development environment.
 * It transpiles the TypeScript files on the fly and runs the tests.
 * 
 * Usage:
 *   node scripts/test-cdn-adapters.js [cloudflare|vercel|fastly|all]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Default to testing all CDNs if none specified
const cdnType = process.argv[2] || 'all';

// Validate CDN type
if (!['cloudflare', 'vercel', 'fastly', 'all'].includes(cdnType)) {
  console.error(`Invalid CDN type: ${cdnType}`);
  console.error('Please use one of: cloudflare, vercel, fastly, all');
  process.exit(1);
}

// Check if ts-node is installed
try {
  execSync('npx ts-node --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ ts-node is required but not available. Please install it using:');
  console.error('npm install -g ts-node typescript');
  process.exit(1);
}

// Path to the test runner script
const testRunnerPath = path.join(__dirname, '..', 'src-v2', 'tests', 'cdn-test-runner.ts');

// Check if the test runner exists
if (!fs.existsSync(testRunnerPath)) {
  console.error(`❌ Test runner not found at: ${testRunnerPath}`);
  process.exit(1);
}

console.log(`🧪 Running CDN adapter tests for: ${cdnType.toUpperCase()}`);
console.log('=====================================================');

try {
  // Run the test runner with the specified CDN type
  execSync(`npx ts-node ${testRunnerPath} ${cdnType}`, { 
    stdio: 'inherit',
    encoding: 'utf-8'
  });
  console.log('🎉 Tests completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Tests failed!');
  process.exit(1);
} 