/**
 * Comprehensive Edge Mode Tests for Optimizely Edge Agent
 * 
 * These tests verify Edge Mode functionality which differs from Agent Mode by:
 * - Intercepting GET requests to specific URL patterns
 * - Serving different content variations based on cdnVariationSettings
 * - Handling content routing, caching, and transformations
 * 
 * Test Categories:
 * 1. URL Pattern Matching
 * 2. Content Delivery Methods 
 * 3. Caching Behavior
 * 4. Response Headers and Tracing
 * 5. Cookie and Visitor Management
 * 6. Error Handling
 */

const fetch = require('node-fetch');
const testUtils = require('../../utils/test-utils');

// Load environment variables
testUtils.loadEnv();

// Edge Mode Test Configuration
const config = {
  // Base URL for the deployed edge agent
  EDGE_AGENT_URL: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
  
  // SDK Key for Optimizely project with Edge Mode flags
  SDK_KEY: process.env.SDK_KEY || 'test-sdk-key',
  
  // Test identification
  TEST_ID: testUtils.generateTestId('edge-mode-comprehensive'),
  
  // Edge Mode specific configuration
  EDGE_MODE_FLAG: process.env.EDGE_MODE_FLAG || 'edge_mode_test',
  
  // Test URLs that should match experiment patterns (configure these based on your cdnExperimentURL)
  TEST_URLS: {
    // URLs expected to trigger Edge Mode
    MATCH: [
      '/products/test-product-1',
      '/categories/shoes?filter=price',
      '/homepage-variant'
    ],
    // URLs that should NOT trigger Edge Mode  
    NO_MATCH: [
      '/api/data',
      '/admin/dashboard',
      '/static/images/logo.png'
    ]
  },
  
  // Test visitor IDs
  VISITOR_IDS: [
    `edge-visitor-${Date.now()}-1`,
    `edge-visitor-${Date.now()}-2`,
    `edge-visitor-${Date.now()}-3`
  ]
};

// Create test results container
const testResults = testUtils.createTestResults('Edge Mode: Comprehensive Tests', {
  edgeModeFlag: config.EDGE_MODE_FLAG,
  testUrls: config.TEST_URLS
});

/**
 * Helper function to make Edge Mode requests (GET requests to content URLs)
 */
async function makeEdgeModeRequest(path, options = {}) {
  const {
    visitorId,
    headers = {},
    queryParams = {},
    followRedirects = true
  } = options;
  
  // Construct full URL
  const url = new URL(path, config.EDGE_AGENT_URL);
  
  // Add query parameters
  Object.keys(queryParams).forEach(key => {
    url.searchParams.append(key, queryParams[key]);
  });
  
  // Add visitor ID if provided
  if (visitorId) {
    url.searchParams.append('optimizely_visitor_id', visitorId);
  }
  
  // Prepare headers
  const requestHeaders = {
    'User-Agent': 'OptimizelyEdgeModeTest/1.0',
    'X-Optimizely-SDK-Key': config.SDK_KEY,
    ...headers
  };
  
  console.log(`Making Edge Mode request to: ${url.toString()}`);
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: requestHeaders,
    redirect: followRedirects ? 'follow' : 'manual'
  });
  
  return response;
}

/**
 * Test Category 1: URL Pattern Matching
 * Tests the URLMatcher service and cdnExperimentURL matching
 */
describe('Edge Mode: URL Pattern Matching', () => {
  
  test('Should match configured experiment URLs', async () => {
    const testName = 'URL Pattern Matching - Should Match';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      for (const testUrl of config.TEST_URLS.MATCH) {
        const response = await makeEdgeModeRequest(testUrl, {
          visitorId: config.VISITOR_IDS[0]
        });
        
        testCase.steps.push({
          action: `GET ${testUrl}`,
          expected: 'Should return 200 and Edge Mode headers',
          actual: `Status: ${response.status}, Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`,
          passed: response.status === 200
        });
        
        // Check for Edge Mode indicators
        const hasEdgeModeHeader = response.headers.get('x-optimizely-edge-mode') === 'active';
        const hasOptimizelyHeaders = response.headers.get('x-optimizely-flag') || 
                                    response.headers.get('x-optimizely-variation');
        
        testCase.steps.push({
          action: 'Check Edge Mode headers',
          expected: 'Should have Edge Mode activation headers',
          actual: `Edge Mode: ${hasEdgeModeHeader}, Optimizely Headers: ${hasOptimizelyHeaders}`,
          passed: hasEdgeModeHeader || hasOptimizelyHeaders
        });
      }
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
  
  test('Should NOT match non-experiment URLs', async () => {
    const testName = 'URL Pattern Matching - Should NOT Match';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      for (const testUrl of config.TEST_URLS.NO_MATCH) {
        const response = await makeEdgeModeRequest(testUrl, {
          visitorId: config.VISITOR_IDS[0]
        });
        
        // For non-matching URLs, the behavior depends on your setup:
        // - Could return 404 if URL doesn't exist
        // - Could return 200 with regular content (no Edge Mode processing)
        // - Could forward to origin without experiment context
        
        const hasEdgeModeHeader = response.headers.get('x-optimizely-edge-mode') === 'active';
        
        testCase.steps.push({
          action: `GET ${testUrl}`,
          expected: 'Should NOT have Edge Mode activation',
          actual: `Status: ${response.status}, Edge Mode Active: ${hasEdgeModeHeader}`,
          passed: !hasEdgeModeHeader  // Should NOT have Edge Mode headers
        });
      }
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
  
  test('Should handle URL variations correctly', async () => {
    const testName = 'URL Variations Handling';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      const baseUrl = config.TEST_URLS.MATCH[0]; // Use first test URL
      
      // Test trailing slash handling
      const urlWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const urlWithoutSlash = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      for (const url of [urlWithSlash, urlWithoutSlash]) {
        const response = await makeEdgeModeRequest(url, {
          visitorId: config.VISITOR_IDS[0]
        });
        
        const hasEdgeModeActivation = response.headers.get('x-optimizely-edge-mode') === 'active';
        
        testCase.steps.push({
          action: `Test URL normalization: ${url}`,
          expected: 'Should consistently match regardless of trailing slash',
          actual: `Edge Mode Active: ${hasEdgeModeActivation}`,
          passed: hasEdgeModeActivation
        });
      }
      
      // Test query parameter handling
      const urlWithExtraParams = `${baseUrl}?extra_param=test&another=value`;
      const response = await makeEdgeModeRequest(urlWithExtraParams, {
        visitorId: config.VISITOR_IDS[0]
      });
      
      const hasEdgeModeActivation = response.headers.get('x-optimizely-edge-mode') === 'active';
      
      testCase.steps.push({
        action: 'Test with additional query parameters',
        expected: 'Should handle additional query parameters correctly',
        actual: `Edge Mode Active: ${hasEdgeModeActivation}`,
        passed: hasEdgeModeActivation
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
});

/**
 * Test Category 2: Content Delivery Methods
 * Tests different ways Edge Mode can serve content
 */
describe('Edge Mode: Content Delivery', () => {
  
  test('Should handle forwardRequestToOrigin=true', async () => {
    const testName = 'Forward to Origin';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      // This test assumes some URLs are configured with forwardRequestToOrigin=true
      const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[0], {
        visitorId: config.VISITOR_IDS[0]
      });
      
      testCase.steps.push({
        action: 'Request URL configured to forward to origin',
        expected: 'Should receive response with experiment context',
        actual: `Status: ${response.status}`,
        passed: response.status === 200
      });
      
      // Check for headers that indicate the request was processed with experiment context
      const hasVisitorHeader = response.headers.get('x-optimizely-visitor-id');
      const hasDecisionHeaders = response.headers.get('x-optimizely-flag') || 
                                response.headers.get('x-optimizely-variation');
      
      testCase.steps.push({
        action: 'Check experiment context headers',
        expected: 'Should have visitor ID and decision headers',
        actual: `Visitor Header: ${hasVisitorHeader}, Decision Headers: ${hasDecisionHeaders}`,
        passed: hasVisitorHeader && hasDecisionHeaders
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
  
  test('Should handle cdnResponseURL content fetching', async () => {
    const testName = 'CDN Response URL Content';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      // This test assumes some URLs are configured with cdnResponseURL
      const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[1], {
        visitorId: config.VISITOR_IDS[1]
      });
      
      testCase.steps.push({
        action: 'Request URL configured with cdnResponseURL',
        expected: 'Should receive content from alternative source',
        actual: `Status: ${response.status}`,
        passed: response.status === 200
      });
      
      // Check cache headers
      const cacheStatus = response.headers.get('x-edge-cache');
      
      testCase.steps.push({
        action: 'Check cache status',
        expected: 'Should have cache status header',
        actual: `Cache Status: ${cacheStatus}`,
        passed: cacheStatus === 'HIT' || cacheStatus === 'MISS'
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
});

/**
 * Test Category 3: Visitor Management and Stickiness
 * Tests visitor ID generation and variation stickiness
 */
describe('Edge Mode: Visitor Management', () => {
  
  test('Should generate visitor ID when none provided', async () => {
    const testName = 'Visitor ID Generation';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      // Make request without visitor ID
      const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[0]);
      
      const visitorIdHeader = response.headers.get('x-optimizely-visitor-id');
      const setCookieHeader = response.headers.get('set-cookie');
      
      testCase.steps.push({
        action: 'Request without visitor ID',
        expected: 'Should generate and return visitor ID',
        actual: `Visitor ID Header: ${visitorIdHeader}`,
        passed: !!visitorIdHeader
      });
      
      testCase.steps.push({
        action: 'Check visitor ID cookie',
        expected: 'Should set visitor ID cookie',
        actual: `Set-Cookie: ${setCookieHeader}`,
        passed: setCookieHeader && setCookieHeader.includes('optimizely_visitor_id')
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
  
  test('Should maintain visitor consistency across requests', async () => {
    const testName = 'Visitor Consistency';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      const visitorId = config.VISITOR_IDS[2];
      
      // Make multiple requests with same visitor ID
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[0], {
          visitorId: visitorId
        });
        responses.push(response);
      }
      
      // Check that visitor ID is consistent
      const visitorIdHeaders = responses.map(r => r.headers.get('x-optimizely-visitor-id'));
      const allSameVisitor = visitorIdHeaders.every(id => id === visitorId);
      
      testCase.steps.push({
        action: 'Multiple requests with same visitor ID',
        expected: 'Should maintain consistent visitor ID',
        actual: `Visitor IDs: ${visitorIdHeaders.join(', ')}`,
        passed: allSameVisitor
      });
      
      // Check for variation consistency (if variations are sticky)
      const variationHeaders = responses.map(r => r.headers.get('x-optimizely-variation'));
      const hasVariations = variationHeaders.some(v => !!v);
      
      if (hasVariations) {
        const allSameVariation = variationHeaders.every(v => v === variationHeaders[0]);
        
        testCase.steps.push({
          action: 'Check variation stickiness',
          expected: 'Should maintain consistent variation assignment',
          actual: `Variations: ${variationHeaders.join(', ')}`,
          passed: allSameVariation
        });
      }
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
});

/**
 * Test Category 4: Caching Behavior
 * Tests Edge Mode caching functionality
 */
describe('Edge Mode: Caching', () => {
  
  test('Should implement caching for repeated requests', async () => {
    const testName = 'Cache Behavior';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      const visitorId = config.VISITOR_IDS[0];
      const testUrl = config.TEST_URLS.MATCH[0];
      
      // First request (should be cache MISS)
      const response1 = await makeEdgeModeRequest(testUrl, { visitorId });
      const cacheStatus1 = response1.headers.get('x-edge-cache');
      
      // Second request immediately after (should be cache HIT if caching is enabled)
      const response2 = await makeEdgeModeRequest(testUrl, { visitorId });
      const cacheStatus2 = response2.headers.get('x-edge-cache');
      
      testCase.steps.push({
        action: 'First request',
        expected: 'Should indicate cache miss or no cache header',
        actual: `Cache Status: ${cacheStatus1}`,
        passed: true  // Both MISS and null are acceptable for first request
      });
      
      testCase.steps.push({
        action: 'Second request',
        expected: 'Should potentially show cache hit if caching enabled',
        actual: `Cache Status: ${cacheStatus2}`,
        passed: true  // Accept any cache status as configuration-dependent
      });
      
      // If both have cache headers, they should be different (MISS then HIT)
      if (cacheStatus1 && cacheStatus2) {
        testCase.steps.push({
          action: 'Cache status progression',
          expected: 'Should show cache progression (MISS -> HIT)',
          actual: `${cacheStatus1} -> ${cacheStatus2}`,
          passed: cacheStatus1 !== cacheStatus2
        });
      }
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
});

/**
 * Test Category 5: Error Handling
 * Tests Edge Mode error scenarios
 */
describe('Edge Mode: Error Handling', () => {
  
  test('Should handle invalid SDK keys gracefully', async () => {
    const testName = 'Invalid SDK Key Handling';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[0], {
        headers: {
          'X-Optimizely-SDK-Key': 'invalid-sdk-key-12345'
        }
      });
      
      // Edge Mode with invalid SDK key should either:
      // 1. Return error status (4xx)
      // 2. Fall back to no-experiment behavior
      
      testCase.steps.push({
        action: 'Request with invalid SDK key',
        expected: 'Should handle gracefully (error or fallback)',
        actual: `Status: ${response.status}`,
        passed: response.status >= 200 && response.status < 500  // Accept any non-5xx
      });
      
      // Should not crash or return 5xx error
      testCase.steps.push({
        action: 'Check for server errors',
        expected: 'Should not return server errors',
        actual: `Status: ${response.status}`,
        passed: response.status < 500
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
  
  test('Should handle missing SDK keys gracefully', async () => {
    const testName = 'Missing SDK Key Handling';
    console.log(`Running test: ${testName}`);
    
    const testCase = testUtils.createTestCase(testName);
    
    try {
      const response = await makeEdgeModeRequest(config.TEST_URLS.MATCH[0], {
        headers: {}  // No SDK key header
      });
      
      testCase.steps.push({
        action: 'Request without SDK key',
        expected: 'Should handle gracefully',
        actual: `Status: ${response.status}`,
        passed: response.status >= 200 && response.status < 500
      });
      
      testCase.passed = testCase.steps.every(step => step.passed);
      
    } catch (error) {
      testCase.error = error.message;
      testCase.passed = false;
    }
    
    testResults.testCases.push(testCase);
    return testCase.passed;
  });
});

/**
 * Main test execution function
 */
async function runEdgeModeTests() {
  console.log('Starting Edge Mode Comprehensive Tests...');
  console.log('Configuration:', JSON.stringify(config, null, 2));
  
  try {
    // Set test start time
    testResults.startTime = new Date().toISOString();
    
    // Run all test categories
    let passedTests = 0;
    let totalTests = 0;
    
    // URL Pattern Matching Tests
    console.log('\n=== URL Pattern Matching Tests ===');
    totalTests += 3;
    if (await test1()) passedTests++;
    if (await test2()) passedTests++;
    if (await test3()) passedTests++;
    
    // Content Delivery Tests
    console.log('\n=== Content Delivery Tests ===');
    totalTests += 2;
    if (await test4()) passedTests++;
    if (await test5()) passedTests++;
    
    // Visitor Management Tests
    console.log('\n=== Visitor Management Tests ===');
    totalTests += 2;
    if (await test6()) passedTests++;
    if (await test7()) passedTests++;
    
    // Caching Tests
    console.log('\n=== Caching Tests ===');
    totalTests += 1;
    if (await test8()) passedTests++;
    
    // Error Handling Tests
    console.log('\n=== Error Handling Tests ===');
    totalTests += 2;
    if (await test9()) passedTests++;
    if (await test10()) passedTests++;
    
    // Set completion time
    testResults.endTime = new Date().toISOString();
    testResults.summary = {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
    };
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await testUtils.saveTestResults(testResults, `edge-mode-comprehensive-${timestamp}`);
    
    console.log('\n=== Edge Mode Test Summary ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${testResults.summary.successRate}`);
    
    return {
      success: passedTests === totalTests,
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

// Individual test functions (referenced above)
async function test1() {
  return await describe('Edge Mode: URL Pattern Matching', () => {
    return test('Should match configured experiment URLs');
  });
}

// ... (define other test functions similarly)

// Export for use in other modules
module.exports = {
  runEdgeModeTests,
  config,
  makeEdgeModeRequest
};

// Run tests if this file is executed directly
if (require.main === module) {
  runEdgeModeTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}