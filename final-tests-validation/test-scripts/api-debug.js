/**
 * API Debug Script
 * 
 * This script makes direct calls to the Edge Agent API endpoints and logs the raw responses
 * to help debug what's happening with the decide-all endpoint
 */

const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  edgeAgentUrl: 'https://edge-agent-test.expedge.workers.dev',
  sdkKey: '8mR1pGh8u2ztUP8GqjmQq'
};

// Test user
const testUser = {
  userId: 'test-user-debug-' + Math.floor(Math.random() * 1000000),
  attributes: {
    browser: 'Chrome',
    location: 'US'
  }
};

// Endpoints to test
const endpoints = [
  '/api/decide',
  '/api/decide-all',
  '/api/decide-for-keys'
];

/**
 * Make a request to an API endpoint
 */
async function makeRequest(endpoint, body) {
  const url = `${CONFIG.edgeAgentUrl}${endpoint}`;
  
  console.log(`Making request to ${endpoint}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    let responseJson;
    
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      console.log('Response is not valid JSON:');
      console.log(responseText);
      return;
    }
    
    console.log(`Response from ${endpoint} (${response.status}):`, JSON.stringify(responseJson, null, 2));
    console.log('');
    
    return responseJson;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
  }
}

/**
 * Run the debug script
 */
async function run() {
  console.log('==== API Debug Script ====');
  console.log(`Edge Agent URL: ${CONFIG.edgeAgentUrl}`);
  console.log(`SDK Key: ${CONFIG.sdkKey}`);
  console.log(`Test User: ${testUser.userId}`);
  console.log('');
  
  // Test decide endpoint
  await makeRequest('/api/decide', {
    userId: testUser.userId,
    key: 'test-flag',
    attributes: testUser.attributes
  });
  
  // Test decide-all endpoint
  await makeRequest('/api/decide-all', {
    userId: testUser.userId,
    attributes: testUser.attributes
  });
  
  // Test decide-for-keys endpoint
  await makeRequest('/api/decide-for-keys', {
    userId: testUser.userId,
    flagKeys: ['test-flag', 'homepage-test'],
    attributes: testUser.attributes
  });
}

// Run the script
run()
  .then(() => console.log('Debug complete.'))
  .catch(error => console.error('Error running debug script:', error)); 