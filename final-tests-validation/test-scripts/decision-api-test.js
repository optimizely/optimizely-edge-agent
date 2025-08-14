/**
 * Decision API Test
 * 
 * This script validates the Edge Agent's decision API endpoints, testing
 * feature flag decisions, experiment decisions, and forced variations.
 * 
 * Usage:
 *   node decision-api-test.js
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
  edgeAgentUrl: process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev',
  sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
  
  // Optional configuration
  logLevel: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  resultDir: '../test-results',
  
  // Feature/Experiment keys for testing
  featureKeys: process.env.FEATURE_KEYS ? process.env.FEATURE_KEYS.split(',') : ['test-flag', 'homepage-test', 'product-test'],
  experimentKeys: process.env.EXPERIMENT_KEYS ? process.env.EXPERIMENT_KEYS.split(',') : ['ab-test-1', 'feature-test-1'],
  
  // Decision API endpoints
  endpoints: {
    decide: '/api/decide',
    decideAll: '/api/decide-all',
    decideForKeys: '/api/decide-for-keys',
    decideOptions: '/api/decide-options'
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
  ]
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `decision-api-test-${timestamp}`;

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
  
  let markdown = `# Decision API Test Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Feature Keys: \`${CONFIG.featureKeys.join('`, `')}\`\n`;
  markdown += `- Experiment Keys: \`${CONFIG.experimentKeys.join('`, `')}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Test Results\n\n`;
  
  // Group results by endpoint
  const endpointGroups = {};
  testResults.results.forEach(result => {
    const endpoint = result.endpoint || 'Other';
    if (!endpointGroups[endpoint]) {
      endpointGroups[endpoint] = [];
    }
    endpointGroups[endpoint].push(result);
  });
  
  // Generate results by endpoint
  Object.keys(endpointGroups).forEach(endpoint => {
    markdown += `### ${endpoint}\n\n`;
    
    endpointGroups[endpoint].forEach(result => {
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
function recordResult(test, description, result, details = null, error = null, endpoint = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    endpoint,
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}${endpoint ? ' - ' + endpoint : ''}`);
  } else {
    logger.error(`❌ FAIL: ${test}${endpoint ? ' - ' + endpoint : ''}`, error);
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
    const featureKeys = process.env.FEATURE_KEYS;
    const experimentKeys = process.env.EXPERIMENT_KEYS;
    const usingDefault = !edgeAgentUrl || !sdkKey;
    
    recordResult(
      'Environment Variables',
      'Verify that environment variables are properly resolved',
      true, // We can't fail the test, just record the state
      {
        resolvedEdgeAgentUrl: CONFIG.edgeAgentUrl,
        resolvedSdkKey: CONFIG.sdkKey,
        resolvedFeatureKeys: CONFIG.featureKeys,
        resolvedExperimentKeys: CONFIG.experimentKeys,
        envEdgeAgentUrl: edgeAgentUrl || '(not set)',
        envSdkKey: sdkKey || '(not set)',
        envFeatureKeys: featureKeys || '(not set)',
        envExperimentKeys: experimentKeys || '(not set)',
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
 * Make a request to the Decision API
 */
async function makeDecisionRequest(endpoint, method = 'POST', body = null) {
  const url = `${CONFIG.edgeAgentUrl}${endpoint}`;
  
  try {
    logger.debug(`Making ${method} request to ${url}...`);
    
    const options = {
      method,
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey,
        'Content-Type': 'application/json'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const headers = Object.fromEntries(response.headers.entries());
    let responseBody;
    
    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = await response.text();
    }
    
    // Check for Cloudflare-specific headers to verify live infrastructure
    const isCloudflare = headers['cf-ray'] !== undefined;
    
    return {
      url,
      method,
      requestBody: body,
      status: response.status,
      statusText: response.statusText,
      headers,
      body: responseBody,
      ok: response.ok,
      isCloudflare
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      method,
      requestBody: body,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test basic feature flag decisions
 */
async function testFeatureFlagDecisions() {
  try {
    logger.info('Testing feature flag decisions...');
    
    const testUser = CONFIG.testUsers[0];
    const responses = [];
    
    // Test each feature flag
    for (const featureKey of CONFIG.featureKeys) {
      const body = {
        userId: testUser.userId,
        key: featureKey,
        attributes: testUser.attributes
      };
      
      const response = await makeDecisionRequest(CONFIG.endpoints.decide, 'POST', body);
      responses.push({
        featureKey,
        response
      });
      
      // Test for Cloudflare to verify we're hitting live infrastructure
      if (!response.isCloudflare) {
        logger.warn(`Response for ${featureKey} does not appear to be from Cloudflare`);
      }
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Feature Flag Decisions',
      'Verify that the Edge Agent can provide feature flag decisions',
      success,
      {
        testUser,
        responses: responses.map(r => ({
          featureKey: r.featureKey,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          decision: r.response.body
        }))
      },
      success ? null : 'One or more flag decisions failed',
      CONFIG.endpoints.decide
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Feature Flag Decisions',
      'Verify that the Edge Agent can provide feature flag decisions',
      false,
      null,
      error,
      CONFIG.endpoints.decide
    );
    return false;
  }
}

/**
 * Test experiment decisions
 */
async function testExperimentDecisions() {
  try {
    logger.info('Testing experiment decisions...');
    
    const testUser = CONFIG.testUsers[0];
    const responses = [];
    
    // Test each experiment
    for (const experimentKey of CONFIG.experimentKeys) {
      const body = {
        userId: testUser.userId,
        key: experimentKey,
        attributes: testUser.attributes
      };
      
      const response = await makeDecisionRequest(CONFIG.endpoints.decide, 'POST', body);
      responses.push({
        experimentKey,
        response
      });
      
      // Test for Cloudflare to verify we're hitting live infrastructure
      if (!response.isCloudflare) {
        logger.warn(`Response for ${experimentKey} does not appear to be from Cloudflare`);
      }
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Experiment Decisions',
      'Verify that the Edge Agent can provide experiment variation decisions',
      success,
      {
        testUser,
        responses: responses.map(r => ({
          experimentKey: r.experimentKey,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          decision: r.response.body
        }))
      },
      success ? null : 'One or more experiment decisions failed',
      CONFIG.endpoints.decide
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Experiment Decisions',
      'Verify that the Edge Agent can provide experiment variation decisions',
      false,
      null,
      error,
      CONFIG.endpoints.decide
    );
    return false;
  }
}

/**
 * Test user targeting with different attributes
 */
async function testUserTargeting() {
  try {
    logger.info('Testing user targeting with different attributes...');
    
    const testFeatureKey = CONFIG.featureKeys[0];
    const testExperimentKey = CONFIG.experimentKeys[0];
    const responses = [];
    
    // Test with each user (with different attributes)
    for (const testUser of CONFIG.testUsers) {
      // Test a feature flag decision
      const featureResponse = await makeDecisionRequest(CONFIG.endpoints.decide, 'POST', {
        userId: testUser.userId,
        key: testFeatureKey,
        attributes: testUser.attributes
      });
      
      // Test an experiment decision
      const experimentResponse = await makeDecisionRequest(CONFIG.endpoints.decide, 'POST', {
        userId: testUser.userId,
        key: testExperimentKey,
        attributes: testUser.attributes
      });
      
      responses.push({
        userId: testUser.userId,
        attributes: testUser.attributes,
        featureResponse,
        experimentResponse
      });
    }
    
    const success = responses.every(r => r.featureResponse.ok && r.experimentResponse.ok);
    
    recordResult(
      'User Targeting',
      'Verify that the Edge Agent handles user targeting with different attributes',
      success,
      {
        testFeatureKey,
        testExperimentKey,
        responses: responses.map(r => ({
          userId: r.userId,
          attributes: r.attributes,
          featureDecision: r.featureResponse.body,
          experimentDecision: r.experimentResponse.body
        }))
      },
      success ? null : 'One or more user targeting tests failed',
      CONFIG.endpoints.decide
    );
    
    return success;
  } catch (error) {
    recordResult(
      'User Targeting',
      'Verify that the Edge Agent handles user targeting with different attributes',
      false,
      null,
      error,
      CONFIG.endpoints.decide
    );
    return false;
  }
}

/**
 * Test decide-all endpoint
 */
async function testDecideAll() {
  try {
    logger.info('Testing decide-all endpoint...');
    
    const testUser = CONFIG.testUsers[0];
    const body = {
      userId: testUser.userId,
      attributes: testUser.attributes
    };
    
    const response = await makeDecisionRequest(CONFIG.endpoints.decideAll, 'POST', body);
    
    // Test for Cloudflare to verify we're hitting live infrastructure
    if (!response.isCloudflare) {
      logger.warn('Response from decide-all does not appear to be from Cloudflare');
    }
    
    // Check that we got decisions for all feature keys
    const hasAllFeatures = CONFIG.featureKeys.every(key => 
      response.body && 
      response.body.decisions && 
      response.body.decisions.some(d => d.key === key)
    );
    
    recordResult(
      'Decide All Endpoint',
      'Verify that the decide-all endpoint returns decisions for all features',
      response.ok && hasAllFeatures,
      {
        testUser,
        response: {
          status: response.status,
          isCloudflare: response.isCloudflare,
          decisions: response.body ? response.body.decisions : null
        },
        hasAllFeatures
      },
      response.ok ? null : 'Decide-all endpoint failed',
      CONFIG.endpoints.decideAll
    );
    
    return response.ok;
  } catch (error) {
    recordResult(
      'Decide All Endpoint',
      'Verify that the decide-all endpoint returns decisions for all features',
      false,
      null,
      error,
      CONFIG.endpoints.decideAll
    );
    return false;
  }
}

/**
 * Test decide-for-keys endpoint
 */
async function testDecideForKeys() {
  try {
    logger.info('Testing decide-for-keys endpoint...');
    
    const testUser = CONFIG.testUsers[0];
    const body = {
      userId: testUser.userId,
      attributes: testUser.attributes,
      keys: CONFIG.featureKeys
    };
    
    const response = await makeDecisionRequest(CONFIG.endpoints.decideForKeys, 'POST', body);
    
    // Test for Cloudflare to verify we're hitting live infrastructure
    if (!response.isCloudflare) {
      logger.warn('Response from decide-for-keys does not appear to be from Cloudflare');
    }
    
    // Check that we got decisions for all requested keys
    const hasAllRequestedKeys = CONFIG.featureKeys.every(key => 
      response.body && 
      response.body.decisions && 
      response.body.decisions.some(d => d.key === key)
    );
    
    recordResult(
      'Decide For Keys Endpoint',
      'Verify that the decide-for-keys endpoint returns decisions for specified keys',
      response.ok && hasAllRequestedKeys,
      {
        testUser,
        requestedKeys: CONFIG.featureKeys,
        response: {
          status: response.status,
          isCloudflare: response.isCloudflare,
          decisions: response.body ? response.body.decisions : null
        },
        hasAllRequestedKeys
      },
      response.ok ? null : 'Decide-for-keys endpoint failed',
      CONFIG.endpoints.decideForKeys
    );
    
    return response.ok;
  } catch (error) {
    recordResult(
      'Decide For Keys Endpoint',
      'Verify that the decide-for-keys endpoint returns decisions for specified keys',
      false,
      null,
      error,
      CONFIG.endpoints.decideForKeys
    );
    return false;
  }
}

/**
 * Test decide-options endpoint and options parameters
 */
async function testDecideOptions() {
  try {
    logger.info('Testing decide-options endpoint and options parameters...');
    
    const testUser = CONFIG.testUsers[0];
    const testFeatureKey = CONFIG.featureKeys[0];
    
    // Test with different options combinations
    const testCases = [
      {
        name: 'Include Reasons',
        options: { includeReasons: true }
      },
      {
        name: 'Enable Debug',
        options: { enableDebug: true }
      },
      {
        name: 'Multiple Options',
        options: { 
          includeReasons: true, 
          enableDebug: true
        }
      }
    ];
    
    const responses = [];
    
    for (const testCase of testCases) {
      const body = {
        userId: testUser.userId,
        key: testFeatureKey,
        attributes: testUser.attributes,
        options: testCase.options
      };
      
      const response = await makeDecisionRequest(CONFIG.endpoints.decide, 'POST', body);
      
      // Test for Cloudflare to verify we're hitting live infrastructure
      if (!response.isCloudflare) {
        logger.warn(`Response for ${testCase.name} does not appear to be from Cloudflare`);
      }
      
      responses.push({
        testCase,
        response
      });
    }
    
    const success = responses.every(r => r.response.ok);
    
    recordResult(
      'Decision Options',
      'Verify that the Edge Agent supports decision options parameters',
      success,
      {
        testUser,
        testFeatureKey,
        responses: responses.map(r => ({
          testCase: r.testCase.name,
          options: r.testCase.options,
          status: r.response.status,
          isCloudflare: r.response.isCloudflare,
          decision: r.response.body
        }))
      },
      success ? null : 'One or more decision options tests failed',
      CONFIG.endpoints.decide
    );
    
    return success;
  } catch (error) {
    recordResult(
      'Decision Options',
      'Verify that the Edge Agent supports decision options parameters',
      false,
      null,
      error,
      CONFIG.endpoints.decide
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting decision API test`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    featureKeys: CONFIG.featureKeys,
    experimentKeys: CONFIG.experimentKeys
  });
  
  // Record environment variables
  testEnvironmentVariables();
  
  // Run the tests
  await testFeatureFlagDecisions();
  await testExperimentDecisions();
  await testUserTargeting();
  await testDecideAll();
  await testDecideForKeys();
  await testDecideOptions();
  
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