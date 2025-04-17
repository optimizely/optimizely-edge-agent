#!/usr/bin/env node

/**
 * @fileoverview Command-line script for running tests against the live environment
 * 
 * This script provides a command-line interface for executing tests using the 
 * LiveTestRunner. It supports running individual tests against the live environment
 * or running comparison tests (local vs. live) with various configuration options.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { LiveTestRunner, TEST_EXECUTION_ORDER } = require('./live-test-runner');
const path = require('path');
const fs = require('fs');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    testName: null,
    runAll: false,
    comparison: false,
    rateLimiting: true,
    abortOnFailure: false,
    safeMode: true,
    outputPath: null,
    cloudflareUrl: process.env.CLOUDFLARE_WORKER_URL,
    sdkKey: process.env.OPTIMIZELY_SDK_KEY,
    help: false,
    listTests: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--test' || arg === '-t') {
      options.testName = args[++i];
    } else if (arg === '--all' || arg === '-a') {
      options.runAll = true;
    } else if (arg === '--comparison' || arg === '-c') {
      options.comparison = true;
    } else if (arg === '--no-rate-limit') {
      options.rateLimiting = false;
    } else if (arg === '--abort-on-failure') {
      options.abortOnFailure = true;
    } else if (arg === '--no-safe-mode') {
      options.safeMode = false;
    } else if (arg === '--output' || arg === '-o') {
      options.outputPath = args[++i];
    } else if (arg === '--url') {
      options.cloudflareUrl = args[++i];
    } else if (arg === '--key') {
      options.sdkKey = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list' || arg === '-l') {
      options.listTests = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (!options.testName && !arg.startsWith('-')) {
      // Assume it's a test name if not starting with -
      options.testName = arg;
    }
  }

  return options;
}

/**
 * Display help message
 */
function showHelp() {
  console.log('Usage: node run-live-tests.js [options] [test-name]');
  console.log('\nOptions:');
  console.log('  --test, -t <name>      Run a specific test by name');
  console.log('  --all, -a              Run all tests in dependency order');
  console.log('  --comparison, -c       Run comparison tests (local vs. live)');
  console.log('  --no-rate-limit        Disable rate limiting for requests');
  console.log('  --abort-on-failure     Stop test suite execution on first test failure');
  console.log('  --no-safe-mode         Disable safe mode (allows potentially destructive operations)');
  console.log('  --output, -o <path>    Set custom output path for results');
  console.log('  --url <url>            Specify Cloudflare Worker URL (default: env CLOUDFLARE_WORKER_URL)');
  console.log('  --key <key>            Specify SDK Key (default: env OPTIMIZELY_SDK_KEY)');
  console.log('  --list, -l             List available tests');
  console.log('  --verbose, -v          Enable verbose logging');
  console.log('  --help, -h             Show this help message');
  console.log('\nExamples:');
  console.log('  node run-live-tests.js --all --comparison      # Run all tests in comparison mode');
  console.log('  node run-live-tests.js decision-api-test.js    # Run specific test against live environment');
  console.log('  node run-live-tests.js -t decision-api-test.js -c  # Run specific comparison test');
  console.log('\nEnvironment Variables:');
  console.log('  CLOUDFLARE_WORKER_URL   The URL of the Cloudflare Worker');
  console.log('  OPTIMIZELY_SDK_KEY      The SDK Key for authentication');
  console.log('\nCAUTION: This script runs tests against the live Cloudflare Worker environment.');
  console.log('         Safe mode is enabled by default to prevent destructive operations.');
}

/**
 * List available tests
 * @param {LiveTestRunner} runner - Initialized test runner
 */
function listTests(runner) {
  console.log('Available tests for live execution:');
  console.log('----------------------------------');
  
  // Display tests in dependency order
  const availableTests = TEST_EXECUTION_ORDER.filter(testName => runner.testFiles[testName]);
  
  if (availableTests.length === 0) {
    console.log('No tests found!');
    return;
  }
  
  console.log('Dependency order:');
  availableTests.forEach((testName, index) => {
    const testFile = runner.testFiles[testName];
    const hasCriteria = runner.verificationCriteria[testName.replace(/\.js$/, '')] ? '✅' : '❌';
    
    console.log(`${index + 1}. ${testName} - Verification Criteria: ${hasCriteria}`);
    if (testFile && testFile.modified) {
      console.log(`   Last modified: ${testFile.modified}`);
    }
  });
  
  console.log('\nIndividual tests:');
  Object.keys(runner.testFiles).sort().forEach(testName => {
    if (!availableTests.includes(testName)) {
      const testFile = runner.testFiles[testName];
      const hasCriteria = runner.verificationCriteria[testName.replace(/\.js$/, '')] ? '✅' : '❌';
      
      console.log(`- ${testName} - Verification Criteria: ${hasCriteria}`);
      if (testFile && testFile.modified) {
        console.log(`   Last modified: ${testFile.modified}`);
      }
    }
  });
}

/**
 * Display warning message for live environment testing
 */
function showLiveWarning() {
  console.log('\n' + '!'.repeat(80));
  console.log('WARNING: You are about to run tests against the LIVE Cloudflare Worker environment.');
  console.log('This may have impacts on production data or services.');
  console.log('!'.repeat(80) + '\n');
  
  console.log('Press CTRL+C to abort or ENTER to continue...');
  return new Promise(resolve => {
    process.stdin.once('data', () => {
      console.log('\nProceeding with live environment testing...\n');
      resolve();
    });
  });
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const options = parseArgs();
  
  // Show help and exit if requested
  if (options.help) {
    showHelp();
    return;
  }

  // Create the live test runner with options
  const testRunner = new LiveTestRunner({
    liveEnvironment: {
      url: options.cloudflareUrl,
      apiKey: options.sdkKey,
      enableRateLimiting: options.rateLimiting,
      enableSafeMode: options.safeMode
    },
    outputPath: options.outputPath || path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'results', 'live'),
    abortOnFailure: options.abortOnFailure,
    createComparisonReports: true
  });
  
  try {
    await testRunner.initialize();
    
    // List tests and exit if requested
    if (options.listTests) {
      listTests(testRunner);
      return;
    }
    
    // Show warning for live environment and wait for confirmation
    await showLiveWarning();
    
    // Run tests based on command line options
    if (options.runAll) {
      if (options.comparison) {
        console.log('Running all tests in comparison mode (local vs. live)...');
        const results = await testRunner.runAllComparisonTests();
        
        // Display summary
        console.log('\nComparison Test Suite Results:');
        console.log(`Total: ${results.testsRun}`);
        console.log(`Matching: ${results.matchingResults}`);
        console.log(`Discrepancies: ${results.discrepancies}`);
        console.log(`Errors: ${results.errors}`);
        
        // Exit with non-zero code if any tests had errors
        if (results.errors > 0) {
          process.exit(1);
        }
      } else {
        console.log('Running all tests against live environment...');
        const results = { testsRun: 0, testsPassed: 0, testsFailed: 0 };
        
        // Run tests in dependency order
        const executionOrder = TEST_EXECUTION_ORDER.filter(testName => testRunner.testFiles[testName]);
        
        for (const testName of executionOrder) {
          console.log(`\n${'='.repeat(80)}\nRunning live test [${results.testsRun + 1}/${executionOrder.length}]: ${testName}\n${'='.repeat(80)}\n`);
          
          // Run the test against live environment
          const result = await testRunner.runLiveTest(testName);
          results.testsRun++;
          
          if (result.success) {
            results.testsPassed++;
          } else {
            results.testsFailed++;
            
            // Abort on failure if configured
            if (options.abortOnFailure) {
              console.log(`Test ${testName} failed, aborting test suite execution`);
              break;
            }
          }
        }
        
        // Display summary
        console.log('\nLive Test Suite Results:');
        console.log(`Total: ${results.testsRun}`);
        console.log(`Passed: ${results.testsPassed}`);
        console.log(`Failed: ${results.testsFailed}`);
        
        // Exit with non-zero code if any tests failed
        if (results.testsFailed > 0) {
          process.exit(1);
        }
      }
    } else if (options.testName) {
      if (options.comparison) {
        console.log(`Running comparison test for: ${options.testName}`);
        const result = await testRunner.runComparisonTest(options.testName);
        
        // Display result
        console.log('\nComparison Result:');
        console.log(`Local Success: ${result.localSuccess}`);
        console.log(`Live Success: ${result.liveSuccess}`);
        console.log(`Results Match: ${result.comparisonMatch}`);
        
        if (result.discrepancies && result.discrepancies.length > 0) {
          console.log(`Discrepancy Count: ${result.discrepancies.length}`);
        }
        
        // Exit with non-zero code if test failed in either environment
        if (!result.localSuccess || !result.liveSuccess) {
          process.exit(1);
        }
      } else {
        console.log(`Running live test: ${options.testName}`);
        const result = await testRunner.runLiveTest(options.testName);
        
        // Display result
        console.log('\nLive Test Result:');
        console.log(`Success: ${result.success}`);
        
        if (result.error) {
          console.error(`Error: ${result.error}`);
        }
        
        // Exit with non-zero code if test failed
        if (!result.success) {
          process.exit(1);
        }
      }
    } else {
      console.log('No test specified. Use --all to run all tests or specify a test name.');
      console.log('Use --help for usage information or --list to see available tests.');
    }
  } catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
  }
}

// Run main function
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 