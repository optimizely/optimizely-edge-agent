/**
 * @fileoverview Example Test Using Verification Criteria
 * 
 * This file demonstrates how to create a test that uses the verification criteria
 * system with the local test execution infrastructure. It shows how to access the
 * verification criteria and ensure that tests meet the established standards.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

/**
 * Example test function that uses verification criteria
 * @param {object} testContext - Test context from the runner
 * @returns {object} Test result
 */
async function runTest(testContext) {
  // Extract components from test context
  const { 
    logger, 
    evidence, 
    assert, 
    step, 
    verificationCriteria,
    wranglerProcess 
  } = testContext;

  // Log test initialization
  logger.log('INFO', 'TEST_START', 'Starting example test with verification criteria', {
    testId: 'example-test',
    timestamp: new Date().toISOString(),
    hasVerificationCriteria: !!verificationCriteria,
    wranglerEnabled: !!wranglerProcess
  });

  // Create verification hooks
  const { VerificationHooks } = require('../verification/verification-hooks');
  const verification = new VerificationHooks({ logger, evidence });
  
  // Run pre-execution verification
  await verification.preExecution();
  
  // Log verification criteria availability
  if (verificationCriteria) {
    logger.log('INFO', 'INFO', 'Verification criteria loaded', {
      criteriaPath: verificationCriteria.path,
      criteriaLoaded: verificationCriteria.loaded
    });
  } else {
    logger.log('WARNING', 'WARNING', 'No verification criteria found for this test', {
      recommendedAction: 'Create verification criteria document for more thorough validation'
    });
  }

  try {
    // Example test steps that follow verification criteria
    // 1. Test Connectivity
    const connectivityStep = step.start('connectivity', 'Testing Edge Agent connectivity');
    
    // Store evidence of environment configuration
    await evidence.storeDataArtifact({
      environment: process.env.NODE_ENV || 'development',
      edgeAgentUrl: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
      sdkKey: process.env.SDK_KEY ? '[REDACTED]' : 'Not configured',
      timestamp: new Date().toISOString()
    }, 'Environment Configuration');
    
    // Make a request to the Edge Agent (or local Wrangler)
    const targetUrl = process.env.EDGE_AGENT_URL || 'http://localhost:8787';
    
    logger.log('INFO', 'HTTP_REQUEST', 'Making request to Edge Agent', {
      url: targetUrl,
      method: 'GET'
    });
    
    const startTime = Date.now();
    const response = await fetch(`${targetUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Extract headers for verification and evidence
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    
    // Store evidence of HTTP transaction
    await evidence.storeDataArtifact({
      url: `${targetUrl}/health`,
      method: 'GET',
      headers: headers,
      status: response.status,
      responseTime,
      timestamp: new Date().toISOString()
    }, 'HTTP Transaction Evidence');
    
    // Verify Cloudflare evidence if present
    const hasCfRay = headers['cf-ray'] !== undefined;
    verification.verifyCloudflare({ headers });
    
    // Verify connectivity requirements
    assert.equal(response.status, 200, 'Edge Agent should return 200 OK');
    assert.isTrue(responseTime < 2000, `Response time should be under 2000ms (actual: ${responseTime}ms)`);
    
    // Complete connectivity step
    connectivityStep.pass('Connectivity test completed successfully');
    
    // 2. Test Functionality
    const functionalityStep = step.start('functionality', 'Testing basic functionality');
    
    // Example functionality test
    const responseBody = await response.text();
    
    // Store evidence of functionality test
    await evidence.storeDataArtifact({
      responseBody,
      timestamp: new Date().toISOString()
    }, 'Functionality Test Evidence');
    
    // Verify functionality requirements
    assert.isTrue(responseBody.length > 0, 'Response body should not be empty');
    
    // Complete functionality step
    functionalityStep.pass('Functionality test completed successfully');
    
    // 3. Run post-execution verification
    const verificationResult = await verification.postExecution();
    
    // Return the test result with verification status
    return {
      success: true,
      cloudflareEvidence: hasCfRay,
      verificationStatus: verificationResult.status,
      verifications: verificationResult.verifications,
      responseTime,
      assertions: {
        total: assert.getTotal(),
        passed: assert.getPassed(),
        failed: assert.getFailed(),
        skipped: 0
      }
    };
    
  } catch (err) {
    // Log error
    logger.error(`Test error: ${err.message}`, err);
    
    // Store error evidence
    await evidence.storeDataArtifact({
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    }, 'Error Evidence');
    
    // Run post-execution verification even on error
    const verificationResult = await verification.postExecution();
    
    // Return failure result
    return {
      success: false,
      error: err.message,
      verificationStatus: verificationResult.status,
      assertions: {
        total: assert.getTotal(),
        passed: assert.getPassed(),
        failed: assert.getFailed(),
        skipped: 0
      }
    };
  }
}

// Export the test function
module.exports = {
  runTest
};

// Run directly if called from command line
if (require.main === module) {
  const { IntegratedTestRunner } = require('../integrated-test-runner');
  
  async function main() {
    const testRunner = new IntegratedTestRunner('example-test', {
      loggerConfig: {
        logToConsole: true
      },
      evidenceConfig: {
        saveArtifacts: true
      },
      createReports: true
    });
    
    await testRunner.initialize();
    const result = await testRunner.runTest(runTest);
    
    console.log('Test completed with result:', result.success ? 'SUCCESS' : 'FAILURE');
    process.exit(result.success ? 0 : 1);
  }
  
  main().catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
  });
} 