#!/usr/bin/env node

/**
 * @fileoverview Command-line script for running local environment tests
 * 
 * This script provides a command-line interface for executing tests using the 
 * LocalTestRunner. It supports running individual tests or the full test suite
 * with various configuration options.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { LocalTestRunner, TEST_EXECUTION_ORDER } = require('./local-test-runner');
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
    wranglerEnabled: true,
    abortOnFailure: false,
    outputPath: null,
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
    } else if (arg === '--no-wrangler') {
      options.wranglerEnabled = false;
    } else if (arg === '--abort-on-failure') {
      options.abortOnFailure = true;
    } else if (arg === '--output' || arg === '-o') {
      options.outputPath = args[++i];
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
  console.log('Usage: node run-tests.js [options] [test-name]');
  console.log('\nOptions:');
  console.log('  --test, -t <name>       Run a specific test by name');
  console.log('  --all, -a               Run all tests in dependency order');
  console.log('  --no-wrangler           Disable Wrangler dev process');
  console.log('  --abort-on-failure      Stop test suite execution on first test failure');
  console.log('  --output, -o <path>     Set custom output path for results');
  console.log('  --list, -l              List available tests');
  console.log('  --verbose, -v           Enable verbose logging');
  console.log('  --help, -h              Show this help message');
  console.log('\nExamples:');
  console.log('  node run-tests.js --all                           # Run all tests');
  console.log('  node run-tests.js infrastructure-verification.js  # Run specific test');
  console.log('  node run-tests.js -t decision-api-test.js        # Run specific test');
  console.log('  node run-tests.js --all --no-wrangler            # Run all tests without Wrangler');
}

/**
 * List available tests
 * @param {LocalTestRunner} runner - Initialized test runner
 */
function listTests(runner) {
  console.log('Available tests:');
  console.log('----------------');
  
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

  // Create and initialize the test runner
  const testRunner = new LocalTestRunner({
    localEnvironment: {
      wranglerEnabled: options.wranglerEnabled,
      enableNetworkLogging: true
    },
    outputPath: options.outputPath || path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'results'),
    abortOnFailure: options.abortOnFailure
  });
  
  try {
    await testRunner.initialize();
    
    // List tests and exit if requested
    if (options.listTests) {
      listTests(testRunner);
      return;
    }
    
    // Run tests based on command line options
    if (options.runAll) {
      console.log('Running all tests in dependency order...');
      const results = await testRunner.runAllTests();
      
      // Display summary
      console.log('\nTest Suite Results:');
      console.log(`Total: ${results.testsRun}`);
      console.log(`Passed: ${results.testsPassed}`);
      console.log(`Failed: ${results.testsFailed}`);
      console.log(`Errors: ${results.testsWithErrors}`);
      
      // Exit with non-zero code if any tests failed
      if (results.testsFailed > 0 || results.testsWithErrors > 0) {
        process.exit(1);
      }
    } else if (options.testName) {
      console.log(`Running single test: ${options.testName}`);
      const result = await testRunner.runTest(options.testName);
      
      // Display result
      console.log('\nTest Result:');
      console.log(`Success: ${result.success}`);
      
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }
      
      // Exit with non-zero code if test failed
      if (!result.success) {
        process.exit(1);
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