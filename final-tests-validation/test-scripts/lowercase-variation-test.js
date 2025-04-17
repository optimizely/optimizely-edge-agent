/**
 * Lowercase Variation Test
 * 
 * This script specifically tests the Edge Agent's ability to handle lowercase "on" variation keys
 * in forced variations through the JSON payload method.
 * 
 * Usage:
 *   node lowercase-variation-test.js
 */

const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  edgeAgentUrl: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
  sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
  logLevel: 'debug'
};

// Logger setup
const log = {
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : '')
};

// Test helper function
async function makeRequest(endpoint, body) {
  try {
    log.debug(`Making request to ${CONFIG.edgeAgentUrl}${endpoint}`, body);
    
    const response = await fetch(`${CONFIG.edgeAgentUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': CONFIG.sdkKey
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();
    
    log.debug(`Response status: ${response.status}`, responseData);
    
    return { status: response.status, data: responseData };
  } catch (error) {
    log.error(`Request failed: ${error.message}`);
    return { status: 500, error: error.message };
  }
}

// Test case: Test lowercase "on" variation using forcedDecisions in JSON payload
async function testLowercaseOnVariation() {
  log.info("Testing lowercase 'on' variation...");
  
  const testUserId = `test-user-${Math.floor(Math.random() * 1000000)}`;
  const testFlagKey = 'test-flag';
  
  // Test with lowercase "on" variation
  const body = {
    userId: testUserId,
    attributes: {
      forcedDecisions: {
        [testFlagKey]: {
          variationKey: "on"  // lowercase "on" is the key test case
        }
      }
    }
  };
  
  // Make the request to the decide endpoint
  const result = await makeRequest('/api/decide', {
    userId: testUserId,
    key: testFlagKey,
    attributes: {
      forcedDecisions: {
        [testFlagKey]: {
          variationKey: "on"  // lowercase "on" variation
        }
      }
    }
  });
  
  // Verify the response
  if (result.status === 200 && result.data) {
    const decision = result.data;
    
    log.info("Decision result:", decision);
    
    // Check if variation matches our forced value
    if (decision.variationKey === "on") {
      log.info("✅ SUCCESS: Lowercase 'on' variation correctly preserved!");
      return true;
    } else {
      log.error(`❌ FAIL: Expected variation 'on' but got '${decision.variationKey}'`);
      return false;
    }
  } else {
    log.error("❌ FAIL: Request failed or returned unexpected response", result);
    return false;
  }
}

// Test case: Compare lowercase "on" with uppercase "ON" variation
async function testCaseSensitiveVariation() {
  log.info("Testing case sensitivity by comparing 'on' vs 'ON'...");
  
  const testUserId = `test-user-${Math.floor(Math.random() * 1000000)}`;
  const testFlagKey = 'test-flag';
  
  // Test with lowercase "on"
  const lowercaseResult = await makeRequest('/api/decide', {
    userId: testUserId,
    key: testFlagKey,
    attributes: {
      forcedDecisions: {
        [testFlagKey]: {
          variationKey: "on"  // lowercase "on"
        }
      }
    }
  });
  
  // Test with uppercase "ON"
  const uppercaseResult = await makeRequest('/api/decide', {
    userId: testUserId,
    key: testFlagKey,
    attributes: {
      forcedDecisions: {
        [testFlagKey]: {
          variationKey: "ON"  // uppercase "ON"
        }
      }
    }
  });
  
  // Compare results
  if (lowercaseResult.status === 200 && uppercaseResult.status === 200) {
    log.info("Lowercase variation result:", lowercaseResult.data);
    log.info("Uppercase variation result:", uppercaseResult.data);
    
    const lowercaseVariation = lowercaseResult.data.variationKey;
    const uppercaseVariation = uppercaseResult.data.variationKey;
    
    // They should be different if case sensitivity is properly handled
    if (lowercaseVariation !== uppercaseVariation) {
      log.info(`✅ SUCCESS: Case sensitivity preserved ('${lowercaseVariation}' vs '${uppercaseVariation}')`);
      return true;
    } else {
      log.error(`❌ FAIL: Case sensitivity not preserved (both returned '${lowercaseVariation}')`);
      return false;
    }
  } else {
    log.error("❌ FAIL: One or both requests failed", { 
      lowercase: lowercaseResult, 
      uppercase: uppercaseResult 
    });
    return false;
  }
}

// Run all tests
async function runTests() {
  log.info("== LOWERCASE VARIATION TEST SUITE ==");
  log.info(`Edge Agent URL: ${CONFIG.edgeAgentUrl}`);
  log.info(`SDK Key: ${CONFIG.sdkKey}`);
  log.info("================================");
  
  try {
    // Run individual tests
    const test1Result = await testLowercaseOnVariation();
    const test2Result = await testCaseSensitiveVariation();
    
    // Print summary
    log.info("== TEST SUMMARY ==");
    log.info(`Lowercase 'on' Preservation: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
    log.info(`Case Sensitivity: ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
    log.info("=================");
    
    if (test1Result && test2Result) {
      log.info("🎉 ALL TESTS PASSED! The implementation correctly handles lowercase variation keys.");
    } else {
      log.error("❌ SOME TESTS FAILED. See logs above for details.");
    }
  } catch (error) {
    log.error("❌ ERROR RUNNING TESTS:", error);
  }
}

// Execute tests
runTests(); 