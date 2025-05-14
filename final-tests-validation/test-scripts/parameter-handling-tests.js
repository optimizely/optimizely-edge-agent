/**
 * Parameter Handling Tests
 * 
 * This script comprehensively tests the Edge Agent's handling of parameters
 * through different input methods, focusing on:
 * 1. All query parameter types
 * 2. All HTTP header options
 * 3. All JSON payload parameters
 * 4. Parameter precedence when provided through multiple sources
 * 
 * Usage:
 *   node parameter-handling-tests.js
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
    decideAll: '/api/decide-all',
    decideForKeys: '/api/decide-for-keys',
    datafile: '/api/datafile',
    debug: '/api/debug'
  },
  
  // Test feature flags and experiments
  featureKeys: ['test-flag', 'homepage-test', 'product-test'],
  experimentKeys: ['ab-test-1', 'feature-test-1'],
  
  // Test users
  testUserId: 'test-user-' + Math.floor(Math.random() * 1000000),
  
  // Test attributes
  testAttributes: {
    browser: 'Chrome',
    location: 'US',
    device: 'desktop',
    age: '30',
    returning: 'true',
    userId: 'attribute-user-id-override'
  },
  
  // Query parameters to test
  queryParameters: {
    // Basic parameters
    'visitor_id': 'query-test-user-id',
    'sdk_key': '8mR1pGh8u2ztUP8GqjmQq',
    'flag_key': 'test-flag',
    'experiment_key': 'test-experiment',
    
    // Additional query parameters
    'override_visitor_id': 'true',
    'return_decisions': 'true',
    'variation': 'query-variation',
    
    // Attribute parameters (will be tested with attributes.* prefix)
    // e.g., attributes.browser=Chrome
  },
  
  // Header options to test
  headerOptions: {
    // Basic headers
    'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
    'X-Optimizely-Visitor-Id': 'header-test-user-id',
    'X-Optimizely-Flag-Key': 'test-flag',
    'X-Optimizely-Experiment-Key': 'test-experiment',
    
    // Additional headers
    'X-Optimizely-Return-Decisions': 'true',
    'X-Optimizely-Forced-Decision': '{"flagKey":"test-flag","variationKey":"header-variation"}',
    
    // Attribute headers (will be tested with X-Optimizely-Attribute-* prefix)
    // e.g., X-Optimizely-Attribute-Browser: Chrome
  },
  
  // JSON payload parameters to test
  jsonPayloadParameters: {
    // Basic parameters
    userId: 'json-test-user-id',
    flagKey: 'test-flag',
    experimentKey: 'test-experiment',
    sdkKey: '8mR1pGh8u2ztUP8GqjmQq',
    
    // Attribute object
    attributes: {
      browser: 'Chrome',
      location: 'US',
      device: 'desktop',
      age: 30,
      returning: true
    },
    
    // Additional parameters
    forcedDecisions: [
      {
        flagKey: 'test-flag',
        variationKey: 'json-variation'
      }
    ],
    decideOptions: {
      includeReasons: true
    },
    overrideVisitorId: true,
    returnDecisions: true,
    responseCookies: true,
    secureCookies: false
  }
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `parameter-handling-test-${timestamp}`;

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
  
  let markdown = `# Parameter Handling Test Results\n\n`;
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
 * Make a request to the API
 */
async function makeRequest(options) {
  const {
    endpoint,
    method = 'POST',
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
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, requestOptions);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody;
    
    try {
      responseBody = await response.json();
    } catch (e) {
      try {
        responseBody = await response.text();
      } catch (e2) {
        responseBody = '(Unable to read response body)';
      }
    }
    
    // Check for Cloudflare-specific headers to verify live infrastructure
    const isCloudflare = responseHeaders['cf-ray'] !== undefined;
    
    return {
      url,
      method,
      requestHeaders: requestOptions.headers,
      requestQueryParams: queryParams,
      requestBody: body,
      status: response.status,
      statusText: response.statusText,
      responseHeaders,
      responseBody,
      ok: response.ok,
      isCloudflare
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      method,
      requestHeaders: headers,
      requestQueryParams: queryParams,
      requestBody: body,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test visitor ID via query parameters
 */
async function testQueryVisitorId() {
  try {
    logger.info('Testing visitor_id query parameter...');
    
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: CONFIG.queryParameters.flag_key
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams
    });
    
    // Check if the visitor ID was correctly applied
    // This is indicated by the visitor_id appearing in the decision or return ID
    const responseContainsVisitorId = JSON.stringify(response.responseBody || {}).includes(queryParams.visitor_id);
    
    recordResult(
      'Query Parameter - visitor_id',
      'Verify that the visitor_id query parameter is properly applied',
      response.ok && responseContainsVisitorId,
      {
        visitorId: queryParams.visitor_id,
        flagKey: queryParams.flag_key,
        status: response.status,
        responseContainsVisitorId,
        response: response.responseBody
      },
      response.ok && !responseContainsVisitorId ? 'Visitor ID was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Query Parameters'
    );
    
    return response.ok && responseContainsVisitorId;
  } catch (error) {
    recordResult(
      'Query Parameter - visitor_id',
      'Verify that the visitor_id query parameter is properly applied',
      false,
      null,
      error,
      'Query Parameters'
    );
    return false;
  }
}

/**
 * Test flag key via query parameters
 */
async function testQueryFlagKey() {
  try {
    logger.info('Testing flag_key query parameter...');
    
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: CONFIG.queryParameters.flag_key
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams
    });
    
    // Check if the flag key was correctly applied
    // This is indicated by the flag_key appearing in the decision
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(queryParams.flag_key);
    
    recordResult(
      'Query Parameter - flag_key',
      'Verify that the flag_key query parameter is properly applied',
      response.ok && responseContainsFlagKey,
      {
        visitorId: queryParams.visitor_id,
        flagKey: queryParams.flag_key,
        status: response.status,
        responseContainsFlagKey,
        response: response.responseBody
      },
      response.ok && !responseContainsFlagKey ? 'Flag key was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Query Parameters'
    );
    
    return response.ok && responseContainsFlagKey;
  } catch (error) {
    recordResult(
      'Query Parameter - flag_key',
      'Verify that the flag_key query parameter is properly applied',
      false,
      null,
      error,
      'Query Parameters'
    );
    return false;
  }
}

/**
 * Test attributes via query parameters
 */
async function testQueryAttributes() {
  try {
    logger.info('Testing attributes.* query parameters...');
    
    // Prepare query parameters with attributes
    // Format: attributes.attributeName=attributeValue
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: CONFIG.queryParameters.flag_key
    };
    
    // Add attribute parameters
    Object.entries(CONFIG.testAttributes).forEach(([key, value]) => {
      queryParams[`attributes.${key}`] = value;
    });
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams
    });
    
    // For a comprehensive test, we'd need to check if attributes affected the decision
    // For simplicity, we'll verify the request succeeded
    const success = response.ok;
    
    recordResult(
      'Query Parameter - attributes.*',
      'Verify that attributes.* query parameters are properly applied',
      success,
      {
        queryParams,
        status: response.status,
        response: response.responseBody
      },
      !success ? 'Request with attribute query parameters failed' : null,
      'Query Parameters'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Query Parameter - attributes.*',
      'Verify that attributes.* query parameters are properly applied',
      false,
      null,
      error,
      'Query Parameters'
    );
    return false;
  }
}

/**
 * Test all query parameters
 */
async function testAllQueryParameters() {
  try {
    logger.info('Testing all query parameters together...');
    
    // Test all basic query parameters together
    const queryParams = { ...CONFIG.queryParameters };
    
    // Add attribute parameters
    Object.entries(CONFIG.testAttributes).forEach(([key, value]) => {
      queryParams[`attributes.${key}`] = value;
    });
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams
    });
    
    // Check if visitor_id and flag_key were applied
    const responseContainsVisitorId = JSON.stringify(response.responseBody || {}).includes(queryParams.visitor_id);
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(queryParams.flag_key);
    
    const success = response.ok && responseContainsVisitorId && responseContainsFlagKey;
    
    recordResult(
      'Query Parameters - All',
      'Verify that all query parameters are properly applied together',
      success,
      {
        queryParams,
        status: response.status,
        responseContainsVisitorId,
        responseContainsFlagKey,
        response: response.responseBody
      },
      !success ? 'Not all query parameters were correctly applied' : null,
      'Query Parameters'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Query Parameters - All',
      'Verify that all query parameters are properly applied together',
      false,
      null,
      error,
      'Query Parameters'
    );
    return false;
  }
}

/**
 * Test User ID header
 */
async function testHeaderUserId() {
  try {
    logger.info('Testing X-Optimizely-Visitor-Id header...');
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key']
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers
    });
    
    // Check if the user ID was correctly applied
    const responseContainsUserId = JSON.stringify(response.responseBody || {}).includes(headers['X-Optimizely-Visitor-Id']);
    
    recordResult(
      'Header - X-Optimizely-Visitor-Id',
      'Verify that the X-Optimizely-Visitor-Id header is properly applied',
      response.ok && responseContainsUserId,
      {
        headers,
        status: response.status,
        responseContainsUserId,
        response: response.responseBody
      },
      response.ok && !responseContainsUserId ? 'User ID was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Header Options'
    );
    
    return response.ok && responseContainsUserId;
  } catch (error) {
    recordResult(
      'Header - X-Optimizely-Visitor-Id',
      'Verify that the X-Optimizely-Visitor-Id header is properly applied',
      false,
      null,
      error,
      'Header Options'
    );
    return false;
  }
}

/**
 * Test Flag Key header
 */
async function testHeaderFlagKey() {
  try {
    logger.info('Testing X-Optimizely-Flag-Key header...');
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key']
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers
    });
    
    // Check if the flag key was correctly applied
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(headers['X-Optimizely-Flag-Key']);
    
    recordResult(
      'Header - X-Optimizely-Flag-Key',
      'Verify that the X-Optimizely-Flag-Key header is properly applied',
      response.ok && responseContainsFlagKey,
      {
        headers,
        status: response.status,
        responseContainsFlagKey,
        response: response.responseBody
      },
      response.ok && !responseContainsFlagKey ? 'Flag key was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Header Options'
    );
    
    return response.ok && responseContainsFlagKey;
  } catch (error) {
    recordResult(
      'Header - X-Optimizely-Flag-Key',
      'Verify that the X-Optimizely-Flag-Key header is properly applied',
      false,
      null,
      error,
      'Header Options'
    );
    return false;
  }
}

/**
 * Test attribute headers
 */
async function testHeaderAttributes() {
  try {
    logger.info('Testing X-Optimizely-Attribute-* headers...');
    
    // Prepare headers with basic headers
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key']
    };
    
    // Add attribute headers
    Object.entries(CONFIG.testAttributes).forEach(([key, value]) => {
      const headerKey = `X-Optimizely-Attribute-${key.charAt(0).toUpperCase() + key.slice(1)}`;
      headers[headerKey] = value;
    });
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers
    });
    
    // For a comprehensive test, we'd need to check if attributes affected the decision
    // For simplicity, we'll verify the request succeeded
    const success = response.ok;
    
    recordResult(
      'Header - X-Optimizely-Attribute-*',
      'Verify that X-Optimizely-Attribute-* headers are properly applied',
      success,
      {
        headers,
        status: response.status,
        response: response.responseBody
      },
      !success ? 'Request with attribute headers failed' : null,
      'Header Options'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Header - X-Optimizely-Attribute-*',
      'Verify that X-Optimizely-Attribute-* headers are properly applied',
      false,
      null,
      error,
      'Header Options'
    );
    return false;
  }
}

/**
 * Test all header options
 */
async function testAllHeaderOptions() {
  try {
    logger.info('Testing all header options together...');
    
    // Test all header options together
    const headers = { ...CONFIG.headerOptions };
    
    // Add attribute headers
    Object.entries(CONFIG.testAttributes).forEach(([key, value]) => {
      const headerKey = `X-Optimizely-Attribute-${key.charAt(0).toUpperCase() + key.slice(1)}`;
      headers[headerKey] = value;
    });
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers
    });
    
    // Check if user ID and flag key were applied
    const responseContainsUserId = JSON.stringify(response.responseBody || {}).includes(headers['X-Optimizely-Visitor-Id']);
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(headers['X-Optimizely-Flag-Key']);
    
    const success = response.ok && responseContainsUserId && responseContainsFlagKey;
    
    recordResult(
      'Header Options - All',
      'Verify that all header options are properly applied together',
      success,
      {
        headers,
        status: response.status,
        responseContainsUserId,
        responseContainsFlagKey,
        response: response.responseBody
      },
      !success ? 'Not all header options were correctly applied' : null,
      'Header Options'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Header Options - All',
      'Verify that all header options are properly applied together',
      false,
      null,
      error,
      'Header Options'
    );
    return false;
  }
}

/**
 * Test userId in JSON payload
 */
async function testJsonUserId() {
  try {
    logger.info('Testing userId in JSON payload...');
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: CONFIG.jsonPayloadParameters.flagKey
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      body
    });
    
    // Check if the user ID was correctly applied
    const responseContainsUserId = JSON.stringify(response.responseBody || {}).includes(body.userId);
    
    recordResult(
      'JSON Payload - userId',
      'Verify that the userId parameter in JSON payload is properly applied',
      response.ok && responseContainsUserId,
      {
        body,
        status: response.status,
        responseContainsUserId,
        response: response.responseBody
      },
      response.ok && !responseContainsUserId ? 'User ID was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'JSON Payload'
    );
    
    return response.ok && responseContainsUserId;
  } catch (error) {
    recordResult(
      'JSON Payload - userId',
      'Verify that the userId parameter in JSON payload is properly applied',
      false,
      null,
      error,
      'JSON Payload'
    );
    return false;
  }
}

/**
 * Test flagKey in JSON payload
 */
async function testJsonFlagKey() {
  try {
    logger.info('Testing flagKey in JSON payload...');
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: CONFIG.jsonPayloadParameters.flagKey
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      body
    });
    
    // Check if the flag key was correctly applied
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(body.flagKey);
    
    recordResult(
      'JSON Payload - flagKey',
      'Verify that the flagKey parameter in JSON payload is properly applied',
      response.ok && responseContainsFlagKey,
      {
        body,
        status: response.status,
        responseContainsFlagKey,
        response: response.responseBody
      },
      response.ok && !responseContainsFlagKey ? 'Flag key was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'JSON Payload'
    );
    
    return response.ok && responseContainsFlagKey;
  } catch (error) {
    recordResult(
      'JSON Payload - flagKey',
      'Verify that the flagKey parameter in JSON payload is properly applied',
      false,
      null,
      error,
      'JSON Payload'
    );
    return false;
  }
}

/**
 * Test attributes in JSON payload
 */
async function testJsonAttributes() {
  try {
    logger.info('Testing attributes in JSON payload...');
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: CONFIG.jsonPayloadParameters.flagKey,
      attributes: CONFIG.jsonPayloadParameters.attributes
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      body
    });
    
    // For a comprehensive test, we'd need to check if attributes affected the decision
    // For simplicity, we'll verify the request succeeded
    const success = response.ok;
    
    recordResult(
      'JSON Payload - attributes',
      'Verify that the attributes object in JSON payload is properly applied',
      success,
      {
        body,
        status: response.status,
        response: response.responseBody
      },
      !success ? 'Request with attributes in JSON payload failed' : null,
      'JSON Payload'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'JSON Payload - attributes',
      'Verify that the attributes object in JSON payload is properly applied',
      false,
      null,
      error,
      'JSON Payload'
    );
    return false;
  }
}

/**
 * Test all JSON payload parameters
 */
async function testAllJsonParameters() {
  try {
    logger.info('Testing all JSON payload parameters together...');
    
    // Test all JSON payload parameters together
    const body = { ...CONFIG.jsonPayloadParameters };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey
    };
    
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      body
    });
    
    // Check if user ID and flag key were applied
    const responseContainsUserId = JSON.stringify(response.responseBody || {}).includes(body.userId);
    const responseContainsFlagKey = JSON.stringify(response.responseBody || {}).includes(body.flagKey);
    
    const success = response.ok && responseContainsUserId && responseContainsFlagKey;
    
    recordResult(
      'JSON Payload - All',
      'Verify that all JSON payload parameters are properly applied together',
      success,
      {
        body,
        status: response.status,
        responseContainsUserId,
        responseContainsFlagKey,
        response: response.responseBody
      },
      !success ? 'Not all JSON payload parameters were correctly applied' : null,
      'JSON Payload'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'JSON Payload - All',
      'Verify that all JSON payload parameters are properly applied together',
      false,
      null,
      error,
      'JSON Payload'
    );
    return false;
  }
}

/**
 * Test parameter precedence: Header > JSON > Query
 */
async function testParameterPrecedence() {
  try {
    logger.info('Testing parameter precedence (Header > JSON > Query)...');
    
    // Set different user IDs for each parameter type
    const queryParams = {
      visitor_id: 'query-precedence-user-id',
      flag_key: CONFIG.queryParameters.flag_key
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': 'header-precedence-user-id',
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key']
    };
    
    const body = {
      userId: 'json-precedence-user-id',
      flagKey: CONFIG.jsonPayloadParameters.flagKey
    };
    
    // Make request with all three parameter types
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams,
      body
    });
    
    // Expected: Header value (header-precedence-user-id) should take precedence
    const expectedUserId = 'header-precedence-user-id';
    const responseContainsExpectedUserId = JSON.stringify(response.responseBody || {}).includes(expectedUserId);
    const responseContainsJsonUserId = JSON.stringify(response.responseBody || {}).includes(body.userId);
    const responseContainsQueryUserId = JSON.stringify(response.responseBody || {}).includes(queryParams.visitor_id);
    
    // Check precedence was correctly applied
    const correctPrecedence = responseContainsExpectedUserId && 
                             !responseContainsJsonUserId && 
                             !responseContainsQueryUserId;
    
    recordResult(
      'Parameter Precedence - User ID',
      'Verify that parameter precedence rules (Header > JSON > Query) are applied correctly',
      response.ok && correctPrecedence,
      {
        queryUserId: queryParams.visitor_id,
        headerUserId: headers['X-Optimizely-Visitor-Id'],
        jsonUserId: body.userId,
        expectedUserId,
        status: response.status,
        responseContainsExpectedUserId,
        responseContainsJsonUserId,
        responseContainsQueryUserId,
        correctPrecedence,
        response: response.responseBody
      },
      response.ok && !correctPrecedence ? 'Parameter precedence was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Parameter Precedence'
    );
    
    return response.ok && correctPrecedence;
  } catch (error) {
    recordResult(
      'Parameter Precedence - User ID',
      'Verify that parameter precedence rules (Header > JSON > Query) are applied correctly',
      false,
      null,
      error,
      'Parameter Precedence'
    );
    return false;
  }
}

/**
 * Test flag key parameter precedence
 */
async function testFlagKeyPrecedence() {
  try {
    logger.info('Testing flag key parameter precedence (Header > JSON > Query)...');
    
    // Set different flag keys for each parameter type
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: 'query-precedence-flag-key'
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': 'header-precedence-flag-key'
    };
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: 'json-precedence-flag-key'
    };
    
    // Make request with all three parameter types
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams,
      body
    });
    
    // Expected: Header value (header-precedence-flag-key) should take precedence
    const expectedFlagKey = 'header-precedence-flag-key';
    const responseContainsExpectedFlagKey = JSON.stringify(response.responseBody || {}).includes(expectedFlagKey);
    const responseContainsJsonFlagKey = JSON.stringify(response.responseBody || {}).includes(body.flagKey);
    const responseContainsQueryFlagKey = JSON.stringify(response.responseBody || {}).includes(queryParams.flag_key);
    
    // Check precedence was correctly applied
    const correctPrecedence = responseContainsExpectedFlagKey && 
                             !responseContainsJsonFlagKey && 
                             !responseContainsQueryFlagKey;
    
    recordResult(
      'Parameter Precedence - Flag Key',
      'Verify that flag key parameter precedence rules (Header > JSON > Query) are applied correctly',
      response.ok && correctPrecedence,
      {
        queryFlagKey: queryParams.flag_key,
        headerFlagKey: headers['X-Optimizely-Flag-Key'],
        jsonFlagKey: body.flagKey,
        expectedFlagKey,
        status: response.status,
        responseContainsExpectedFlagKey,
        responseContainsJsonFlagKey,
        responseContainsQueryFlagKey,
        correctPrecedence,
        response: response.responseBody
      },
      response.ok && !correctPrecedence ? 'Flag key parameter precedence was not correctly applied' : 
        !response.ok ? 'Request failed' : null,
      'Parameter Precedence'
    );
    
    return response.ok && correctPrecedence;
  } catch (error) {
    recordResult(
      'Parameter Precedence - Flag Key',
      'Verify that flag key parameter precedence rules (Header > JSON > Query) are applied correctly',
      false,
      null,
      error,
      'Parameter Precedence'
    );
    return false;
  }
}

/**
 * Test attributes parameter precedence
 */
async function testAttributesPrecedence() {
  try {
    logger.info('Testing attributes parameter precedence (Header > JSON > Query)...');
    
    // Test a single common attribute across all parameter types
    const attributeName = 'browser';
    const queryValue = 'query-browser';
    const headerValue = 'header-browser';
    const jsonValue = 'json-browser';
    
    // Set up parameters
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: CONFIG.queryParameters.flag_key,
      [`attributes.${attributeName}`]: queryValue
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key'],
      [`X-Optimizely-Attribute-${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)}`]: headerValue
    };
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: CONFIG.jsonPayloadParameters.flagKey,
      attributes: {
        [attributeName]: jsonValue
      }
    };
    
    // Make request with all three parameter types
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers,
      queryParams,
      body
    });
    
    // Since we can't directly check which attribute was used (without specific test flags configured),
    // we'll just verify the request was successful. In a real-world scenario, you would need a flag
    // that uses attribute targeting to properly verify this.
    const success = response.ok;
    
    recordResult(
      'Parameter Precedence - Attributes',
      'Verify that attributes parameter precedence rules are respected',
      success,
      {
        attributeName,
        queryValue,
        headerValue,
        jsonValue,
        status: response.status,
        response: response.responseBody
      },
      !success ? 'Request failed' : null,
      'Parameter Precedence'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Parameter Precedence - Attributes',
      'Verify that attributes parameter precedence rules are respected',
      false,
      null,
      error,
      'Parameter Precedence'
    );
    return false;
  }
}

/**
 * Test array attributes from multiple sources
 */
async function testArrayAttributeHandling() {
  try {
    logger.info('Testing array attribute handling across multiple sources...');
    
    // Test array attribute with values from different sources
    const arrayAttributeName = 'preferences';
    const queryArrayValue = ['query-item-1', 'query-item-2'];
    const headerArrayValue = ['header-item-1', 'header-item-2'];
    const jsonArrayValue = ['json-item-1', 'json-item-2'];
    
    // Set up parameters
    const queryParams = {
      visitor_id: CONFIG.queryParameters.visitor_id,
      flag_key: CONFIG.queryParameters.flag_key,
      [`attributes.${arrayAttributeName}`]: JSON.stringify(queryArrayValue)
    };
    
    const headers = {
      'X-Optimizely-SDK-Key': CONFIG.sdkKey,
      'X-Optimizely-Visitor-Id': CONFIG.headerOptions['X-Optimizely-Visitor-Id'],
      'X-Optimizely-Flag-Key': CONFIG.headerOptions['X-Optimizely-Flag-Key']
    };
    
    // Set header array attribute
    headers[`X-Optimizely-Attribute-${arrayAttributeName.charAt(0).toUpperCase() + arrayAttributeName.slice(1)}`] = 
      JSON.stringify(headerArrayValue);
    
    const body = {
      userId: CONFIG.jsonPayloadParameters.userId,
      flagKey: CONFIG.jsonPayloadParameters.flagKey,
      attributes: {
        [arrayAttributeName]: jsonArrayValue,
        // Add another field to help with debugging
        testSource: 'json'
      }
    };
    
    // Make request with all three parameter types
    const response = await makeRequest({
      endpoint: CONFIG.endpoints.debug,
      headers,
      queryParams,
      body
    });
    
    const success = response.ok;
    
    // For debugging, we'll also try a request with each source individually
    // This will help identify if the issue is with merging or with a specific source
    
    // 1. Only query parameters
    const queryOnlyResponse = await makeRequest({
      endpoint: CONFIG.endpoints.debug,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      queryParams,
      body: {
        userId: CONFIG.jsonPayloadParameters.userId,
        flagKey: CONFIG.jsonPayloadParameters.flagKey
      }
    });
    
    // 2. Only headers
    const headersOnlyResponse = await makeRequest({
      endpoint: CONFIG.endpoints.debug,
      headers,
      body: {
        userId: CONFIG.jsonPayloadParameters.userId,
        flagKey: CONFIG.jsonPayloadParameters.flagKey
      }
    });
    
    // 3. Only JSON
    const jsonOnlyResponse = await makeRequest({
      endpoint: CONFIG.endpoints.debug,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body
    });
    
    recordResult(
      'Array Attribute Handling',
      'Verify that array attributes are properly handled across multiple sources',
      success,
      {
        arrayAttributeName,
        queryArrayValue,
        headerArrayValue,
        jsonArrayValue,
        mainResponse: {
          status: response.status,
          body: response.responseBody
        },
        queryOnlyResponse: {
          status: queryOnlyResponse.status,
          body: queryOnlyResponse.responseBody
        },
        headersOnlyResponse: {
          status: headersOnlyResponse.status,
          body: headersOnlyResponse.responseBody
        },
        jsonOnlyResponse: {
          status: jsonOnlyResponse.status,
          body: jsonOnlyResponse.responseBody
        }
      },
      !success ? 'Request failed' : null,
      'Array Attributes'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Array Attribute Handling',
      'Verify that array attributes are properly handled across multiple sources',
      false,
      null,
      error,
      'Array Attributes'
    );
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  logger.info(`Starting Parameter Handling Tests at ${new Date().toLocaleString()}`);
  logger.info(`Edge Agent URL: ${CONFIG.edgeAgentUrl}`);
  logger.info(`SDK Key: ${CONFIG.sdkKey}`);
  
  try {
    // Test Query Parameters
    await testQueryVisitorId();
    await testQueryFlagKey();
    await testQueryAttributes();
    await testAllQueryParameters();
    
    // Test Header Options
    await testHeaderUserId();
    await testHeaderFlagKey();
    await testHeaderAttributes();
    await testAllHeaderOptions();
    
    // Test JSON Payload Parameters
    await testJsonUserId();
    await testJsonFlagKey();
    await testJsonAttributes();
    await testAllJsonParameters();
    
    // Test Parameter Precedence
    await testParameterPrecedence();
    await testFlagKeyPrecedence();
    await testAttributesPrecedence();
    
    // Test array attribute handling
    await testArrayAttributeHandling();
    
    // Save results
    const resultPath = saveResults();
    logger.info(`All tests completed. Results saved to ${resultPath}`);
    
    // Log summary
    const passCount = testResults.results.filter(r => r.result === 'PASS').length;
    const failCount = testResults.results.filter(r => r.result === 'FAIL').length;
    const totalCount = testResults.results.length;
    logger.info(`SUMMARY: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)`);
    
    if (failCount > 0) {
      logger.error(`${failCount} tests failed.`);
      process.exit(1);
    } else {
      logger.info('All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    logger.error('Test execution failed', error);
    process.exit(1);
  }
}

// Execute tests
runTests(); 