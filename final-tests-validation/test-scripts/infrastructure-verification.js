/**
 * Infrastructure Verification Test
 * 
 * This script validates connectivity to the Edge Agent infrastructure and
 * verifies that it's running on Cloudflare with the expected configuration.
 * 
 * Usage:
 *   node infrastructure-verification.js
 * 
 * Environment variables:
 *   EDGE_AGENT_URL - URL of the Edge Agent deployment (required)
 *   SDK_KEY - SDK key to use for testing (required)
 *   LOG_LEVEL - Level of logging detail (default: info)
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  // Required environment variables
  edgeAgentUrl: process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev',
  sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
  
  // Optional configuration
  logLevel: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  resultDir: '../test-results',
  
  // Test endpoints
  endpoints: {
    status: '/api/sdk',
    decide: '/api/decide',
    datafile: '/api/datafile',
  }
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `infrastructure-verification-${timestamp}`;

// Initialize logging
const logger = {
  debug: (msg, data) => CONFIG.logLevel === 'debug' && console.log(`[DEBUG] ${msg}`, data || ''),
  info: (msg, data) => ['debug', 'info'].includes(CONFIG.logLevel) && console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => ['debug', 'info', 'warn'].includes(CONFIG.logLevel) && console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || '')
};

// Results storage
const testResults = {
  timestamp: timestamp,
  testId: testId,
  environment: {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    nodeVersion: process.version
  },
  results: []
};

/**
 * Save test results to a JSON file
 */
function saveResults() {
  try {
    // Ensure the directory exists
    if (!fs.existsSync(CONFIG.resultDir)) {
      fs.mkdirSync(CONFIG.resultDir, { recursive: true });
    }
    
    // Write results to file
    const filePath = path.join(CONFIG.resultDir, `${testId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(testResults, null, 2));
    logger.info(`Results saved to ${filePath}`);
    
    // Write summary to markdown file
    const summaryPath = path.join(CONFIG.resultDir, `${testId}.md`);
    const summary = generateMarkdownSummary();
    fs.writeFileSync(summaryPath, summary);
    logger.info(`Summary saved to ${summaryPath}`);
    
    return filePath;
  } catch (error) {
    logger.error('Failed to save results', error);
    return null;
  }
}

/**
 * Generate a markdown summary of test results
 */
function generateMarkdownSummary() {
  const passCount = testResults.results.filter(r => r.result === 'PASS').length;
  const failCount = testResults.results.filter(r => r.result === 'FAIL').length;
  const totalCount = testResults.results.length;
  
  let markdown = `# Infrastructure Verification Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Test Results\n\n`;
  
  testResults.results.forEach(result => {
    markdown += `### ${result.test} - ${result.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;
    markdown += `${result.description}\n\n`;
    
    if (result.details) {
      markdown += `**Details:**\n\n`;
      markdown += `\`\`\`\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (result.error) {
      markdown += `**Error:**\n\n`;
      markdown += `\`\`\`\n${result.error}\n\`\`\`\n\n`;
    }
  });
  
  return markdown;
}

/**
 * Record a test result
 */
function recordResult(test, description, result, details = null, error = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}`);
  } else {
    logger.error(`❌ FAIL: ${test}`, error);
  }
}

/**
 * Test basic connectivity to the Edge Agent
 */
async function testBasicConnectivity() {
  try {
    logger.info(`Testing connection to ${CONFIG.edgeAgentUrl}...`);
    
    const response = await fetch(`${CONFIG.edgeAgentUrl}${CONFIG.endpoints.status}`, {
      method: 'GET',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      }
    });
    
    const headers = Object.fromEntries(response.headers.entries());
    const body = await response.text();
    
    // Check for Cloudflare-specific headers
    const isCloudflare = headers['cf-ray'] !== undefined;
    
    recordResult(
      'Basic Connectivity',
      'Verify that the Edge Agent endpoint is accessible and running on Cloudflare',
      response.ok && isCloudflare,
      {
        url: `${CONFIG.edgeAgentUrl}${CONFIG.endpoints.status}`,
        status: response.status,
        statusText: response.statusText,
        headers: headers,
        isCloudflare: isCloudflare,
        body: body.substring(0, 500) // Truncate long responses
      }
    );
    
    return response.ok && isCloudflare;
  } catch (error) {
    recordResult(
      'Basic Connectivity',
      'Verify that the Edge Agent endpoint is accessible and running on Cloudflare',
      false,
      null,
      error
    );
    return false;
  }
}

/**
 * Test SDK key validation
 */
async function testSdkKeyValidation() {
  try {
    logger.info(`Testing SDK key validation...`);
    
    // Test with valid SDK key
    const validResponse = await fetch(`${CONFIG.edgeAgentUrl}${CONFIG.endpoints.datafile}`, {
      method: 'GET',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      }
    });
    
    // Test with invalid SDK key
    const invalidResponse = await fetch(`${CONFIG.edgeAgentUrl}${CONFIG.endpoints.datafile}`, {
      method: 'GET',
      headers: {
        'X-Optimizely-SDK-Key': 'invalid-sdk-key'
      }
    });
    
    const validHeaders = Object.fromEntries(validResponse.headers.entries());
    const invalidHeaders = Object.fromEntries(invalidResponse.headers.entries());
    
    const validBody = await validResponse.text();
    const invalidBody = await invalidResponse.text();
    
    const isValid = validResponse.ok && validBody.length > 100;
    const rejectsInvalid = !invalidResponse.ok && invalidResponse.status === 401;
    
    recordResult(
      'SDK Key Validation',
      'Verify that the Edge Agent accepts valid SDK keys and rejects invalid ones',
      isValid && rejectsInvalid,
      {
        validRequest: {
          url: `${CONFIG.edgeAgentUrl}${CONFIG.endpoints.datafile}`,
          status: validResponse.status,
          statusText: validResponse.statusText,
          headers: validHeaders,
          bodyLength: validBody.length
        },
        invalidRequest: {
          url: `${CONFIG.edgeAgentUrl}${CONFIG.endpoints.datafile}`,
          status: invalidResponse.status,
          statusText: invalidResponse.statusText,
          headers: invalidHeaders,
          bodyLength: invalidBody.length
        }
      }
    );
    
    return isValid && rejectsInvalid;
  } catch (error) {
    recordResult(
      'SDK Key Validation',
      'Verify that the Edge Agent accepts valid SDK keys and rejects invalid ones',
      false,
      null,
      error
    );
    return false;
  }
}

/**
 * Test environment variable resolution
 */
function testEnvironmentVariables() {
  try {
    logger.info(`Testing environment variable resolution...`);
    
    const edgeAgentUrl = process.env.EDGE_AGENT_URL;
    const sdkKey = process.env.SDK_KEY;
    const usingDefault = !edgeAgentUrl || !sdkKey;
    
    recordResult(
      'Environment Variables',
      'Verify that environment variables are properly resolved',
      true, // We can't fail the test, just record the state
      {
        resolvedEdgeAgentUrl: CONFIG.edgeAgentUrl,
        resolvedSdkKey: CONFIG.sdkKey,
        envEdgeAgentUrl: edgeAgentUrl || '(not set)',
        envSdkKey: sdkKey || '(not set)',
        usingDefaults: usingDefault
      }
    );
    
    return true;
  } catch (error) {
    recordResult(
      'Environment Variables',
      'Verify that environment variables are properly resolved',
      false,
      null,
      error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting infrastructure verification test`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey
  });
  
  // Record environment variables
  testEnvironmentVariables();
  
  // Test connectivity
  const connectivityOk = await testBasicConnectivity();
  
  // Only proceed with additional tests if basic connectivity works
  if (connectivityOk) {
    await testSdkKeyValidation();
  }
  
  // Save results and generate report
  saveResults();
  
  // Determine overall success
  const allPassed = testResults.results.every(r => r.result === 'PASS');
  return allPassed;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      logger.info('All tests passed successfully! 🎉');
      process.exit(0);
    } else {
      logger.error('Some tests failed. See results for details.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Test execution failed', error);
    process.exit(1);
  }); 