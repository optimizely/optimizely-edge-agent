/**
 * @fileoverview Decision API Test Adapter
 * 
 * This adapter integrates the original decision API test
 * with the environment-aware testing framework.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

// Mock the original test environment
const originalTest = require('../../final-tests-validation/test-scripts/decision-api-test');

/**
 * Adapted test function for the decision API test
 * @param {object} context - Enhanced test context from environment-aware framework
 * @returns {object} Test result
 */
async function decisionApiTest(context) {
  // Extract utilities from context
  const { utils, baseUrl } = context;
  
  console.log(`Running Decision API Test in ${context.environmentName} environment`);
  console.log(`Base URL: ${baseUrl}`);
  
  try {
    // Step 1: Test basic decision endpoint
    console.log('\n--- Step 1: Basic Decision Endpoint Test ---');
    const decisionPayload = {
      userId: "test-user-" + Date.now(),
      features: ["feature1", "feature2"]
    };
    
    const decisionResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(decisionPayload)
    });
    
    // Normalize the response
    const normalizedDecisionResponse = utils.normalize.response(decisionResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true,
      normalizeTimestamps: true
    });
    
    // Assert response status with environment-specific rules
    utils.assert.responseStatus(normalizedDecisionResponse, 200);
    
    // Verify response structure
    if (normalizedDecisionResponse.body && 
        typeof normalizedDecisionResponse.body === 'object' &&
        normalizedDecisionResponse.body.decisions) {
      console.log('✅ Basic decision endpoint test passed');
    } else {
      throw new Error('Invalid decision endpoint response structure');
    }
    
    // Step 2: Test decision with force flag
    console.log('\n--- Step 2: Decision with Force Flag Test ---');
    const forcedDecisionPayload = {
      userId: "test-user-" + Date.now(),
      features: ["feature1"],
      forceVariation: "on"
    };
    
    const forcedResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(forcedDecisionPayload)
    });
    
    // Normalize the response
    const normalizedForcedResponse = utils.normalize.response(forcedResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true,
      normalizeTimestamps: true
    });
    
    // Assert response status
    utils.assert.responseStatus(normalizedForcedResponse, 200);
    
    // Verify forced variation is applied
    const forcedCorrectly = 
      normalizedForcedResponse.body &&
      normalizedForcedResponse.body.decisions &&
      normalizedForcedResponse.body.decisions.feature1 === "on";
    
    if (forcedCorrectly) {
      console.log('✅ Decision with force flag test passed');
    } else {
      throw new Error('Forced variation not applied correctly');
    }
    
    // Step 3: Test with user attributes
    console.log('\n--- Step 3: Decision with User Attributes Test ---');
    const attributesPayload = {
      userId: "test-user-" + Date.now(),
      features: ["feature1", "feature2"],
      attributes: {
        location: "US",
        device: "mobile",
        premium: true
      }
    };
    
    const attributesResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(attributesPayload)
    });
    
    // Normalize the response with environment-specific processing
    const normalizedAttributesResponse = utils.normalize.response(attributesResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true,
      normalizeTimestamps: true
    });
    
    // Assert response status
    utils.assert.responseStatus(normalizedAttributesResponse, 200);
    
    // Verify response includes decisions
    if (normalizedAttributesResponse.body && 
        normalizedAttributesResponse.body.decisions) {
      console.log('✅ Decision with user attributes test passed');
    } else {
      throw new Error('Invalid decision with attributes response');
    }
    
    // Return successful test result
    return {
      success: true,
      environment: context.environmentType,
      data: {
        basic_decision_endpoint: true,
        forced_variation: true,
        user_attributes: true
      }
    };
  } catch (error) {
    console.error(`❌ Decision API test failed: ${error.message}`);
    
    // Return failure result
    return {
      success: false,
      environment: context.environmentType,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

// Export the adapted test function
module.exports = decisionApiTest; 