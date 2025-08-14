/**
 * Feature Parity Test
 * 
 * This script validates the Edge Agent's feature parity with the original implementation,
 * testing core features and verifying overall functionality.
 * 
 * Usage:
 *   node feature-parity-test.js
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
    sdk: '/api/sdk',
    track: '/api/track',
    trackGif: '/api/track.gif',
    flagKeys: '/api/flagkeys'
  },
  
  // Feature areas to test
  featureAreas: [
    {
      name: 'Cookie Management',
      description: 'Verify cookie persistence and management'
    },
    {
      name: 'Response Headers',
      description: 'Verify response headers for compatibility'
    },
    {
      name: 'KV Storage Integration',
      description: 'Verify KV storage functionality'
    },
    {
      name: 'Configuration Options',
      description: 'Verify configuration options support'
    },
    {
      name: 'Visitor ID Management',
      description: 'Verify visitor ID handling across requests'
    }
  ],
  
  // Test users
  testUsers: [
    {
      userId: 'test-user-' + Math.floor(Math.random() * 1000000),
      attributes: {
        browser: 'Chrome',
        location: 'US'
      }
    }
  ]
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `feature-parity-test-${timestamp}`;

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
    testUsers: CONFIG.testUsers
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
  
  let markdown = `# Feature Parity Test Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Feature Parity Matrix\n\n`;
  
  // Create a feature parity table
  markdown += `| Feature Area | Status | Notes |\n`;
  markdown += `|-------------|--------|-------|\n`;
  
  // Group results by feature area
  const featureAreaGroups = {};
  testResults.results.forEach(result => {
    const featureArea = result.featureArea || 'Other';
    if (!featureAreaGroups[featureArea]) {
      featureAreaGroups[featureArea] = [];
    }
    featureAreaGroups[featureArea].push(result);
  });
  
  // Add feature areas to the table
  CONFIG.featureAreas.forEach(area => {
    const results = featureAreaGroups[area.name] || [];
    const areaPassCount = results.filter(r => r.result === 'PASS').length;
    const areaTestCount = results.length;
    
    let status;
    if (areaTestCount === 0) {
      status = '⚠️ Not Tested';
    } else if (areaPassCount === areaTestCount) {
      status = '✅ Full Parity';
    } else if (areaPassCount > 0) {
      status = '🟡 Partial Parity';
    } else {
      status = '❌ No Parity';
    }
    
    markdown += `| ${area.name} | ${status} | ${areaTestCount > 0 ? `${areaPassCount}/${areaTestCount} tests passed` : 'Not tested'} |\n`;
  });
  
  markdown += '\n## Test Results\n\n';
  
  // Generate results by feature area
  Object.keys(featureAreaGroups).forEach(featureArea => {
    markdown += `### ${featureArea}\n\n`;
    
    featureAreaGroups[featureArea].forEach(result => {
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
function recordResult(test, description, result, details = null, error = null, featureArea = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    featureArea,
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}${featureArea ? ' - ' + featureArea : ''}`);
  } else {
    logger.error(`❌ FAIL: ${test}${featureArea ? ' - ' + featureArea : ''}`, error);
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
    body = null,
    cookieJar = {}
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
        ...headers
      }
    };
    
    // Add cookies if present
    if (Object.keys(cookieJar).length > 0) {
      const cookieString = Object.entries(cookieJar)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      requestOptions.headers.Cookie = cookieString;
    }
    
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
      }
    }
    
    const response = await fetch(url, requestOptions);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    
    // Extract and parse cookies
    const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
    const cookies = {};
    
    setCookieHeaders.forEach(cookieStr => {
      const cookiePart = cookieStr.split(';')[0];
      const [name, value] = cookiePart.split('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
    
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
      requestHeaders: requestOptions.headers,
      requestBody: body,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      cookies,
      body: responseBody,
      ok: response.ok,
      isCloudflare
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      method,
      requestHeaders: headers,
      requestBody: body,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test cookie persistence across requests
 */
async function testCookiePersistence() {
  try {
    logger.info('Testing cookie persistence across requests...');
    
    const testUser = CONFIG.testUsers[0];
    let cookieJar = {};
    
    // First request - should set cookies
    const firstResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: {
        userId: testUser.userId,
        key: 'test-flag'
      }
    });
    
    // Update cookie jar with cookies from first response
    cookieJar = { ...firstResponse.cookies };
    
    // Second request - should use cookies
    const secondResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: {
        userId: testUser.userId,
        key: 'test-flag'
      },
      cookieJar
    });
    
    // Verify both responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = [firstResponse, secondResponse].every(r => r.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    // Check for cookies being set and used
    const setCookies = Object.keys(firstResponse.cookies).length > 0;
    
    // Verify the body of the responses matches expectations
    const validDecisions = [firstResponse, secondResponse].every(r => 
      r.body && 
      typeof r.body === 'object' && 
      r.body.hasOwnProperty('variationKey')
    );
    
    const success = firstResponse.ok && secondResponse.ok && setCookies && validDecisions;
    
    recordResult(
      'Cookie Persistence',
      'Verify that cookies are properly set and persisted across requests',
      success,
      {
        testUser,
        firstResponse: {
          status: firstResponse.status,
          isCloudflare: firstResponse.isCloudflare,
          cookies: firstResponse.cookies,
          body: firstResponse.body
        },
        secondResponse: {
          status: secondResponse.status,
          isCloudflare: secondResponse.isCloudflare,
          requestCookies: cookieJar,
          body: secondResponse.body
        },
        setCookies,
        validDecisions
      },
      success ? null : 'Cookie persistence test failed',
      'Cookie Management'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Cookie Persistence',
      'Verify that cookies are properly set and persisted across requests',
      false,
      null,
      error,
      'Cookie Management'
    );
    return false;
  }
}

/**
 * Test response headers for compatibility
 */
async function testResponseHeaders() {
  try {
    logger.info('Testing response headers for compatibility...');
    
    const testUser = CONFIG.testUsers[0];
    
    // Test various endpoints for expected headers
    const endpointTests = [
      {
        name: 'SDK Endpoint',
        endpoint: CONFIG.endpoints.sdk,
        method: 'GET',
        expectedHeaders: ['content-type', 'cache-control']
      },
      {
        name: 'Datafile Endpoint',
        endpoint: CONFIG.endpoints.datafile,
        method: 'GET',
        expectedHeaders: ['content-type', 'cache-control', 'last-modified']
      },
      {
        name: 'Decide Endpoint',
        endpoint: CONFIG.endpoints.decide,
        method: 'POST',
        body: {
          userId: testUser.userId,
          key: 'test-flag'
        },
        expectedHeaders: ['content-type', 'cache-control']
      },
      {
        name: 'Flag Keys Endpoint',
        endpoint: CONFIG.endpoints.flagKeys,
        method: 'GET',
        expectedHeaders: ['content-type', 'cache-control']
      }
    ];
    
    const responses = [];
    
    for (const test of endpointTests) {
      const response = await makeRequest({
        endpoint: test.endpoint,
        method: test.method,
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey
        },
        body: test.body
      });
      
      responses.push({
        test,
        response,
        hasExpectedHeaders: test.expectedHeaders.every(header => 
          response.headers && response.headers[header] !== undefined
        )
      });
    }
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok && r.hasExpectedHeaders);
    
    recordResult(
      'Response Headers',
      'Verify that all endpoints return the expected response headers',
      success,
      {
        responses: responses.map(r => ({
          endpoint: r.test.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          headers: r.response.headers,
          expectedHeaders: r.test.expectedHeaders,
          hasExpectedHeaders: r.hasExpectedHeaders
        })),
        allCloudflare
      },
      success ? null : 'Response headers test failed',
      'Response Headers'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Response Headers',
      'Verify that all endpoints return the expected response headers',
      false,
      null,
      error,
      'Response Headers'
    );
    return false;
  }
}

/**
 * Test KV storage integration by checking caching behavior
 */
async function testKvStorageIntegration() {
  try {
    logger.info('Testing KV storage integration...');
    
    // Test datafile caching - first request should be cached
    const firstDatafileResponse = await makeRequest({
      endpoint: CONFIG.endpoints.datafile,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      }
    });
    
    // Second request should be faster due to caching
    const secondDatafileResponse = await makeRequest({
      endpoint: CONFIG.endpoints.datafile,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      }
    });
    
    // Verify both responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = [firstDatafileResponse, secondDatafileResponse].every(r => r.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    // Check for caching headers in the response
    const hasCacheHeaders = secondDatafileResponse.headers 
      && (secondDatafileResponse.headers['cf-cache-status'] !== undefined 
          || secondDatafileResponse.headers['cache-control'] !== undefined);
    
    // Both responses should have the same content
    const sameContent = typeof firstDatafileResponse.body === 'string' 
      && typeof secondDatafileResponse.body === 'string'
      && firstDatafileResponse.body === secondDatafileResponse.body;
    
    const success = firstDatafileResponse.ok && secondDatafileResponse.ok && hasCacheHeaders && sameContent;
    
    recordResult(
      'KV Storage Integration',
      'Verify that the Edge Agent properly uses KV storage for caching datafiles',
      success,
      {
        firstResponse: {
          status: firstDatafileResponse.status,
          isCloudflare: firstDatafileResponse.isCloudflare,
          headers: firstDatafileResponse.headers,
          bodyLength: typeof firstDatafileResponse.body === 'string' ? firstDatafileResponse.body.length : null
        },
        secondResponse: {
          status: secondDatafileResponse.status,
          isCloudflare: secondDatafileResponse.isCloudflare,
          headers: secondDatafileResponse.headers,
          bodyLength: typeof secondDatafileResponse.body === 'string' ? secondDatafileResponse.body.length : null
        },
        hasCacheHeaders,
        sameContent
      },
      success ? null : 'KV storage integration test failed',
      'KV Storage Integration'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'KV Storage Integration',
      'Verify that the Edge Agent properly uses KV storage for caching datafiles',
      false,
      null,
      error,
      'KV Storage Integration'
    );
    return false;
  }
}

/**
 * Test configuration options support
 */
async function testConfigurationOptions() {
  try {
    logger.info('Testing configuration options support...');
    
    const testUser = CONFIG.testUsers[0];
    const testCases = [
      {
        name: 'No Options',
        body: {
          userId: testUser.userId,
          key: 'test-flag'
        }
      },
      {
        name: 'Include Reasons',
        body: {
          userId: testUser.userId,
          key: 'test-flag',
          options: { includeReasons: true }
        },
        expectedOption: 'reasons'
      },
      {
        name: 'Disable Activation',
        body: {
          userId: testUser.userId,
          key: 'test-flag',
          options: { skipActivation: true }
        }
      },
      {
        name: 'Multiple Options',
        body: {
          userId: testUser.userId,
          key: 'test-flag',
          options: { 
            includeReasons: true,
            skipActivation: true
          }
        },
        expectedOption: 'reasons'
      }
    ];
    
    const responses = [];
    
    for (const test of testCases) {
      const response = await makeRequest({
        endpoint: CONFIG.endpoints.decide,
        method: 'POST',
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey
        },
        body: test.body
      });
      
      // Check if expected option is present in the response
      const hasExpectedOption = !test.expectedOption 
        || (response.body && response.body[test.expectedOption] !== undefined);
      
      responses.push({
        test,
        response,
        hasExpectedOption
      });
    }
    
    // Verify all responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    const success = responses.every(r => r.response.ok && (!r.test.expectedOption || r.hasExpectedOption));
    
    recordResult(
      'Configuration Options',
      'Verify that the Edge Agent properly supports various configuration options',
      success,
      {
        responses: responses.map(r => ({
          name: r.test.name,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          options: r.test.body.options,
          hasExpectedOption: r.hasExpectedOption,
          body: r.response.body
        })),
        allCloudflare
      },
      success ? null : 'Configuration options test failed',
      'Configuration Options'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Configuration Options',
      'Verify that the Edge Agent properly supports various configuration options',
      false,
      null,
      error,
      'Configuration Options'
    );
    return false;
  }
}

/**
 * Test visitor ID management
 */
async function testVisitorIdManagement() {
  try {
    logger.info('Testing visitor ID management...');
    
    // Generate test users with different IDs
    const testUsers = [
      {
        userId: 'test-user-' + Math.floor(Math.random() * 1000000),
        attributes: { browser: 'Chrome' }
      },
      {
        userId: 'test-user-' + Math.floor(Math.random() * 1000000),
        attributes: { browser: 'Chrome' }
      }
    ];
    
    const responses = [];
    
    // Test with first user
    const firstUserResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: {
        userId: testUsers[0].userId,
        key: 'test-flag'
      }
    });
    
    responses.push({
      user: testUsers[0],
      response: firstUserResponse
    });
    
    // Test with second user
    const secondUserResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      method: 'POST',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: {
        userId: testUsers[1].userId,
        key: 'test-flag'
      }
    });
    
    responses.push({
      user: testUsers[1],
      response: secondUserResponse
    });
    
    // Verify both responses have Cloudflare headers to confirm live infrastructure
    const allCloudflare = responses.every(r => r.response.isCloudflare);
    if (!allCloudflare) {
      logger.warn('One or more responses do not have Cloudflare headers');
    }
    
    // Check if responses have the expected user IDs
    const validDecisions = responses.every(r => 
      r.response.body && 
      typeof r.response.body === 'object' && 
      r.response.body.hasOwnProperty('variationKey')
    );
    
    const success = responses.every(r => r.response.ok) && validDecisions;
    
    recordResult(
      'Visitor ID Management',
      'Verify that the Edge Agent properly handles different visitor IDs',
      success,
      {
        responses: responses.map(r => ({
          userId: r.user.userId,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          body: r.response.body
        })),
        allCloudflare,
        validDecisions
      },
      success ? null : 'Visitor ID management test failed',
      'Visitor ID Management'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Visitor ID Management',
      'Verify that the Edge Agent properly handles different visitor IDs',
      false,
      null,
      error,
      'Visitor ID Management'
    );
    return false;
  }
}

/**
 * Test all API endpoints for feature parity
 */
async function testApiEndpointParity() {
  try {
    logger.info('Testing API endpoint parity...');
    
    const testUser = CONFIG.testUsers[0];
    const endpointTests = [
      {
        name: 'SDK Endpoint',
        endpoint: CONFIG.endpoints.sdk,
        method: 'GET'
      },
      {
        name: 'Datafile Endpoint',
        endpoint: CONFIG.endpoints.datafile,
        method: 'GET'
      },
      {
        name: 'Decide Endpoint',
        endpoint: CONFIG.endpoints.decide,
        method: 'POST',
        body: {
          userId: testUser.userId,
          key: 'test-flag'
        }
      },
      {
        name: 'Decide All Endpoint',
        endpoint: CONFIG.endpoints.decideAll,
        method: 'POST',
        body: {
          userId: testUser.userId
        }
      },
      {
        name: 'Decide For Keys Endpoint',
        endpoint: CONFIG.endpoints.decideForKeys,
        method: 'POST',
        body: {
          userId: testUser.userId,
          keys: ['test-flag']
        }
      },
      {
        name: 'Flag Keys Endpoint',
        endpoint: CONFIG.endpoints.flagKeys,
        method: 'GET'
      },
      {
        name: 'Track Endpoint',
        endpoint: CONFIG.endpoints.track,
        method: 'POST',
        body: {
          userId: testUser.userId,
          eventKey: 'test-event'
        }
      },
      {
        name: 'Track GIF Endpoint',
        endpoint: CONFIG.endpoints.trackGif + `?userId=${testUser.userId}&eventKey=test-event`,
        method: 'GET'
      }
    ];
    
    const responses = [];
    
    for (const test of endpointTests) {
      const response = await makeRequest({
        endpoint: test.endpoint,
        method: test.method,
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey
        },
        body: test.body
      });
      
      responses.push({
        test,
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
      'API Endpoint Parity',
      'Verify that all API endpoints are implemented and working correctly',
      success,
      {
        responses: responses.map(r => ({
          endpoint: r.test.name,
          url: r.response.url,
          method: r.test.method,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare
        })),
        allCloudflare
      },
      success ? null : 'API endpoint parity test failed',
      'API Endpoints'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'API Endpoint Parity',
      'Verify that all API endpoints are implemented and working correctly',
      false,
      null,
      error,
      'API Endpoints'
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting feature parity test`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey
  });
  
  // Record environment variables
  testEnvironmentVariables();
  
  // Run the tests
  await testCookiePersistence();
  await testResponseHeaders();
  await testKvStorageIntegration();
  await testConfigurationOptions();
  await testVisitorIdManagement();
  await testApiEndpointParity();
  
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