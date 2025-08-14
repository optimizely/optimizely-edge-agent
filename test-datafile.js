// Test datafile endpoint locally
const { handleVercelEdgeRequest } = require('./dist/vercel/composition/vercelComposition');

async function testDatafile() {
  try {
    console.log('🧪 Testing Datafile API locally...');
    
    // Test datafile endpoint
    const testUrl = 'https://localhost:3000/datafile?sdkKey=8mR1pGh8u2ztUP8GqjmQq';
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

    console.log('📨 Making GET request to:', testUrl);
    
    // Call the function
    const response = await handleVercelEdgeRequest(request, env, {});
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    const preview = text.length > 300 ? text.substring(0, 300) + '...' : text;
    console.log('✅ Response preview:', preview);
    
    // Try to parse as JSON to verify it's valid
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const parsed = JSON.parse(text);
        console.log('✅ Valid JSON response with keys:', Object.keys(parsed));
      } catch (e) {
        console.log('❌ Invalid JSON response');
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testDatafile();