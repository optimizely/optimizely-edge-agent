// Local test of the Edge Agent function
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition');

async function testEdgeAgent() {
  try {
    console.log('🧪 Testing Edge Agent locally...');
    
    // Create a test request
    const testUrl = 'https://localhost:3000/decide?sdkKey=8mR1pGh8u2ztUP8GqjmQq&userId=test-user-123';
    const request = new Request(testUrl, {
      method: 'GET',
      headers: {
        'host': 'localhost:3000',
        'user-agent': 'test-client'
      }
    });

    // Test environment
    const env = {
      OPTIMIZELY_SDK_KEY: '8mR1pGh8u2ztUP8GqjmQq',
      OPTIMIZELY_ADMIN_TOKEN: 'dev-admin-token'
    };

    console.log('📨 Making request to:', testUrl);
    
    // Call the function
    const response = await handleVercelEdgeRequest(request, env, {});
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('✅ Response body:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('❌ Stack:', error.stack);
  }
}

testEdgeAgent();