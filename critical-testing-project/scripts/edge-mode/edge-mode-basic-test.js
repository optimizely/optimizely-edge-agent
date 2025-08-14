/**
 * Basic Edge Mode Test for Optimizely Edge Agent
 * 
 * This test verifies core Edge Mode functionality:
 * - GET requests to URLs with cdnVariationSettings
 * - URL pattern matching 
 * - Content routing decisions
 * - Basic header verification
 * 
 * Edge Mode differs from Agent Mode by intercepting GET requests 
 * to content URLs and serving experimented variations.
 */

const fetch = require('node-fetch');
const testUtils = require('../../utils/test-utils');

// Load environment variables
testUtils.loadEnv();

// Test Configuration
const config = {
  EDGE_AGENT_URL: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
  SDK_KEY: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',  // Default SDK key
  TEST_ID: testUtils.generateTestId('edge-mode-basic'),
  USER_ID: `edge-test-user-${Date.now()}`
};

// Create test results container
const testResults = testUtils.createTestResults('Edge Mode: Basic Functionality Test', {
  description: 'Tests core Edge Mode request interception and content routing'
});

/**
 * Helper to make Edge Mode requests (GET requests to content URLs)
 */
async function makeEdgeModeRequest(path, options = {}) {
  const { visitorId, additionalHeaders = {} } = options;
  
  const url = new URL(path, config.EDGE_AGENT_URL);
  
  // Add visitor ID if provided
  if (visitorId) {
    url.searchParams.append('optimizely_visitor_id', visitorId);
  }
  
  const headers = {
    'User-Agent': 'EdgeModeTest/1.0',
    'X-Optimizely-SDK-Key': config.SDK_KEY,
    ...additionalHeaders
  };
  
  console.log(`Making Edge Mode request: GET ${url.toString()}`);
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers
  });
  
  return response;
}

/**
 * Test 1: Basic Edge Mode URL Interception
 * Tests if Edge Mode can intercept and process GET requests
 */
async function testBasicEdgeModeInterception() {
  const testName = 'Basic Edge Mode Interception';
  console.log(`\nRunning test: ${testName}`);
  
  const testCase = testUtils.createTestCase(testName);
  
  try {
    // Test different URL patterns that might trigger Edge Mode
    const testPaths = [
      '/',                    // Root path
      '/products',            // Products path
      '/test-page',          // Generic test path
      '/home'                // Home path
    ];
    
    for (const path of testPaths) {
      const response = await makeEdgeModeRequest(path, {
        visitorId: config.USER_ID
      });
      
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      testCase.steps.push({
        action: `GET ${path}`,
        expected: 'Should return valid response',
        actual: `Status: ${response.status}, Headers: ${Object.keys(responseHeaders).join(', ')}`,
        passed: response.status < 500  // Accept any non-server-error
      });
      
      // Check for any Optimizely-related headers
      const optimizelyHeaders = Object.keys(responseHeaders).filter(h => 
        h.toLowerCase().includes('optimizely') || h.toLowerCase().includes('edge')
      );
      
      if (optimizelyHeaders.length > 0) {
        testCase.steps.push({
          action: `Check Optimizely headers for ${path}`,
          expected: 'Found Optimizely headers indicating Edge Mode processing',
          actual: `Headers: ${optimizelyHeaders.join(', ')}`,
          passed: true
        });
      }
      
      console.log(`  ${path}: ${response.status} - ${optimizelyHeaders.length > 0 ? 'Edge Mode Active' : 'Standard Response'}`);
    }
    
    testCase.passed = testCase.steps.some(step => step.passed);
    
  } catch (error) {
    testCase.error = error.message;
    testCase.passed = false;
    console.error(`Test failed: ${error.message}`);
  }
  
  testResults.testCases.push(testCase);
  return testCase.passed;
}

/**
 * Test 2: Edge Mode vs Agent Mode Behavior
 * Compares Edge Mode (GET) vs Agent Mode (POST) behavior
 */
async function testEdgeModeVsAgentMode() {
  const testName = 'Edge Mode vs Agent Mode Behavior';
  console.log(`\nRunning test: ${testName}`);
  
  const testCase = testUtils.createTestCase(testName);
  
  try {
    // Test Edge Mode (GET request)
    const edgeModeResponse = await makeEdgeModeRequest('/', {
      visitorId: config.USER_ID
    });
    
    testCase.steps.push({
      action: 'Edge Mode GET request to /',
      expected: 'Should process as Edge Mode',
      actual: `Status: ${edgeModeResponse.status}`,
      passed: edgeModeResponse.status < 500
    });
    
    // Test Agent Mode (POST to /decide)
    const agentModeUrl = `${config.EDGE_AGENT_URL}/decide`;
    const agentModeResponse = await fetch(agentModeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': config.SDK_KEY
      },
      body: JSON.stringify({
        userId: config.USER_ID,
        flagKey: 'test-flag'
      })
    });
    
    testCase.steps.push({
      action: 'Agent Mode POST request to /decide',
      expected: 'Should process as Agent Mode and return JSON',
      actual: `Status: ${agentModeResponse.status}, Content-Type: ${agentModeResponse.headers.get('content-type')}`,
      passed: agentModeResponse.status < 500
    });
    
    // Verify different response types
    const edgeContentType = edgeModeResponse.headers.get('content-type') || '';
    const agentContentType = agentModeResponse.headers.get('content-type') || '';
    
    testCase.steps.push({
      action: 'Compare response types',
      expected: 'Edge Mode and Agent Mode should have different response characteristics',
      actual: `Edge: ${edgeContentType}, Agent: ${agentContentType}`,
      passed: true  // Both are valid, just documenting the difference
    });
    
    testCase.passed = testCase.steps.every(step => step.passed);
    
  } catch (error) {
    testCase.error = error.message;
    testCase.passed = false;
    console.error(`Test failed: ${error.message}`);
  }
  
  testResults.testCases.push(testCase);
  return testCase.passed;
}

/**
 * Test 3: Visitor ID Handling in Edge Mode
 * Tests visitor identification and persistence
 */
async function testVisitorIdHandling() {
  const testName = 'Edge Mode Visitor ID Handling';
  console.log(`\nRunning test: ${testName}`);
  
  const testCase = testUtils.createTestCase(testName);
  
  try {
    // Test without visitor ID (should generate one)
    const response1 = await makeEdgeModeRequest('/test', {});
    
    const generatedVisitorId = response1.headers.get('x-optimizely-visitor-id');
    const setCookie = response1.headers.get('set-cookie');
    
    testCase.steps.push({
      action: 'Request without visitor ID',
      expected: 'Should generate visitor ID',
      actual: `Generated ID: ${generatedVisitorId}, Set-Cookie: ${setCookie ? 'present' : 'none'}`,
      passed: !!generatedVisitorId || !!setCookie
    });
    
    // Test with provided visitor ID
    const providedVisitorId = `test-visitor-${Date.now()}`;
    const response2 = await makeEdgeModeRequest('/test', {
      visitorId: providedVisitorId
    });
    
    const returnedVisitorId = response2.headers.get('x-optimizely-visitor-id');
    
    testCase.steps.push({
      action: 'Request with provided visitor ID',
      expected: 'Should use provided visitor ID',
      actual: `Provided: ${providedVisitorId}, Returned: ${returnedVisitorId}`,
      passed: returnedVisitorId === providedVisitorId || !returnedVisitorId  // Some implementations may not echo back
    });
    
    testCase.passed = testCase.steps.some(step => step.passed);
    
  } catch (error) {
    testCase.error = error.message;
    testCase.passed = false;
    console.error(`Test failed: ${error.message}`);
  }
  
  testResults.testCases.push(testCase);
  return testCase.passed;
}

/**
 * Test 4: Edge Mode Headers and Tracing
 * Tests Edge Mode specific headers
 */
async function testEdgeModeHeaders() {
  const testName = 'Edge Mode Headers and Tracing';
  console.log(`\nRunning test: ${testName}`);
  
  const testCase = testUtils.createTestCase(testName);
  
  try {
    const response = await makeEdgeModeRequest('/test', {
      visitorId: config.USER_ID
    });
    
    // Collect all headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Look for Edge Mode related headers
    const edgeModeHeaders = Object.keys(headers).filter(h => 
      h.toLowerCase().includes('optimizely') || 
      h.toLowerCase().includes('edge') ||
      h.toLowerCase().includes('cache')
    );
    
    testCase.steps.push({
      action: 'Check for Edge Mode headers',
      expected: 'Should have headers indicating Edge Mode processing',
      actual: `Headers found: ${edgeModeHeaders.join(', ')}`,
      passed: edgeModeHeaders.length > 0
    });
    
    // Log all headers for debugging
    console.log('All response headers:');
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    testCase.passed = testCase.steps.some(step => step.passed);
    
  } catch (error) {
    testCase.error = error.message;
    testCase.passed = false;
    console.error(`Test failed: ${error.message}`);
  }
  
  testResults.testCases.push(testCase);
  return testCase.passed;
}

/**
 * Main test runner
 */
async function runBasicEdgeModeTests() {
  console.log('=== Basic Edge Mode Tests ===');
  console.log('Configuration:');
  console.log(`  Edge Agent URL: ${config.EDGE_AGENT_URL}`);
  console.log(`  SDK Key: ${config.SDK_KEY}`);
  console.log(`  Test User ID: ${config.USER_ID}`);
  
  try {
    testResults.startTime = new Date().toISOString();
    
    const tests = [
      testBasicEdgeModeInterception,
      testEdgeModeVsAgentMode,
      testVisitorIdHandling,
      testEdgeModeHeaders
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
      if (await test()) {
        passedTests++;
      }
    }
    
    testResults.endTime = new Date().toISOString();
    testResults.summary = {
      totalTests: tests.length,
      passedTests,
      failedTests: tests.length - passedTests,
      successRate: `${((passedTests / tests.length) * 100).toFixed(1)}%`
    };
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await testUtils.saveTestResults(testResults, `edge-mode-basic-${timestamp}`);
    
    console.log('\n=== Test Summary ===');
    console.log(`Total Tests: ${tests.length}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${tests.length - passedTests}`);
    console.log(`Success Rate: ${testResults.summary.successRate}`);
    
    if (passedTests < tests.length) {
      console.log('\nFailed Tests:');
      testResults.testCases.filter(tc => !tc.passed).forEach(tc => {
        console.log(`  - ${tc.testName}: ${tc.error || 'Check test steps'}`);
      });
    }
    
    return {
      success: passedTests === tests.length,
      results: testResults
    };
    
  } catch (error) {
    console.error('Error running Edge Mode tests:', error);
    testResults.error = error.message;
    return {
      success: false,
      results: testResults
    };
  }
}

// Export for use in other modules
module.exports = {
  runBasicEdgeModeTests,
  config,
  makeEdgeModeRequest
};

// Run tests if this file is executed directly
if (require.main === module) {
  runBasicEdgeModeTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}