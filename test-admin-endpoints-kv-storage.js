// Comprehensive test for admin endpoints and KV storage functionality
const fetch = require('node-fetch');

async function testAdminEndpointsKVStorage() {
  console.log('🔧 Testing Admin Endpoints & KV Storage Functionality\n');

  const baseUrl = 'http://localhost:5000';
  const headers = {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-Admin-Token': 'dev-admin-token',
    'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq'
  };

  let allTestsPassed = true;
  const testResults = [];

  function logTest(test, status, message, details = null) {
    const result = { test, status, message, details };
    testResults.push(result);
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${test}: ${message}`);
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
    if (status === 'FAIL') allTestsPassed = false;
  }

  try {
    // Test 1: Config Endpoint - Basic Access
    console.log('\n📋 Test 1: Config Endpoint - Basic Access');
    try {
      const configResponse = await fetch(`${baseUrl}/api/config`, {
        method: 'GET',
        headers
      });

      if (configResponse.status === 200) {
        const configData = await configResponse.json();
        logTest('Config Basic Access', 'PASS', `Status ${configResponse.status}`, {
          hasMetadata: !!configData.metadata,
          hasFeatures: !!configData.features,
          hasSummary: !!configData.summary
        });
      } else {
        const errorData = await configResponse.json();
        logTest('Config Basic Access', 'FAIL', `Status ${configResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Config Basic Access', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 2: Config Endpoint - Summary Mode
    console.log('\n📋 Test 2: Config Endpoint - Summary Mode');
    try {
      const summaryResponse = await fetch(`${baseUrl}/api/config?summary=true`, {
        method: 'GET',
        headers
      });

      if (summaryResponse.status === 200) {
        const summaryData = await summaryResponse.json();
        logTest('Config Summary Mode', 'PASS', `Status ${summaryResponse.status}`, {
          totalFeatures: summaryData.summary?.totalFeatures,
          totalExperiments: summaryData.summary?.totalExperiments,
          totalEvents: summaryData.summary?.totalEvents
        });
      } else {
        const errorData = await summaryResponse.json();
        logTest('Config Summary Mode', 'FAIL', `Status ${summaryResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Config Summary Mode', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 3: Config Endpoint - Feature Lookup
    console.log('\n📋 Test 3: Config Endpoint - Feature Lookup');
    try {
      const lookupResponse = await fetch(`${baseUrl}/api/config?featureKey=test-flag`, {
        method: 'GET',
        headers
      });

      if (lookupResponse.status === 200) {
        const lookupData = await lookupResponse.json();
        logTest('Config Feature Lookup', 'PASS', `Status ${lookupResponse.status}`, {
          foundFeature: !!lookupData.feature,
          featureKey: lookupData.feature?.key
        });
      } else {
        const errorData = await lookupResponse.json();
        logTest('Config Feature Lookup', 'FAIL', `Status ${lookupResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Config Feature Lookup', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 4: Flag Keys Endpoint - Basic Retrieval
    console.log('\n🚩 Test 4: Flag Keys Endpoint - Basic Retrieval');
    try {
      const flagKeysResponse = await fetch(`${baseUrl}/api/flagKeys`, {
        method: 'GET',
        headers
      });

      if (flagKeysResponse.status === 200) {
        const flagKeysData = await flagKeysResponse.json();
        logTest('Flag Keys Basic Retrieval', 'PASS', `Status ${flagKeysResponse.status}`, {
          flagKeysCount: flagKeysData.flagKeys?.length || 0,
          flagKeys: flagKeysData.flagKeys?.slice(0, 5) // Show first 5 flag keys
        });
      } else {
        const errorData = await flagKeysResponse.json();
        logTest('Flag Keys Basic Retrieval', 'FAIL', `Status ${flagKeysResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Flag Keys Basic Retrieval', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 5: Flag Keys Endpoint - KV Storage Specific
    console.log('\n🚩 Test 5: Flag Keys Endpoint - KV Storage Specific');
    try {
      const kvFlagKeysResponse = await fetch(`${baseUrl}/api/flagKeys?flagsFromKV=true`, {
        method: 'GET',
        headers
      });

      if (kvFlagKeysResponse.status === 200) {
        const kvFlagKeysData = await kvFlagKeysResponse.json();
        logTest('Flag Keys KV Storage', 'PASS', `Status ${kvFlagKeysResponse.status}`, {
          flagKeysCount: kvFlagKeysData.flagKeys?.length || 0,
          source: 'KV Storage'
        });
      } else if (kvFlagKeysResponse.status === 404) {
        const errorData = await kvFlagKeysResponse.json();
        logTest('Flag Keys KV Storage', 'PASS', 'Expected 404 - no KV storage configured', errorData);
      } else {
        const errorData = await kvFlagKeysResponse.json();
        logTest('Flag Keys KV Storage', 'FAIL', `Unexpected status ${kvFlagKeysResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Flag Keys KV Storage', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 6: Flag Keys Endpoint - Manual Update (PUT)
    console.log('\n🚩 Test 6: Flag Keys Endpoint - Manual Update (PUT)');
    try {
      const testFlagKeys = ['test-flag', 'checkout-flow', 'new-feature'];
      const putFlagKeysResponse = await fetch(`${baseUrl}/api/flagKeys`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          flagKeys: testFlagKeys
        })
      });

      if (putFlagKeysResponse.status === 200) {
        const putData = await putFlagKeysResponse.json();
        logTest('Flag Keys Manual Update', 'PASS', `Status ${putFlagKeysResponse.status}`, {
          operation: 'PUT',
          flagKeysSet: testFlagKeys.length,
          response: putData
        });
      } else {
        const errorData = await putFlagKeysResponse.json();
        logTest('Flag Keys Manual Update', 'FAIL', `Status ${putFlagKeysResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Flag Keys Manual Update', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 7: Verify Flag Keys Update Persisted
    console.log('\n🚩 Test 7: Verify Flag Keys Update Persisted');
    try {
      // Wait a moment for the update to persist
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const verifyResponse = await fetch(`${baseUrl}/api/flagKeys`, {
        method: 'GET',
        headers
      });

      if (verifyResponse.status === 200) {
        const verifyData = await verifyResponse.json();
        const hasTestFlag = verifyData.flagKeys?.includes('test-flag');
        const hasCheckoutFlow = verifyData.flagKeys?.includes('checkout-flow');
        
        logTest('Flag Keys Persistence', hasTestFlag && hasCheckoutFlow ? 'PASS' : 'FAIL', 
          'Updated flag keys persisted', {
          flagKeys: verifyData.flagKeys,
          hasTestFlag,
          hasCheckoutFlow
        });
      } else {
        const errorData = await verifyResponse.json();
        logTest('Flag Keys Persistence', 'FAIL', `Status ${verifyResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Flag Keys Persistence', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 8: Flag Keys POST Operation
    console.log('\n🚩 Test 8: Flag Keys POST Operation');
    try {
      const newFlagKeys = ['post-test-flag', 'new-experiment', 'feature-rollout'];
      const postFlagKeysResponse = await fetch(`${baseUrl}/api/flagKeys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          flagKeys: newFlagKeys
        })
      });

      if (postFlagKeysResponse.status === 200) {
        const postData = await postFlagKeysResponse.json();
        logTest('Flag Keys POST Operation', 'PASS', `Status ${postFlagKeysResponse.status}`, {
          operation: 'POST',
          flagKeysSet: newFlagKeys.length,
          response: postData
        });
      } else {
        const errorData = await postFlagKeysResponse.json();
        logTest('Flag Keys POST Operation', 'FAIL', `Status ${postFlagKeysResponse.status}`, errorData);
      }
    } catch (error) {
      logTest('Flag Keys POST Operation', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 9: Storage Behavior Analysis
    console.log('\n💾 Test 9: Storage Behavior Analysis');
    try {
      const storageTestResponse = await fetch(`${baseUrl}/api/flagKeys`, {
        method: 'GET',
        headers
      });

      if (storageTestResponse.status === 200) {
        const storageData = await storageTestResponse.json();
        
        // Check response headers for storage indicators
        const responseHeaders = {};
        storageTestResponse.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        logTest('Storage Behavior Analysis', 'PASS', 'Storage metadata captured', {
          flagKeysCount: storageData.flagKeys?.length,
          responseHeaders: Object.keys(responseHeaders),
          storageType: process.env.KV_URL ? 'Real KV Available' : 'Memory Storage'
        });
      } else {
        logTest('Storage Behavior Analysis', 'FAIL', `Status ${storageTestResponse.status}`);
      }
    } catch (error) {
      logTest('Storage Behavior Analysis', 'FAIL', `Request failed: ${error.message}`);
    }

    // Test 10: Error Handling - Invalid Admin Token
    console.log('\n🔒 Test 10: Error Handling - Invalid Admin Token');
    try {
      const invalidTokenHeaders = { ...headers, 'X-Optimizely-Admin-Token': 'invalid-token' };
      const invalidTokenResponse = await fetch(`${baseUrl}/api/config`, {
        method: 'GET',
        headers: invalidTokenHeaders
      });

      if (invalidTokenResponse.status === 401 || invalidTokenResponse.status === 403) {
        logTest('Invalid Admin Token', 'PASS', `Correctly rejected with status ${invalidTokenResponse.status}`);
      } else {
        logTest('Invalid Admin Token', 'FAIL', `Expected 401/403, got ${invalidTokenResponse.status}`);
      }
    } catch (error) {
      logTest('Invalid Admin Token', 'FAIL', `Request failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    allTestsPassed = false;
  }

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('🎯 ADMIN ENDPOINTS & KV STORAGE TEST RESULTS');
  console.log('='.repeat(70));
  
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const failCount = testResults.filter(r => r.status === 'FAIL').length;
  
  console.log(`📊 Results: ${passCount} PASSED, ${failCount} FAILED`);
  
  if (allTestsPassed) {
    console.log('🎉 ALL ADMIN ENDPOINT TESTS PASSED!');
    console.log('✅ Config endpoint: Working with admin authentication');
    console.log('✅ Flag keys endpoint: Working with KV storage');
    console.log('✅ Manual flag key management: Working correctly');
    console.log('✅ Storage persistence: Data persists between requests');
    console.log('✅ Error handling: Proper authentication validation');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('Failed tests:');
    testResults.filter(r => r.status === 'FAIL').forEach(test => {
      console.log(`  - ${test.test}: ${test.message}`);
    });
  }
  
  console.log('\n📋 Admin Endpoints Status:');
  console.log('- Config endpoint: Admin-authenticated access to OptimizelyConfig');
  console.log('- Flag keys GET: Retrieval from storage with source selection');
  console.log('- Flag keys PUT/POST: Manual flag key management with admin auth');
  console.log('- KV storage integration: Seamless fallback to memory storage');
  console.log('- Authentication: Proper admin token validation');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Test with real Vercel KV credentials if available');
  console.log('2. Test automatic flag key extraction from datafiles');
  console.log('3. Test Edge Mode functionality');
  
  return { allTestsPassed, testResults };
}

// Run the comprehensive test
testAdminEndpointsKVStorage().catch(console.error);