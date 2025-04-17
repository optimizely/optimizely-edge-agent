/**
 * @fileoverview Basic Test Example
 * 
 * This file demonstrates how to use the environment-aware testing infrastructure.
 * It shows environment detection, response normalization, conditional assertions,
 * and retry/wait operations.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

/**
 * Basic test function that demonstrates key features
 * @param {object} context - Test context with enhanced utilities
 * @returns {object} Test result
 */
async function basicTest(context) {
  // Extract utilities from context
  const { utils, baseUrl } = context;
  
  // Log environment information
  console.log(`Running in ${context.environmentName} environment (${context.isLiveEnvironment ? 'Live' : 'Local'})`);
  console.log(`Base URL: ${baseUrl}`);
  
  try {
    // Step 1: Make a basic request with environment-aware fetch
    console.log('\n--- Step 1: Basic Request ---');
    const response = await utils.fetch(`${baseUrl}/`);
    
    // Normalize the response for consistent handling
    const normalizedResponse = utils.normalize.response(response, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true
    });
    
    // Assert response status with environment-specific rules
    utils.assert.responseStatus(normalizedResponse, 200);
    console.log('✅ Response status assertion passed');
    
    // Step 2: Test retry logic with a potentially inconsistent operation
    console.log('\n--- Step 2: Retry Logic ---');
    let retryCount = 0;
    
    const retryResult = await utils.retry.operation(
      async () => {
        // Simulate operation that might fail in first attempts
        retryCount++;
        if (retryCount < 2) {
          throw new Error('Simulated transient error');
        }
        return { success: true, attempt: retryCount };
      },
      null, // No validation function needed here
      {
        maxRetries: 3,
        delayMs: 100,
        description: 'Simulated retry operation'
      }
    );
    
    console.log(`✅ Retry logic successful after ${retryCount} attempts`);
    
    // Step 3: Test wait condition
    console.log('\n--- Step 3: Wait Condition ---');
    let ready = false;
    
    // Set ready to true after 200ms
    setTimeout(() => { ready = true; }, 200);
    
    await utils.retry.waitFor(
      () => ready,
      { 
        timeoutMs: 1000,
        intervalMs: 50,
        description: 'Waiting for ready state'
      }
    );
    
    console.log('✅ Wait condition satisfied');
    
    // Step 4: Test environment-specific configurations
    console.log('\n--- Step 4: Environment-Specific Configurations ---');
    
    // Configurations will be different based on environment
    console.log(`Request timeout: ${utils.environment.config.timing.requestTimeout}ms`);
    console.log(`Retry delay: ${utils.environment.config.timing.retryDelay}ms`);
    console.log(`Allow status variance: ${utils.environment.config.validation.allowLiveStatusVariance}`);
    
    // Step 5: Create a test response and normalize it
    console.log('\n--- Step 5: Response Normalization ---');
    
    const sampleResponse = {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'max-age=3600',
        'cf-ray': '781defbb2e6a3183-IAD'
      },
      body: {
        timestamp: new Date().toISOString(),
        data: [1, 2, 3],
        metadata: {
          created_at: new Date().toISOString(),
          environment: context.environmentType
        }
      }
    };
    
    const normalizedSample = utils.normalize.response(sampleResponse, {
      normalizeBody: true,
      normalizeTimestamps: true,
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true
    });
    
    console.log('Original headers:', Object.keys(sampleResponse.headers).join(', '));
    console.log('Normalized headers:', Object.keys(normalizedSample.headers).join(', '));
    console.log('Timestamp normalized:', normalizedSample.body.timestamp);
    console.log('Nested timestamp normalized:', normalizedSample.body.metadata.created_at);
    
    // Return test result
    return {
      success: true,
      environment: context.environmentType,
      data: {
        requestSuccessful: true,
        retryRequired: retryCount > 1,
        normalizedResponse: normalizedSample
      }
    };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    
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

// Export the test function
module.exports = basicTest; 