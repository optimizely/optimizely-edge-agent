/**
 * @fileoverview Environment Configuration Factory
 * 
 * This module provides an environment-specific configuration factory
 * that creates appropriate configurations based on the detected environment.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

/**
 * Creates configuration based on the detected environment
 * @param {object} context - Test context with environment information
 * @returns {object} Environment-specific configuration
 */
function getEnvironmentConfig(context = {}) {
  const isLive = context?.isLiveEnvironment || false;
  
  return {
    // Timing settings
    timing: {
      requestTimeout: isLive ? 5000 : 1000,
      operationTimeout: isLive ? 10000 : 2000,
      retryDelay: isLive ? 500 : 100,
      maxRetries: isLive ? 3 : 1,
      waitInterval: isLive ? 200 : 50
    },
    
    // Network settings
    network: {
      rateLimit: isLive ? true : false,
      rateLimitDelay: isLive ? 500 : 0,
      concurrentRequests: isLive ? 1 : 5,
      captureHeaders: true,
      captureBodies: true
    },
    
    // Validation settings
    validation: {
      strictHeaderMatching: !isLive,
      strictBodyMatching: !isLive,
      allowLiveStatusVariance: isLive,
      normalizeResponses: true,
      removeCloudflareHeaders: true,
      normalizeCacheHeaders: true,
      normalizeTimestamps: true,
      ignoreExtraProperties: isLive
    },
    
    // Cache settings
    cache: {
      enableCacheWarming: isLive,
      ignoreCacheStatus: isLive,
      bypassCache: isLive ? false : true
    },
    
    // Storage settings
    storage: {
      waitForConsistency: isLive,
      consistencyTimeout: isLive ? 3000 : 500,
      consistencyMaxRetries: isLive ? 3 : 1
    },
    
    // Error handling settings
    errors: {
      looseErrorMatching: isLive,
      captureStackTraces: !isLive,
      detailedErrorReporting: !isLive
    }
  };
}

/**
 * Creates configuration for specific test types
 * @param {string} testType - Type of test
 * @param {object} context - Test context
 * @returns {object} Test-specific configuration
 */
function getTestTypeConfig(testType, context = {}) {
  const baseConfig = getEnvironmentConfig(context);
  const isLive = context?.isLiveEnvironment || false;
  
  // Extend with test-type specific configurations
  switch (testType) {
    case 'kv-storage':
      return {
        ...baseConfig,
        storage: {
          ...baseConfig.storage,
          consistencyTimeout: isLive ? 5000 : 500,  // Longer for KV tests
          consistencyMaxRetries: isLive ? 5 : 1     // More retries for KV tests
        },
        validation: {
          ...baseConfig.validation,
          ignoreExtraProperties: true               // KV may add extra metadata
        }
      };
      
    case 'decision-api':
      return {
        ...baseConfig,
        cache: {
          ...baseConfig.cache,
          enableCacheWarming: true,
          bypassCache: false                        // Need to test caching behavior
        },
        validation: {
          ...baseConfig.validation,
          normalizeTimestamps: true,                // Decision API includes timestamps
          ignoreExtraProperties: isLive             // Allow extra properties in live
        }
      };
      
    case 'infrastructure':
      return {
        ...baseConfig,
        validation: {
          ...baseConfig.validation,
          strictHeaderMatching: false,              // Headers vary significantly
          removeCloudflareHeaders: true             // Remove CF headers for comparison
        },
        timing: {
          ...baseConfig.timing,
          requestTimeout: isLive ? 10000 : 2000     // Longer timeouts for infra tests
        }
      };
      
    case 'parameter-handling':
      return {
        ...baseConfig,
        validation: {
          ...baseConfig.validation,
          strictBodyMatching: false,                // Parameter handling may vary
          normalizeResponses: true                  // Normalize for comparison
        }
      };
      
    case 'feature-parity':
      return {
        ...baseConfig,
        validation: {
          ...baseConfig.validation,
          strictBodyMatching: true,                 // Must match exactly for parity
          ignoreExtraProperties: false              // Don't ignore any properties
        },
        cache: {
          ...baseConfig.cache,
          bypassCache: true                         // Always bypass cache for parity tests
        }
      };
      
    default:
      return baseConfig;
  }
}

/**
 * Gets environment-specific override values for test parameters
 * @param {string} parameterName - The parameter name
 * @param {object} context - Test context
 * @returns {any} The environment-specific value or undefined
 */
function getEnvironmentSpecificValue(parameterName, context = {}) {
  const isLive = context?.isLiveEnvironment || false;
  
  // Common parameters that need environment-specific overrides
  const overrides = {
    // Timeouts
    'requestTimeout': isLive ? 5000 : 1000,
    'operationTimeout': isLive ? 10000 : 2000,
    'consistency.timeout': isLive ? 3000 : 500,
    
    // Cache-related
    'cache.ttl': isLive ? 300 : 60,
    'cache.behavior': isLive ? 'honor' : 'bypass',
    
    // Network-related
    'maxConcurrent': isLive ? 1 : 5,
    'retryCount': isLive ? 3 : 1,
    
    // Headers
    'headers.required': isLive ? ['content-type'] : ['content-type', 'content-length'],
    'headers.normalized': isLive ? true : false
  };
  
  return overrides[parameterName];
}

module.exports = {
  getEnvironmentConfig,
  getTestTypeConfig,
  getEnvironmentSpecificValue
}; 