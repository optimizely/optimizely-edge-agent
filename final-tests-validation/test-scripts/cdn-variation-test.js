/**
 * CDN Variation Settings Test
 * 
 * This script tests CDN Variation Settings functionality, specifically:
 * - URL pattern matching
 * - Origin request forwarding
 * - Caching behavior
 * - Content transformation
 * 
 * Usage:
 *   node cdn-variation-test.js
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
  
  // Test settings
  testUser: {
    userId: 'test-user-' + Math.floor(Math.random() * 1000000),
    attributes: {
      browser: 'Chrome',
      location: 'US'
    }
  },
  
  // CDN test paths
  testPaths: [
    '/edge-test/forward',     // Should match a rule with forwardRequestToOrigin: true
    '/edge-test/no-forward',  // Should match a rule with forwardRequestToOrigin: false
    '/edge-test/transform',   // Should match a rule with content transformation
    '/edge-test/control',     // Should match a control treatment
    '/edge-test/treatment',   // Should match a variation treatment
    '/non-matching-path'      // Should not match any rules
  ],
  
  // Cache test settings
  cacheTests: {
    requestCount: 3,          // Number of sequential requests to test caching
    delayBetweenRequests: 500 // ms between requests
  }
};

// Validation timestamps for unique filenames
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const testId = `cdn-variation-test-${timestamp}`;

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
    testUser: CONFIG.testUser
  },
  results: []
};

/**
 * Save test results to files
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
  
  let markdown = `# CDN Variation Settings Test Results\n\n`;
  markdown += `Test Date: ${new Date(timestamp).toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Edge Agent URL: \`${CONFIG.edgeAgentUrl}\`\n`;
  markdown += `- SDK Key: \`${CONFIG.sdkKey}\`\n`;
  markdown += `- Test User ID: \`${CONFIG.testUser.userId}\`\n`;
  markdown += `- Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)\n\n`;
  
  markdown += `## Test Results\n\n`;
  
  testResults.results.forEach(result => {
    markdown += `### ${result.test} - ${result.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;
    markdown += `${result.description}\n\n`;
    
    if (result.path) {
      markdown += `**Path:** \`${result.path}\`\n\n`;
    }
    
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
function recordResult(test, description, result, details = null, error = null, path = null) {
  testResults.results.push({
    test,
    description,
    result: result ? 'PASS' : 'FAIL',
    path,
    details,
    error: error ? String(error) : null
  });
  
  if (result) {
    logger.info(`✅ PASS: ${test}${path ? ' - ' + path : ''}`);
  } else {
    logger.error(`❌ FAIL: ${test}${path ? ' - ' + path : ''}`, error);
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make a request to the Edge Agent with a specific path
 */
async function makeRequest(path, cached = false) {
  const url = `${CONFIG.edgeAgentUrl}${path}`;
  
  try {
    logger.debug(`Making request to ${url}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Optimizely-SDK-Key': CONFIG.sdkKey,
        'X-Optimizely-User-Id': CONFIG.testUser.userId,
        'Cache-Control': cached ? 'max-age=0' : 'no-cache'
      }
    });
    
    const headers = Object.fromEntries(response.headers.entries());
    const contentType = headers['content-type'] || '';
    let body;
    
    // Process the body based on content type to avoid "body used already" errors
    try {
      // For JSON responses
      if (contentType.includes('application/json')) {
        body = await response.json();
      } 
      // For all other types, get as text
      else {
        body = await response.text();
        
        // Try to parse as JSON even if content-type isn't set correctly
        if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
          try {
            body = JSON.parse(body);
          } catch (parseError) {
            // If parsing fails, keep as text
            logger.debug(`Failed to parse response as JSON, keeping as text`);
          }
        }
      }
    } catch (e) {
      logger.warn(`Error processing response body: ${e.message}`);
      // Fallback to empty string if body processing fails
      body = '(Error reading response body)';
    }
    
    return {
      url,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      ok: response.ok
    };
  } catch (error) {
    logger.error(`Request failed for ${url}`, error);
    return {
      url,
      error: String(error),
      ok: false
    };
  }
}

/**
 * Test URL pattern matching with a specific path
 */
async function testUrlPatternMatching(path) {
  try {
    logger.info(`Testing URL pattern matching for ${path}...`);
    
    const response = await makeRequest(path);
    
    // Check if this appears to be an origin response or Edge Agent response
    const isOriginForwarded = typeof response.body === 'object' && 
                              (response.body.url || response.body.args || response.body.headers);
    
    const isVariationApplied = response.headers['x-optimizely-variation'] !== undefined;
    const isEdgeResponse = response.headers['x-optimizely-edge-agent'] !== undefined;
    
    recordResult(
      'URL Pattern Matching',
      `Verify URL pattern matching for path: ${path}`,
      response.ok,
      {
        response,
        isOriginForwarded,
        isVariationApplied,
        isEdgeResponse
      },
      null,
      path
    );
    
    return response;
  } catch (error) {
    recordResult(
      'URL Pattern Matching',
      `Verify URL pattern matching for path: ${path}`,
      false,
      null,
      error,
      path
    );
    return null;
  }
}

/**
 * Test origin request forwarding
 */
async function testOriginForwarding(path) {
  try {
    logger.info(`Testing origin request forwarding for ${path}...`);
    
    const response = await makeRequest(path);
    
    // Check if this appears to be an origin response
    const isOriginForwarded = typeof response.body === 'object' && 
                              (response.body.url || response.body.args || response.body.headers);
    
    recordResult(
      'Origin Request Forwarding',
      `Verify origin request forwarding for path: ${path}`,
      response.ok,
      {
        response,
        isOriginForwarded,
        originIndicators: isOriginForwarded ? [
          // Extract some evidence that this is an origin response
          response.body.url || null,
          response.body.headers ? Object.keys(response.body.headers).join(', ') : null
        ] : null
      },
      null,
      path
    );
    
    return response;
  } catch (error) {
    recordResult(
      'Origin Request Forwarding',
      `Verify origin request forwarding for path: ${path}`,
      false,
      null,
      error,
      path
    );
    return null;
  }
}

/**
 * Test caching behavior with multiple requests
 */
async function testCacheBehavior(path) {
  try {
    logger.info(`Testing cache behavior for ${path}...`);
    
    const responses = [];
    
    // Make several requests to the same path
    for (let i = 0; i < CONFIG.cacheTests.requestCount; i++) {
      // Add a small delay between requests
      if (i > 0) {
        await sleep(CONFIG.cacheTests.delayBetweenRequests);
      }
      
      logger.debug(`Making request ${i+1}/${CONFIG.cacheTests.requestCount} to ${path}...`);
      const response = await makeRequest(path, true);
      responses.push(response);
    }
    
    // Check for cache hits in responses after the first one
    const cacheStatuses = responses.map(r => r.headers['cf-cache-status'] || 'N/A');
    const hasCacheHit = cacheStatuses.slice(1).some(status => status === 'HIT');
    
    recordResult(
      'Cache Behavior',
      `Verify cache behavior for path: ${path}`,
      responses.every(r => r.ok), // Test passes if all requests succeeded
      {
        responses: responses.map((r, i) => ({
          requestNumber: i + 1,
          status: r.status,
          cacheStatus: r.headers['cf-cache-status'] || 'N/A',
          headers: r.headers
        })),
        cacheStatuses,
        hasCacheHit
      },
      null,
      path
    );
    
    return responses;
  } catch (error) {
    recordResult(
      'Cache Behavior',
      `Verify cache behavior for path: ${path}`,
      false,
      null,
      error,
      path
    );
    return null;
  }
}

/**
 * Test content transformation
 */
async function testContentTransformation(path) {
  try {
    logger.info(`Testing content transformation for ${path}...`);
    
    const response = await makeRequest(path);
    
    // Look for evidence of content transformation
    const isHtml = typeof response.body === 'string' && 
                  (response.body.includes('<!DOCTYPE html>') || 
                   response.body.includes('<html') ||
                   response.body.includes('<body'));
                   
    const hasTransformationIndicator = typeof response.body === 'string' && 
                                      (response.body.includes('Test Content') ||
                                       response.body.includes('data-optimizely'));
    
    recordResult(
      'Content Transformation',
      `Verify content transformation for path: ${path}`,
      response.ok,
      {
        response: {
          ...response,
          // Truncate body if it's a string
          body: typeof response.body === 'string' 
            ? (response.body.length > 500 ? response.body.substring(0, 500) + '...' : response.body)
            : response.body
        },
        isHtml,
        hasTransformationIndicator,
        contentType: response.headers['content-type']
      },
      null,
      path
    );
    
    return response;
  } catch (error) {
    recordResult(
      'Content Transformation',
      `Verify content transformation for path: ${path}`,
      false,
      null,
      error,
      path
    );
    return null;
  }
}

/**
 * Test for a specific path with all test types
 */
async function runTestsForPath(path) {
  logger.info(`Running all tests for path: ${path}`);
  
  // First test URL pattern matching
  const urlTestResponse = await testUrlPatternMatching(path);
  
  if (!urlTestResponse || !urlTestResponse.ok) {
    logger.warn(`Skipping further tests for ${path} due to URL matching failure`);
    return;
  }
  
  // Run the other tests
  await testOriginForwarding(path);
  await testCacheBehavior(path);
  await testContentTransformation(path);
}

/**
 * Main test runner
 */
async function runTests() {
  logger.info(`Starting CDN variation settings test`, {
    edgeAgentUrl: CONFIG.edgeAgentUrl,
    sdkKey: CONFIG.sdkKey,
    testUser: CONFIG.testUser
  });
  
  // Run tests for each path
  for (const path of CONFIG.testPaths) {
    await runTestsForPath(path);
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