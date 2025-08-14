// Test Agent Mode locally
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition');

async function testAgentMode() {
  try {
    console.log('🧪 Testing Agent Mode locally...');
    
    // Create a POST request for Agent Mode
    const requestBody = JSON.stringify({
      userId: 'test-user-123',
      userAttributes: {
        device: 'mobile',
        browser: 'chrome'
      }
    });
    
    const testUrl = 'https://localhost:3000/decide';
    const request = new Request(testUrl, {
      method: 'POST',
      headers: {
        'host': 'localhost:3000',
        'user-agent': 'test-client',
        'content-type': 'application/json'
      },
      body: requestBody
    });

    // Test environment
    const env = {
      OPTIMIZELY_SDK_KEY: '8mR1pGh8u2ztUP8GqjmQq',
      OPTIMIZELY_ADMIN_TOKEN: 'dev-admin-token'
    };

    console.log('📨 Making POST request to:', testUrl);
    console.log('📦 Request body:', requestBody);
    
    // Call the function
    const response = await handleVercelEdgeRequest(request, env, {});
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('✅ Response body:', text);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('❌ Stack:', error.stack);
  }
}

testAgentMode();