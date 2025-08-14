/**
 * Debug script for the decide-all endpoint
 */
const fetch = require('node-fetch');

// Configuration - matches the main test script
const CONFIG = {
  edgeAgentUrl: 'https://edge-agent-test.expedge.workers.dev',
  sdkKey: '8mR1pGh8u2ztUP8GqjmQq',
  featureKeys: ['test-flag', 'homepage-test', 'product-test'],
  experimentKeys: ['ab-test-1', 'feature-test-1']
};

// Test user
const testUser = {
  userId: 'debug-user-' + Math.floor(Math.random() * 1000000),
  attributes: {
    browser: 'Chrome',
    location: 'US'
  }
};

async function testDecideAll() {
  console.log('Testing decide-all endpoint...');
  console.log('Looking for feature keys:', CONFIG.featureKeys);
  
  const body = {
    userId: testUser.userId,
    attributes: testUser.attributes
  };
  
  try {
    const response = await fetch(`${CONFIG.edgeAgentUrl}/api/decide-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: JSON.stringify(body)
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
      console.log('Response body:', JSON.stringify(responseJson, null, 2));
      
      if (responseJson.decisions) {
        // Log all keys in the response
        const keys = responseJson.decisions.map(d => d.key);
        console.log('Keys in response:', keys);
        
        // Check if all required keys are present
        const missingKeys = CONFIG.featureKeys.filter(key => !keys.includes(key));
        console.log('Missing keys:', missingKeys.length > 0 ? missingKeys : 'None');
        
        // The test is checking specifically for:
        const hasAllFeatures = CONFIG.featureKeys.every(key => 
          responseJson.decisions &&
          responseJson.decisions.some(d => d.key === key)
        );
        console.log('Test would pass:', hasAllFeatures ? 'YES' : 'NO');
      } else {
        console.log('No decisions array in the response!');
      }
    } catch (e) {
      console.log('Failed to parse response as JSON:');
      console.log(responseText);
    }
  } catch (error) {
    console.error('Error making request:', error);
  }
}

testDecideAll().then(() => console.log('Debug complete.')); 