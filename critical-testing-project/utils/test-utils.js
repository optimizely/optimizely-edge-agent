/**
 * Common utility functions for Edge Agent tests
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a unique test ID based on test name and timestamp
 * @param {string} testName - The name of the test
 * @returns {string} A unique test ID
 */
function generateTestId(testName) {
  const timestamp = Date.now();
  const sanitizedTestName = testName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${sanitizedTestName}-${timestamp}`;
}

/**
 * Save test results to a JSON file
 * @param {object} results - The test results object
 * @param {string} testId - The unique test ID
 * @param {string} resultsDir - The directory to save results to
 * @returns {string} The path to the saved file
 */
function saveTestResults(results, testId, resultsDir = '../results') {
  const resultsPath = path.join(__dirname, resultsDir);
  
  // Ensure results directory exists
  if (!fs.existsSync(resultsPath)) {
    fs.mkdirSync(resultsPath, { recursive: true });
  }
  
  const filePath = path.join(resultsPath, `${testId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  return filePath;
}

/**
 * Generate a Markdown report from test results
 * @param {object} results - The test results object
 * @param {string} testId - The unique test ID
 * @param {string} resultsDir - The directory to save results to
 * @returns {string} The path to the saved report
 */
function generateReport(results, testId, resultsDir = '../results/reports') {
  const reportPath = path.join(__dirname, resultsDir);
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }
  
  // Format the report content
  const report = `# Test Report: ${results.name || 'Unnamed Test'}

## Summary

- **Test ID:** ${testId}
- **Timestamp:** ${results.timestamp || new Date().toISOString()}
- **Status:** ${results.summary?.status?.toUpperCase() || 'UNKNOWN'}
- **Total Tests:** ${results.summary?.totalTests || 0}
- **Passed:** ${results.summary?.passed || 0}
- **Failed:** ${results.summary?.failed || 0}

## Environment

${Object.entries(results.environment || {}).map(([key, value]) => `- **${key}:** ${value}`).join('\n')}

## Test Results

${(results.tests || []).map(test => `
### ${test.name}

- **Status:** ${test.status?.toUpperCase() || 'UNKNOWN'}
- **Timestamp:** ${test.timestamp || ''}

${Object.entries(test.details || {}).map(([key, value]) => `- **${key}:** ${value}`).join('\n')}

${test.evidence ? '#### Evidence\n\n' + Object.entries(test.evidence)
  .filter(([key, value]) => typeof value === 'string')
  .map(([key, value]) => `**${key}:**\n\`\`\`\n${value}\n\`\`\``).join('\n\n') : ''}
`).join('\n')}

## Conclusion

${results.summary?.status === 'passed' 
  ? 'All tests have passed successfully.' 
  : `Some tests have failed. See the detailed results above for more information.`}
`;

  const filePath = path.join(reportPath, `${testId}.md`);
  fs.writeFileSync(filePath, report);
  return filePath;
}

/**
 * Create a standard test result structure
 * @param {string} testName - The name of the test
 * @param {object} environment - Environment information
 * @returns {object} A standard test result structure
 */
function createTestResults(testName, environment = {}) {
  return {
    name: testName,
    timestamp: new Date().toISOString(),
    environment: {
      EDGE_AGENT_URL: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
      SDK_KEY: process.env.SDK_KEY ? '****' + process.env.SDK_KEY.substr(-4) : 'not-set',
      nodeVersion: process.version,
      platform: process.platform,
      ...environment
    },
    tests: [],
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      status: 'not-run'
    }
  };
}

/**
 * Update the summary in a test results object
 * @param {object} results - The test results object
 * @returns {object} The updated test results object
 */
function updateSummary(results) {
  results.summary.totalTests = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
  results.summary.failed = results.tests.filter(t => t.status === 'failed').length;
  results.summary.status = results.summary.failed === 0 ? 'passed' : 'failed';
  return results;
}

/**
 * Create a new test case structure
 * @param {string} testName - The name of the test
 * @returns {object} A new test case structure
 */
function createTestCase(testName) {
  return {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {},
    evidence: {}
  };
}

/**
 * Load environment variables from .env file
 */
function loadEnv() {
  try {
    require('dotenv').config();
  } catch (error) {
    console.warn('Could not load dotenv, using process.env only.');
  }
}

/**
 * Print test case result to console
 * @param {object} testCase - The test case object
 */
function logTestResult(testCase) {
  if (testCase.status === 'passed') {
    console.log(`✅ ${testCase.name} - Passed`);
    if (testCase.details.message) {
      console.log(`   ${testCase.details.message}`);
    }
  } else {
    console.error(`❌ ${testCase.name} - Failed`);
    if (testCase.details.error) {
      console.error(`   Error: ${testCase.details.error}`);
    }
  }
}

module.exports = {
  generateTestId,
  saveTestResults,
  generateReport,
  createTestResults,
  updateSummary,
  createTestCase,
  loadEnv,
  logTestResult
}; 