/**
 * @fileoverview Verified Test Runner
 * 
 * This module provides a higher-level abstraction that combines the IntegratedTestRunner
 * with VerificationHooks to create a unified interface for running verified tests.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { IntegratedTestRunner } = require('../integrated-test-runner');
const { VerificationHooks, VERIFICATION_STATUS, VERIFICATION_TYPES } = require('./verification-hooks');

/**
 * Default configuration for the verified test runner
 */
const DEFAULT_CONFIG = {
  loggerConfig: {},
  evidenceConfig: {},
  wrapperConfig: {},
  verificationConfig: {
    verifyIntegrity: true,
    verifyCloudflare: true,
    requireTimestampUTC: true,
    requireSignatures: true,
    evidenceThreshold: 3,
    cloudflareEvidenceRequired: true,
    validateExecutionChain: true
  },
  enforcePassing: false // If true, test will be marked as failed if verification fails
};

/**
 * Class to run tests with integrated verification
 */
class VerifiedTestRunner {
  /**
   * Create a new VerifiedTestRunner instance
   * @param {string} testId - The identifier for the test
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    this.testId = testId;
    
    // Create deep merged configuration
    this.config = { 
      ...DEFAULT_CONFIG,
      ...config,
      loggerConfig: { ...DEFAULT_CONFIG.loggerConfig, ...config.loggerConfig },
      evidenceConfig: { ...DEFAULT_CONFIG.evidenceConfig, ...config.evidenceConfig },
      wrapperConfig: { ...DEFAULT_CONFIG.wrapperConfig, ...config.wrapperConfig },
      verificationConfig: { ...DEFAULT_CONFIG.verificationConfig, ...config.verificationConfig }
    };
    
    // Create integrated test runner
    this.runner = new IntegratedTestRunner(testId, {
      loggerConfig: this.config.loggerConfig,
      evidenceConfig: this.config.evidenceConfig,
      wrapperConfig: this.config.wrapperConfig
    });
    
    // Verification context
    this.verification = null;
    this.verificationResult = null;
  }

  /**
   * Initialize the verified test runner
   * @param {object} environment - Environment information (optional)
   */
  async initialize(environment = {}) {
    return await this.runner.initialize(environment);
  }

  /**
   * Run a test with integrated verification
   * @param {Function} testFn - The test function to run
   * @param {object} environment - Environment information (optional)
   * @returns {object} The test results with verification information
   */
  async runTest(testFn, environment = {}) {
    if (!testFn || typeof testFn !== 'function') {
      throw new Error('Test function is required');
    }
    
    // Initialize if needed
    if (!this.runner.initialized) {
      await this.initialize(environment);
    }
    
    // Run the test with verification hooks
    const result = await this.runner.runTest(async (test) => {
      // Create verification hooks with test context
      this.verification = new VerificationHooks({
        logger: test.logger,
        evidence: test.evidence
      }, this.config.verificationConfig);
      
      // Pre-execution verification
      await this.verification.preExecution();
      
      // Wrap the original test function with verification
      let testResult;
      let error = null;
      
      try {
        // Run the user's test function with enhanced context
        testResult = await testFn({
          ...test,
          verification: this.verification
        });
      } catch (err) {
        error = err;
      }
      
      // Post-execution verification 
      this.verificationResult = await this.verification.postExecution();
      
      // If error occurred, rethrow it after verification
      if (error) {
        throw error;
      }
      
      // Return combined result
      return {
        ...testResult,
        verificationStatus: this.verificationResult.status,
        verifications: this.verificationResult.verifications
      };
    }, environment);
    
    // Mark test as failed if verification failed and enforcement is enabled
    if (this.config.enforcePassing && 
        this.verificationResult && 
        (this.verificationResult.status === VERIFICATION_STATUS.FAIL || 
         this.verificationResult.status === VERIFICATION_STATUS.ERROR)) {
      result.success = false;
      result.verificationFailure = true;
    }
    
    return {
      ...result,
      verificationStatus: this.verificationResult?.status || VERIFICATION_STATUS.ERROR,
      verifications: this.verificationResult?.verifications || {}
    };
  }

  /**
   * Run a simple test with default verification
   * @param {string} name - Test name
   * @param {Function} testFn - Test function that receives the test context
   * @param {object} environment - Environment information
   * @returns {object} Test result
   */
  static async runSimpleTest(name, testFn, environment = {}) {
    const runner = new VerifiedTestRunner(name);
    await runner.initialize(environment);
    
    return await runner.runTest(async (context) => {
      const { step, assert, logger, verification } = context;
      
      // Start main test step
      const mainStep = step.start('main', `Running test: ${name}`);
      
      try {
        // Run the provided function with context
        const result = await testFn(context);
        
        // Complete test step
        mainStep.pass('Test completed successfully');
        
        return {
          name,
          success: true,
          result
        };
      } catch (err) {
        // Log the error and fail the step
        logger.error(`Test failed: ${err.message}`, err);
        mainStep.fail(`Test failed: ${err.message}`);
        
        return {
          name,
          success: false,
          error: err.message
        };
      }
    }, environment);
  }
}

module.exports = {
  VerifiedTestRunner,
  VERIFICATION_STATUS,
  VERIFICATION_TYPES
}; 