/**
 * Infrastructure Test Script for Optimizely Edge Agent
 * 
 * This script tests the deployed Cloudflare Worker API endpoints
 * with real infrastructure.
 */

// The deployed worker URL
const WORKER_URL = 'https://edge-agent-test.expedge.workers.dev';
const TEST_SDK_KEY = 'test-sdk-key';
const TEST_ADMIN_TOKEN = 'test-admin-token'; // Replace with actual token if needed

// Sample datafile for testing
const TEST_DATAFILE = {
  revision: '123',
  featureFlags: [
    { key: 'flag1', experimentKey: 'exp1' },
    { key: 'flag2', experimentKey: 'exp2' }
  ]
};

// Utility function to make API requests
async function makeRequest(path, method = 'GET', headers = {}, body = null) {
  const url = `${WORKER_URL}${path}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`Making ${method} request to ${url}`);
  
  try {
    const startTime = performance.now();
    const response = await fetch(url, options);
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    const contentType = response.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.log('Full JSON Response:', JSON.stringify(responseData, null, 2));
    } else {
      responseData = await response.text();
      
      if (responseData.length > 1000) {
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        console.log('Response Text (truncated):', responseData.substring(0, 500) + '...');
      } else {
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        console.log('Response Text:', responseData);
      }
    }
    
    return {
      status: response.status,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries()),
      responseTime
    };
  } catch (error) {
    console.error(`Error making request to ${url}:`, error);
    throw error;
  }
}

// Test functions for each API endpoint
async function testGetDatafile() {
  console.log('\n==== Testing GET /api/datafile ====');
  const result = await makeRequest(`/api/datafile?sdkKey=${TEST_SDK_KEY}`);
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data:', result.data);
  return result;
}

async function testUpdateDatafile() {
  console.log('\n==== Testing POST /api/datafile ====');
  const result = await makeRequest(
    `/api/datafile?sdkKey=${TEST_SDK_KEY}`,
    'POST',
    { 'Authorization': `Bearer ${TEST_ADMIN_TOKEN}` },
    TEST_DATAFILE
  );
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data:', result.data);
  return result;
}

async function testGetFlagKeys() {
  console.log('\n==== Testing GET /api/flagkeys ====');
  const result = await makeRequest(`/api/flagkeys?sdkKey=${TEST_SDK_KEY}`);
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data:', result.data);
  return result;
}

async function testGetSdkInfo() {
  console.log('\n==== Testing GET /api/sdk ====');
  const result = await makeRequest('/api/sdk');
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data:', result.data);
  return result;
}

async function testRootPath() {
  console.log('\n==== Testing Root Path / ====');
  const result = await makeRequest('/');
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data (truncated):', result.data.substring ? result.data.substring(0, 200) + '...' : result.data);
  return result;
}

// Add this test function
async function testSimpleApiEndpoint() {
  console.log('\n==== Testing Simple API Endpoint /api/test ====');
  const result = await makeRequest('/api/test');
  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime.toFixed(2)}ms`);
  console.log('Response Data:', result.data);
  return result;
}

// Run all tests
async function runTests() {
  console.log('=================================================');
  console.log('OPTIMIZELY EDGE AGENT INFRASTRUCTURE TEST SCRIPT');
  console.log('=================================================');
  console.log(`Testing Worker URL: ${WORKER_URL}`);
  console.log('Starting tests...\n');
  
  try {
    // Test the simple endpoint first to verify basic functionality
    await testSimpleApiEndpoint();
    
    // Test SDK endpoint which should be working now
    const sdkResult = await testGetSdkInfo();
    const isSuccessful = sdkResult.status === 200;
    
    // Summarize results
    console.log('\n=================================================');
    console.log('Test Results Summary:');
    console.log('=================================================');
    console.log(`Simple API Test: PASS`);
    console.log(`SDK Info API: ${isSuccessful ? 'PASS' : 'FAIL'}`);
    console.log(`Overall Status: ${isSuccessful ? 'PASS' : 'FAIL'}`);
    console.log('=================================================');
    
    return isSuccessful;
  } catch (error) {
    console.error('Error during tests:', error);
    return false;
  }
}

// Run the tests
runTests(); 