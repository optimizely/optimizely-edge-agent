/**
 * @fileoverview Test Script for Manifest Generator
 * 
 * This module demonstrates how to use the ManifestGenerator to generate
 * test run manifests from various sources.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const path = require('path');
const { ManifestGenerator } = require('./manifest-generator');
const { IntegratedTestRunner } = require('../integrated-test-runner');
const { VerifiedTestRunner } = require('../verification/verified-test-runner');

/**
 * Run a sample test and generate a manifest
 */
async function runSampleTestAndGenerateManifest() {
  // Create a test runner
  const testRunner = new IntegratedTestRunner('manifest-demo');
  
  // Initialize the runner
  await testRunner.initialize({
    environment: 'test',
    version: '1.0.0'
  });
  
  // Run a simple test
  const testResult = await testRunner.runTest(async (test) => {
    const { logger, evidence, assert, step } = test;
    
    // Log test step
    const testStep = step.start('test-component', 'Sample test for manifest generation');
    
    try {
      // Perform some logging
      logger.log('INFO', 'INFO', 'Running sample test for manifest generator demo', {
        component: 'manifest-demo'
      });
      
      // Store some evidence
      await evidence.storeDataArtifact({
        sampleData: 'This is sample test data for manifest generation',
        timestamp: new Date().toISOString()
      }, 'Sample Test Data');
      
      // Make an assertion
      assert.isTrue(true, 'Simple assertion should pass');
      
      // Complete the step
      testStep.pass('Sample test completed successfully');
      
      return {
        success: true,
        message: 'Test completed for manifest generation'
      };
    } catch (err) {
      // Log error and fail the test step
      logger.error(`Test error: ${err.message}`, err);
      testStep.fail(`Test failed with error: ${err.message}`);
      
      return {
        success: false,
        error: err.message
      };
    }
  });
  
  console.log(`Sample test execution completed with result: ${testResult.success ? 'SUCCESS' : 'FAILURE'}`);
  
  // Create manifest generator
  const manifestGenerator = new ManifestGenerator({
    basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest', 'samples')
  });
  
  // Generate manifest from test result
  const manifestResult = await manifestGenerator.generateFromRunnerResult(testResult);
  
  console.log('Manifest generation completed:');
  console.log('- Manifest Path:', manifestResult.path);
  console.log('- Markdown Path:', manifestResult.markdownPath);
  
  return manifestResult;
}

/**
 * Run a sample verified test and generate a manifest
 */
async function runVerifiedTestAndGenerateManifest() {
  // Create a verified test runner
  const verifiedRunner = new VerifiedTestRunner('verified-manifest-demo', {
    enforcePassing: true // Fail test if verification fails
  });
  
  // Initialize the runner
  await verifiedRunner.initialize({
    environment: 'test',
    version: '1.0.0'
  });
  
  // Run a simple verified test
  const verifiedResult = await verifiedRunner.runTest(async (context) => {
    const { logger, evidence, assert, step, verification } = context;
    
    // Log test step
    const testStep = step.start('test-component', 'Sample verified test for manifest generation');
    
    try {
      // Perform some logging
      logger.log('INFO', 'INFO', 'Running sample verified test', {
        component: 'verified-manifest-demo'
      });
      
      // Store some evidence
      await evidence.storeDataArtifact({
        sampleData: 'This is sample test data with verification',
        timestamp: new Date().toISOString()
      }, 'Verified Test Data');
      
      // Verify timestamp format
      const timestamp = new Date().toISOString();
      const timestampValid = verification.verifyTimestamp(timestamp);
      assert.isTrue(timestampValid, 'Timestamp format should be valid UTC ISO8601');
      
      // Make an assertion
      assert.isTrue(true, 'Simple assertion should pass');
      
      // Complete the step
      testStep.pass('Sample verified test completed successfully');
      
      return {
        success: true,
        message: 'Verified test completed for manifest generation'
      };
    } catch (err) {
      // Log error and fail the test step
      logger.error(`Test error: ${err.message}`, err);
      testStep.fail(`Test failed with error: ${err.message}`);
      
      return {
        success: false,
        error: err.message
      };
    }
  });
  
  console.log(`Sample verified test execution completed with result: ${verifiedResult.success ? 'SUCCESS' : 'FAILURE'}`);
  console.log('Verification status:', verifiedResult.verificationStatus);
  
  // Create manifest generator
  const manifestGenerator = new ManifestGenerator({
    basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest', 'samples')
  });
  
  // Generate manifest from verified result
  const manifestResult = await manifestGenerator.generateFromVerifiedResult(verifiedResult);
  
  console.log('Verified manifest generation completed:');
  console.log('- Manifest Path:', manifestResult.path);
  console.log('- Markdown Path:', manifestResult.markdownPath);
  
  return manifestResult;
}

/**
 * Generate a consolidated report for multiple tests
 */
async function generateConsolidatedReport() {
  // Create manifest generator
  const manifestGenerator = new ManifestGenerator({
    basePath: path.join(process.cwd(), 'ai-workflow-workspace', 'testing-audit', 'manifest', 'samples')
  });
  
  // Generate consolidated report
  const reportResult = await manifestGenerator.generateConsolidatedReport(
    ['manifest-demo', 'verified-manifest-demo'],
    'Manifest Generator Demo Report'
  );
  
  console.log('Consolidated report generation completed:');
  console.log('- Report Path:', reportResult.path);
  console.log('- Markdown Path:', reportResult.markdownPath);
  
  return reportResult;
}

/**
 * Main demo function
 */
async function main() {
  try {
    console.log('=== Running Sample Test and Generating Manifest ===');
    await runSampleTestAndGenerateManifest();
    
    console.log('\n=== Running Verified Test and Generating Manifest ===');
    await runVerifiedTestAndGenerateManifest();
    
    console.log('\n=== Generating Consolidated Report ===');
    await generateConsolidatedReport();
    
    console.log('\nManifest generator demonstration completed successfully');
  } catch (err) {
    console.error('Error in manifest generator demo:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runSampleTestAndGenerateManifest,
  runVerifiedTestAndGenerateManifest,
  generateConsolidatedReport
}; 