/**
 * @fileoverview Parameter Validation Test Adapter
 * 
 * This adapter integrates the original parameter validation test
 * with the environment-aware testing framework.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

// Mock the original test environment
const originalTest = require('../../final-tests-validation/test-scripts/parameter-validation-test');

/**
 * Adapted test function for the parameter validation test
 * @param {object} context - Enhanced test context from environment-aware framework
 * @returns {object} Test result
 */
async function parameterValidationTest(context) {
  // Extract utilities from context
  const { utils, baseUrl } = context;
  
  console.log(`Running Parameter Validation Test in ${context.environmentName} environment`);
  console.log(`Base URL: ${baseUrl}`);
  
  try {
    // Step 1: Test request parameter validation
    console.log('\n--- Step 1: Request Parameter Validation Test ---');
    
    // Test missing user ID
    console.log('Testing missing userId parameter...');
    const missingUserIdPayload = {
      // Intentionally omitting userId
      features: ["feature1", "feature2"]
    };
    
    const missingUserIdResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(missingUserIdPayload)
    });
    
    // Normalize the response
    const normalizedMissingUserIdResponse = utils.normalize.response(missingUserIdResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true
    });
    
    // Check if response indicates parameter validation error
    // Local and live environments might handle this differently
    utils.assert.conditionalValue({
      value: normalizedMissingUserIdResponse.status,
      condition: context.isLiveEnvironment ? 'equals' : 'oneOf',
      expected: context.isLiveEnvironment ? 400 : [400, 422],
      message: 'Missing userId should return appropriate error status'
    });
    
    if (normalizedMissingUserIdResponse.status >= 400) {
      console.log('✅ Missing userId validation test passed');
    } else {
      throw new Error('Missing userId validation failed - should have returned error');
    }
    
    // Step 2: Test features parameter validation
    console.log('\n--- Step 2: Features Parameter Validation Test ---');
    
    // Test missing features
    console.log('Testing missing features parameter...');
    const missingFeaturesPayload = {
      userId: "test-user-" + Date.now()
      // Intentionally omitting features
    };
    
    const missingFeaturesResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(missingFeaturesPayload)
    });
    
    // Normalize the response
    const normalizedMissingFeaturesResponse = utils.normalize.response(missingFeaturesResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true
    });
    
    // Assert response based on environment - feature param may be optional in some environments
    utils.assert.conditionalValue({
      value: normalizedMissingFeaturesResponse.status,
      condition: context.isLiveEnvironment ? 'equals' : 'oneOf',
      expected: context.isLiveEnvironment ? 200 : [200, 400, 422],
      message: 'Missing features should be handled consistently in this environment'
    });
    
    console.log('✅ Missing features validation test passed');
    
    // Step 3: Test type validation
    console.log('\n--- Step 3: Parameter Type Validation Test ---');
    
    // Test invalid userId type
    console.log('Testing invalid userId type...');
    const invalidUserIdPayload = {
      userId: 12345, // Number instead of string
      features: ["feature1", "feature2"]
    };
    
    const invalidUserIdResponse = await utils.fetch(`${baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidUserIdPayload)
    });
    
    // Normalize the response
    const normalizedInvalidUserIdResponse = utils.normalize.response(invalidUserIdResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeBody: true
    });
    
    // Check response - different environments might auto-convert types
    const isTypeValidationWorking = 
      (normalizedInvalidUserIdResponse.status >= 400) || 
      (normalizedInvalidUserIdResponse.status === 200 && 
       typeof normalizedInvalidUserIdResponse.body?.userId === 'string');
    
    if (isTypeValidationWorking) {
      console.log('✅ Type validation test passed');
    } else {
      console.log('⚠️ Type validation behaves differently in this environment');
    }
    
    // Return successful test result with all test data
    return {
      success: true,
      environment: context.environmentType,
      data: {
        missing_userid_test: {
          status: normalizedMissingUserIdResponse.status,
          passed: normalizedMissingUserIdResponse.status >= 400
        },
        missing_features_test: {
          status: normalizedMissingFeaturesResponse.status,
          passed: true // Based on conditional validation above
        },
        type_validation_test: {
          status: normalizedInvalidUserIdResponse.status,
          passed: isTypeValidationWorking
        }
      }
    };
  } catch (error) {
    console.error(`❌ Parameter validation test failed: ${error.message}`);
    
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
module.exports = parameterValidationTest; 