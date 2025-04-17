/**
 * @fileoverview KV Storage Test Adapter
 * 
 * This adapter integrates the original KV storage test with the environment-aware testing framework.
 * It specifically addresses eventual consistency issues between local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

// Mock the original test environment
const originalTest = require('../../final-tests-validation/test-scripts/kv-storage-tests');

/**
 * Adapted test function for the KV storage test
 * @param {object} context - Enhanced test context from environment-aware framework
 * @returns {object} Test result
 */
async function kvStorageTest(context) {
  // Extract utilities from context
  const { utils, baseUrl } = context;
  
  console.log(`Running KV Storage Test in ${context.environmentName} environment`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Using environment-specific timing: Wait delay ${utils.environment.config.timing.retryDelay}ms, Timeout ${utils.environment.config.timing.operationTimeout}ms`);
  
  // Generate unique test keys to avoid collisions
  const testPrefix = `test-${Date.now()}-`;
  const testKey1 = `${testPrefix}key1`;
  const testKey2 = `${testPrefix}key2`;
  
  try {
    // Step 1: Write KV value
    console.log('\n--- Step 1: Write KV Value ---');
    const writePayload = {
      key: testKey1,
      value: "test-value-" + Date.now()
    };
    
    const writeResponse = await utils.fetch(`${baseUrl}/kv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(writePayload)
    });
    
    // Normalize the response
    const normalizedWriteResponse = utils.normalize.response(writeResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true
    });
    
    // Assert response status
    utils.assert.responseStatus(normalizedWriteResponse, 200);
    console.log('✅ Write KV value completed');
    
    // Step 2: Read KV value with retry for eventual consistency
    console.log('\n--- Step 2: Read KV Value (with retry for eventual consistency) ---');
    
    // Use retry operation for eventually consistent KV storage
    const readResult = await utils.retry.operation(
      async () => {
        const readResponse = await utils.fetch(`${baseUrl}/kv/${testKey1}`);
        
        // Normalize the response
        const normalizedReadResponse = utils.normalize.response(readResponse, {
          removeCloudflareHeaders: true,
          normalizeCacheHeaders: true
        });
        
        // Verify the value exists and matches what we wrote
        if (normalizedReadResponse.status !== 200 || 
            !normalizedReadResponse.body || 
            !normalizedReadResponse.body.includes(writePayload.value)) {
          throw new Error('KV value not found or does not match (eventual consistency delay)');
        }
        
        return {
          response: normalizedReadResponse,
          value: normalizedReadResponse.body
        };
      },
      null, // No validation function needed here
      {
        maxRetries: context.isLiveEnvironment ? 5 : 2, // More retries in live environment
        delayMs: utils.environment.config.timing.retryDelay,
        description: 'Reading KV value with retry for eventual consistency'
      }
    );
    
    console.log(`✅ Read KV value successful: ${readResult.value}`);
    
    // Step 3: Write multiple KV values
    console.log('\n--- Step 3: Write Multiple KV Values ---');
    const writeMultiplePayload = {
      items: [
        { key: `${testKey1}-multi`, value: "multi-value-1" },
        { key: `${testKey2}-multi`, value: "multi-value-2" }
      ]
    };
    
    const writeMultipleResponse = await utils.fetch(`${baseUrl}/kv-multi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(writeMultiplePayload)
    });
    
    // Normalize the response
    const normalizedMultiWriteResponse = utils.normalize.response(writeMultipleResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true
    });
    
    // Assert response status
    utils.assert.responseStatus(normalizedMultiWriteResponse, 200);
    console.log('✅ Write multiple KV values completed');
    
    // Step 4: Read multiple KV values with retry for eventual consistency
    console.log('\n--- Step 4: Read Multiple KV Values (with retry for eventual consistency) ---');
    
    // Use retry operation for eventually consistent KV storage
    const readMultipleResult = await utils.retry.operation(
      async () => {
        // Read first value
        const read1Response = await utils.fetch(`${baseUrl}/kv/${writeMultiplePayload.items[0].key}`);
        const normalized1 = utils.normalize.response(read1Response, {
          removeCloudflareHeaders: true,
          normalizeCacheHeaders: true
        });
        
        // Read second value
        const read2Response = await utils.fetch(`${baseUrl}/kv/${writeMultiplePayload.items[1].key}`);
        const normalized2 = utils.normalize.response(read2Response, {
          removeCloudflareHeaders: true,
          normalizeCacheHeaders: true
        });
        
        // Verify values match what we wrote
        if (normalized1.status !== 200 || !normalized1.body.includes(writeMultiplePayload.items[0].value) ||
            normalized2.status !== 200 || !normalized2.body.includes(writeMultiplePayload.items[1].value)) {
          throw new Error('Multiple KV values not found or do not match (eventual consistency delay)');
        }
        
        return {
          values: [normalized1.body, normalized2.body]
        };
      },
      null, // No validation function needed here
      {
        maxRetries: context.isLiveEnvironment ? 5 : 2, // More retries in live environment
        delayMs: utils.environment.config.timing.retryDelay,
        description: 'Reading multiple KV values with retry for eventual consistency'
      }
    );
    
    console.log(`✅ Read multiple KV values successful: [${readMultipleResult.values.join(', ')}]`);
    
    // Step 5: Delete KV value
    console.log('\n--- Step 5: Delete KV Value ---');
    const deleteResponse = await utils.fetch(`${baseUrl}/kv/${testKey1}`, {
      method: 'DELETE'
    });
    
    // Normalize the response
    const normalizedDeleteResponse = utils.normalize.response(deleteResponse, {
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true
    });
    
    // Assert response status
    utils.assert.responseStatus(normalizedDeleteResponse, 200);
    console.log('✅ Delete KV value completed');
    
    // Step 6: Verify deletion with retry for eventual consistency
    console.log('\n--- Step 6: Verify Deletion (with retry for eventual consistency) ---');
    
    // Use retry and wait for the key to be gone
    let deletionVerified = false;
    
    await utils.retry.waitFor(
      async () => {
        try {
          const verifyResponse = await utils.fetch(`${baseUrl}/kv/${testKey1}`);
          
          // In some environments, a deleted key returns 404, in others it might return 200 with empty/null
          if (verifyResponse.status === 404 || 
              (verifyResponse.status === 200 && (!verifyResponse.body || verifyResponse.body === 'null' || verifyResponse.body === ''))) {
            deletionVerified = true;
            return true;
          }
          
          console.log(`Waiting for deletion to propagate. Current status: ${verifyResponse.status}`);
          return false;
        } catch (error) {
          // Some errors might actually indicate success (e.g., 404 throws in fetch)
          if (error.message && error.message.includes('404')) {
            deletionVerified = true;
            return true;
          }
          console.log(`Error during deletion verification: ${error.message}`);
          return false;
        }
      },
      {
        timeoutMs: utils.environment.config.timing.operationTimeout,
        intervalMs: utils.environment.config.timing.retryDelay,
        description: 'Waiting for KV deletion to be consistent'
      }
    );
    
    if (deletionVerified) {
      console.log('✅ KV deletion verification successful');
    } else {
      throw new Error('Failed to verify KV deletion (eventual consistency timeout)');
    }
    
    // Return successful test result
    return {
      success: true,
      environment: context.environmentType,
      data: {
        write_kv: true,
        read_kv: true,
        write_multiple: true,
        read_multiple: true,
        delete_kv: true,
        verify_deletion: true
      }
    };
  } catch (error) {
    console.error(`❌ KV Storage test failed: ${error.message}`);
    
    // Return failure result
    return {
      success: false,
      environment: context.environmentType,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  } finally {
    // Cleanup: Try to delete test keys to avoid pollution
    try {
      await utils.fetch(`${baseUrl}/kv/${testKey1}`, { method: 'DELETE' });
      await utils.fetch(`${baseUrl}/kv/${testKey2}`, { method: 'DELETE' });
      await utils.fetch(`${baseUrl}/kv/${testKey1}-multi`, { method: 'DELETE' });
      await utils.fetch(`${baseUrl}/kv/${testKey2}-multi`, { method: 'DELETE' });
    } catch (cleanupError) {
      console.warn('Cleanup warning: Failed to delete some test keys', cleanupError.message);
    }
  }
}

// Export the adapted test function
module.exports = kvStorageTest; 