/**
 * @fileoverview Test Script for VerificationHooks
 * 
 * This module demonstrates how to use the VerificationHooks in test scripts
 * to ensure test integrity, execution validation, and proper evidence collection.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { VerificationHooks, VERIFICATION_STATUS } = require('./verification-hooks');
const { IntegratedTestRunner } = require('../integrated-test-runner');

/**
 * Example test that uses verification hooks
 */
async function runTestWithVerification() {
  // Create the integrated test runner
  const testRunner = new IntegratedTestRunner('verification-hooks-demo');
  
  // Initialize the runner
  await testRunner.initialize({
    environment: 'test',
    version: '1.0.0'
  });
  
  // Run the test with verification hooks
  const result = await testRunner.runTest(async (test) => {
    // Get context from test runner
    const { logger, evidence, assert, step } = test;
    
    // Create verification hooks instance
    const verification = new VerificationHooks({ 
      logger, 
      evidence 
    });
    
    // Pre-execution verification
    await verification.preExecution();
    
    // Log test step
    const testStep = step.start('test-component', 'Testing with verification hooks');
    
    try {
      // Perform a test HTTP request to Cloudflare
      const response = await fetch('https://api.optimizely.com/v3/edge-agent', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Verify Cloudflare evidence in the response
      const responseData = {
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status
      };
      
      // Verify timestamp format
      const timestamp = new Date().toISOString();
      const timestampValid = verification.verifyTimestamp(timestamp);
      assert.isTrue(timestampValid, 'Timestamp format should be valid UTC ISO8601');
      
      // Verify Cloudflare evidence
      const cloudflareValid = verification.verifyCloudflare(responseData);
      assert.isTrue(cloudflareValid, 'Response should contain Cloudflare evidence (cf-ray header)');
      
      // Store some test evidence
      await evidence.storeDataArtifact({
        testData: 'This is a test',
        timestamp: new Date().toISOString()
      }, 'Test Evidence');
      
      // Create a test signature and verify it
      const testData = {
        id: '12345',
        timestamp: new Date().toISOString(),
        data: 'Test data for signature verification'
      };
      
      // Complete the test step
      testStep.pass('Test completed with verification');
      
      // Post-execution verification
      const verificationResult = await verification.postExecution();
      
      // Log verification result
      logger.log('TEST_END', 'INFO', `Test verification completed with status: ${verificationResult.status}`, {
        component: 'verification-demo',
        verificationStatus: verificationResult.status
      });
      
      // Return test result with verification data
      return {
        success: true,
        verificationStatus: verificationResult.status,
        verifications: verificationResult.verifications
      };
    } catch (err) {
      // Log error and fail the test step
      logger.error(`Test error: ${err.message}`, err);
      testStep.fail(`Test failed with error: ${err.message}`);
      
      // Still run post-execution verification
      const verificationResult = await verification.postExecution();
      
      return {
        success: false,
        error: err.message,
        verificationStatus: verificationResult.status
      };
    }
  });
  
  console.log('Test completed with result:', result.success ? 'SUCCESS' : 'FAILURE');
  console.log('Verification status:', result.testResult?.verificationStatus || 'UNKNOWN');
  
  return result;
}

/**
 * Main execution function
 */
async function main() {
  try {
    const result = await runTestWithVerification();
    console.log('Test execution completed');
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runTestWithVerification
}; 