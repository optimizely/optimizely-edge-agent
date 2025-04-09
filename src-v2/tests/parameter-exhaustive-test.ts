/**
 * Exhaustive Parameter Testing Script for Optimizely Edge Agent
 * 
 * This script implements the comprehensive test plan from exhaustive-test-plan.md
 * and tests all possible combinations of headers, query parameters, and JSON payload.
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const EDGE_AGENT_URL = process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev';
const SDK_KEY = process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = process.env.FLAG_KEY || 'test-flag';
const EVENT_KEY = process.env.EVENT_KEY || 'testing_event';

// Interfaces
interface TestCase {
  id: string;
  description: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  jsonBody?: any;
  expectedStatus: number;
  expectedAssertions?: ((responseBody: any) => boolean)[];
}

interface TestResult {
  testCase: TestCase;
  status: number;
  success: boolean;
  responseBody?: any;
  error?: string;
  duration: number;
}

// Parameter Generators
function generateHeadersOnly(params: Record<string, any>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Convert parameters to X-Optimizely-* headers
  Object.entries(params).forEach(([key, value]) => {
    let headerKey: string;
    
    // Special case for nested objects
    if (key === 'user') {
      headers['X-Optimizely-User-Id'] = value.id;
      if (value.attributes) {
        headers['X-Optimizely-Attributes'] = JSON.stringify(value.attributes);
      }
      return;
    }
    
    // Special case for eventTags
    if (key === 'eventTags') {
      headers['X-Optimizely-Event-Tags'] = JSON.stringify(value);
      return;
    }
    
    // Standard parameters
    switch (key) {
      case 'sdkKey':
        headerKey = 'X-Optimizely-SDK-Key';
        break;
      case 'flagKey':
        headerKey = 'X-Optimizely-Flag-Key';
        break;
      case 'userId':
        headerKey = 'X-Optimizely-User-Id';
        break;
      case 'eventKey':
        headerKey = 'X-Optimizely-Event-Key';
        break;
      default:
        // Convert camelCase to dash-case for header
        headerKey = 'X-Optimizely-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    }
    
    // Convert complex objects to JSON strings
    headers[headerKey] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
  
  return headers;
}

function generateQueryParams(params: Record<string, any>): Record<string, string> {
  const queryParams: Record<string, string> = {};
  
  // Handle special cases
  if (params.user) {
    queryParams['userId'] = params.user.id;
    
    // Handle user attributes
    if (params.user.attributes) {
      queryParams['attributes'] = JSON.stringify(params.user.attributes);
    }
  } else {
    // Standard parameters
    Object.entries(params).forEach(([key, value]) => {
      // Complex objects need JSON stringification
      queryParams[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }
  
  return queryParams;
}

// Test Executor
async function runTest(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Running test ${testCase.id}: ${testCase.description}`);
    
    // Build URL with query parameters
    const url = new URL(`${EDGE_AGENT_URL}${testCase.endpoint}`);
    if (testCase.queryParams) {
      Object.entries(testCase.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    
    console.log(`URL: ${url.toString()}`);
    
    // Build request options
    const requestOptions: any = {
      method: testCase.method,
      headers: {
        'Content-Type': 'application/json',
        ...(testCase.headers || {})
      }
    };
    
    // Add body if present and not GET
    if (testCase.jsonBody && testCase.method !== 'GET') {
      requestOptions.body = JSON.stringify(testCase.jsonBody);
      console.log(`Body: ${requestOptions.body}`);
    }
    
    console.log(`Headers:`, requestOptions.headers);
    
    // Make request
    const response = await fetch(url.toString(), requestOptions);
    const responseText = await response.text();
    
    // Parse response as JSON if possible
    let responseBody: any;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = { raw: responseText };
    }
    
    // Check if status matches expected
    const statusMatches = response.status === testCase.expectedStatus;
    
    // Run additional assertions if provided
    let assertionsPassed = true;
    if (testCase.expectedAssertions && responseBody) {
      assertionsPassed = testCase.expectedAssertions.every(assertion => {
        try {
          return assertion(responseBody);
        } catch (e) {
          console.error(`Assertion error:`, e);
          return false;
        }
      });
    }
    
    const success = statusMatches && assertionsPassed;
    const duration = Date.now() - startTime;
    
    console.log(`Result: ${success ? 'SUCCESS' : 'FAILURE'} (${response.status})`);
    
    return {
      testCase,
      status: response.status,
      success,
      responseBody,
      duration
    };
  } catch (error: any) {
    console.error(`Error in test ${testCase.id}:`, error);
    
    return {
      testCase,
      status: 0,
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

// Utility to format results in a table
function formatResultsTable(results: TestResult[]): string {
  let table = '| ID | Description | Status | Expected | Result | Duration |\n';
  table += '|-----|-------------|--------|----------|--------|----------|\n';
  
  for (const result of results) {
    table += `| ${result.testCase.id} | ${result.testCase.description} | ${result.status} | ${result.testCase.expectedStatus} | ${result.success ? '✅' : '❌'} | ${result.duration}ms |\n`;
  }
  
  return table;
}

// Utility to log a divider
function logDivider(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}`);
  console.log('='.repeat(80));
}

// Generate test matrices
function generateBasicTests(): TestCase[] {
  const userId = `test-user-${uuidv4()}`;
  
  return [
    {
      id: 'B-01',
      description: 'Headers only - All parameters in headers',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { id: userId }
      }),
      expectedStatus: 200
    },
    {
      id: 'B-02',
      description: 'Query params only - All parameters in query string',
      endpoint: '/decide',
      method: 'POST',
      queryParams: generateQueryParams({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        userId
      }),
      expectedStatus: 200
    },
    {
      id: 'B-03',
      description: 'Body only - All parameters in JSON body',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { id: userId }
      },
      expectedStatus: 200
    },
    {
      id: 'B-04',
      description: 'Headers only - Track endpoint',
      endpoint: '/track',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        user: { id: userId }
      }),
      expectedStatus: 200
    },
    {
      id: 'B-05',
      description: 'Query params only - Track endpoint',
      endpoint: '/track',
      method: 'POST',
      queryParams: generateQueryParams({
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        userId
      }),
      expectedStatus: 200
    },
    {
      id: 'B-06',
      description: 'Body only - Track endpoint',
      endpoint: '/track',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        user: { id: userId }
      },
      expectedStatus: 200
    },
    {
      id: 'B-07',
      description: 'Pixel tracking - Query params only',
      endpoint: '/track.gif',
      method: 'GET',
      queryParams: generateQueryParams({
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        userId
      }),
      expectedStatus: 200
    }
  ];
}

function generatePrecedenceTests(): TestCase[] {
  const userId = `test-prec-${uuidv4()}`;
  
  return [
    {
      id: 'P-01',
      description: 'Headers take precedence over query params',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { id: userId }
      }),
      queryParams: generateQueryParams({
        sdkKey: 'invalid-key',
        flagKey: 'invalid-flag',
        userId: 'invalid-user'
      }),
      expectedStatus: 200,
      expectedAssertions: [
        (body) => body.flagKey === FLAG_KEY
      ]
    },
    {
      id: 'P-02',
      description: 'Headers take precedence over JSON body',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { id: userId }
      }),
      jsonBody: {
        sdkKey: 'invalid-key',
        flagKey: 'invalid-flag',
        user: { id: 'invalid-user' }
      },
      expectedStatus: 200,
      expectedAssertions: [
        (body) => body.flagKey === FLAG_KEY
      ]
    },
    {
      id: 'P-03',
      description: 'Query params take precedence over JSON body',
      endpoint: '/decide',
      method: 'POST',
      queryParams: generateQueryParams({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        userId
      }),
      jsonBody: {
        sdkKey: 'invalid-key',
        flagKey: 'invalid-flag',
        user: { id: 'invalid-user' }
      },
      expectedStatus: 200,
      expectedAssertions: [
        (body) => body.flagKey === FLAG_KEY
      ]
    }
  ];
}

function generateMixedSourceTests(): TestCase[] {
  const userId = `test-mixed-${uuidv4()}`;
  
  return [
    {
      id: 'M-01',
      description: 'Headers (sdkKey) + Query params (flagKey, userId)',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY
      }),
      queryParams: generateQueryParams({
        flagKey: FLAG_KEY,
        userId
      }),
      expectedStatus: 200
    },
    {
      id: 'M-02',
      description: 'Headers (sdkKey) + Body (flagKey, user)',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY
      }),
      jsonBody: {
        flagKey: FLAG_KEY,
        user: { id: userId }
      },
      expectedStatus: 200
    },
    {
      id: 'M-03',
      description: 'Headers (attribute1) + Query (attribute2) + Body (more attributes)',
      endpoint: '/decide',
      method: 'POST',
      headers: generateHeadersOnly({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { 
          id: userId,
          attributes: { source: 'header', device: 'mobile' }
        }
      }),
      queryParams: generateQueryParams({
        attributes: JSON.stringify({ source: 'query', country: 'US' })
      }),
      jsonBody: {
        user: {
          attributes: { source: 'body', premium: true }
        }
      },
      expectedStatus: 200
    }
  ];
}

function generateErrorTests(): TestCase[] {
  return [
    {
      id: 'E-01',
      description: 'Missing SDK key',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        flagKey: FLAG_KEY,
        user: { id: `test-error-${uuidv4()}` }
      },
      expectedStatus: 400
    },
    {
      id: 'E-02',
      description: 'Invalid SDK key',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        sdkKey: 'invalid-key',
        flagKey: FLAG_KEY,
        user: { id: `test-error-${uuidv4()}` }
      },
      expectedStatus: 404
    },
    {
      id: 'E-03',
      description: 'Missing flag key',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        user: { id: `test-error-${uuidv4()}` }
      },
      expectedStatus: 400
    }
  ];
}

function generateSpecialTests(): TestCase[] {
  const userId = `test-special-${uuidv4()}`;
  
  return [
    {
      id: 'S-01',
      description: 'Include reasons option',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: { id: userId },
        options: ['INCLUDE_REASONS']
      },
      expectedStatus: 200,
      expectedAssertions: [
        (body) => Array.isArray(body.reasons)
      ]
    },
    {
      id: 'S-02',
      description: 'Complex user attributes',
      endpoint: '/decide',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: {
          id: userId,
          attributes: {
            device: { type: 'mobile', os: 'iOS', version: '15.0' },
            location: { country: 'US', city: 'San Francisco' },
            premium: true,
            subscriptionLevel: 'pro',
            lastLogin: Date.now()
          }
        }
      },
      expectedStatus: 200
    },
    {
      id: 'S-03',
      description: 'Complex event tags',
      endpoint: '/track',
      method: 'POST',
      jsonBody: {
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        user: { id: userId },
        eventTags: {
          revenue: 99.99,
          currency: 'USD',
          items: [
            { id: 'SKU123', name: 'Product 1', price: 49.99, quantity: 1 },
            { id: 'SKU456', name: 'Product 2', price: 24.99, quantity: 2 }
          ],
          transactionId: `txn-${uuidv4()}`,
          coupon: 'SUMMER20'
        }
      },
      expectedStatus: 200
    }
  ];
}

/**
 * Run all tests and report results
 */
async function runAllTests() {
  console.log('Starting exhaustive parameter tests...');
  
  const testMatrices = [
    { name: 'Basic Tests', tests: generateBasicTests() },
    { name: 'Precedence Tests', tests: generatePrecedenceTests() },
    { name: 'Mixed Source Tests', tests: generateMixedSourceTests() },
    { name: 'Error Tests', tests: generateErrorTests() },
    { name: 'Special Tests', tests: generateSpecialTests() }
  ];
  
  const allResults: TestResult[] = [];
  
  // Run each test matrix
  for (const matrix of testMatrices) {
    logDivider(`RUNNING ${matrix.name.toUpperCase()}`);
    
    for (const testCase of matrix.tests) {
      const result = await runTest(testCase);
      allResults.push(result);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Report results
  logDivider('TEST RESULTS SUMMARY');
  
  const successCount = allResults.filter(r => r.success).length;
  const failureCount = allResults.length - successCount;
  
  console.log(`Total Tests: ${allResults.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log('\nResults Table:');
  console.log(formatResultsTable(allResults));
  
  // For more detailed results
  logDivider('DETAILED FAILURES');
  allResults.forEach(result => {
    if (!result.success) {
      console.log(`\nTest ${result.testCase.id} (${result.testCase.description}):`);
      console.log(`Status: ${result.status} (Expected: ${result.testCase.expectedStatus})`);
      console.log('Response:', result.responseBody);
      if (result.error) console.log('Error:', result.error);
    }
  });
  
  // Save results to file
  /*
  try {
    const fs = require('fs');
    const path = require('path');
    const resultsDir = path.join(__dirname, 'results');
    
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const resultsPath = path.join(resultsDir, `parameter-test-results-${timestamp}.json`);
    
    fs.writeFileSync(resultsPath, JSON.stringify({
      date: new Date().toISOString(),
      environment: EDGE_AGENT_URL,
      summary: {
        total: allResults.length,
        success: successCount,
        failure: failureCount
      },
      results: allResults
    }, null, 2));
    
    console.log(`\nDetailed results saved to ${resultsPath}`);
  } catch (error) {
    console.error('Error saving results to file:', error);
  }
  */
}

// Run all tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 