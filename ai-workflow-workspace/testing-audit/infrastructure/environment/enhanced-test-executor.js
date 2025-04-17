/**
 * @fileoverview Enhanced Test Executor
 * 
 * This module provides an environment-aware test execution framework that
 * addresses the documented discrepancies between local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { detectEnvironment } = require('./environment-detector');
const { normalizeResponse, normalizeUrl } = require('../normalization/response-normalizer');
const { retryOperation, waitForCondition } = require('../operations/retry-operations');
const { getEnvironmentConfig, getTestTypeConfig } = require('./environment-config');
const { 
  assertResponseStatus, 
  assertResponseHeaders, 
  assertResponseBody 
} = require('../assertions/conditional-assertions');

/**
 * Enhanced Test Executor that wraps test execution with environment-aware capabilities
 */
class EnhancedTestExecutor {
  /**
   * Create a new EnhancedTestExecutor
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.context = null;
    this.config = null;
    this.logger = options.logger || console;
    this.evidence = options.evidence || null;
  }
  
  /**
   * Initialize the executor with test context
   * @param {object} context - Base test context
   * @returns {object} Enhanced context
   */
  initialize(context = {}) {
    // Detect environment and enhance context
    this.context = detectEnvironment(context);
    
    // Get appropriate configuration
    const testType = context.testType || 'default';
    this.config = getTestTypeConfig(testType, this.context);
    
    // Store logger and evidence if provided in context
    if (context.logger) {
      this.logger = context.logger;
    }
    
    if (context.evidence) {
      this.evidence = context.evidence;
    }
    
    // Add essential utilities to context
    this.context.utils = this._createUtilsObject();
    
    // Log environment detection
    this._logEnvironmentInfo();
    
    return this.context;
  }
  
  /**
   * Create the utilities object for test context
   * @returns {object} Utilities object
   * @private
   */
  _createUtilsObject() {
    return {
      // Environment utilities
      environment: {
        isLive: this.context.isLiveEnvironment,
        config: this.config,
        type: this.context.environmentType,
        name: this.context.environmentName
      },
      
      // Assertion utilities
      assert: {
        responseStatus: (response, expectedStatus, options = {}) => 
          assertResponseStatus(response, expectedStatus, { 
            ...options, 
            context: this.context,
            allowLiveStatusVariance: this.config.validation.allowLiveStatusVariance
          }),
        responseHeaders: (response, expectedHeaders, options = {}) => 
          assertResponseHeaders(response, expectedHeaders, { 
            ...options, 
            context: this.context,
            strictHeaderValues: this.config.validation.strictHeaderMatching
          }),
        responseBody: (response, expectedBody, options = {}) => 
          assertResponseBody(response, expectedBody, { 
            ...options, 
            context: this.context,
            normalizeBeforeComparison: this.config.validation.normalizeResponses,
            looseLiveComparison: !this.config.validation.strictBodyMatching,
            ignoreExtraProperties: this.config.validation.ignoreExtraProperties
          })
      },
      
      // Normalization utilities
      normalize: {
        response: (response, options = {}) => 
          normalizeResponse(response, { 
            ...options, 
            context: this.context,
            removeCloudflareHeaders: this.config.validation.removeCloudflareHeaders,
            normalizeCacheHeaders: this.config.validation.normalizeCacheHeaders,
            normalizeTimestamps: this.config.validation.normalizeTimestamps
          }),
        url: (url, options = {}) =>
          normalizeUrl(url, {
            ...options,
            context: this.context,
            sortQueryParameters: true,
            normalizeHostCase: true
          })
      },
      
      // Retry/wait utilities
      retry: {
        operation: (operation, validation, options = {}) => 
          retryOperation(operation, validation, { 
            ...options, 
            context: this.context,
            maxRetries: this.config.timing.maxRetries,
            delayMs: this.config.timing.retryDelay,
            timeout: this.config.timing.operationTimeout
          }),
        waitFor: (condition, options = {}) => 
          waitForCondition(condition, { 
            ...options, 
            context: this.context,
            timeoutMs: this.config.timing.operationTimeout,
            intervalMs: this.config.timing.waitInterval
          })
      },
      
      // Network utilities with environment awareness
      fetch: async (url, options = {}) => {
        const fetchFn = async () => {
          // Add cache control if bypass requested
          if (this.config.cache.bypassCache) {
            options.headers = options.headers || {};
            options.headers['Cache-Control'] = 'no-cache';
            options.headers['Pragma'] = 'no-cache';
          }
          
          // Apply rate limiting if enabled
          if (this.context.isLiveEnvironment && 
              this.config.network.rateLimit && 
              this.config.network.rateLimitDelay > 0) {
            await new Promise(resolve => 
              setTimeout(resolve, this.config.network.rateLimitDelay)
            );
          }
          
          // Log request if evidence collection is enabled
          if (this.evidence) {
            this.evidence.recordNetworkRequest({
              url,
              method: options.method || 'GET',
              headers: options.headers,
              body: options.body,
              timestamp: new Date().toISOString(),
              environment: this.context.environmentName
            });
          }
          
          // Create request timeout if specified
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.config.timing.requestTimeout);
          
          // Perform the fetch with timeout
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            
            // Capture response body for evidence
            let responseData;
            let responseText;
            
            if (this.evidence && this.config.network.captureBodies) {
              try {
                responseText = await response.clone().text();
                try {
                  responseData = JSON.parse(responseText);
                } catch (e) {
                  responseData = responseText;
                }
              } catch (e) {
                responseData = { error: 'Could not capture response body: ' + e.message };
              }
            }
            
            // Log response if evidence collection is enabled
            if (this.evidence) {
              this.evidence.recordNetworkResponse({
                url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseData,
                timestamp: new Date().toISOString(),
                environment: this.context.environmentName
              });
            }
            
            return response;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        
        // Use retry logic if enabled
        if (this.options.enableRetryForFetch) {
          return retryOperation(fetchFn, null, {
            maxRetries: this.config.timing.maxRetries,
            delayMs: this.config.timing.retryDelay,
            context: this.context,
            description: `fetch ${url}`
          });
        }
        
        return fetchFn();
      }
    };
  }
  
  /**
   * Log environment information
   * @private
   */
  _logEnvironmentInfo() {
    this.logger.info(`Environment detected: ${this.context.environmentName} (${this.context.isLiveEnvironment ? 'Live' : 'Local'})`);
    this.logger.info(`Test type: ${this.context.testType || 'default'}`);
    
    // Record environment information in evidence if available
    if (this.evidence) {
      this.evidence.recordEnvironmentInfo({
        type: this.context.environmentType,
        name: this.context.environmentName,
        isLive: this.context.isLiveEnvironment,
        testType: this.context.testType || 'default',
        baseUrl: this.context.baseUrl,
        timestamp: new Date().toISOString(),
        config: this.config
      });
    }
  }
  
  /**
   * Execute a test function with environment-aware context
   * @param {Function} testFn - Test function to execute
   * @param {object} baseContext - Base test context
   * @returns {Promise<any>} Test result
   */
  async executeTest(testFn, baseContext = {}) {
    if (!testFn || typeof testFn !== 'function') {
      throw new Error('Test function is required');
    }
    
    // Initialize context if not already done
    if (!this.context) {
      this.initialize(baseContext);
    }
    
    // Record test execution start if evidence collection is enabled
    if (this.evidence) {
      this.evidence.recordTestStart({
        testId: baseContext.testId || 'unknown',
        timestamp: new Date().toISOString(),
        environment: this.context.environmentName
      });
    }
    
    try {
      // Execute the test with enhanced context
      const result = await testFn(this.context);
      
      // Record test execution completion if evidence collection is enabled
      if (this.evidence) {
        this.evidence.recordTestComplete({
          testId: baseContext.testId || 'unknown',
          status: 'completed',
          timestamp: new Date().toISOString(),
          environment: this.context.environmentName,
          result
        });
      }
      
      return result;
    } catch (error) {
      // Record test execution failure if evidence collection is enabled
      if (this.evidence) {
        this.evidence.recordTestFailure({
          testId: baseContext.testId || 'unknown',
          status: 'failed',
          timestamp: new Date().toISOString(),
          environment: this.context.environmentName,
          error: {
            message: error.message,
            stack: this.config.errors.captureStackTraces ? error.stack : undefined
          }
        });
      }
      
      // Re-throw the error
      throw error;
    }
  }
}

module.exports = {
  EnhancedTestExecutor
}; 