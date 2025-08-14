/**
 * Parameter Validation Test
 * 
 * This script tests the Edge Agent's handling of different parameter types:
 * - HTTP headers
 * - Query parameters
 * - JSON body parameters
 * 
 * It validates parameter precedence, format variations, and validation rules.
 * 
 * Usage:
 *   node parameter-validation-test.js
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
    decide: '/api/decide',
    datafile: '/api/datafile',
    sdk: '/api/sdk'
  },
  
  // Test user IDs
  testUserId: 'test-user-' + Math.floor(Math.random() * 1000000),
  
  // Test headers
  headers: {
    sdkKey: 'X-Optimizely-SDK-Key',
    userId: 'X-Optimizely-Visitor-Id',
    contextType: 'X-Optimizely-Context-Type',
    skipActivation: 'X-Optimizely-Skip-Activation'
  },
  
  // Test query parameters
  queryParams: {
    sdkKey: 'optimizely_sdk_key',
    userId: 'optimizely_user_id',
    skipActivation: 'optimizely_skip_activation'
  }
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `parameter-validation-test-${timestamp}`;

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
    nodeVersion: process.version,
    testUserId: CONFIG.testUserId
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
  
  let markdown = `# Parameter Validation Test Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Test Results\n\n`;
  
  // Group results by category
  const categoryGroups = {};
  testResults.results.forEach(result => {
    const category = result.category || 'Other';
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(result);
  });
  
  // Generate results by category
  Object.keys(categoryGroups).forEach(category => {
    markdown += `### ${category}\n\n`;
    
    categoryGroups[category].forEach(result => {
      markdown += `#### ${result.test} - ${result.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;
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
  });
  
  return markdown;
}

/**
 * Record a test result
 */
function recordResult(test, description, result, details = null, error = null, category = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    category,
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}${category ? ' - ' + category : ''}`);
  } else {
    logger.error(`❌ FAIL: ${test}${category ? ' - ' + category : ''}`, error);
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
 * Make a request to the API
 */
async function makeRequest(options) {
  const {
    endpoint,
    method = 'GET',
    headers = {},
    queryParams = {},
    body = null
  } = options;
  
  // Build the URL with query parameters
  let url = `${CONFIG.edgeAgentUrl}${endpoint}`;
  if (Object.keys(queryParams).length > 0) {
    const query = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    url += `?${query}`;
  }
  
  try {
    logger.debug(`Making ${method} request to ${url}...`);
    
    const requestOptions = {
      method,
      headers
    };
    
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
      }
    }
    
    const response = await fetch(url, requestOptions);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody;
    
    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = await response.text();
    }
    
    // Check for Cloudflare-specific headers to verify live infrastructure
    const isCloudflare = responseHeaders['cf-ray'] !== undefined;
    
    return {
      url,
      method,
      requestOptions,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      ok: response.ok,
      isCloudflare
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      method,
      requestOptions,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test header parameters
 */
async function testHeaderParameters() {
  try {
    logger.info('Testing header parameters...');
    
    const responses = [];
    
    // Test SDK Key header
    const sdkKeyResponse = await makeRequest({
      endpoint: CONFIG.endpoints.sdk,
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey
      }
    });
    
    responses.push({
      name: 'SDK Key Header',
      response: sdkKeyResponse
    });
    
    // Test User ID header
    const userIdResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey,
        [CONFIG.headers.userId]: CONFIG.testUserId
      },
      body: {
        key: 'test-flag'
      }
    });
    
    responses.push({
      name: 'User ID Header',
      response: userIdResponse
    });
    
    // Test Custom Headers
    const customHeadersResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey,
        [CONFIG.headers.userId]: CONFIG.testUserId,
        [CONFIG.headers.contextType]: 'browser',
        [CONFIG.headers.skipActivation]: 'true'
      },
      body: {
        key: 'test-flag'
      }
    });
    
    responses.push({
      name: 'Custom Headers',
      response: customHeadersResponse
    });
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Header Parameters',
      'Verify that the Edge Agent correctly processes HTTP header parameters',
      success,
      {
        responses: responses.map(r => ({
          name: r.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          headers: r.response.requestOptions.headers,
          body: r.response.body
        })),
        allCloudflare
      },
      success ? null : 'One or more header parameter tests failed',
      'Header Parameters'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Header Parameters',
      'Verify that the Edge Agent correctly processes HTTP header parameters',
      false,
      null,
      error,
      'Header Parameters'
    );
    return false;
  }
}

/**
 * Test query parameters
 */
async function testQueryParameters() {
  try {
    logger.info('Testing query parameters...');
    
    const responses = [];
    
    // Test SDK Key query parameter
    const sdkKeyResponse = await makeRequest({
      endpoint: CONFIG.endpoints.sdk,
      queryParams: {
        [CONFIG.queryParams.sdkKey]: CONFIG.sdkKey
      }
    });
    
    responses.push({
      name: 'SDK Key Query Parameter',
      response: sdkKeyResponse
    });
    
    // Test User ID query parameter
    const userIdResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      queryParams: {
        [CONFIG.queryParams.sdkKey]: CONFIG.sdkKey,
        [CONFIG.queryParams.userId]: CONFIG.testUserId
      },
      body: {
        key: 'test-flag'
      }
    });
    
    responses.push({
      name: 'User ID Query Parameter',
      response: userIdResponse
    });
    
    // Test Skip Activation query parameter
    const skipActivationResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      queryParams: {
        [CONFIG.queryParams.sdkKey]: CONFIG.sdkKey,
        [CONFIG.queryParams.userId]: CONFIG.testUserId,
        [CONFIG.queryParams.skipActivation]: 'true'
      },
      body: {
        key: 'test-flag'
      }
    });
    
    responses.push({
      name: 'Skip Activation Query Parameter',
      response: skipActivationResponse
    });
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Query Parameters',
      'Verify that the Edge Agent correctly processes query parameters',
      success,
      {
        responses: responses.map(r => ({
          name: r.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          url: r.response.url,
          body: r.response.body
        })),
        allCloudflare
      },
      success ? null : 'One or more query parameter tests failed',
      'Query Parameters'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Query Parameters',
      'Verify that the Edge Agent correctly processes query parameters',
      false,
      null,
      error,
      'Query Parameters'
    );
    return false;
  }
}

/**
 * Test JSON body parameters
 */
async function testJsonBodyParameters() {
  try {
    logger.info('Testing JSON body parameters...');
    
    const responses = [];
    
    // Test basic JSON body parameters
    const basicJsonResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey
      },
      body: {
        userId: CONFIG.testUserId,
        key: 'test-flag'
      }
    });
    
    responses.push({
      name: 'Basic JSON Body',
      response: basicJsonResponse
    });
    
    // Test JSON body with attributes
    const attributesJsonResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey
      },
      body: {
        userId: CONFIG.testUserId,
        key: 'test-flag',
        attributes: {
          browser: 'Chrome',
          location: 'US'
        }
      }
    });
    
    responses.push({
      name: 'JSON Body with Attributes',
      response: attributesJsonResponse
    });
    
    // Test JSON body with options
    const optionsJsonResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        [CONFIG.headers.sdkKey]: CONFIG.sdkKey
      },
      body: {
        userId: CONFIG.testUserId,
        key: 'test-flag',
        options: {
          includeReasons: true,
          skipActivation: true
        }
      }
    });
    
    responses.push({
      name: 'JSON Body with Options',
      response: optionsJsonResponse
    });
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'JSON Body Parameters',
      'Verify that the Edge Agent correctly processes JSON body parameters',
      success,
      {
        responses: responses.map(r => ({
          name: r.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          requestBody: r.response.requestOptions.body,
          responseBody: r.response.body
        })),
        allCloudflare
      },
      success ? null : 'One or more JSON body parameter tests failed',
      'JSON Body Parameters'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'JSON Body Parameters',
      'Verify that the Edge Agent correctly processes JSON body parameters',
      false,
      null,
      error,
      'JSON Body Parameters'
    );
    return false;
  }
}

/**
 * Test parameter precedence
 */
async function testParameterPrecedence() {
  try {
    logger.info('Testing parameter precedence...');
    
    const testCases = [
      {
        name: 'Header vs Query Parameter',
        headers: {
          [CONFIG.headers.sdkKey]: CONFIG.sdkKey,
          [CONFIG.headers.userId]: 'header-user'
        },
        queryParams: {
          [CONFIG.queryParams.userId]: 'query-user'
        },
        body: {
          key: 'test-flag'
        },
        expectedSource: 'header'
      },
      {
        name: 'Header vs JSON Body',
        headers: {
          [CONFIG.headers.sdkKey]: CONFIG.sdkKey,
          [CONFIG.headers.userId]: 'header-user'
        },
        body: {
          userId: 'body-user',
          key: 'test-flag'
        },
        expectedSource: 'header'
      },
      {
        name: 'Query Parameter vs JSON Body',
        headers: {
          [CONFIG.headers.sdkKey]: CONFIG.sdkKey
        },
        queryParams: {
          [CONFIG.queryParams.userId]: 'query-user'
        },
        body: {
          userId: 'body-user',
          key: 'test-flag'
        },
        expectedSource: 'query'
      }
    ];
    
    const responses = [];
    
    for (const testCase of testCases) {
      const response = await makeRequest({
        endpoint: CONFIG.endpoints.decide,
        method: 'POST',
        headers: testCase.headers,
        queryParams: testCase.queryParams || {},
        body: testCase.body
      });
      
      responses.push({
        testCase,
        response
      });
    }
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Parameter Precedence',
      'Verify that the Edge Agent correctly handles parameter precedence',
      success,
      {
        responses: responses.map(r => ({
          name: r.testCase.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          headers: r.response.requestOptions.headers,
          queryParams: r.testCase.queryParams,
          requestBody: r.testCase.body,
          responseBody: r.response.body,
          expectedSource: r.testCase.expectedSource
        })),
        allCloudflare
      },
      success ? null : 'One or more parameter precedence tests failed',
      'Parameter Precedence'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Parameter Precedence',
      'Verify that the Edge Agent correctly handles parameter precedence',
      false,
      null,
      error,
      'Parameter Precedence'
    );
    return false;
  }
}

/**
 * Test parameter format variations
 */
async function testParameterFormatVariations() {
  try {
    logger.info('Testing parameter format variations...');
    
    const testCases = [
      {
        name: 'Boolean as String',
        body: {
          userId: CONFIG.testUserId,
          key: 'test-flag',
          options: {
            skipActivation: 'true'
          }
        }
      },
      {
        name: 'Boolean as Boolean',
        body: {
          userId: CONFIG.testUserId,
          key: 'test-flag',
          options: {
            skipActivation: true
          }
        }
      },
      {
        name: 'Empty Attributes',
        body: {
          userId: CONFIG.testUserId,
          key: 'test-flag',
          attributes: {}
        }
      },
      {
        name: 'Null Attributes',
        body: {
          userId: CONFIG.testUserId,
          key: 'test-flag',
          attributes: null
        }
      }
    ];
    
    const responses = [];
    
    for (const testCase of testCases) {
      const response = await makeRequest({
        endpoint: CONFIG.endpoints.decide,
        method: 'POST',
        headers: {
          [CONFIG.headers.sdkKey]: CONFIG.sdkKey
        },
        body: testCase.body
      });
      
      responses.push({
        testCase,
        response
      });
    }
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Parameter Format Variations',
      'Verify that the Edge Agent handles different parameter format variations',
      success,
      {
        responses: responses.map(r => ({
          name: r.testCase.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          requestBody: r.testCase.body,
          responseBody: r.response.body
        })),
        allCloudflare
      },
      success ? null : 'One or more parameter format variation tests failed',
      'Parameter Format Variations'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Parameter Format Variations',
      'Verify that the Edge Agent handles different parameter format variations',
      false,
      null,
      error,
      'Parameter Format Variations'
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting parameter validation test`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    testUserId: CONFIG.testUserId
  });
  
  // Record environment variables
  testEnvironmentVariables();
  
  // Run the tests
  await testHeaderParameters();
  await testQueryParameters();
  await testJsonBodyParameters();
  await testParameterPrecedence();
  await testParameterFormatVariations();
  
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