/**
 * @fileoverview Test script for the evidence storage utility
 * 
 * This script tests the functionality of the evidence storage utility, including:
 * - Initialization
 * - Network artifact storage
 * - Data artifact storage
 * - Screenshot artifact storage
 * - Assertion artifact storage
 * - Metadata and registry generation
 * - Integrity verification
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { EvidenceStorage, RESULT_TYPES } = require('./evidence-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Run the test script
 */
async function runTest() {
  console.log('Testing evidence storage utility...');
  
  try {
    // Create a test evidence storage instance
    const evidence = new EvidenceStorage('evidence-test');
    
    // Initialize with environment info
    await evidence.initialize({
      workerUrl: 'https://edge-agent.example.workers.dev',
      sdkKey: 'SDK-123456-TEST'
    });
    
    console.log(`Evidence storage initialized with runId: ${evidence.runId}`);
    console.log(`Metadata file: ${evidence.metadataFilePath}`);
    
    // Store a network artifact
    const networkData = {
      url: 'https://edge-agent.example.workers.dev/decide',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EvidenceStorage/1.0',
        'cf-ray': '8168c5df8c5d3183-DFW'
      },
      body: JSON.stringify({
        userId: '12345',
        attributes: { test: true }
      }),
      statusCode: 200,
      responseHeaders: {
        'Content-Type': 'application/json',
        'cf-ray': '8168c5df8c5d3183-DFW'
      },
      responseBody: {
        flagKey: 'test-flag',
        enabled: true,
        variables: { test: 'value' }
      }
    };
    
    const networkArtifact = await evidence.storeNetworkArtifact(
      networkData,
      'Test API request to /decide endpoint'
    );
    
    console.log(`Network artifact stored: ${networkArtifact.id}`);
    console.log(`Network artifact path: ${networkArtifact.path}`);
    
    // Store a data artifact
    const dataArtifact = await evidence.storeDataArtifact(
      { key: 'value', nested: { array: [1, 2, 3] } },
      'Test data object'
    );
    
    console.log(`Data artifact stored: ${dataArtifact.id}`);
    console.log(`Data artifact path: ${dataArtifact.path}`);
    
    // Create a simple screenshot (mock data)
    const mockImageBuffer = Buffer.from(
      crypto.randomBytes(1024 * 10) // 10KB random data as mock image
    );
    
    const screenshotArtifact = await evidence.storeScreenshotArtifact(
      mockImageBuffer,
      'Test screenshot',
      'Testing screenshot storage'
    );
    
    console.log(`Screenshot artifact stored: ${screenshotArtifact.id}`);
    console.log(`Screenshot artifact path: ${screenshotArtifact.path}`);
    
    // Store assertion artifacts
    const passAssertion = {
      message: 'Response should contain flag data',
      status: 'PASS',
      expected: 'object with flagKey',
      actual: 'object with flagKey="test-flag"'
    };
    
    const failAssertion = {
      message: 'Response should contain specific variation',
      status: 'FAIL',
      expected: 'variation="test-variation"',
      actual: 'variation=null'
    };
    
    const skipAssertion = {
      message: 'Response should contain metrics data',
      status: 'SKIPPED',
      reason: 'Metrics not available in test environment'
    };
    
    await evidence.storeAssertionArtifact(passAssertion);
    await evidence.storeAssertionArtifact(failAssertion);
    await evidence.storeAssertionArtifact(skipAssertion);
    
    console.log(`Assertions stored: ${evidence.summary.assertions.total}`);
    console.log(`Passed: ${evidence.summary.assertions.passed}, Failed: ${evidence.summary.assertions.failed}, Skipped: ${evidence.summary.assertions.skipped}`);
    
    // Update summary information
    await evidence.updateSummary({
      steps: {
        total: 5,
        passed: 4,
        failed: 1,
        skipped: 0
      },
      errors: 1,
      warnings: 2
    });
    
    console.log('Summary updated');
    
    // Finalize the evidence collection
    const finalResult = await evidence.finalize(RESULT_TYPES.FAIL, 1500);
    
    console.log('Evidence collection finalized:');
    console.log(`  Result: ${finalResult.result}`);
    console.log(`  Duration: ${finalResult.duration}ms`);
    console.log(`  Artifacts: ${finalResult.artifactCount}`);
    
    // Verify the evidence
    console.log('Verifying evidence integrity...');
    const verificationResult = await EvidenceStorage.verifyEvidence(evidence.metadataFilePath);
    
    console.log('Verification result:');
    console.log(`  Verified: ${verificationResult.verified}`);
    console.log(`  Artifacts Verified: ${verificationResult.artifactsVerified}/${verificationResult.artifactsTotal}`);
    
    if (!verificationResult.verified) {
      console.error('Verification errors:');
      verificationResult.errors.forEach((error, i) => {
        console.error(`  ${i+1}. ${error}`);
      });
    }
    
    // Find evidence by test ID
    console.log('Finding evidence by test ID...');
    const foundEvidence = await EvidenceStorage.findEvidenceByTestId('evidence-test');
    
    console.log(`Found ${foundEvidence.length} evidence entries for test ID 'evidence-test'`);
    
    // Get evidence summary by date
    const today = new Date().toISOString().split('T')[0];
    console.log(`Getting evidence summary for ${today}...`);
    const summary = await EvidenceStorage.getEvidenceSummaryByDate(today);
    
    if (summary) {
      console.log('Evidence summary:');
      console.log(`  Total Runs: ${summary.summary.totalRuns}`);
      console.log(`  Passed: ${summary.summary.passed}`);
      console.log(`  Failed: ${summary.summary.failed}`);
      console.log(`  Total Artifacts: ${summary.summary.totalArtifacts}`);
    }
    
    console.log('Test completed successfully!');
    
    return {
      success: true,
      evidencePath: evidence.metadataFilePath,
      verified: verificationResult.verified
    };
    
  } catch (err) {
    console.error('Test failed with error:', err);
    return {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runTest()
    .then(result => {
      if (result.success) {
        console.log('Evidence storage test completed successfully!');
        if (result.verified) {
          console.log('Evidence integrity verified!');
        } else {
          console.error('Evidence integrity verification failed!');
          process.exit(1);
        }
      } else {
        console.error('Evidence storage test failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error in test:', err);
      process.exit(1);
    });
}

module.exports = { runTest }; 