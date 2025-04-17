#!/usr/bin/env node
/**
 * @fileoverview Enhanced Test Runner CLI
 * 
 * This module provides a command-line interface for running tests with
 * the environment-aware enhanced test runner.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');
const { EnhancedTestRunner } = require('../execution/enhanced-test-runner');

// Parse command line arguments
const args = process.argv.slice(2);
const options = parseCommandLineArgs(args);

// Show help if requested
if (options.help) {
  showHelp();
  process.exit(0);
}

// Validate required options
if (!options.test && !options.directory) {
  console.error('Error: Either --test or --directory must be specified');
  showHelp();
  process.exit(1);
}

// Run the test(s)
async function main() {
  try {
    if (options.test) {
      // Run single test
      await runSingleTest(options.test, options);
    } else if (options.directory) {
      // Run all tests in directory
      await runTestDirectory(options.directory, options);
    }
  } catch (error) {
    console.error('Error during test execution:', error.message);
    process.exit(1);
  }
}

// Run a single test file
async function runSingleTest(testFile, options) {
  console.log(`\n=== Running test: ${testFile} ===\n`);
  
  // Resolve test file path
  const testPath = path.resolve(process.cwd(), testFile);
  
  // Validate test file exists
  if (!fs.existsSync(testPath)) {
    throw new Error(`Test file not found: ${testPath}`);
  }
  
  // Load test module
  const testModule = require(testPath);
  
  // Get test function
  const testFn = testModule.default || testModule.test || testModule;
  
  if (typeof testFn !== 'function') {
    throw new Error(`No test function found in ${testPath}`);
  }
  
  // Set up environment options
  const environment = {
    baseUrl: options.baseUrl || process.env.CLOUDFLARE_WORKER_URL || 'http://localhost:8787',
    testType: options.type || 'default',
    environment: {
      mode: options.forceMode
    }
  };
  
  // Create test runner
  const testId = path.basename(testFile, path.extname(testFile));
  const runner = new EnhancedTestRunner(testId, {
    testType: options.type,
    executorOptions: {
      enableRetryForFetch: options.retry
    }
  });
  
  // Run test or comparison
  if (options.compare) {
    const results = await runner.runComparison(testFn, {
      maxTimeDifference: options.timeDifference
    });
    
    // Output comparison results
    console.log('\n=== Comparison Results ===\n');
    console.log(`Status: ${results.comparison.status}`);
    console.log(`Discrepancies: ${results.comparison.discrepancies.length}`);
    
    if (results.comparison.discrepancies.length > 0) {
      console.log('\nDiscrepancies found:');
      for (const discrepancy of results.comparison.discrepancies) {
        console.log(`- ${discrepancy.type}: ${discrepancy.description}`);
      }
    }
    
    // Save results to file if requested
    if (options.output) {
      const outputPath = path.resolve(process.cwd(), options.output);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`\nResults saved to: ${outputPath}`);
    }
  } else {
    const result = await runner.runTest(testFn, environment);
    
    // Output test results
    console.log('\n=== Test Results ===\n');
    console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`Environment: ${result.environment.name}`);
    console.log(`Duration: ${result.duration}ms`);
    
    if (!result.success && result.error) {
      console.log(`Error: ${result.error.message}`);
    }
    
    // Save results to file if requested
    if (options.output) {
      const outputPath = path.resolve(process.cwd(), options.output);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\nResults saved to: ${outputPath}`);
    }
  }
}

// Run all tests in a directory
async function runTestDirectory(directory, options) {
  console.log(`\n=== Running all tests in: ${directory} ===\n`);
  
  // Resolve directory path
  const dirPath = path.resolve(process.cwd(), directory);
  
  // Validate directory exists
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  
  // Get all JavaScript files in directory
  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.js') && !file.endsWith('.test.js'))
    .map(file => path.join(directory, file));
  
  if (files.length === 0) {
    console.log('No test files found in directory');
    return;
  }
  
  console.log(`Found ${files.length} test files\n`);
  
  // Run each test
  const results = [];
  for (const file of files) {
    try {
      // Create output option for this specific test
      const testOptions = { ...options };
      
      if (options.output) {
        const baseName = path.basename(file, path.extname(file));
        testOptions.output = path.join(
          path.dirname(options.output),
          `${baseName}-${path.basename(options.output)}`
        );
      }
      
      await runSingleTest(file, testOptions);
      results.push({ file, success: true });
    } catch (error) {
      console.error(`Error running test ${file}:`, error.message);
      results.push({ file, success: false, error: error.message });
    }
  }
  
  // Output summary
  console.log('\n=== Test Run Summary ===\n');
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  if (results.some(r => !r.success)) {
    console.log('\nFailed tests:');
    for (const result of results.filter(r => !r.success)) {
      console.log(`- ${result.file}: ${result.error}`);
    }
  }
}

// Parse command line arguments
function parseCommandLineArgs(args) {
  const options = {
    baseUrl: process.env.CLOUDFLARE_WORKER_URL || 'http://localhost:8787',
    retry: true,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--test':
      case '-t':
        options.test = args[++i];
        break;
      case '--directory':
      case '-d':
        options.directory = args[++i];
        break;
      case '--type':
        options.type = args[++i];
        break;
      case '--base-url':
      case '-b':
        options.baseUrl = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--compare':
      case '-c':
        options.compare = true;
        break;
      case '--force-mode':
      case '-m':
        options.forceMode = args[++i];
        break;
      case '--no-retry':
        options.retry = false;
        break;
      case '--time-difference':
        options.timeDifference = parseInt(args[++i], 10);
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option: ${arg}`);
        }
    }
  }
  
  return options;
}

// Show help message
function showHelp() {
  console.log(`
Enhanced Test Runner CLI

Usage:
  node run-test.js [options]

Options:
  --test, -t <file>            Test file to run
  --directory, -d <dir>        Directory containing test files to run
  --type <type>                Test type (default, kv-storage, decision-api, etc.)
  --base-url, -b <url>         Base URL for test requests (default: CLOUDFLARE_WORKER_URL or http://localhost:8787)
  --output, -o <file>          Save results to JSON file
  --compare, -c                Run test in both local and live environments and compare results
  --force-mode, -m <mode>      Force environment mode ('local' or 'live')
  --no-retry                   Disable retry logic for operations
  --time-difference <ms>       Maximum acceptable time difference for comparison (default: 1000ms)
  --verbose, -v                Enable verbose logging
  --help, -h                   Show this help message

Examples:
  node run-test.js --test tests/example-test.js
  node run-test.js --directory tests --type kv-storage
  node run-test.js --test tests/example-test.js --compare --output results.json
  node run-test.js --test tests/example-test.js --force-mode live
  `);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 