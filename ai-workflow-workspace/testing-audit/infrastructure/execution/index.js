/**
 * @fileoverview Index file for the Test Execution Infrastructure
 * 
 * This file exports all components of the test execution infrastructure,
 * making it easier to import and use them in other modules.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { LocalTestRunner, TEST_EXECUTION_ORDER } = require('./local-test-runner');
const liveTesting = require('./live');

/**
 * Run a single test using the local test runner
 * @param {string} testName - The name of the test to run
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Test result
 */
async function runSingleTest(testName, options = {}) {
  const runner = new LocalTestRunner(options);
  await runner.initialize();
  return await runner.runTest(testName);
}

/**
 * Run all tests in dependency order
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Test suite results
 */
async function runAllTests(options = {}) {
  const runner = new LocalTestRunner(options);
  await runner.initialize();
  return await runner.runAllTests();
}

/**
 * Run a single test against the live environment
 * @param {string} testName - The name of the test to run
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Test result
 */
async function runLiveTest(testName, options = {}) {
  const runner = new liveTesting.LiveTestRunner(options);
  await runner.initialize();
  return await runner.runLiveTest(testName);
}

/**
 * Run a comparison test between local and live environments
 * @param {string} testName - The name of the test to run
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Comparison result
 */
async function runComparisonTest(testName, options = {}) {
  const runner = new liveTesting.LiveTestRunner(options);
  await runner.initialize();
  return await runner.runComparisonTest(testName);
}

/**
 * Run all tests in comparison mode
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Comparison suite results
 */
async function runAllComparisonTests(options = {}) {
  const runner = new liveTesting.LiveTestRunner(options);
  await runner.initialize();
  return await runner.runAllComparisonTests(options);
}

/**
 * Get a list of available tests
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Object containing test information
 */
async function listAvailableTests(options = {}) {
  const runner = new LocalTestRunner(options);
  await runner.initialize();
  
  return {
    orderedTests: TEST_EXECUTION_ORDER.filter(testName => runner.testFiles[testName]),
    allTests: Object.keys(runner.testFiles),
    verificationCriteria: Object.keys(runner.verificationCriteria)
  };
}

module.exports = {
  // Local testing
  LocalTestRunner,
  TEST_EXECUTION_ORDER,
  runSingleTest,
  runAllTests,
  
  // Live testing
  LiveTestRunner: liveTesting.LiveTestRunner,
  runLiveTest,
  runComparisonTest,
  runAllComparisonTests,
  
  // Utility functions
  listAvailableTests
}; 