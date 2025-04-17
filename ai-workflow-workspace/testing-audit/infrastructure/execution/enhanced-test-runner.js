/**
 * @fileoverview Enhanced Test Runner
 * 
 * This module extends the IntegratedTestRunner with environment-aware capabilities.
 * It provides a unified interface for executing tests in both local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { IntegratedTestRunner } = require('../integrated-test-runner');
const { EnhancedTestExecutor } = require('../environment/enhanced-test-executor');

/**
 * Enhanced test runner with environment-awareness
 */
class EnhancedTestRunner extends IntegratedTestRunner {
  /**
   * Create a new EnhancedTestRunner
   * @param {string} testId - Test identifier
   * @param {object} config - Configuration options
   */
  constructor(testId, config = {}) {
    super(testId, config);
    
    this.executor = new EnhancedTestExecutor({
      enableRetryForFetch: true,
      logger: this.logger,
      evidence: this.evidence,
      ...config.executorOptions
    });
    
    this.testType = config.testType || 'default';
    this.enhancedContext = null;
  }
  
  /**
   * Initialize the test runner with enhanced context
   * @param {object} environment - Environment information
   * @returns {object} Initialization result
   */
  async initialize(environment = {}) {
    // Call parent initialize
    const initResult = await super.initialize(environment);
    
    // Add test type to context for type-specific configuration
    environment.testType = this.testType;
    
    // Initialize executor with enhanced environment
    this.enhancedContext = this.executor.initialize({
      ...environment,
      logger: this.logger,
      evidence: this.evidence
    });
    
    this.logger.info(`Enhanced test runner initialized for test: ${this.testId} (${this.enhancedContext.environmentName})`);
    
    return {
      ...initResult,
      enhancedContext: this.enhancedContext
    };
  }
  
  /**
   * Run a test with environment-aware execution
   * @param {Function} testFn - Test function
   * @param {object} environment - Environment information
   * @returns {object} Test results
   */
  async runTest(testFn, environment = {}) {
    if (!this.initialized) {
      await this.initialize(environment);
    }
    
    // Set test type if provided in environment
    if (environment.testType) {
      this.testType = environment.testType;
    }
    
    this.logger.info(`Running test ${this.testId} in ${this.enhancedContext.environmentName} environment`);
    
    // Start timing the test
    const startTime = Date.now();
    
    try {
      // Run the test with environment-aware context
      const result = await super.runTest(async (testContext) => {
        // Add test type to context
        testContext.testType = this.testType;
        
        // Run the test through the enhanced executor
        return this.executor.executeTest(testFn, testContext);
      }, environment);
      
      // Calculate test duration
      const duration = Date.now() - startTime;
      
      // Log test completion
      this.logger.info(`Test ${this.testId} completed in ${duration}ms with status: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
      
      if (!result.success && result.error) {
        this.logger.error(`Test failure: ${result.error.message}`);
      }
      
      // Add environment info to result
      return {
        ...result,
        environment: {
          type: this.enhancedContext.environmentType,
          name: this.enhancedContext.environmentName,
          isLive: this.enhancedContext.isLiveEnvironment
        },
        duration
      };
    } catch (error) {
      // Calculate test duration
      const duration = Date.now() - startTime;
      
      // Log test error
      this.logger.error(`Test ${this.testId} failed with error: ${error.message}`);
      
      // Rethrow with enhanced information
      throw new Error(`Environment-aware test execution failed: ${error.message}`);
    }
  }
  
  /**
   * Run the same test in both local and live environments for comparison
   * @param {Function} testFn - Test function
   * @param {object} options - Options for comparison
   * @returns {object} Comparison results
   */
  async runComparison(testFn, options = {}) {
    const results = {
      local: null,
      live: null,
      comparison: {
        status: 'pending',
        discrepancies: [],
        timestamp: new Date().toISOString()
      }
    };
    
    try {
      // Run in local environment (force local even if live is detected)
      this.logger.info(`Running comparison test ${this.testId} in local environment`);
      results.local = await this.runTest(testFn, { 
        ...options,
        environment: { mode: 'local' } 
      });
      
      // Run in live environment (force live)
      this.logger.info(`Running comparison test ${this.testId} in live environment`);
      results.live = await this.runTest(testFn, { 
        ...options,
        environment: { mode: 'live' } 
      });
      
      // Compare results
      results.comparison = this._compareResults(results.local, results.live, options);
      
      return results;
    } catch (error) {
      this.logger.error(`Comparison test failed: ${error.message}`);
      
      // Include partial results if available
      results.comparison.status = 'failed';
      results.comparison.error = error.message;
      
      return results;
    }
  }
  
  /**
   * Compare test results between environments
   * @param {object} localResult - Local environment result
   * @param {object} liveResult - Live environment result
   * @param {object} options - Comparison options
   * @returns {object} Comparison result
   * @private
   */
  _compareResults(localResult, liveResult, options = {}) {
    const { normalizeResponse } = require('../normalization/response-normalizer');
    const { findDifferences } = require('../assertions/conditional-assertions');
    
    // If either test failed, mark comparison as failed
    if (!localResult?.success || !liveResult?.success) {
      return {
        status: 'failed',
        discrepancies: [
          {
            type: 'test_success',
            local: localResult?.success,
            live: liveResult?.success,
            description: 'Test success status differs between environments'
          }
        ],
        timestamp: new Date().toISOString()
      };
    }
    
    // Compare normalized responses if available
    const discrepancies = [];
    
    // Compare main result data
    if (localResult.data && liveResult.data) {
      // Normalize both results for comparison
      const normalizedLocal = normalizeResponse(
        { body: localResult.data },
        { 
          normalizeBody: true,
          normalizeCacheHeaders: true,
          normalizeTimestamps: true,
          removeCloudflareHeaders: true
        }
      ).body;
      
      const normalizedLive = normalizeResponse(
        { body: liveResult.data },
        { 
          normalizeBody: true,
          normalizeCacheHeaders: true,
          normalizeTimestamps: true,
          removeCloudflareHeaders: true
        }
      ).body;
      
      // Find differences between normalized results
      const differences = findDifferences(normalizedLocal, normalizedLive, {
        ignoreExtraProperties: true
      });
      
      // Add each difference as a discrepancy
      if (differences.length > 0) {
        discrepancies.push({
          type: 'result_data',
          differences,
          description: 'Data differences found between environments after normalization'
        });
      }
    }
    
    // Compare execution time
    const timeDifference = Math.abs((liveResult.duration || 0) - (localResult.duration || 0));
    if (timeDifference > (options.maxTimeDifference || 1000)) {
      discrepancies.push({
        type: 'execution_time',
        local: localResult.duration,
        live: liveResult.duration,
        difference: timeDifference,
        description: 'Significant execution time difference between environments'
      });
    }
    
    return {
      status: discrepancies.length > 0 ? 'discrepancies_found' : 'identical',
      discrepancies,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  EnhancedTestRunner
}; 