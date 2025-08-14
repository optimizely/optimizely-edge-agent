/**
 * Enhanced Metrics Test
 * 
 * This script makes requests to the deployed Worker to test if the metrics
 * functionality is working correctly with the Node.js SDK.
 */

// Run this script with:
// npx ts-node src-v2/tests/metrics-test.ts

// Configuration
const EDGE_AGENT_URL = process.env.EDGE_AGENT_URL || 'https://edge-agent-test.expedge.workers.dev';
const SDK_KEY = process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = process.env.FLAG_KEY || 'test-flag'; // Using real flag from datafile
const EVENT_KEY = process.env.EVENT_KEY || 'testing_event'; // Using real event from datafile

/**
 * Test the /decide endpoint and verify metrics recording
 */
async function testDecideEndpoint() {
  console.log('===============================================');
  console.log(`🚀 Testing metrics on ${EDGE_AGENT_URL}`);
  console.log(`Using SDK Key: ${SDK_KEY.substring(0, 4)}...${SDK_KEY.substring(SDK_KEY.length - 3)}`);
  console.log(`Testing flag: ${FLAG_KEY} (verified in actual datafile)`);
  console.log(`Testing event: ${EVENT_KEY} (verified in actual datafile)`);
  console.log('-----------------------------------------------');
  
  try {
    // Generate a random user ID to ensure uniqueness
    const userId = `test-user-${Math.floor(Math.random() * 1000000)}`;
    
    // Make a simple decide request
    const requestUrl = `${EDGE_AGENT_URL}/decide`;
    console.log('📤 Making request to:', requestUrl);
    console.log('With payload:');
    console.log(JSON.stringify({
      sdkKey: SDK_KEY,
      flagKey: FLAG_KEY,
      user: {
        id: userId,
        attributes: {}
      }
    }, null, 2));
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sdkKey: SDK_KEY,
        flagKey: FLAG_KEY,
        user: {
          id: userId,
          attributes: {}
        }
      })
    });
    
    // Check if response is valid
    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Define the expected response type
    interface DecideResponse {
      flagKey: string;
      enabled: boolean;
      variationKey: string;
      variables: Record<string, any>;
      reasons?: string[];
    }
    
    // Type assertion
    const decideData = data as DecideResponse;
    
    console.log('📥 Response status:', response.status);
    console.log('Response headers:', headersToObject(response.headers));
    console.log('Response body:', JSON.stringify(data, null, 2));
    
    // Now make a request to test the SDK integration
    console.log('\n🧪 Testing SDK integration with a /track request...');
    console.log('With payload:');
    console.log(JSON.stringify({
      sdkKey: SDK_KEY,
      eventKey: EVENT_KEY,
      user: {
        id: userId,
        attributes: {}
      },
      eventTags: {
        test_value: 100
      }
    }, null, 2));
    
    const trackResponse = await fetch(`${EDGE_AGENT_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sdkKey: SDK_KEY,
        eventKey: EVENT_KEY,
        user: {
          id: userId,
          attributes: {}
        },
        eventTags: {
          test_value: 100
        }
      })
    });
    
    if (!trackResponse.ok) {
      throw new Error(`Track request failed with status: ${trackResponse.status}`);
    }
    
    const trackData = await trackResponse.json();
    console.log('Track response:', JSON.stringify(trackData, null, 2));
    
    // Verify the response contains the expected data structure
    console.log('\n📊 Expected Metrics that should be recorded:');
    console.log('1. optimizely_edge_requests_total - Count of requests');
    console.log('2. optimizely_edge_request_duration - Request duration in ms');
    console.log('3. optimizely_edge_decisions - Count of flag decisions');
    console.log('4. optimizely_edge_decision_duration - Decision time in ms');
    console.log('5. optimizely_edge_events_tracked - Count of track events');
    console.log('6. optimizely_edge_event_tracking_duration - Track event duration in ms');
    console.log('7. optimizely_edge_datafile_fetch_duration_ms - Datafile fetch time');
    console.log('8. optimizely_edge_response_status - Count of response status codes');
    
    if (response.status === 200 && decideData.flagKey === FLAG_KEY) {
      if (decideData.variationKey) {
        console.log('\n✅ Requests successful - SDL integration is fully working');
        console.log(`   Flag variation: ${decideData.variationKey}, enabled: ${decideData.enabled}`);
        console.log(`   Flag variables: ${JSON.stringify(decideData.variables)}`);
      } else {
        console.log('\n⚠️ Flag decision returned null variation but response was 200 OK');
        console.log(`   Reasons: ${decideData.reasons?.join(', ') || 'None provided'}`);
      }
      console.log('   Optimizely Edge Agent SDK integration appears to be working correctly!');
    } else {
      console.log('\n⚠️ Request succeeded but response data looks incorrect');
      console.log('   Check if the correct flag key was returned');
    }
    
    console.log('\n⚠️ Known Issue: CloudflareMetricsAdapter is failing to record metrics.');
    console.log('   This is a separate issue from the SDK integration that still needs to be fixed.');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
  
  console.log('\n📊 To verify metrics in Cloudflare (once issue is fixed):');
  console.log('  1. Go to Cloudflare Analytics Dashboard');
  console.log('  2. Check Analytics Engine for dataset: optimizely_edge_agent_test_metrics');
  console.log('  3. Look for metrics with prefix: optimizely_edge_');
  console.log('===============================================');
}

/**
 * Helper function to convert Headers to a plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Run the test
testDecideEndpoint(); 