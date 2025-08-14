/**
 * User Profile Service KV Storage Tests
 * 
 * This script tests the Edge Agent's KV-based User Profile Service functionality, focusing on:
 * 1. Persistent bucketing across requests
 * 2. TTL functionality
 * 3. Cache size limits
 * 4. isDecisionFromStorage verification
 * 
 * Usage:
 *   node user-profile-service-tests.js
 * 
 * Environment variables:
 *   EDGE_AGENT_URL - URL of the Edge Agent deployment (required)
 *   SDK_KEY - SDK key to use for testing (required)
 *   LOG_LEVEL - Level of logging detail (default: info)
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');

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
    debug: '/api/debug',
    internal: '/api/_internal'
  },
  
  // Test flags
  testFlags: {
    primary: 'test-flag',
    secondary: 'homepage-test',
    tertiary: 'product-test'
  },
  
  // Admin settings
  adminToken: 'optly-admin-token',
  
  // Test scenarios
  stickyBucketingTest: {
    userCount: 5,  // Number of unique users to test
    requestsPerUser: 3,  // Number of requests per user
    timeBetweenRequests: 2000  // Time between requests in ms
  },
  
  ttlTest: {
    requestCount: 3,
    timeBetweenRequests: 30000  // 30 seconds between requests to test persistence
  },
  
  cacheLimitTest: {
    // Generate more users than the cache size (configured as 100 in KVUserProfileService)
    userCount: 110,
    batchSize: 10  // Process in batches to avoid overwhelming the service
  },
  
  isDecisionFromStorageTest: {
    firstRequestAttributes: {
      browser: 'Chrome',
      location: 'US'
    },
    secondRequestAttributes: {
      browser: 'Firefox',
      location: 'UK'
    }
  }
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `user-profile-service-test-${timestamp}`;

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
 * Sleep for a specified number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a random user ID
 */
const generateUserId = (prefix = 'test-user') => {
  return `${prefix}-${Math.floor(Math.random() * 10000000)}`;
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
  
  let markdown = `# User Profile Service KV Storage Test Results\n\n`;
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
    body = null,
    cookies = []
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
    
    // Add cookies if provided
    if (cookies && cookies.length > 0) {
      requestOptions.headers['Cookie'] = cookies.join('; ');
    }
    
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, requestOptions);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody;
    
    try {
      // Try to parse as JSON
      const contentType = responseHeaders['content-type'] || '';
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        // Get as text
        responseBody = await response.text();
        
        // Try to parse as JSON even if content-type isn't set correctly
        if (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('[')) {
          try {
            responseBody = JSON.parse(responseBody);
          } catch (parseError) {
            // Keep as text if parsing fails
            logger.debug(`Failed to parse response as JSON, keeping as text`);
          }
        }
      }
    } catch (e) {
      logger.warn(`Error processing response body: ${e.message}`);
      responseBody = '(Error reading response body)';
    }
    
    // Extract any cookies from Set-Cookie header
    const cookies = response.headers.raw()['set-cookie'] || [];
    
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
      cookies,
      ok: response.ok
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
 * Test sticky bucketing across multiple requests
 */
async function testStickyBucketing() {
  logger.info('Testing sticky bucketing across multiple requests...');
  
  try {
    const userResults = [];
    
    // Generate test users
    const testUsers = Array.from({ length: CONFIG.stickyBucketingTest.userCount })
      .map(() => generateUserId('sticky-test'));
    
    // Test each user with multiple requests
    for (const userId of testUsers) {
      const userRequests = [];
      
      // Make multiple requests for the same user
      for (let i = 0; i < CONFIG.stickyBucketingTest.requestsPerUser; i++) {
        // Add delay between requests
        if (i > 0) {
          await sleep(CONFIG.stickyBucketingTest.timeBetweenRequests);
        }
        
        // Make the request
        const response = await makeRequest({
          endpoint: CONFIG.endpoints.decide,
          headers: {
            'X-Optimizely-SDK-Key': CONFIG.sdkKey,
            'X-Optimizely-Visitor-Id': userId
          },
          body: {
            flagKey: CONFIG.testFlags.primary
          }
        });
        
        userRequests.push({
          requestNumber: i + 1,
          status: response.status,
          variationKey: response.responseBody?.variationKey || null,
          enabled: response.responseBody?.enabled || false,
          decision: {
            ...response.responseBody
          }
        });
        
        logger.debug(`Request ${i + 1} for user ${userId}: ${response.responseBody?.variationKey || 'n/a'}`);
      }
      
      // Check if all requests return the same variation
      const firstVariation = userRequests[0].variationKey;
      const consistent = userRequests.every(req => req.variationKey === firstVariation);
      
      userResults.push({
        userId,
        consistent,
        variationKey: firstVariation,
        requestDetails: userRequests
      });
      
      logger.info(`User ${userId}: ${consistent ? 'Consistent bucketing ✓' : 'Inconsistent bucketing ✗'}`);
    }
    
    // Evaluate overall test success
    const allConsistent = userResults.every(user => user.consistent);
    const consistentCount = userResults.filter(user => user.consistent).length;
    
    recordResult(
      'Sticky Bucketing',
      'Verify consistent bucketing across multiple requests for the same user',
      allConsistent,
      {
        userCount: testUsers.length,
        consistentCount,
        inconsistentCount: testUsers.length - consistentCount,
        userResults
      },
      !allConsistent ? 'One or more users received inconsistent variations across requests' : null,
      'User Profile Stickiness'
    );
    
    return allConsistent;
  } catch (error) {
    recordResult(
      'Sticky Bucketing',
      'Verify consistent bucketing across multiple requests for the same user',
      false,
      null,
      error,
      'User Profile Stickiness'
    );
    return false;
  }
}

/**
 * Test the isDecisionFromStorage functionality
 */
async function testIsDecisionFromStorage() {
  logger.info('Testing isDecisionFromStorage functionality...');
  
  try {
    // Generate a test user ID
    const userId = generateUserId('decision-storage-test');
    const flagKey = CONFIG.testFlags.primary;
    
    // Make an initial request to bucket the user
    const initialResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey,
        'X-Optimizely-Visitor-Id': userId
      },
      body: {
        flagKey,
        attributes: CONFIG.isDecisionFromStorageTest.firstRequestAttributes
      }
    });
    
    if (!initialResponse.ok) {
      throw new Error(`Initial request failed with status ${initialResponse.status}`);
    }
    
    const variationKey = initialResponse.responseBody?.variationKey;
    
    // Wait for the decision to be stored
    await sleep(2000);
    
    // Make a second request with debug header to see if decision came from storage
    const secondResponse = await makeRequest({
      endpoint: CONFIG.endpoints.decide,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey,
        'X-Optimizely-Visitor-Id': userId,
        'X-Optimizely-Debug': 'true'
      },
      body: {
        flagKey,
        attributes: CONFIG.isDecisionFromStorageTest.secondRequestAttributes
      }
    });
    
    // Check for isDecisionFromStorage in debug info
    const debugInfo = secondResponse.responseBody?.metadata?.debugInfo || {};
    const isFromStorage = debugInfo.isDecisionFromStorage || false;
    
    // Check if decision is consistent despite different attributes
    const isSameDecision = variationKey === secondResponse.responseBody?.variationKey;
    
    // For more detailed validation, use the debug endpoint if available
    let debugEndpointResult = null;
    
    try {
      const debugResponse = await makeRequest({
        endpoint: CONFIG.endpoints.debug,
        method: 'POST',
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey,
          'X-Optimizely-Admin-Token': CONFIG.adminToken
        },
        body: {
          action: 'checkUserProfiles',
          userId: userId
        }
      });
      
      if (debugResponse.ok) {
        debugEndpointResult = debugResponse.responseBody;
      }
    } catch (error) {
      logger.warn(`Debug endpoint request failed: ${error.message}`);
    }
    
    // Evaluate test success - should be both from storage AND same decision
    const success = isFromStorage && isSameDecision;
    
    recordResult(
      'Decision From Storage',
      'Verify isDecisionFromStorage functionality correctly identifies decisions from storage',
      success,
      {
        userId,
        flagKey,
        initialRequest: {
          attributes: CONFIG.isDecisionFromStorageTest.firstRequestAttributes,
          variationKey
        },
        secondRequest: {
          attributes: CONFIG.isDecisionFromStorageTest.secondRequestAttributes,
          variationKey: secondResponse.responseBody?.variationKey
        },
        isFromStorage,
        isSameDecision,
        debugInfo,
        debugEndpointResult
      },
      !success ? 
        (!isFromStorage ? 'Decision not reported as coming from storage' : 'Decision not consistent between requests') : 
        null,
      'User Profile Storage'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Decision From Storage',
      'Verify isDecisionFromStorage functionality correctly identifies decisions from storage',
      false,
      null,
      error,
      'User Profile Storage'
    );
    return false;
  }
}

/**
 * Test TTL functionality by checking if profiles persist for the expected time
 * Note: Full TTL testing would require waiting for the entire TTL period (30 days),
 * so we're just verifying short-term persistence here.
 */
async function testPersistence() {
  logger.info('Testing user profile persistence...');
  
  try {
    // Generate a test user ID
    const userId = generateUserId('ttl-test');
    const flagKey = CONFIG.testFlags.primary;
    
    const results = [];
    
    // Make multiple requests over time
    for (let i = 0; i < CONFIG.ttlTest.requestCount; i++) {
      // Add delay between requests (except for first request)
      if (i > 0) {
        logger.info(`Waiting ${CONFIG.ttlTest.timeBetweenRequests / 1000} seconds before next request...`);
        await sleep(CONFIG.ttlTest.timeBetweenRequests);
      }
      
      const response = await makeRequest({
        endpoint: CONFIG.endpoints.decide,
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey,
          'X-Optimizely-Visitor-Id': userId,
          'X-Optimizely-Debug': 'true'
        },
        body: {
          flagKey
        }
      });
      
      const timestamp = new Date().toISOString();
      
      results.push({
        requestNumber: i + 1,
        timestamp,
        variationKey: response.responseBody?.variationKey,
        isFromStorage: response.responseBody?.metadata?.debugInfo?.isDecisionFromStorage || false,
        elapsedSeconds: i > 0 ? 
          Math.round((CONFIG.ttlTest.timeBetweenRequests * i) / 1000) : 
          0
      });
      
      logger.info(`Request ${i + 1} at ${timestamp}: ${response.responseBody?.variationKey}, from storage: ${results[i].isFromStorage}`);
    }
    
    // First request should not be from storage
    const firstRequestNotFromStorage = !results[0].isFromStorage;
    
    // Subsequent requests should be from storage and have the same variation
    const subsequentRequestsFromStorage = results.slice(1).every(r => r.isFromStorage);
    const allSameVariation = results.every(r => r.variationKey === results[0].variationKey);
    
    // Overall success
    const success = firstRequestNotFromStorage && subsequentRequestsFromStorage && allSameVariation;
    
    recordResult(
      'Profile Persistence',
      'Verify user profiles persist for the expected time',
      success,
      {
        userId,
        flagKey,
        firstRequestNotFromStorage,
        subsequentRequestsFromStorage,
        allSameVariation,
        requestResults: results
      },
      !success ? 
        (!firstRequestNotFromStorage ? 'First request incorrectly reported as from storage' : 
         !subsequentRequestsFromStorage ? 'Subsequent requests not from storage' :
         !allSameVariation ? 'Variations inconsistent across requests' : 'Unknown error') : 
        null,
      'User Profile TTL'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Profile Persistence',
      'Verify user profiles persist for the expected time',
      false,
      null,
      error,
      'User Profile TTL'
    );
    return false;
  }
}

/**
 * Test cache size limits by generating more users than the cache can hold
 */
async function testCacheSizeLimits() {
  logger.info('Testing cache size limits...');
  
  try {
    const flagKey = CONFIG.testFlags.primary;
    const testUsers = Array.from({ length: CONFIG.cacheLimitTest.userCount })
      .map(() => generateUserId('cache-limit-test'));
    
    const userResults = [];
    
    // Process in batches to avoid overwhelming the service
    for (let i = 0; i < testUsers.length; i += CONFIG.cacheLimitTest.batchSize) {
      const batchUsers = testUsers.slice(i, i + CONFIG.cacheLimitTest.batchSize);
      logger.info(`Processing batch ${Math.floor(i / CONFIG.cacheLimitTest.batchSize) + 1}/${Math.ceil(testUsers.length / CONFIG.cacheLimitTest.batchSize)}, users ${i + 1}-${Math.min(i + CONFIG.cacheLimitTest.batchSize, testUsers.length)}`);
      
      // Process each user in the batch
      for (const userId of batchUsers) {
        // Make an initial request to bucket and store the user
        const initialResponse = await makeRequest({
          endpoint: CONFIG.endpoints.decide,
          headers: {
            'X-Optimizely-SDK-Key': CONFIG.sdkKey,
            'X-Optimizely-Visitor-Id': userId
          },
          body: {
            flagKey
          }
        });
        
        if (!initialResponse.ok) {
          logger.warn(`Initial request failed for user ${userId}`);
          continue;
        }
        
        const variationKey = initialResponse.responseBody?.variationKey;
        
        userResults.push({
          userId,
          variationKey,
          initialRequestStatus: initialResponse.status
        });
      }
      
      // Small delay between batches to avoid rate limiting
      await sleep(1000);
    }
    
    // Request a subset of the users again to check for cache eviction
    // Get first, middle, and last users to test LRU behavior
    const checkUsers = [
      testUsers[0], // First user (should be evicted if LRU works correctly)
      testUsers[Math.floor(testUsers.length / 2)], // Middle user
      testUsers[testUsers.length - 1] // Last user (should still be in cache)
    ];
    
    const checkResults = [];
    
    for (const userId of checkUsers) {
      // Wait briefly to ensure cache processing has time
      await sleep(500);
      
      // Request with debug flag to check if decision from storage
      const response = await makeRequest({
        endpoint: CONFIG.endpoints.decide,
        headers: {
          'X-Optimizely-SDK-Key': CONFIG.sdkKey,
          'X-Optimizely-Visitor-Id': userId,
          'X-Optimizely-Debug': 'true'
        },
        body: {
          flagKey
        }
      });
      
      const initialResult = userResults.find(r => r.userId === userId);
      
      checkResults.push({
        userId,
        initialVariationKey: initialResult?.variationKey,
        secondVariationKey: response.responseBody?.variationKey,
        isFromStorage: response.responseBody?.metadata?.debugInfo?.isDecisionFromStorage || false,
        isConsistent: initialResult?.variationKey === response.responseBody?.variationKey
      });
    }
    
    // For this test to pass, we consider it successful if:
    // 1. We were able to bucket all users successfully
    // 2. The most recent users are still retrievable from cache/storage
    
    const allUsersSuccessfullyBucketed = userResults.length === testUsers.length;
    
    // At least the last user should still be retrievable from storage
    // The first user might be evicted from memory cache but should still be in KV storage
    const lastUserFromStorage = checkResults.some(r => r.userId === testUsers[testUsers.length - 1] && r.isFromStorage);
    const allCheckResultsConsistent = checkResults.every(r => r.isConsistent);
    
    const success = allUsersSuccessfullyBucketed && lastUserFromStorage && allCheckResultsConsistent;
    
    recordResult(
      'Cache Size Limits',
      'Test cache size limits by generating more users than the cache can hold',
      success,
      {
        totalUsers: testUsers.length,
        successfullyBucketed: userResults.length,
        cacheCheckResults: checkResults,
        lastUserFromStorage,
        allCheckResultsConsistent
      },
      !success ? 
        (!allUsersSuccessfullyBucketed ? 'Failed to bucket all test users' : 
         !lastUserFromStorage ? 'Last user not retrievable from storage' :
         !allCheckResultsConsistent ? 'Inconsistent variations for check users' : 'Unknown error') : 
        null,
      'Cache Management'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Cache Size Limits',
      'Test cache size limits by generating more users than the cache can hold',
      false,
      null,
      error,
      'Cache Management'
    );
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  logger.info(`Starting User Profile Service KV Storage Tests at ${new Date().toLocaleString()}`);
  logger.info(`Edge Agent URL: ${CONFIG.edgeAgentUrl}`);
  logger.info(`SDK Key: ${CONFIG.sdkKey}`);
  
  try {
    // Test sticky bucketing across multiple requests
    await testStickyBucketing();
    
    // Test isDecisionFromStorage functionality
    await testIsDecisionFromStorage();
    
    // Test profile persistence (short-term)
    await testPersistence();
    
    // Test cache size limits
    await testCacheSizeLimits();
    
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