/**
 * @fileoverview Example Live Test
 * 
 * This file demonstrates how to run a test against the live Cloudflare Workers environment
 * with full integration of verification criteria, logging, evidence collection, and
 * result comparison between local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { LiveTestRunner } = require('./live-test-runner');

/**
 * Run an example test demonstrating local vs. live comparison
 */
async function runExampleTest() {
  // Create a new LiveTestRunner instance
  const testRunner = new LiveTestRunner({
    // Configure live environment (these can also be set via environment variables)
    liveEnvironment: {
      // URL to the live Cloudflare Worker
      url: process.env.CLOUDFLARE_WORKER_URL || 'https://edge-agent.optimizely.com',
      
      // SDK Key for authentication (should be set in environment variables)
      apiKey: process.env.OPTIMIZELY_SDK_KEY || '',
      
      // Enable rate limiting to avoid overloading the live service
      enableRateLimiting: true,
      requestDelay: 500, // ms between requests
      
      // Enable safe mode to prevent destructive operations
      enableSafeMode: true,
      
      // Capture all headers for full evidence collection
      captureAllHeaders: true,
      
      // Limit concurrent requests
      maxConcurrentRequests: 1
    },
    
    // Create comparison reports
    createComparisonReports: true,
    
    // Verify results against criteria
    verifyResults: true,
    
    // Save evidence for audit
    saveEvidence: true
  });
  
  // Initialize the test runner
  await testRunner.initialize();
  
  console.log('Running example test...');
  
  // 1. Run a simple local test
  console.log('\nStep 1: Running test in local environment...');
  const localResult = await testRunner.runTest('infrastructure-verification.js');
  console.log(`Local test success: ${localResult.success}`);
  
  // 2. Run the same test against the live environment
  console.log('\nStep 2: Running test in live environment...');
  const liveResult = await testRunner.runLiveTest('infrastructure-verification.js');
  console.log(`Live test success: ${liveResult.success}`);
  
  // 3. Compare the results
  console.log('\nStep 3: Comparing results...');
  const comparisonResult = await testRunner._compareResults('infrastructure-verification.js', localResult, liveResult);
  
  // 4. Show comparison summary
  console.log('\nComparison Results:');
  console.log(`Match: ${comparisonResult.match}`);
  console.log(`Discrepancies: ${comparisonResult.discrepancies.length}`);
  
  if (comparisonResult.discrepancies.length > 0) {
    console.log('\nDiscrepancies found:');
    comparisonResult.discrepancies.forEach((discrepancy, index) => {
      console.log(`${index + 1}. Type: ${discrepancy.type}`);
      console.log(`   Description: ${discrepancy.description}`);
      console.log(`   Severity: ${discrepancy.severity}`);
    });
  } else {
    console.log('\nNo discrepancies found. Local and live results match!');
  }
  
  // 5. Show report paths
  console.log('\nEvidence and Reports:');
  console.log(`Local Manifest: ${localResult.manifestPath || 'Not generated'}`);
  console.log(`Live Manifest: ${liveResult.manifestPath || 'Not generated'}`);
  console.log(`Comparison Report: ${comparisonResult.reportPath || 'Not generated'}`);
  
  return {
    localResult,
    liveResult,
    comparisonResult
  };
}

/**
 * If this file is executed directly, run the example test
 */
if (require.main === module) {
  console.log('Running example live test demonstration...');
  
  runExampleTest()
    .then(results => {
      console.log('\nExample test completed successfully!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\nError running example test:', err);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = {
    runExampleTest
  };
} 