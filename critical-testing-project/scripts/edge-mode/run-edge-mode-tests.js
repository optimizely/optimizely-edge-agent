/**
 * Edge Mode Test Runner
 * 
 * Executes Edge Mode tests and provides comprehensive reporting.
 * This runner can execute both basic and comprehensive Edge Mode tests.
 */

const path = require('path');
const testUtils = require('../../utils/test-utils');

// Load environment variables
testUtils.loadEnv();

// Import test modules
const basicTests = require('./edge-mode-basic-test');

// Test runner configuration
const config = {
  testTypes: {
    'basic': {
      name: 'Basic Edge Mode Tests',
      description: 'Core Edge Mode functionality verification',
      runner: basicTests.runBasicEdgeModeTests
    }
    // Note: comprehensive tests would be added here when fully implemented
  },
  
  defaultTestType: 'basic',
  
  // Environment validation
  requiredEnvVars: [
    'EDGE_AGENT_URL',
    'SDK_KEY'
  ]
};

/**
 * Validates environment setup for Edge Mode testing
 */
function validateEnvironment() {
  console.log('Validating environment for Edge Mode testing...');
  
  const missing = config.requiredEnvVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease set these variables and try again.');
    console.error('See scripts/edge-mode/README.md for setup instructions.');
    return false;
  }
  
  // Validate URL format
  const edgeAgentUrl = process.env.EDGE_AGENT_URL;
  try {
    new URL(edgeAgentUrl);
  } catch (error) {
    console.error(`Invalid EDGE_AGENT_URL format: ${edgeAgentUrl}`);
    return false;
  }
  
  console.log('Environment validation passed ✓');
  return true;
}

/**
 * Displays environment information
 */
function displayEnvironmentInfo() {
  console.log('\n=== Edge Mode Test Environment ===');
  console.log(`Edge Agent URL: ${process.env.EDGE_AGENT_URL}`);
  console.log(`SDK Key: ${process.env.SDK_KEY?.substring(0, 8)}...`);
  console.log(`Edge Mode Flag: ${process.env.EDGE_MODE_FLAG || 'not specified'}`);
  console.log(`Test Flag Key: ${process.env.TEST_FLAG_KEY || 'not specified'}`);
}

/**
 * Displays usage information
 */
function displayUsage() {
  console.log('Usage: node run-edge-mode-tests.js [test-type]');
  console.log('');
  console.log('Available test types:');
  Object.entries(config.testTypes).forEach(([key, testType]) => {
    console.log(`  ${key}: ${testType.description}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node run-edge-mode-tests.js basic');
  console.log('  node run-edge-mode-tests.js');
  console.log('');
  console.log('Environment Variables:');
  console.log('  EDGE_AGENT_URL - URL of deployed Edge Agent (required)');
  console.log('  SDK_KEY - Optimizely SDK key (required)');
  console.log('  EDGE_MODE_FLAG - Specific flag key for Edge Mode testing (optional)');
  console.log('');
  console.log('For setup instructions, see: scripts/edge-mode/README.md');
}

/**
 * Main test execution function
 */
async function runEdgeModeTests(testType = config.defaultTestType) {
  console.log('🚀 Starting Edge Mode Tests');
  console.log('================================');
  
  // Validate environment
  if (!validateEnvironment()) {
    return {
      success: false,
      error: 'Environment validation failed'
    };
  }
  
  // Display environment info
  displayEnvironmentInfo();
  
  // Validate test type
  if (!config.testTypes[testType]) {
    console.error(`\nUnknown test type: ${testType}`);
    console.error('Available test types:', Object.keys(config.testTypes).join(', '));
    return {
      success: false,
      error: `Unknown test type: ${testType}`
    };
  }
  
  const selectedTest = config.testTypes[testType];
  
  console.log(`\n=== Running ${selectedTest.name} ===`);
  console.log(selectedTest.description);
  console.log('');
  
  try {
    const startTime = Date.now();
    
    // Execute the selected test suite
    const result = await selectedTest.runner();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n=== Test Execution Complete ===');
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Success: ${result.success ? '✓' : '✗'}`);
    
    if (result.results && result.results.summary) {
      const summary = result.results.summary;
      console.log(`Tests: ${summary.totalTests} total, ${summary.passedTests} passed, ${summary.failedTests} failed`);
      console.log(`Success Rate: ${summary.successRate}`);
    }
    
    if (!result.success) {
      console.log('\n=== Troubleshooting ===');
      console.log('If tests are failing:');
      console.log('1. Verify your Edge Agent is deployed and accessible');
      console.log('2. Check that your Optimizely project has feature flags with cdnVariationSettings');
      console.log('3. Ensure the SDK key has access to the configured flags');
      console.log('4. Review the test output above for specific failure details');
      console.log('5. See scripts/edge-mode/README.md for detailed setup instructions');
    }
    
    return result;
    
  } catch (error) {
    console.error('\nFatal error during test execution:', error.message);
    console.error('\nStack trace:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  // Check for help flags
  if (args.includes('--help') || args.includes('-h')) {
    displayUsage();
    process.exit(0);
  }
  
  // Get test type from first argument
  const testType = args[0] || config.defaultTestType;
  
  return { testType };
}

// Main execution
if (require.main === module) {
  const { testType } = parseArguments();
  
  runEdgeModeTests(testType)
    .then(result => {
      if (result.success) {
        console.log('\n🎉 All Edge Mode tests completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Edge Mode tests failed.');
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\nUnhandled error:', error);
      process.exit(1);
    });
}

// Export for use in other modules
module.exports = {
  runEdgeModeTests,
  config,
  validateEnvironment,
  displayEnvironmentInfo
};