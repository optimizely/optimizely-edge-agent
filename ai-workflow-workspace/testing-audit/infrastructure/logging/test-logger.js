/**
 * @fileoverview Test script for the structured logging framework
 * 
 * This script tests the functionality of the logging framework, including:
 * - Basic logging
 * - HTTP request/response logging
 * - Test step logging
 * - Assertion logging
 * - Error logging
 * - Integrity verification
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { TestLogger } = require('./logger');
const fs = require('fs');
const path = require('path');

/**
 * Run the test script
 */
async function runTest() {
  console.log('Testing logging framework...');
  
  // Create a test logger instance
  const logger = new TestLogger('logger-test', {
    enableConsoleOutput: true
  });
  
  try {
    // Initialize the logger
    await logger.initialize();
    console.log(`Log file created at: ${logger.logFilePath}`);
    
    // Log some basic events
    logger.log('INFO', 'INFO', 'This is a basic info message');
    logger.log('DEBUG', 'DEBUG', 'This is a debug message');
    logger.log('WARNING', 'WARNING', 'This is a warning message');
    
    // Log a test step
    logger.step('test-component', 'PASS', 'Initialize test environment');
    
    // Log an HTTP request
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'TestLogger/1.0'
    };
    
    logger.httpRequest('POST', 'https://api.optimizely.com/v2/experiments', requestHeaders, 
      JSON.stringify({ name: 'Test Experiment', variations: [{ name: 'Control' }, { name: 'Variation' }] }));
    
    // Log an HTTP response
    const responseHeaders = {
      'Content-Type': 'application/json',
      'cf-ray': '8168c5df8c5d3183-DFW'
    };
    
    const responseBody = {
      id: '12345',
      name: 'Test Experiment',
      variations: [
        { id: 'var1', name: 'Control' },
        { id: 'var2', name: 'Variation' }
      ]
    };
    
    logger.httpResponse(200, responseHeaders, responseBody, 123);
    
    // Log some assertions
    logger.assertion('variation-test', 'PASS', 'Variation name should match expected value', 
      'Variation', responseBody.variations[1].name);
    
    logger.assertion('count-test', 'PASS', 'Should have 2 variations', 
      2, responseBody.variations.length);
    
    logger.assertion('failing-test', 'FAIL', 'This assertion will fail', 
      'expected', 'actual');
    
    // Log an error
    try {
      throw new Error('This is a test error');
    } catch (err) {
      logger.error('An error occurred during testing', err);
    }
    
    // Log more steps
    logger.step('test-component', 'PASS', 'Execute variation API calls');
    logger.step('test-component', 'SKIPPED', 'Execute feature flag tests');
    logger.step('test-component', 'FAIL', 'Validate response structure');
    
    // Finalize the logger
    await logger.finalize('PASS', 'Test completed with some failures');
    
    // Verify the log integrity
    console.log('Verifying log integrity...');
    const verificationResult = await TestLogger.verifyLogIntegrity(logger.logFilePath);
    
    console.log('Verification result:', JSON.stringify(verificationResult, null, 2));
    
    if (verificationResult.verified) {
      console.log('Log integrity verified successfully!');
    } else {
      console.error('Log integrity verification failed!');
      console.error('Errors:', verificationResult.errors);
    }
    
    // Print the log file location
    console.log(`Log file: ${logger.logFilePath}`);
    
    // Print manifest location
    const dateStr = new Date().toISOString().split('T')[0];
    const manifestPath = path.join(
      logger.config.basePath,
      'manifest',
      `${dateStr}-manifest.json`
    );
    
    console.log(`Manifest file: ${manifestPath}`);
    
    // Return success
    return {
      success: true,
      logFilePath: logger.logFilePath,
      manifestPath
    };
    
  } catch (err) {
    // Log the error
    if (logger.initialized) {
      logger.error('Test script failed', err);
      await logger.finalize('ERROR', 'Test execution failed with error');
    }
    
    console.error('Test script failed:', err);
    
    // Return failure
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
        console.log('Test completed successfully!');
      } else {
        console.error('Test failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error in test:', err);
      process.exit(1);
    });
}

module.exports = { runTest }; 