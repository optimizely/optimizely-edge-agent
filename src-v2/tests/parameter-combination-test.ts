/**
 * Optimizely Edge Agent Parameter Combination Test
 * 
 * This script tests all possible combinations of headers, query parameters,
 * and JSON payloads for the /decide and /track endpoints.
 */

// Run this script with:
// npx ts-node src-v2/tests/parameter-combination-test.ts

// Dependencies
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const EDGE_AGENT_URL = process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev';
const SDK_KEY = process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = process.env.FLAG_KEY || 'test-flag';
const EVENT_KEY = process.env.EVENT_KEY || 'testing_event';

// Test matrix setup
interface TestResult {
  testId: string;
  description: string;
  statusCode: number;
  response: any;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];

// Utility to format results in a table
function formatResultsTable(results: TestResult[]): string {
  let table = '| Test ID | Description | Status | Success |\n';
  table += '|---------|-------------|--------|--------|\n';
  
  for (const result of results) {
    table += `| ${result.testId} | ${result.description} | ${result.statusCode} | ${result.success ? '✅' : '❌'} |\n`;
  }
  
  return table;
}

// Utility to log a divider
function logDivider(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}`);
  console.log('='.repeat(80));
}

/**
 * Run a test with the given configuration
 */
async function runTest(
  testId: string,
  description: string,
  endpoint: string,
  method: string,
  headers: Record<string, string> = {},
  queryParams: Record<string, string> = {},
  body: any = null
): Promise<TestResult> {
  try {
    // Build URL with query parameters
    const url = new URL(`${EDGE_AGENT_URL}${endpoint}`);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Build request options
    const requestOptions: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    // Add body if present and not GET
    if (body !== null && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    // Make request
    console.log(`Running test ${testId}: ${description}`);
    console.log(`URL: ${url.toString()}`);
    console.log(`Headers:`, headers);
    if (body) console.log(`Body:`, body);

    const response = await fetch(url.toString(), requestOptions);
    const responseText = await response.text();
    let responseJson: any;
    
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      responseJson = { raw: responseText };
    }

    const success = response.status >= 200 && response.status < 300;
    
    const result: TestResult = {
      testId,
      description,
      statusCode: response.status,
      response: responseJson,
      success
    };

    console.log(`Result: ${success ? 'SUCCESS' : 'FAILURE'} (${response.status})`);
    return result;
  } catch (error: any) {
    console.error(`Error in test ${testId}:`, error);
    return {
      testId,
      description,
      statusCode: 0,
      response: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Test the /decide endpoint with different parameter combinations
 */
async function testDecideParameterCombinations() {
  logDivider('TESTING /decide ENDPOINT PARAMETER COMBINATIONS');
  
  const userId = `test-params-${uuidv4()}`;
  
  // Test 1: Header-only parameters
  results.push(await runTest(
    'D-H-01',
    'Headers only - All parameters in headers',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Flag-Key': FLAG_KEY,
      'X-Optimizely-Visitor-Id': userId
    },
    {},
    {}
  ));
  
  // Test 2: Query-only parameters
  results.push(await runTest(
    'D-Q-01',
    'Query params only - All parameters in query string',
    '/decide',
    'POST',
    {},
    {
      'sdkKey': SDK_KEY,
      'flagKey': FLAG_KEY,
      'userId': userId
    },
    {}
  ));
  
  // Test 3: Body-only parameters
  results.push(await runTest(
    'D-B-01',
    'Body only - All parameters in JSON body',
    '/decide',
    'POST',
    {},
    {},
    {
      sdkKey: SDK_KEY,
      flagKey: FLAG_KEY,
      user: {
        id: userId
      }
    }
  ));
  
  // Test 4: Headers take precedence over query params
  results.push(await runTest(
    'D-M-01',
    'Headers take precedence over query params',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Flag-Key': FLAG_KEY,
      'X-Optimizely-Visitor-Id': userId
    },
    {
      'sdkKey': 'invalid-key',
      'flagKey': 'invalid-flag',
      'userId': 'invalid-user'
    },
    {}
  ));
  
  // Test 5: Headers take precedence over body
  results.push(await runTest(
    'D-M-02',
    'Headers take precedence over body',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Flag-Key': FLAG_KEY,
      'X-Optimizely-Visitor-Id': userId
    },
    {},
    {
      sdkKey: 'invalid-key',
      flagKey: 'invalid-flag',
      user: {
        id: 'invalid-user'
      }
    }
  ));
  
  // Test 6: Query params take precedence over body
  results.push(await runTest(
    'D-M-03',
    'Query params take precedence over body',
    '/decide',
    'POST',
    {},
    {
      'sdkKey': SDK_KEY,
      'flagKey': FLAG_KEY,
      'userId': userId
    },
    {
      sdkKey: 'invalid-key',
      flagKey: 'invalid-flag',
      user: {
        id: 'invalid-user'
      }
    }
  ));
  
  // Test 7: Mix of headers and query params
  results.push(await runTest(
    'D-M-04',
    'Mix of headers and query params',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Flag-Key': FLAG_KEY
    },
    {
      'userId': userId
    },
    {}
  ));
  
  // Test 8: Mix of headers and body
  results.push(await runTest(
    'D-M-05',
    'Mix of headers and body',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY
    },
    {},
    {
      flagKey: FLAG_KEY,
      user: {
        id: userId
      }
    }
  ));
  
  // Test 9: Mix of query params and body
  results.push(await runTest(
    'D-M-06',
    'Mix of query params and body',
    '/decide',
    'POST',
    {},
    {
      'sdkKey': SDK_KEY,
      'flagKey': FLAG_KEY
    },
    {
      user: {
        id: userId
      }
    }
  ));
  
  // Test 10: Attributes combined from different sources
  const userWithAttributes = `test-attrs-${uuidv4()}`;
  results.push(await runTest(
    'D-M-07',
    'Attributes combined from different sources',
    '/decide',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Flag-Key': FLAG_KEY,
      'X-Optimizely-Visitor-Id': userWithAttributes,
      'X-Optimizely-Attributes': JSON.stringify({ source: 'header', device: 'mobile' })
    },
    {
      'attributes': JSON.stringify({ source: 'query', country: 'US' })
    },
    {
      user: {
        attributes: { source: 'body', premium: true }
      }
    }
  ));
}

/**
 * Test the /track endpoint with different parameter combinations
 */
async function testTrackParameterCombinations() {
  logDivider('TESTING /track ENDPOINT PARAMETER COMBINATIONS');
  
  const userId = `test-track-${uuidv4()}`;
  
  // Test 1: Header-only parameters for tracking
  results.push(await runTest(
    'T-H-01',
    'Headers only - All parameters in headers',
    '/track',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Event-Key': EVENT_KEY,
      'X-Optimizely-Visitor-Id': userId
    },
    {},
    {}
  ));
  
  // Test 2: Query-only parameters for tracking
  results.push(await runTest(
    'T-Q-01',
    'Query params only - All parameters in query string',
    '/track',
    'POST',
    {},
    {
      'sdkKey': SDK_KEY,
      'eventKey': EVENT_KEY,
      'userId': userId
    },
    {}
  ));
  
  // Test 3: Body-only parameters for tracking
  results.push(await runTest(
    'T-B-01',
    'Body only - All parameters in JSON body',
    '/track',
    'POST',
    {},
    {},
    {
      sdkKey: SDK_KEY,
      eventKey: EVENT_KEY,
      user: {
        id: userId
      }
    }
  ));
  
  // Test 4: Mix of sources with event tags
  results.push(await runTest(
    'T-M-01',
    'Mix of sources with event tags',
    '/track',
    'POST',
    {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Event-Key': EVENT_KEY,
      'X-Optimizely-Visitor-Id': userId
    },
    {
      'value': '99.99'
    },
    {
      eventTags: {
        currency: 'USD',
        items: [{ id: 'SKU123', name: 'Test Product' }]
      }
    }
  ));
  
  // Test 5: Pixel tracking via track.gif
  results.push(await runTest(
    'T-P-01',
    'Pixel tracking via track.gif endpoint',
    '/track.gif',
    'GET',
    {},
    {
      'sdkKey': SDK_KEY,
      'eventKey': EVENT_KEY,
      'userId': userId,
      'value': '199.99'
    },
    null
  ));
}

/**
 * Run all tests and report results
 */
async function runAllTests() {
  console.log('Starting parameter combination tests...');
  
  await testDecideParameterCombinations();
  await testTrackParameterCombinations();
  
  // Report results
  logDivider('TEST RESULTS SUMMARY');
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log('\nResults Table:');
  console.log(formatResultsTable(results));
  
  // For more detailed results
  logDivider('DETAILED RESULTS');
  results.forEach(result => {
    if (!result.success) {
      console.log(`\nTest ${result.testId} (${result.description}):`);
      console.log(`Status: ${result.statusCode}`);
      console.log('Response:', result.response);
      if (result.error) console.log('Error:', result.error);
    }
  });
}

// Run all tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 