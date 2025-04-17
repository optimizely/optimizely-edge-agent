/**
 * Forced Variation Tests
 * 
 * This script validates the Edge Agent's ability to handle forced variations
 * through different methods: headers, JSON payload, and query parameters.
 * 
 * Usage:
 *   node forced-variation-tests.js
 * 
 * Environment variables:
 *   EDGE_AGENT_URL - URL of the Edge Agent deployment (required)
 *   SDK_KEY - SDK key to use for testing (required)
 *   LOG_LEVEL - Level of logging detail (default: info)
 *   FEATURE_KEYS - Comma-separated list of feature keys to test (default from config)
 *   EXPERIMENT_KEYS - Comma-separated list of experiment keys to test (default from config)
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  // Required environment variables
  edgeAgentUrl: process.env.EDGE_AGENT_URL || 'http://127.0.0.1:8787',
  sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
  
  // Optional configuration
  logLevel: process.env.LOG_LEVEL || 'debug', // 'debug', 'info', 'warn', 'error'
  resultDir: '../test-results',
  
  // Feature/Experiment keys for testing
  featureKeys: process.env.FEATURE_KEYS ? process.env.FEATURE_KEYS.split(',') : ['test-flag', 'homepage-test', 'product-test'],
  experimentKeys: process.env.EXPERIMENT_KEYS ? process.env.EXPERIMENT_KEYS.split(',') : ['ab-test-1', 'feature-test-1'],
  
  // Decision API endpoints
  endpoints: {
    decide: '/api/decide',
    decideAll: '/api/decide-all',
    decideForKeys: '/api/decide-for-keys'
  },
  
  // Test users
  testUsers: [
    {
      userId: 'test-user-' + Math.floor(Math.random() * 1000000),
      attributes: {
        browser: 'Chrome',
        location: 'US'
      }
    },
    {
      userId: 'test-user-' + Math.floor(Math.random() * 1000000),
      attributes: {
        browser: 'Firefox',
        location: 'UK'
      }
    }
  ],
  
  // Test variations for forcing
  testVariations: ['control', 'treatment', 'variant-1', 'variant-2']
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `forced-variation-test-${timestamp}`;

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
    featureKeys: CONFIG.featureKeys,
    experimentKeys: CONFIG.experimentKeys,
    testUsers: CONFIG.testUsers,
    testVariations: CONFIG.testVariations
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
  
  let markdown = `# Forced Variation Test Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Feature Keys: \`${CONFIG.featureKeys.join('`, `')}\`\n`;
  markdown += `- Experiment Keys: \`${CONFIG.experimentKeys.join('`, `')}\`\n`;
  markdown += `- Test Variations: \`${CONFIG.testVariations.join('`, `')}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Test Results\n\n`;
  
  // Group results by test method
  const methodGroups = {};
  testResults.results.forEach(result => {
    const method = result.method || 'Other';
    if (!methodGroups[method]) {
      methodGroups[method] = [];
    }
    methodGroups[method].push(result);
  });
  
  // Generate results by method
  Object.keys(methodGroups).forEach(method => {
    markdown += `### ${method}\n\n`;
    
    methodGroups[method].forEach(result => {
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
function recordResult(test, description, result, details = null, error = null, method = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    method,
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}${method ? ' - ' + method : ''}`);
  } else {
    logger.error(`❌ FAIL: ${test}${method ? ' - ' + method : ''}`, error);
  }
}

/**
 * Make a request to the Decision API
 */
async function makeDecisionRequest(endpoint, method = 'POST', body = null, headers = {}, queryParams = null) {
  let url = `${CONFIG.edgeAgentUrl}${endpoint}`;
  
  // Add query parameters if provided
  if (queryParams) {
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    url = `${url}?${queryString}`;
  }
  
  try {
    logger.debug(`Making ${method} request to ${url}...`);
    
    const options = {
      method,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey,
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    logger.debug(`Request options:`, options);
    
    const response = await fetch(url, options);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    let responseBody;
    
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
        // Try to parse it as JSON anyway
        try {
          responseBody = JSON.parse(responseBody);
        } catch (e) {
          // If it's not valid JSON, keep it as text
        }
      }
    } catch (e) {
      responseBody = await response.text();
      logger.debug(`Error parsing response body:`, e);
    }
    
    // Check for Cloudflare-specific headers to verify live infrastructure
    const isCloudflare = responseHeaders['cf-ray'] !== undefined;
    
    logger.debug(`Response status: ${response.status}, body:`, responseBody);
    
    return {
      url,
      method,
      requestBody: body,
      requestHeaders: options.headers,
      requestQueryParams: queryParams,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      ok: response.status >= 200 && response.status < 300,
      isCloudflare
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      method,
      requestBody: body,
      requestHeaders: headers,
      requestQueryParams: queryParams,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test forced variations via HTTP headers
 */
async function testHeaderForcedVariations() {
  try {
    logger.info('Testing header-based forced variations...');
    
    const testUser = CONFIG.testUsers[0];
    const responses = [];
    
    // Test each feature key with a forced variation via header
    for (const featureKey of CONFIG.featureKeys) {
      const variation = CONFIG.testVariations[0]; // Use first variation for test
      
      // Create the forced decision header
      // The v2 API expects a format like: { "flagKey": { "variationKey": "variation" } }
      const forcedDecision = {
        [featureKey]: {
          variationKey: variation
        }
      };
      
      const headers = {
        'X-Optimizely-Forced-Decision': JSON.stringify(forcedDecision)
      };
      
      const body = {
        userId: testUser.userId,
        key: featureKey, // Must match the expected API parameter
        attributes: testUser.attributes
      };
      
      const response = await makeDecisionRequest(
        CONFIG.endpoints.decide,
        'POST',
        body,
        headers
      );
      
      responses.push({
        featureKey,
        variation,
        response
      });
    }
    
    // Now test multiple forced decisions in one request
    // Use the format that matches v2 API docs
    const multipleForcedDecisions = {
      [CONFIG.featureKeys[0]]: {
        variationKey: CONFIG.testVariations[1]  // Use treatment
      },
      [CONFIG.featureKeys[1]]: {
        variationKey: CONFIG.testVariations[2]  // Use variant-1
      }
    };
    
    const multipleHeaders = {
      'X-Optimizely-Forced-Decision': JSON.stringify(multipleForcedDecisions)
    };
    
    const multipleBody = {
      userId: testUser.userId,
      attributes: testUser.attributes
    };
    
    const multipleResponse = await makeDecisionRequest(
      CONFIG.endpoints.decideAll,
      'POST',
      multipleBody,
      multipleHeaders
    );
    
    responses.push({
      featureKey: 'multiple',
      variation: 'multiple',
      response: multipleResponse
    });
    
    const success = responses.every(r => r.response.ok);
    const variationSuccess = responses.filter(r => r.featureKey !== 'multiple')
      .every(r => {
        // Check if the forced variation was actually applied
        if (!r.response.body || !r.response.body.variationKey) {
          return false;
        }
        return r.response.body.variationKey === r.variation;
      });
    
    recordResult(
      'Header-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via HTTP headers',
      success && variationSuccess,
      {
        testUser,
        responses: responses.map(r => ({
          featureKey: r.featureKey,
          forcedVariation: r.variation,
          status: r.response.status,
          decision: r.response.body,
          variationApplied: r.featureKey !== 'multiple' ? 
            (r.response.body && r.response.body.variationKey === r.variation) : 
            'multiple decisions'
        }))
      },
      success && !variationSuccess ? 'Forced variations were not applied correctly' : 
        !success ? 'One or more requests failed' : null,
      'Header-Based'
    );
    
    return success && variationSuccess;
  } catch (error) {
    recordResult(
      'Header-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via HTTP headers',
      false,
      null,
      error,
      'Header-Based'
    );
    return false;
  }
}

/**
 * Test forced variations via JSON payload
 */
async function testJSONForcedVariations() {
  try {
    logger.info('Testing JSON-based forced variations...');
    
    const testUser = CONFIG.testUsers[0];
    const responses = [];
    
    // Test each feature key with a forced variation via JSON payload
    for (const featureKey of CONFIG.featureKeys) {
      const variation = CONFIG.testVariations[1]; // Use second variation for test
      
      // Create the forced decision in the JSON payload
      // Use the format the v2 API expects: { "flagKey": { "variationKey": "variation" } }
      const body = {
        userId: testUser.userId,
        key: featureKey,
        attributes: testUser.attributes,
        forcedDecisions: {
          [featureKey]: {
            variationKey: variation
          }
        }
      };
      
      const response = await makeDecisionRequest(
        CONFIG.endpoints.decide,
        'POST',
        body
      );
      
      responses.push({
        featureKey,
        variation,
        response
      });
    }
    
    // Test with a structure variation with multiple forced decisions
    // Format matches the v2 API docs: { "flag-key": { "variationKey": "variation" } }
    const multipleBody = {
      userId: testUser.userId,
      attributes: testUser.attributes,
      forcedDecisions: {
        [CONFIG.featureKeys[0]]: {
          variationKey: CONFIG.testVariations[2]  // variant-1
        },
        [CONFIG.featureKeys[1]]: {
          variationKey: CONFIG.testVariations[3]  // variant-2
        }
      }
    };
    
    const multipleResponse = await makeDecisionRequest(
      CONFIG.endpoints.decideAll,
      'POST',
      multipleBody
    );
    
    responses.push({
      featureKey: 'multiple',
      variation: 'multiple',
      response: multipleResponse
    });
    
    const success = responses.every(r => r.response.ok);
    const variationSuccess = responses.filter(r => r.featureKey !== 'multiple')
      .every(r => {
        // Check if the forced variation was actually applied
        if (!r.response.body || !r.response.body.variationKey) {
          return false;
        }
        return r.response.body.variationKey === r.variation;
      });
    
    recordResult(
      'JSON-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via JSON payload',
      success && variationSuccess,
      {
        testUser,
        responses: responses.map(r => ({
          featureKey: r.featureKey,
          forcedVariation: r.variation,
          status: r.response.status,
          decision: r.response.body,
          variationApplied: r.featureKey !== 'multiple' ? 
            (r.response.body && r.response.body.variationKey === r.variation) : 
            'multiple decisions'
        }))
      },
      success && !variationSuccess ? 'Forced variations were not applied correctly' : 
        !success ? 'One or more requests failed' : null,
      'JSON-Based'
    );
    
    return success && variationSuccess;
  } catch (error) {
    recordResult(
      'JSON-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via JSON payload',
      false,
      null,
      error,
      'JSON-Based'
    );
    return false;
  }
}

/**
 * Test forced variations via query parameters
 */
async function testQueryForcedVariations() {
  try {
    logger.info('Testing query parameter-based forced variations...');
    
    const testUser = CONFIG.testUsers[0];
    const responses = [];
    
    // Test each feature key with a forced variation via query parameter
    for (const featureKey of CONFIG.featureKeys) {
      const variation = CONFIG.testVariations[2]; // Use variant-1 for test
      
      // Create the query parameters
      const queryParams = {
        key: featureKey, // Changed from flag_key to key
        variation: variation,
        experiment_key: 'test-experiment'
      };
      
      const body = {
        userId: testUser.userId,
        attributes: testUser.attributes
      };
      
      const response = await makeDecisionRequest(
        CONFIG.endpoints.decide,
        'POST',
        body,
        {},
        queryParams
      );
      
      responses.push({
        featureKey,
        variation,
        response
      });
    }
    
    // Now test multiple flags in decide-for-keys
    const multipleBody = {
      userId: testUser.userId,
      attributes: testUser.attributes,
      keys: CONFIG.featureKeys
    };
    
    const multipleQueryParams = {
      variation: CONFIG.testVariations[3], // Use variant-2 for test
      experiment_key: 'test-experiment'
    };
    
    const multipleResponse = await makeDecisionRequest(
      CONFIG.endpoints.decideForKeys,
      'POST',
      multipleBody,
      {},
      multipleQueryParams
    );
    
    responses.push({
      featureKey: 'multiple',
      variation: 'multiple',
      response: multipleResponse
    });
    
    const success = responses.every(r => r.response.ok);
    const variationSuccess = responses.filter(r => r.featureKey !== 'multiple')
      .every(r => {
        // Check if the forced variation was actually applied
        if (!r.response.body || !r.response.body.variationKey) {
          return false;
        }
        return r.response.body.variationKey === r.variation;
      });
    
    recordResult(
      'Query Parameter-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via query parameters',
      success && variationSuccess,
      {
        testUser,
        responses: responses.map(r => ({
          featureKey: r.featureKey,
          forcedVariation: r.variation,
          status: r.response.status,
          decision: r.response.body,
          variationApplied: r.featureKey !== 'multiple' ? 
            (r.response.body && r.response.body.variationKey === r.variation) : 
            'multiple decisions'
        }))
      },
      success && !variationSuccess ? 'Forced variations were not applied correctly' : 
        !success ? 'One or more requests failed' : null,
      'Query-Based'
    );
    
    return success && variationSuccess;
  } catch (error) {
    recordResult(
      'Query Parameter-Based Forced Variations',
      'Verify that the Edge Agent respects forced variations via query parameters',
      false,
      null,
      error,
      'Query-Based'
    );
    return false;
  }
}

/**
 * Test precedence between different forced variation methods
 */
async function testForcedVariationPrecedence() {
  try {
    logger.info('Testing forced variation precedence...');
    
    const testUser = CONFIG.testUsers[0];
    const featureKey = CONFIG.featureKeys[0];
    
    // Define different variations for each method
    const headerVariation = CONFIG.testVariations[0];
    const jsonVariation = CONFIG.testVariations[1];
    const queryVariation = CONFIG.testVariations[2];
    
    // Set up forced decisions for all three methods
    const forcedDecisionHeader = {
      [featureKey]: {
        variationKey: headerVariation
      }
    };
    
    const headers = {
      'X-Optimizely-Forced-Decision': JSON.stringify(forcedDecisionHeader)
    };
    
    const body = {
      userId: testUser.userId,
      key: featureKey,
      attributes: testUser.attributes,
      forcedDecisions: {
        [featureKey]: {
          variationKey: jsonVariation
        }
      }
    };
    
    const queryParams = {
      variation: queryVariation,
      experiment_key: 'test-experiment'
    };
    
    // Make the request with all three methods
    const response = await makeDecisionRequest(
      CONFIG.endpoints.decide,
      'POST',
      body,
      headers,
      queryParams
    );
    
    // Check the result - which variation was applied?
    // The precedence order should be: header > body > query
    const expectedVariation = headerVariation; // Header should have highest precedence
    const chosenVariation = response.body && response.body.variationKey;
    
    const success = response.ok && chosenVariation === expectedVariation;
    
    recordResult(
      'Forced Variation Precedence',
      'Verify that the Edge Agent respects the forced variation precedence rules',
      success,
      {
        testUser,
        featureKey,
        headerVariation,
        jsonVariation,
        queryVariation,
        response: {
          status: response.status,
          body: response.body,
          variationApplied: chosenVariation
        },
        expectedPrecedenceOrder: 'header > body > query'
      },
      success ? null : `Forced variation precedence not respected. Expected '${expectedVariation}', got '${chosenVariation}'`,
      'Precedence'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Forced Variation Precedence',
      'Verify that the Edge Agent respects the forced variation precedence rules',
      false,
      null,
      error,
      'Precedence'
    );
    return false;
  }
}

/**
 * Test handling of invalid forced variations
 */
async function testInvalidForcedVariations() {
  try {
    logger.info('Testing invalid forced variations...');
    
    const testUser = CONFIG.testUsers[0];
    const featureKey = CONFIG.featureKeys[0];
    
    // Test 1: Invalid JSON in the header
    const headers1 = {
      'X-Optimizely-Forced-Decision': '{invalid:json}'
    };
    
    const body1 = {
      userId: testUser.userId,
      key: featureKey,
      attributes: testUser.attributes
    };
    
    const response1 = await makeDecisionRequest(
      CONFIG.endpoints.decide,
      'POST',
      body1,
      headers1
    );
    
    // The request should still succeed even with invalid forced decision
    const test1Success = response1.ok;
    
    // Test 2: Missing required fields in forcedDecisions
    const body2 = {
      userId: testUser.userId,
      key: featureKey,
      attributes: testUser.attributes,
      forcedDecisions: {
        [featureKey]: {
          // Missing variationKey field
          someOtherField: "value"
        }
      }
    };
    
    const response2 = await makeDecisionRequest(
      CONFIG.endpoints.decide,
      'POST',
      body2
    );
    
    // The request should still succeed even with invalid forced decision
    const test2Success = response2.ok;
    
    const success = test1Success && test2Success;
    
    recordResult(
      'Invalid Forced Variation Handling',
      'Verify that the Edge Agent correctly handles invalid forced variations without failing',
      success,
      {
        testUser,
        featureKey,
        test1: {
          description: 'Invalid JSON in header',
          status: response1.status,
          success: test1Success,
          body: response1.body
        },
        test2: {
          description: 'Missing required fields in forcedDecisions',
          status: response2.status,
          success: test2Success,
          body: response2.body
        }
      },
      success ? null : 'One or more tests failed to handle invalid forced variations gracefully',
      'Invalid'
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Invalid Forced Variation Handling',
      'Verify that the Edge Agent correctly handles invalid forced variations without failing',
      false,
      null,
      error,
      'Invalid'
    );
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  logger.info(`Starting Forced Variation Tests at ${new Date().toLocaleString()}`);
  logger.info(`Edge Agent URL: ${CONFIG.edgeAgentUrl}`);
  logger.info(`SDK Key: ${CONFIG.sdkKey}`);
  
  try {
    // Test header-based forced variations
    await testHeaderForcedVariations();
    
    // Test JSON-based forced variations
    await testJSONForcedVariations();
    
    // Test query parameter-based forced variations
    await testQueryForcedVariations();
    
    // Test precedence between different methods
    await testForcedVariationPrecedence();
    
    // Test invalid forced variation inputs
    await testInvalidForcedVariations();
    
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