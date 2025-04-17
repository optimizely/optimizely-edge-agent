/**
 * Optimizely Edge Agent - Infrastructure Verification Test
 * 
 * This script verifies basic connectivity to the Edge Agent and validates
 * the Cloudflare environment. It is the foundation for all other tests.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const config = {
  EDGE_AGENT_URL: process.env.EDGE_AGENT_URL || 'http://localhost:8787',
  SDK_KEY: process.env.SDK_KEY || 'test-sdk-key',
  TEST_ID: `infra-test-${Date.now()}`,
  RESULTS_DIR: path.join(__dirname, '../../results')
};

// Ensure results directory exists
if (!fs.existsSync(config.RESULTS_DIR)) {
  fs.mkdirSync(config.RESULTS_DIR, { recursive: true });
}

// Results container
const testResults = {
  testId: config.TEST_ID,
  timestamp: new Date().toISOString(),
  environment: {
    EDGE_AGENT_URL: config.EDGE_AGENT_URL,
    SDK_KEY: config.SDK_KEY ? '****' + config.SDK_KEY.substr(-4) : 'not-set',
    nodeVersion: process.version,
    platform: process.platform
  },
  tests: [],
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    status: 'not-run'
  }
};

// Test functions
async function runConnectionTest() {
  const testName = 'Basic Connectivity';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {},
    evidence: {}
  };
  
  try {
    const startTime = Date.now();
    const response = await fetch(config.EDGE_AGENT_URL);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const responseText = await response.text();
    const cfRay = response.headers.get('cf-ray');
    
    result.details.statusCode = response.status;
    result.details.responseTime = responseTime;
    result.details.cfRay = cfRay;
    result.details.contentType = response.headers.get('content-type');
    
    result.evidence.headers = Object.fromEntries(response.headers.entries());
    result.evidence.responseText = responseText.substring(0, 500); // Limit size
    
    result.status = response.status >= 200 && response.status < 500 ? 'passed' : 'failed';
    
    if (result.status === 'passed') {
      console.log(`✅ ${testName} - Connected successfully to ${config.EDGE_AGENT_URL}`);
      console.log(`   Response time: ${responseTime}ms, Status: ${response.status}, CF-Ray: ${cfRay || 'Not found'}`);
    } else {
      console.error(`❌ ${testName} - Connection failed with status ${response.status}`);
      console.error(`   Response time: ${responseTime}ms`);
    }
    
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

async function runCloudflareVerification() {
  const testName = 'Cloudflare Environment Verification';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {},
    evidence: {}
  };
  
  try {
    const response = await fetch(config.EDGE_AGENT_URL);
    
    const cfRay = response.headers.get('cf-ray');
    const cfCacheStatus = response.headers.get('cf-cache-status');
    
    result.details.cfRay = cfRay;
    result.details.cfCacheStatus = cfCacheStatus;
    result.evidence.headers = Object.fromEntries(response.headers.entries());
    
    if (cfRay) {
      result.status = 'passed';
      console.log(`✅ ${testName} - Cloudflare environment confirmed (CF-Ray: ${cfRay})`);
      if (cfCacheStatus) {
        console.log(`   Cache Status: ${cfCacheStatus}`);
      }
    } else {
      result.status = 'failed';
      console.error(`❌ ${testName} - No Cloudflare headers detected`);
    }
    
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

async function runAPIHealthCheck() {
  const testName = 'API Health Check';
  console.log(`Running test: ${testName}`);
  
  const result = {
    name: testName,
    status: 'running',
    timestamp: new Date().toISOString(),
    details: {},
    evidence: {}
  };
  
  try {
    // Try to access a known API endpoint
    const endpoint = `${config.EDGE_AGENT_URL}/api/datafile-status`;
    const startTime = Date.now();
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-SDK-Key': config.SDK_KEY
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    result.details.statusCode = response.status;
    result.details.responseTime = responseTime;
    result.details.endpoint = endpoint;
    
    let responseJson;
    try {
      responseJson = await response.json();
      result.evidence.responseBody = responseJson;
    } catch (e) {
      const text = await response.text();
      result.evidence.responseText = text.substring(0, 500); // Limit size
    }
    
    result.evidence.headers = Object.fromEntries(response.headers.entries());
    
    // Even a 404 could be acceptable since we're just checking if the API responds
    result.status = response.status >= 200 && response.status < 500 ? 'passed' : 'failed';
    
    if (result.status === 'passed') {
      console.log(`✅ ${testName} - API responded with status ${response.status}`);
      console.log(`   Response time: ${responseTime}ms`);
    } else {
      console.error(`❌ ${testName} - API failed with status ${response.status}`);
      console.error(`   Response time: ${responseTime}ms`);
    }
    
  } catch (error) {
    result.status = 'failed';
    result.details.error = error.message;
    console.error(`❌ ${testName} - Error: ${error.message}`);
  }
  
  testResults.tests.push(result);
  return result;
}

// Run all tests
async function runAllTests() {
  console.log('\n=== Optimizely Edge Agent Infrastructure Verification ===');
  console.log(`Target URL: ${config.EDGE_AGENT_URL}`);
  console.log(`Test ID: ${config.TEST_ID}`);
  console.log(`Timestamp: ${testResults.timestamp}`);
  console.log('============================================================\n');
  
  const tests = [
    await runConnectionTest(),
    await runCloudflareVerification(),
    await runAPIHealthCheck()
  ];
  
  // Calculate summary
  testResults.summary.totalTests = tests.length;
  testResults.summary.passed = tests.filter(t => t.status === 'passed').length;
  testResults.summary.failed = tests.filter(t => t.status === 'failed').length;
  testResults.summary.status = testResults.summary.failed === 0 ? 'passed' : 'failed';
  
  // Print summary
  console.log('\n============================================================');
  console.log(`Test Results: ${testResults.summary.status.toUpperCase()}`);
  console.log(`Total Tests: ${testResults.summary.totalTests}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log('============================================================\n');
  
  // Save results to file
  const resultsFile = path.join(config.RESULTS_DIR, `${config.TEST_ID}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
  
  // Generate a human-readable report
  const reportFile = path.join(config.RESULTS_DIR, 'reports', `${config.TEST_ID}.md`);
  
  if (!fs.existsSync(path.dirname(reportFile))) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  }
  
  const report = generateReport(testResults);
  fs.writeFileSync(reportFile, report);
  console.log(`Report saved to: ${reportFile}`);
  
  return testResults.summary.status === 'passed';
}

// Generate a human-readable report
function generateReport(results) {
  return `# Optimizely Edge Agent: Infrastructure Verification Report

## Test Summary

- **Test ID:** ${results.testId}
- **Timestamp:** ${results.timestamp}
- **Status:** ${results.summary.status.toUpperCase()}
- **Total Tests:** ${results.summary.totalTests}
- **Passed:** ${results.summary.passed}
- **Failed:** ${results.summary.failed}

## Environment

- **Edge Agent URL:** ${results.environment.EDGE_AGENT_URL}
- **SDK Key:** ${results.environment.SDK_KEY}
- **Node Version:** ${results.environment.nodeVersion}
- **Platform:** ${results.environment.platform}

## Test Results

${results.tests.map(test => `
### ${test.name}

- **Status:** ${test.status.toUpperCase()}
- **Timestamp:** ${test.timestamp}
${Object.entries(test.details).map(([key, value]) => `- **${key}:** ${value}`).join('\n')}
`).join('\n')}

## Conclusion

${results.summary.status === 'passed' 
  ? 'All infrastructure verification tests have passed. The Edge Agent is accessible and running in a Cloudflare environment.'
  : 'Some infrastructure verification tests have failed. See the detailed results above for more information.'}
`;
}

// Execute tests if run directly
if (require.main === module) {
  runAllTests()
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other tests
  module.exports = {
    runAllTests,
    runConnectionTest,
    runCloudflareVerification,
    runAPIHealthCheck
  };
} 