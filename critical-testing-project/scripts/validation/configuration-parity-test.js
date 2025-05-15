/**
 * Configuration Parameter Parity Test Script
 * 
 * This script systematically tests configuration parameter handling across:
 * - HTTP Headers
 * - Query Parameters
 * - JSON Body
 * 
 * It verifies:
 * - Proper parameter parsing
 * - Correct precedence (headers > query params > body)
 * - Support for legacy headers (x-optly-*)
 * - Complex object handling
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const baseUrl = 'http://localhost:8787';
const sdkKey = '8mR1pGh8u2ztUP8GqjmQq';
const testVisitorId = 'config_parity_test_user';

// Utility functions
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(__dirname, '..', '..', 'results', `config-parity-test-${timestamp()}.json`);

// Test parameters
const testParameters = [
  // Core parameters
  { 
    name: 'sdkKey', 
    headerValue: '8mR1pGh8u2ztUP8GqjmQq',
    queryValue: '8mR1pGh8u2ztUP8GqjmQq',
    bodyValue: '8mR1pGh8u2ztUP8GqjmQq',
    headerName: 'X-Optimizely-SDK-Key',
    legacyHeaderName: 'x-optly-sdk-key',
    queryName: 'sdkKey',
    bodyName: 'sdkKey',
    type: 'string',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'visitorId', 
    headerValue: 'header_visitor',
    queryValue: 'query_visitor',
    bodyValue: 'body_visitor',
    headerName: 'X-Optimizely-Visitor-Id',
    legacyHeaderName: 'x-optly-visitor-id',
    queryName: 'visitorId',
    bodyName: 'visitorId',
    type: 'string',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'flagKey', 
    headerValue: 'header_flag',
    queryValue: 'query_flag',
    bodyValue: 'body_flag',
    headerName: 'X-Optimizely-Flag-Key',
    legacyHeaderName: 'x-optly-flag-key',
    queryName: 'flagKey',
    bodyName: 'flagKey',
    type: 'string',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  
  // Boolean parameters
  { 
    name: 'overrideCache', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Override-Cache',
    legacyHeaderName: 'x-optly-override-cache',
    queryName: 'overrideCache',
    bodyName: 'overrideCache',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'overrideVisitorId', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Override-Visitor-Id',
    legacyHeaderName: 'x-optly-override-visitor-id',
    queryName: 'overrideVisitorId',
    bodyName: 'overrideVisitorId',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'setResponseHeaders', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Set-Response-Headers',
    legacyHeaderName: 'x-optly-set-response-headers',
    queryName: 'setResponseHeaders',
    bodyName: 'setResponseHeaders',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'setResponseCookies', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Set-Response-Cookies',
    legacyHeaderName: 'x-optly-set-response-cookies',
    queryName: 'setResponseCookies',
    bodyName: 'setResponseCookies',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'setRequestHeaders', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Set-Request-Headers',
    legacyHeaderName: 'x-optly-set-request-headers',
    queryName: 'setRequestHeaders',
    bodyName: 'setRequestHeaders',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'setRequestCookies', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Set-Request-Cookies',
    legacyHeaderName: 'x-optly-set-request-cookies',
    queryName: 'setRequestCookies',
    bodyName: 'setRequestCookies',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'enableFlagsFromKV', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Flags-KV',
    legacyHeaderName: 'x-optly-flags-kv',
    queryName: 'enableFlagsFromKV',
    bodyName: 'enableFlagsFromKV',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: false,
    supportsBody: true,
  },
  { 
    name: 'datafileFromKV', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Datafile-KV',
    legacyHeaderName: 'x-optly-datafile-kv',
    queryName: 'datafileFromKV',
    bodyName: 'datafileFromKV',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: false,
    supportsBody: true,
  },
  { 
    name: 'enableResponseMetadata', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Enable-Response-Metadata',
    legacyHeaderName: 'x-optly-enable-response-metadata',
    queryName: 'enableResponseMetadata',
    bodyName: 'enableResponseMetadata',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'trimmedDecisions', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Trimmed-Decisions',
    legacyHeaderName: 'x-optly-trimmed-decisions',
    queryName: 'trimmedDecisions',
    bodyName: 'trimmedDecisions',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'excludeVariables', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Exclude-Variables',
    legacyHeaderName: 'x-optly-exclude-variables',
    queryName: 'excludeVariables',
    bodyName: 'excludeVariables',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  
  // Complex object parameters
  { 
    name: 'attributes', 
    headerValue: JSON.stringify({ country: 'US', device: 'mobile' }),
    queryValue: null, // Not typically supported in query params
    bodyValue: { country: 'US', device: 'mobile' },
    headerName: 'X-Optimizely-Attributes',
    legacyHeaderName: 'x-optly-attributes',
    queryName: 'attributes',
    bodyName: 'attributes',
    type: 'object',
    supportsHeader: true,
    supportsQuery: false,
    supportsBody: true,
  },
  { 
    name: 'eventTags', 
    headerValue: JSON.stringify({ value: 10.5, source: 'test' }),
    queryValue: null, // Not typically supported in query params
    bodyValue: { value: 10.5, source: 'test' },
    headerName: 'X-Optimizely-Event-Tags',
    legacyHeaderName: 'x-optly-event-tags',
    queryName: 'eventTags',
    bodyName: 'eventTags',
    type: 'object',
    supportsHeader: true,
    supportsQuery: false,
    supportsBody: true,
  },
  
  // API-specific parameters
  { 
    name: 'eventKey', 
    headerValue: 'header_event',
    queryValue: 'query_event',
    bodyValue: 'body_event',
    headerName: 'X-Optimizely-Event-Key',
    legacyHeaderName: 'x-optly-event-key',
    queryName: 'eventKey',
    bodyName: 'eventKey',
    type: 'string',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'decideOptions', 
    headerValue: JSON.stringify(['INCLUDE_REASONS', 'EXCLUDE_VARIABLES']),
    queryValue: 'INCLUDE_REASONS,EXCLUDE_VARIABLES',
    bodyValue: ['INCLUDE_REASONS', 'EXCLUDE_VARIABLES'],
    headerName: 'X-Optimizely-Decide-Options',
    legacyHeaderName: 'x-optly-decide-options',
    queryName: 'decideOptions',
    bodyName: 'decideOptions',
    type: 'array',
    supportsHeader: true,
    supportsQuery: false,
    supportsBody: true,
  },
  { 
    name: 'flagKeys', 
    headerValue: null, // Not typically supported in headers
    queryValue: ['flag1', 'flag2', 'flag3'], // special handling needed
    bodyValue: ['flag1', 'flag2', 'flag3'],
    headerName: null,
    legacyHeaderName: null,
    queryName: 'flagKeys',
    bodyName: 'flagKeys',
    type: 'array',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
    specialQuery: true, // needs special handling for multi-valued params
  },
  
  // Decide-specific options as direct boolean params
  { 
    name: 'decideAll', 
    headerValue: null, // Not typically supported in headers
    queryValue: 'true',
    bodyValue: true,
    headerName: null,
    legacyHeaderName: null,
    queryName: 'decideAll',
    bodyName: 'decideAll',
    type: 'boolean',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'disableDecisionEvent', 
    headerValue: null, // Not typically supported in headers
    queryValue: 'true',
    bodyValue: true,
    headerName: null,
    legacyHeaderName: null,
    queryName: 'disableDecisionEvent',
    bodyName: 'disableDecisionEvent',
    type: 'boolean',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'enabledFlagsOnly', 
    headerValue: null, // Not typically supported in headers
    queryValue: 'true',
    bodyValue: true,
    headerName: null,
    legacyHeaderName: null,
    queryName: 'enabledFlagsOnly',
    bodyName: 'enabledFlagsOnly',
    type: 'boolean',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'includeReasons', 
    headerValue: null, // Not typically supported in headers
    queryValue: 'true',
    bodyValue: true,
    headerName: null,
    legacyHeaderName: null,
    queryName: 'includeReasons',
    bodyName: 'includeReasons',
    type: 'boolean',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
  },
  { 
    name: 'ignoreUserProfileService', 
    headerValue: null, // Not typically supported in headers
    queryValue: 'true',
    bodyValue: true,
    headerName: null,
    legacyHeaderName: null,
    queryName: 'ignoreUserProfileService',
    bodyName: 'ignoreUserProfileService',
    type: 'boolean',
    supportsHeader: false,
    supportsQuery: true,
    supportsBody: true,
  },
  // Added enableFex parameter for testing
  { 
    name: 'enableFex', 
    headerValue: 'true',
    queryValue: 'true',
    bodyValue: true,
    headerName: 'X-Optimizely-Enable-Fex',  // Standard header
    legacyHeaderName: 'x-optly-enable-fex', // Legacy header
    queryName: 'enableFex',
    bodyName: 'enableFex',
    type: 'boolean',
    supportsHeader: true,
    supportsQuery: true,
    supportsBody: true,
    endpoint: '/api/decide'  // Updated endpoint path with /api prefix
  }
];

// Test results
const testResults = {
  standardHeader: {},
  legacyHeader: {},
  queryParam: {},
  jsonBody: {},
  precedence: {},
  timestamp: new Date().toISOString()
};

/**
 * Run a test with the parameter in the header
 */
async function testStandardHeader(param) {
  if (!param.supportsHeader) {
    console.log(`Skipping header test for ${param.name} - not supported in headers`);
    return { skipped: true, reason: 'Not supported in headers' };
  }
  
  try {
    const headers = {
      'X-Optimizely-Visitor-Id': testVisitorId,
      'X-Optimizely-Enable-Response-Metadata': 'true',  // Enable response metadata
      'X-Optimizely-Enable-Debug-Headers': 'true',      // Enable debug headers
      'X-Optimizely-Enable-FEX': 'true'                 // Enable Feature Experimentation (required)
    };
    
    // Add the test parameter
    headers[param.headerName] = param.headerValue;
    
    // Add SDK key if we're not testing that parameter
    if (param.name !== 'sdkKey') {
      headers['X-Optimizely-SDK-Key'] = sdkKey;
    }
    
    // Use the specified endpoint if available, otherwise default to /api/decide
    const endpoint = param.endpoint || '/api/decide';
    const response = await axios.post(`${baseUrl}${endpoint}`, { flagKey: 'test-flag' }, { headers });
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      parameterDetected: response.data?.metadata ? true : false,
      configMetadata: response.data?.metadata || null,
      success: true
    };
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
  }
}

/**
 * Run a test with the parameter in the legacy header (x-optly-*)
 */
async function testLegacyHeader(param) {
  if (!param.supportsHeader || !param.legacyHeaderName) {
    console.log(`Skipping legacy header test for ${param.name} - not supported`);
    return { skipped: true, reason: 'Not supported in legacy headers' };
  }
  
  try {
    const headers = {
      'x-optly-visitor-id': testVisitorId,
      'x-optly-enable-response-metadata': 'true',  // Enable response metadata
      'x-optly-enable-debug-headers': 'true',      // Enable debug headers
      'x-optly-enable-fex': 'true'                 // Enable Feature Experimentation (required)
    };
    
    // Add the test parameter
    headers[param.legacyHeaderName] = param.headerValue;
    
    // Add SDK key if we're not testing that parameter
    if (param.name !== 'sdkKey') {
      headers['x-optly-sdk-key'] = sdkKey;
    }
    
    // Use the specified endpoint if available, otherwise default to /api/decide
    const endpoint = param.endpoint || '/api/decide';
    const response = await axios.post(`${baseUrl}${endpoint}`, { flagKey: 'test-flag' }, { headers });
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      parameterDetected: response.data?.metadata ? true : false,
      configMetadata: response.data?.metadata || null,
      success: true
    };
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
  }
}

/**
 * Run a test with the parameter in the query parameter
 */
async function testQueryParam(param) {
  if (!param.supportsQuery) {
    console.log(`Skipping query param test for ${param.name} - not supported in query params`);
    return { skipped: true, reason: 'Not supported in query params' };
  }
  
  try {
    let url = `${baseUrl}/api/decide?visitorId=${testVisitorId}&enableResponseMetadata=true&enableDebugHeaders=true&enableFex=true`;
    
    // Add the test parameter
    if (param.specialQuery && param.name === 'flagKeys') {
      // Special handling for multi-valued parameters
      param.queryValue.forEach(value => {
        url += `&${param.queryName}=${encodeURIComponent(value)}`;
      });
    } else {
      url += `&${param.queryName}=${encodeURIComponent(param.queryValue)}`;
    }
    
    // Add SDK key if we're not testing that parameter
    if (param.name !== 'sdkKey') {
      url += `&sdkKey=${sdkKey}`;
    }
    
    const response = await axios.post(url, {});
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      parameterDetected: response.data?.metadata ? true : false,
      configMetadata: response.data?.metadata || null,
      success: true
    };
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
  }
}

/**
 * Run a test with the parameter in the JSON body
 */
async function testJsonBody(param) {
  if (!param.supportsBody) {
    console.log(`Skipping JSON body test for ${param.name} - not supported in body`);
    return { skipped: true, reason: 'Not supported in body' };
  }
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-Response-Metadata': 'true',  // Enable response metadata
      'X-Optimizely-Enable-Debug-Headers': 'true',      // Enable debug headers
      'X-Optimizely-Enable-FEX': 'true'                 // Enable Feature Experimentation (required)
    };
    
    const body = {
      visitorId: testVisitorId,
      flagKey: 'test-flag',
      enableResponseMetadata: true,
      enableDebugHeaders: true
    };
    
    // Add the test parameter
    body[param.bodyName] = param.bodyValue;
    
    // Add SDK key if we're not testing that parameter
    if (param.name !== 'sdkKey') {
      body.sdkKey = sdkKey;
    }
    
    const response = await axios.post(`${baseUrl}/api/decide`, body, { headers });
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      parameterDetected: response.data?.metadata ? true : false,
      configMetadata: response.data?.metadata || null,
      success: true
    };
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
  }
}

/**
 * Run a precedence test with conflicting values
 */
async function testPrecedence(param) {
  if (!param.supportsHeader || !param.supportsQuery || !param.supportsBody) {
    console.log(`Skipping precedence test for ${param.name} - not supported in all channels`);
    return { skipped: true, reason: 'Not supported in all channels' };
  }
  
  try {
    // Only test one parameter at a time to avoid interactions
    // Set all other options to consistent values

    // Create a request that supplies the same parameter via all three methods:
    // 1. Header - value: "header_value"
    // 2. Query parameter - value: "query_value"
    // 3. Body - value: "body_value"
    
    // Basic headers every request needs
    const headers = {
      'X-Optimizely-SDK-Key': sdkKey,  // Always set SDK key
      'X-Optimizely-Visitor-Id': testVisitorId,
      'X-Optimizely-Enable-Response-Metadata': 'true',  // Enable response metadata
      'X-Optimizely-Enable-Debug-Headers': 'true',      // Enable debug headers
      'X-Optimizely-Enable-FEX': 'true'                 // Enable Feature Experimentation (required)
    };
    
    // Add the SINGLE test parameter in header with "header_value"
    if (param.headerName) {
      if (param.type === 'object' || param.type === 'array') {
        headers[param.headerName] = param.headerValue;
      } else if (param.type === 'boolean') {
        headers[param.headerName] = 'true';  // Use 'true' for header boolean
      } else {
        // For sdkKey specifically, make it very distinct to help with debugging
        if (param.name === 'sdkKey') {
          headers[param.headerName] = 'HEADER_SDK_KEY_TEST';
          console.log(`Setting header ${param.headerName} to HEADER_SDK_KEY_TEST`);
        } else {
          headers[param.headerName] = 'header_value';
        }
      }
    }
    
    // Build query with the SINGLE test parameter with "query_value"
    let url = `${baseUrl}/api/decide?enableResponseMetadata=true&enableDebugHeaders=true&enableFex=true`;
    if (param.queryName) {
      if (param.specialQuery && param.name === 'flagKeys') {
        url += '&flagKeys=query_flag1&flagKeys=query_flag2';
      } else if (param.type === 'boolean') {
        url += `&${param.queryName}=false`;  // Use 'false' for query boolean
      } else {
        url += `&${param.queryName}=query_value`;
      }
    }
    
    // Build body with the SINGLE test parameter with "body_value"
    const body = {
      flagKey: 'test-flag',  // Always need a flag key for the decision
      enableResponseMetadata: true,
      enableDebugHeaders: true,
      enableFex: true
    };
    
    if (param.bodyName) {
      if (param.type === 'object') {
        body[param.bodyName] = { source: 'body_value' };
      } else if (param.type === 'array') {
        body[param.bodyName] = ['body_value1', 'body_value2'];
      } else if (param.type === 'boolean') {
        body[param.bodyName] = false;  // Use false for body boolean
      } else {
        body[param.bodyName] = 'body_value';
      }
    }
    
    console.log(`Testing ${param.name} precedence with:
       * Header: ${param.headerName} = ${headers[param.headerName] || 'not set'}
       * Query: ${param.queryName} = ${param.type === 'boolean' ? 'false' : 'query_value'}
       * Body: ${param.bodyName} = ${JSON.stringify(body[param.bodyName] || 'not set')}
    `);
    
    const response = await axios.post(url, body, { headers });
    
    // Debug output for all parameters
    console.log(`DEBUG - Full Response for ${param.name} precedence test:`, JSON.stringify(response.data, null, 2));
    console.log(`DEBUG - HEADERS SENT: `, headers);
    console.log(`DEBUG - URL SENT: `, url);
    console.log(`DEBUG - BODY SENT: `, JSON.stringify(body, null, 2));
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      parameterDetected: response.data?.metadata ? true : false,
      configMetadata: response.data?.metadata || null,
      expectedSource: 'headers', // Headers should take precedence
      detectedSource: null,
      success: true
    };
    
    // Try to determine which value was used based on the response
    if (result.configMetadata) {
      // Different parameters have their source stored in different metadata fields
      // Handle special cases for parameters with specific metadata field names
      let sourceField;
      
      switch(param.name) {
        case 'sdkKey':
          sourceField = 'sdkKeyFrom';
          break;
        case 'visitorId':
        case 'userId':
          sourceField = 'visitorIdFrom';
          break;
        case 'attributes':
          sourceField = 'attributesFrom';
          break;
        case 'eventTags':
          sourceField = 'eventTagsFrom';
          break;
        case 'flagKeys':
        case 'flagKey':
          sourceField = 'flagKeysFrom';
          break;
        case 'overrideCache':
          sourceField = 'overrideCacheFrom';
          break;
        case 'overrideVisitorId':
          sourceField = 'overrideVisitorIdFrom';
          break;
        case 'setResponseHeaders':
          sourceField = 'setResponseHeadersFrom';
          break;
        case 'setResponseCookies':
          sourceField = 'setResponseCookiesFrom';
          break;
        case 'setRequestHeaders':
          sourceField = 'setRequestHeadersFrom';
          break;
        case 'setRequestCookies':
          sourceField = 'setRequestCookiesFrom';
          break;
        case 'trimmedDecisions':
          sourceField = 'trimmedDecisionsFrom';
          break;
        case 'decideAll':
          sourceField = 'decideAllFrom';
          break;
        case 'forcedDecisions':
          sourceField = 'forcedDecisionsFrom';
          break;
        default:
          // For other parameters, use dynamic field name
          sourceField = `${param.name}From`;
      }
      
      if (result.configMetadata[sourceField]) {
        result.detectedSource = result.configMetadata[sourceField];
      }
      
      // Log what we're looking for and what we found
      console.log(`Looking for source in metadata.${sourceField}: ${result.configMetadata[sourceField] || 'not found'}`);
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
  }
}

/**
 * Run all tests for a parameter
 */
async function testParameter(param) {
  console.log(`Testing parameter: ${param.name}`);
  
  // Run standard header test
  console.log(` - Testing standard header: ${param.headerName}`);
  testResults.standardHeader[param.name] = await testStandardHeader(param);
  
  // Run legacy header test
  console.log(` - Testing legacy header: ${param.legacyHeaderName}`);
  testResults.legacyHeader[param.name] = await testLegacyHeader(param);
  
  // Run query parameter test
  console.log(` - Testing query parameter: ${param.queryName}`);
  testResults.queryParam[param.name] = await testQueryParam(param);
  
  // Run JSON body test
  console.log(` - Testing JSON body: ${param.bodyName}`);
  testResults.jsonBody[param.name] = await testJsonBody(param);
  
  // Run precedence test
  console.log(` - Testing precedence`);
  testResults.precedence[param.name] = await testPrecedence(param);
  
  console.log(`Completed testing parameter: ${param.name}\n`);
}

/**
 * Main function to run all tests
 */
async function runTests() {
  console.log('Starting Configuration Parameter Parity Tests');
  console.log(`Endpoint: ${baseUrl}`);
  console.log(`SDK Key: ${sdkKey}`);
  console.log(`Test Visitor ID: ${testVisitorId}`);
  console.log('--------------------------------------------------');
  
  // For debugging, just test a single parameter precedence
  console.log("RUNNING SIMPLIFIED TEST FOR DEBUGGING");
  const sdkKeyParam = testParameters[0];
  testResults.precedence[sdkKeyParam.name] = await testPrecedence(sdkKeyParam);
  
  // Write results to file
  fs.writeFileSync(logFile, JSON.stringify(testResults, null, 2));
  console.log(`Test results written to: ${logFile}`);
  
  // Generate summary
  const summary = generateSummary();
  console.log('\nTest Summary:');
  console.log(summary);
  
  // Write summary to file
  const summaryFile = logFile.replace('.json', '.md');
  fs.writeFileSync(summaryFile, summary);
  console.log(`Test summary written to: ${summaryFile}`);
}

/**
 * Generate a summary of the test results
 */
function generateSummary() {
  let summary = '# Configuration Parameter Parity Test Results\n\n';
  summary += `Tests run at: ${testResults.timestamp}\n\n`;
  
  // Add parameter support matrix
  summary += '## Parameter Support Matrix\n\n';
  summary += '| Parameter | Standard Header | Legacy Header | Query Param | JSON Body | Precedence |\n';
  summary += '|-----------|-----------------|---------------|-------------|-----------|------------|\n';
  
  for (const param of testParameters) {
    const standardHeader = testResults.standardHeader[param.name]?.success ? '✅' : 
                          testResults.standardHeader[param.name]?.skipped ? '➖' : '❌';
    const legacyHeader = testResults.legacyHeader[param.name]?.success ? '✅' : 
                         testResults.legacyHeader[param.name]?.skipped ? '➖' : '❌';
    const queryParam = testResults.queryParam[param.name]?.success ? '✅' : 
                       testResults.queryParam[param.name]?.skipped ? '➖' : '❌';
    const jsonBody = testResults.jsonBody[param.name]?.success ? '✅' : 
                    testResults.jsonBody[param.name]?.skipped ? '➖' : '❌';
                    
    const precedence = testResults.precedence[param.name]?.skipped ? '➖' :
                      testResults.precedence[param.name]?.detectedSource === 'headers' ? '✅' : '❌';
    
    summary += `| ${param.name} | ${standardHeader} | ${legacyHeader} | ${queryParam} | ${jsonBody} | ${precedence} |\n`;
  }
  
  // Add issues section
  summary += '\n## Issues Found\n\n';
  
  let issuesFound = false;
  
  // Check for precedence issues
  for (const [paramName, result] of Object.entries(testResults.precedence)) {
    if (result.success && !result.skipped && 
        result.detectedSource !== 'header' && 
        result.detectedSource !== 'headers') {
      issuesFound = true;
      summary += `- **Precedence Issue**: Parameter \`${paramName}\` used source \`${result.detectedSource}\` instead of \`header\`\n`;
    }
  }
  
  // Check for individual parameter issues
  for (const param of testParameters) {
    // Check standard header
    if (param.supportsHeader && !testResults.standardHeader[param.name]?.skipped && 
        !testResults.standardHeader[param.name]?.success) {
      issuesFound = true;
      summary += `- **Standard Header Issue**: Parameter \`${param.name}\` failed in standard header test\n`;
    }
    
    // Check legacy header
    if (param.supportsHeader && !testResults.legacyHeader[param.name]?.skipped && 
        !testResults.legacyHeader[param.name]?.success) {
      issuesFound = true;
      summary += `- **Legacy Header Issue**: Parameter \`${param.name}\` failed in legacy header test\n`;
    }
    
    // Check query param
    if (param.supportsQuery && !testResults.queryParam[param.name]?.skipped && 
        !testResults.queryParam[param.name]?.success) {
      issuesFound = true;
      summary += `- **Query Parameter Issue**: Parameter \`${param.name}\` failed in query parameter test\n`;
    }
    
    // Check JSON body
    if (param.supportsBody && !testResults.jsonBody[param.name]?.skipped && 
        !testResults.jsonBody[param.name]?.success) {
      issuesFound = true;
      summary += `- **JSON Body Issue**: Parameter \`${param.name}\` failed in JSON body test\n`;
    }
  }
  
  if (!issuesFound) {
    summary += "No issues found. All parameters are properly supported across their expected input methods.\n";
  }
  
  // Add recommendations
  summary += '\n## Recommendations\n\n';
  
  if (!issuesFound) {
    summary += "All parameters are working correctly. No changes needed.\n";
  } else {
    summary += "The following changes are recommended:\n\n";
    
    // Check for precedence issues
    let precedenceIssues = false;
    for (const [paramName, result] of Object.entries(testResults.precedence)) {
      if (result.success && !result.skipped && 
          result.detectedSource !== 'header' && 
          result.detectedSource !== 'headers') {
        precedenceIssues = true;
        break;
      }
    }
    
    if (precedenceIssues) {
      summary += "1. **Fix Precedence Logic**: Update `initialize` method in ConfigurationService to ensure headers always take precedence over query parameters and JSON body.\n";
    }
    
    // Check for header mapping issues
    let headerMappingIssues = false;
    for (const param of testParameters) {
      if (param.supportsHeader && !testResults.standardHeader[param.name]?.skipped && 
          !testResults.standardHeader[param.name]?.success) {
        headerMappingIssues = true;
        break;
      }
    }
    
    if (headerMappingIssues) {
      summary += "2. **Update Header Mappings**: Ensure all standard headers are properly mapped in the `initializeFromHeaders` method.\n";
    }
    
    // Check for legacy header issues
    let legacyHeaderIssues = false;
    for (const param of testParameters) {
      if (param.supportsHeader && !testResults.legacyHeader[param.name]?.skipped && 
          !testResults.legacyHeader[param.name]?.success) {
        legacyHeaderIssues = true;
        break;
      }
    }
    
    if (legacyHeaderIssues) {
      summary += "3. **Fix Legacy Header Support**: Ensure legacy `x-optly-*` headers are properly mapped and processed.\n";
    }
    
    // Check for query parameter issues
    let queryIssues = false;
    for (const param of testParameters) {
      if (param.supportsQuery && !testResults.queryParam[param.name]?.skipped && 
          !testResults.queryParam[param.name]?.success) {
        queryIssues = true;
        break;
      }
    }
    
    if (queryIssues) {
      summary += "4. **Enhance Query Parameter Support**: Update `initializeFromQueryParams` method to handle all supported query parameters.\n";
    }
    
    // Check for JSON body issues
    let bodyIssues = false;
    for (const param of testParameters) {
      if (param.supportsBody && !testResults.jsonBody[param.name]?.skipped && 
          !testResults.jsonBody[param.name]?.success) {
        bodyIssues = true;
        break;
      }
    }
    
    if (bodyIssues) {
      summary += "5. **Improve JSON Body Processing**: Enhance `initializeFromBody` method to properly handle all supported body parameters.\n";
    }
  }
  
  return summary;
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});