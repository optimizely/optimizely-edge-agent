---
type: documentation
description: "Comprehensive test execution plan incorporating environment-specific handling for all documented discrepancies"
lastUpdated: "2023-11-01"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Comprehensive Test Execution Plan

This document outlines the execution plan for running tests with environment-specific handling for all documented discrepancies. It provides a systematic approach to address the differences between local and live Cloudflare Workers environments.

## 1. Overview

Based on the discrepancy analysis, this execution plan focuses on implementing five core capabilities:

1. **Environment Detection & Context Enhancement**
2. **Response Normalization Framework**
3. **Environment-Conditional Assertions**
4. **Wait/Retry Logic for Data Operations**
5. **Environment-Specific Configurations**

These capabilities will be implemented as a unified test execution framework that extends the existing infrastructure.

## 2. Implementation Strategy

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────┐
│       EnhancedTestExecutor          │
├─────────────────────────────────────┤
│ ┌─────────────┐    ┌──────────────┐ │
│ │ Environment │    │ Response     │ │
│ │ Detection   │    │ Normalization│ │
│ └─────────────┘    └──────────────┘ │
│ ┌─────────────┐    ┌──────────────┐ │
│ │ Conditional │    │ Retry/Wait   │ │
│ │ Assertions  │    │ Logic        │ │
│ └─────────────┘    └──────────────┘ │
│ ┌───────────────────────────────────┤
│ │    Environment Config Factory     │ │
│ └───────────────────────────────────┤
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│    IntegratedTestRunner (existing)  │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐ ┌───────────────────────┐
│  LocalTestRunner        │ │ LiveTestRunner        │
└─────────────────────────┘ └───────────────────────┘
```

### 2.2 Primary Components

1. **EnhancedTestExecutor**: A new module that wraps the test execution with environment-aware capabilities.
2. **EnvironmentDetection**: Logic to reliably detect the current environment.
3. **ResponseNormalizer**: Standardizes responses for comparison across environments.
4. **ConditionalAssertions**: Environment-specific assertions.
5. **RetryOperations**: Handles eventual consistency in live environment.
6. **EnvironmentConfigFactory**: Provides environment-specific configurations.

## 3. Implementation Plan

### 3.1 Environment Detection & Context Enhancement

**File:** `ai-workflow-workspace/testing-audit/infrastructure/environment/environment-detector.js`

```javascript
/**
 * Detects the current execution environment
 * @param {object} context - Test context
 * @returns {object} Enhanced context with environment information
 */
function detectEnvironment(context = {}) {
  // Check if environment is explicitly set
  if (context.environment?.mode === 'live') {
    return enhanceContext(context, true);
  }
  
  // Check URL patterns
  const baseUrl = context.baseUrl || '';
  const isLive = baseUrl.includes('edge-agent.optimizely.com') || 
                !!process.env.CLOUDFLARE_WORKER_URL;
  
  return enhanceContext(context, isLive);
}

/**
 * Enhances the test context with environment-specific information
 * @param {object} context - Original test context
 * @param {boolean} isLive - Whether the environment is live
 * @returns {object} Enhanced context
 */
function enhanceContext(context, isLive) {
  return {
    ...context,
    isLiveEnvironment: isLive,
    environmentType: isLive ? 'live' : 'local',
    environmentName: isLive ? 'Cloudflare Workers' : 'Wrangler Local',
    // Additional environment-specific context
    timing: {
      requestTimeout: isLive ? 5000 : 1000,
      operationTimeout: isLive ? 10000 : 2000,
      retryDelay: isLive ? 500 : 100
    }
  };
}

module.exports = {
  detectEnvironment,
  enhanceContext
};
```

### 3.2 Response Normalization Framework

**File:** `ai-workflow-workspace/testing-audit/infrastructure/normalization/response-normalizer.js`

```javascript
/**
 * Normalizes responses for comparison between environments
 * @param {object} response - Response object to normalize
 * @param {object} options - Normalization options
 * @returns {object} Normalized response
 */
function normalizeResponse(response, options = {}) {
  if (!response) return response;
  
  const normalized = { ...response };
  const context = options.context || {};
  
  // Normalize headers
  if (normalized.headers) {
    normalized.headers = normalizeHeaders(normalized.headers, options);
  }
  
  // Normalize body
  if (normalized.body) {
    normalized.body = normalizeBody(normalized.body, options);
  }
  
  // Normalize status codes for known variations
  if (options.normalizeStatusCodes && context.isLiveEnvironment) {
    normalized.status = normalizeStatusCode(normalized.status, options);
  }
  
  return normalized;
}

/**
 * Normalizes response headers
 * @param {object} headers - Headers to normalize
 * @param {object} options - Normalization options
 * @returns {object} Normalized headers
 */
function normalizeHeaders(headers, options = {}) {
  const normalizedHeaders = { ...headers };
  
  // Remove Cloudflare-specific headers if requested
  if (options.removeCloudflareHeaders) {
    const cfHeaders = [
      'cf-ray', 'cf-cache-status', 'cf-worker', 'cf-edge-cache',
      'cf-request-id', 'cf-connecting-ip', 'cf-ipcountry'
    ];
    
    for (const header of cfHeaders) {
      delete normalizedHeaders[header];
    }
  }
  
  // Normalize cache-control headers if requested
  if (options.normalizeCacheHeaders) {
    // Normalize cache control headers
    if (normalizedHeaders['cache-control']) {
      // Simplified cache-control normalization logic
      normalizedHeaders['cache-control'] = normalizedHeaders['cache-control']
        .replace(/max-age=\d+/, 'max-age=XXX')
        .replace(/s-maxage=\d+/, 's-maxage=XXX');
    }
  }
  
  return normalizedHeaders;
}

/**
 * Normalizes response body
 * @param {any} body - Body to normalize
 * @param {object} options - Normalization options
 * @returns {any} Normalized body
 */
function normalizeBody(body, options = {}) {
  // Skip if no body or normalization not requested
  if (!body || !options.normalizeBody) {
    return body;
  }
  
  let normalizedBody = body;
  
  // Parse JSON strings if needed
  if (typeof body === 'string' && options.parseJsonBody) {
    try {
      normalizedBody = JSON.parse(body);
    } catch (e) {
      // Not JSON, keep as string
      return body;
    }
  }
  
  // If object, normalize properties
  if (typeof normalizedBody === 'object' && normalizedBody !== null) {
    // Handle arrays
    if (Array.isArray(normalizedBody)) {
      return normalizedBody.map(item => normalizeBody(item, options));
    }
    
    // Handle objects
    const result = { ...normalizedBody };
    
    // Remove timestamp fields if requested
    if (options.normalizeTimestamps) {
      const timestampFields = ['timestamp', 'created_at', 'updated_at', 'expires_at'];
      for (const field of timestampFields) {
        if (field in result) {
          result[field] = 'NORMALIZED_TIMESTAMP';
        }
      }
    }
    
    // Normalize nested objects
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = normalizeBody(value, options);
      }
    }
    
    return result;
  }
  
  return normalizedBody;
}

/**
 * Normalizes status codes for known variations
 * @param {number} statusCode - Original status code
 * @param {object} options - Normalization options
 * @returns {number} Normalized status code
 */
function normalizeStatusCode(statusCode, options = {}) {
  const statusMappings = options.statusMappings || {};
  
  // Apply custom mappings if provided
  if (statusCode in statusMappings) {
    return statusMappings[statusCode];
  }
  
  // Default mappings for common variations in live environment
  if (options.context?.isLiveEnvironment) {
    // Handle specific cases
    switch (statusCode) {
      case 520: return 500; // Cloudflare unknown error -> Internal server error
      case 524: return 504; // Cloudflare timeout -> Gateway timeout
      case 530: return 503; // Origin unavailable -> Service unavailable
      default: return statusCode;
    }
  }
  
  return statusCode;
}

module.exports = {
  normalizeResponse,
  normalizeHeaders,
  normalizeBody,
  normalizeStatusCode
};
```

### 3.3 Environment-Conditional Assertions

**File:** `ai-workflow-workspace/testing-audit/infrastructure/assertions/conditional-assertions.js`

```javascript
/**
 * Provides environment-aware assertion utilities
 */

/**
 * Asserts response status code with environment-specific rules
 * @param {object} response - Response object
 * @param {number|array} expectedStatus - Expected status code(s)
 * @param {object} options - Assertion options
 * @throws {Error} If assertion fails
 */
function assertResponseStatus(response, expectedStatus, options = {}) {
  const context = options.context || {};
  const actualStatus = response?.status;
  
  // Handle array of expected statuses
  if (Array.isArray(expectedStatus)) {
    if (expectedStatus.includes(actualStatus)) {
      return true;
    }
    
    throw new Error(`Expected status to be one of ${expectedStatus.join(', ')}, but got ${actualStatus}`);
  }
  
  // Live environment with tolerance for certain variations
  if (context.isLiveEnvironment && options.allowLiveStatusVariance) {
    // Define acceptable variations for common status codes
    const acceptableVariations = {
      200: [200, 304], // OK or Not Modified
      201: [201, 200], // Created or OK
      204: [204, 200], // No Content or OK
      404: [404, 403], // Not Found or Forbidden
      500: [500, 502, 503, 520, 521, 522, 524] // Various server errors
    };
    
    if (acceptableVariations[expectedStatus]?.includes(actualStatus)) {
      return true;
    }
  }
  
  // Strict assertion
  if (actualStatus !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus} but got ${actualStatus}`);
  }
  
  return true;
}

/**
 * Asserts response contains expected headers with environment-specific rules
 * @param {object} response - Response object
 * @param {array|object} expectedHeaders - Expected headers
 * @param {object} options - Assertion options
 * @throws {Error} If assertion fails
 */
function assertResponseHeaders(response, expectedHeaders, options = {}) {
  const context = options.context || {};
  const headers = response?.headers || {};
  
  // Handle array of header names
  if (Array.isArray(expectedHeaders)) {
    for (const headerName of expectedHeaders) {
      if (!(headerName.toLowerCase() in headers)) {
        // Skip Cloudflare-specific headers in local environment
        if (!context.isLiveEnvironment && 
            headerName.toLowerCase().startsWith('cf-')) {
          continue;
        }
        
        throw new Error(`Expected header "${headerName}" not found in response`);
      }
    }
    return true;
  }
  
  // Handle object of header name/value pairs
  if (typeof expectedHeaders === 'object' && expectedHeaders !== null) {
    for (const [name, value] of Object.entries(expectedHeaders)) {
      const headerName = name.toLowerCase();
      
      // Skip Cloudflare-specific headers in local environment
      if (!context.isLiveEnvironment && 
          headerName.startsWith('cf-')) {
        continue;
      }
      
      if (!(headerName in headers)) {
        throw new Error(`Expected header "${name}" not found in response`);
      }
      
      // Check value if strict matching requested
      if (options.strictHeaderValues && headers[headerName] !== value) {
        throw new Error(`Expected header "${name}" to be "${value}", but got "${headers[headerName]}"`);
      }
    }
    return true;
  }
  
  throw new Error('Expected headers must be an array or object');
}

/**
 * Asserts response body matches expected value with environment-specific rules
 * @param {object} response - Response object
 * @param {any} expectedBody - Expected body
 * @param {object} options - Assertion options
 * @throws {Error} If assertion fails
 */
function assertResponseBody(response, expectedBody, options = {}) {
  const context = options.context || {};
  let body = response?.body;
  
  // Parse JSON if needed
  if (options.parseBody && typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // Not JSON, keep as string
    }
  }
  
  // Normalize before comparison if requested
  if (options.normalizeBeforeComparison) {
    const { normalizeBody } = require('../normalization/response-normalizer');
    body = normalizeBody(body, options);
    expectedBody = normalizeBody(expectedBody, options);
  }
  
  // Different comparison strategies based on environment and options
  if (context.isLiveEnvironment && options.looseLiveComparison) {
    return assertLooselyEqual(body, expectedBody, options);
  }
  
  // Strict comparison
  return assertDeepEqual(body, expectedBody, options);
}

/**
 * Asserts objects are deeply equal
 * @param {any} actual - Actual value
 * @param {any} expected - Expected value
 * @param {object} options - Assertion options
 * @throws {Error} If assertion fails
 */
function assertDeepEqual(actual, expected, options = {}) {
  const differences = findDifferences(actual, expected, options);
  
  if (differences.length > 0) {
    const diffStr = differences.map(d => 
      `${d.path}: expected ${JSON.stringify(d.expected)} but got ${JSON.stringify(d.actual)}`
    ).join('\n');
    
    throw new Error(`Objects are not equal:\n${diffStr}`);
  }
  
  return true;
}

/**
 * Asserts objects are loosely equal (for live environment)
 * @param {any} actual - Actual value
 * @param {any} expected - Expected value
 * @param {object} options - Assertion options
 * @throws {Error} If assertion fails
 */
function assertLooselyEqual(actual, expected, options = {}) {
  // For primitive types, use basic comparison
  if (typeof actual !== 'object' || typeof expected !== 'object' || 
      actual === null || expected === null) {
    
    if (actual == expected) {  // Loose equality
      return true;
    }
    
    throw new Error(`Values are not equal: expected ${expected} but got ${actual}`);
  }
  
  // For arrays, check length and key items
  if (Array.isArray(actual) && Array.isArray(expected)) {
    // Length check with some tolerance
    if (Math.abs(actual.length - expected.length) > (options.arrayLengthTolerance || 0)) {
      throw new Error(`Array length mismatch: expected ${expected.length} but got ${actual.length}`);
    }
    
    // Only check first N items for large arrays
    const checkLimit = options.arrayCheckLimit || Math.min(10, Math.min(actual.length, expected.length));
    
    for (let i = 0; i < checkLimit; i++) {
      try {
        assertLooselyEqual(actual[i], expected[i], options);
      } catch (err) {
        throw new Error(`Array element ${i} mismatch: ${err.message}`);
      }
    }
    
    return true;
  }
  
  // For objects, check required properties
  const requiredProps = options.requiredProperties || Object.keys(expected);
  
  for (const prop of requiredProps) {
    if (!(prop in actual)) {
      throw new Error(`Missing required property: ${prop}`);
    }
    
    try {
      assertLooselyEqual(actual[prop], expected[prop], options);
    } catch (err) {
      throw new Error(`Property ${prop} mismatch: ${err.message}`);
    }
  }
  
  return true;
}

/**
 * Find differences between objects
 * @param {any} actual - Actual value
 * @param {any} expected - Expected value
 * @param {object} options - Options
 * @param {string} path - Current path (for recursion)
 * @returns {array} Array of differences
 */
function findDifferences(actual, expected, options = {}, path = '') {
  const differences = [];
  
  // Handle null/undefined
  if (actual === expected) return differences;
  if (actual === null && expected !== null) 
    return [{ path: path || 'root', expected, actual }];
  if (actual !== null && expected === null) 
    return [{ path: path || 'root', expected, actual }];
  if (actual === undefined && expected !== undefined) 
    return [{ path: path || 'root', expected, actual }];
  if (actual !== undefined && expected === undefined) 
    return [{ path: path || 'root', expected, actual }];
  
  // Handle different types
  if (typeof actual !== typeof expected) {
    return [{ 
      path: path || 'root', 
      expected: { type: typeof expected, value: expected }, 
      actual: { type: typeof actual, value: actual } 
    }];
  }
  
  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    // Length check
    if (actual.length !== expected.length) {
      differences.push({ 
        path: path || 'root', 
        difference: 'array_length', 
        expected: expected.length, 
        actual: actual.length 
      });
    }
    
    // Compare elements
    const minLength = Math.min(actual.length, expected.length);
    for (let i = 0; i < minLength; i++) {
      const nestedPath = path ? `${path}[${i}]` : `[${i}]`;
      const nestedDiffs = findDifferences(actual[i], expected[i], options, nestedPath);
      differences.push(...nestedDiffs);
    }
    
    return differences;
  }
  
  // Handle objects
  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    
    // Missing keys
    for (const key of expectedKeys) {
      if (!actualKeys.includes(key)) {
        differences.push({ 
          path: path ? `${path}.${key}` : key, 
          difference: 'missing_key', 
          expected: expected[key], 
          actual: undefined 
        });
      }
    }
    
    // Extra keys (if not ignoring)
    if (!options.ignoreExtraProperties) {
      for (const key of actualKeys) {
        if (!expectedKeys.includes(key)) {
          differences.push({ 
            path: path ? `${path}.${key}` : key, 
            difference: 'extra_key', 
            expected: undefined, 
            actual: actual[key] 
          });
        }
      }
    }
    
    // Compare values for keys in both objects
    for (const key of expectedKeys) {
      if (actualKeys.includes(key)) {
        const nestedPath = path ? `${path}.${key}` : key;
        const nestedDiffs = findDifferences(actual[key], expected[key], options, nestedPath);
        differences.push(...nestedDiffs);
      }
    }
    
    return differences;
  }
  
  // For primitives, just compare
  if (actual !== expected) {
    return [{ path: path || 'root', expected, actual }];
  }
  
  return differences;
}

module.exports = {
  assertResponseStatus,
  assertResponseHeaders,
  assertResponseBody,
  assertDeepEqual,
  assertLooselyEqual,
  findDifferences
};
```

### 3.4 Wait/Retry Logic for Data Operations

**File:** `ai-workflow-workspace/testing-audit/infrastructure/operations/retry-operations.js`

```javascript
/**
 * Provides retry/wait logic for operations affected by eventual consistency
 */

/**
 * Retries an operation until successful or max attempts reached
 * @param {Function} operation - The operation to retry
 * @param {Function} validation - Validation function that returns true if successful
 * @param {object} options - Retry options
 * @returns {Promise<any>} The operation result
 */
async function retryOperation(operation, validation, options = {}) {
  const {
    maxRetries = 3,
    delayMs = 500,
    backoff = 1.5,
    timeout = 10000,
    context = {},
    description = 'operation'
  } = options;
  
  // Skip retry logic in local environment if specified
  if (!context.isLiveEnvironment && options.skipRetryInLocalEnvironment) {
    const result = await operation();
    
    if (validation && !(await validation(result))) {
      throw new Error(`Validation failed for ${description}`);
    }
    
    return result;
  }
  
  // Apply retry logic
  let lastError;
  let attempt = 0;
  let currentDelay = delayMs;
  const startTime = Date.now();
  
  while (attempt < maxRetries) {
    const elapsedTime = Date.now() - startTime;
    if (timeout > 0 && elapsedTime >= timeout) {
      throw new Error(`Operation timed out after ${elapsedTime}ms: ${lastError?.message || 'unknown error'}`);
    }
    
    try {
      const result = await operation();
      
      // Skip validation if not provided
      if (!validation) {
        return result;
      }
      
      // If validation passes, return the result
      if (await validation(result)) {
        return result;
      }
      
      // Log validation failure
      const validationError = new Error(`Validation failed for ${description} (attempt ${attempt + 1}/${maxRetries})`);
      lastError = validationError;
      console.warn(validationError.message);
      
    } catch (error) {
      lastError = error;
      console.warn(`Error in ${description} (attempt ${attempt + 1}/${maxRetries}): ${error.message}`);
    }
    
    // Increment attempt counter
    attempt++;
    
    // Exit if we've reached max retries
    if (attempt >= maxRetries) {
      break;
    }
    
    // Wait before next attempt with backoff
    await new Promise(resolve => setTimeout(resolve, currentDelay));
    currentDelay = Math.min(currentDelay * backoff, 10000); // Cap at 10 seconds
  }
  
  throw new Error(`${description} failed after ${maxRetries} attempts: ${lastError?.message || 'validation failed'}`);
}

/**
 * Waits for a condition to be true
 * @param {Function} condition - Condition function that returns a boolean
 * @param {object} options - Wait options
 * @returns {Promise<boolean>} True if condition met, false if timed out
 */
async function waitForCondition(condition, options = {}) {
  const {
    timeoutMs = 5000,
    intervalMs = 100,
    description = 'condition',
    throwOnTimeout = true,
    context = {}
  } = options;
  
  // Skip wait logic in local environment if specified
  if (!context.isLiveEnvironment && options.skipWaitInLocalEnvironment) {
    const result = await condition();
    
    if (!result && throwOnTimeout) {
      throw new Error(`Condition not met for ${description}`);
    }
    
    return result;
  }
  
  // Apply wait logic
  const startTime = Date.now();
  let elapsedTime = 0;
  
  while (elapsedTime < timeoutMs) {
    const result = await condition();
    
    if (result) {
      return true;
    }
    
    // Wait for next check
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    elapsedTime = Date.now() - startTime;
  }
  
  if (throwOnTimeout) {
    throw new Error(`Timed out waiting for ${description} after ${timeoutMs}ms`);
  }
  
  return false;
}

/**
 * Creates a function that automatically retries on failure
 * @param {Function} fn - Function to wrap with retry logic
 * @param {object} options - Retry options
 * @returns {Function} Wrapped function with retry logic
 */
function withRetry(fn, options = {}) {
  return async (...args) => {
    return retryOperation(
      () => fn(...args),
      options.validation || null,
      options
    );
  };
}

module.exports = {
  retryOperation,
  waitForCondition,
  withRetry
};
```

### 3.5 Environment-Specific Configurations

**File:** `ai-workflow-workspace/testing-audit/infrastructure/environment/environment-config.js`

```javascript
/**
 * Provides environment-specific configuration factory
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
      
    // Add configurations for other test types
    
    default:
      return baseConfig;
  }
}

module.exports = {
  getEnvironmentConfig,
  getTestTypeConfig
};
```

### 3.6 EnhancedTestExecutor Implementation

**File:** `ai-workflow-workspace/testing-audit/infrastructure/environment/enhanced-test-executor.js`

```javascript
/**
 * @fileoverview Enhanced Test Executor
 * 
 * This module provides an environment-aware test execution framework that
 * addresses the documented discrepancies between local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { detectEnvironment } = require('./environment-detector');
const { normalizeResponse } = require('../normalization/response-normalizer');
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
    
    // Add essential utilities to context
    this.context.utils = this._createUtilsObject();
    
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
        config: this.config
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
            looseLiveComparison: !this.config.validation.strictBodyMatching
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
          })
      },
      
      // Retry/wait utilities
      retry: {
        operation: (operation, validation, options = {}) => 
          retryOperation(operation, validation, { 
            ...options, 
            context: this.context,
            maxRetries: this.config.timing.maxRetries,
            delayMs: this.config.timing.retryDelay
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
          
          // Perform the fetch
          return fetch(url, options);
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
    
    // Execute the test with enhanced context
    return testFn(this.context);
  }
}

module.exports = {
  EnhancedTestExecutor
};
```

### 3.7 Integration with Existing Infrastructure

**File:** `ai-workflow-workspace/testing-audit/infrastructure/execution/enhanced-test-runner.js`

```javascript
/**
 * @fileoverview Enhanced Test Runner
 * 
 * This module extends the IntegratedTestRunner with environment-aware capabilities.
 * It provides a unified interface for executing tests in both local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const { IntegratedTestRunner } = require('../../integrated-test-runner');
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
      ...config.executorOptions
    });
    
    this.testType = config.testType || 'default';
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
    
    // Run the test with environment-aware context
    return super.runTest(async (testContext) => {
      // Add test type to context
      testContext.testType = this.testType;
      
      // Run the test through the enhanced executor
      return this.executor.executeTest(testFn, testContext);
    }, environment);
  }
}

module.exports = {
  EnhancedTestRunner
};
```

## 4. Test Execution Workflow

### 4.1 Execution Sequence

The test execution workflow will follow this sequence:

1. **Environment Detection**: Detect if the test is running in local or live environment
2. **Context Enhancement**: Enhance the test context with environment-specific information
3. **Configuration Loading**: Load appropriate configuration based on environment and test type
4. **Test Execution**: Run the test with environment-aware utilities
5. **Normalization**: Normalize responses for comparison
6. **Verification**: Apply environment-specific verification rules
7. **Results Processing**: Process and report results

### 4.2 Workflow Diagram

```
┌─────────────────────────────────────────┐
│            Test Execution               │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Environment Detection           │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│        Environment-Specific Config      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Environment-Aware API Calls        │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│          Response Normalization         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│       Environment-Aware Assertions      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│            Results Reporting            │
└─────────────────────────────────────────┘
```

## 5. Implementation Order and Timeline

The implementation will be executed in the following order:

1. **Core Environment Detection** (Day 1)
   - Implement environment detector
   - Create environment config factory

2. **Response Normalization Framework** (Day 1-2)
   - Implement response normalization utilities
   - Test with sample responses from both environments

3. **Environment-Conditional Assertions** (Day 2)
   - Implement conditional assertion utilities
   - Create test-specific assertion adaptations

4. **Retry/Wait Operations** (Day 2-3)
   - Implement retry logic for data operations
   - Implement wait conditions for event-based testing

5. **Enhanced Test Executor** (Day 3)
   - Integrate all components into enhanced executor
   - Create wrapper for existing test runners

6. **Test and Refinement** (Day 3-4)
   - Test against known discrepancy cases
   - Refine and optimize the implementation

## 6. Test Case Adaptations

Each test type will require specific adaptations to work reliably in both environments:

### 6.1 Infrastructure Verification Tests

- Apply header normalization to remove Cloudflare-specific headers
- Implement environment-specific timing thresholds
- Add warm-up requests before performance measurements

### 6.2 KV Storage Tests

- Implement retry/wait logic for write-then-read operations
- Add delay between operations for eventual consistency
- Normalize timestamps in responses

### 6.3 Decision API Tests

- Normalize cache headers before comparison
- Implement environment-specific validation for cached responses
- Add cache warming requests for performance consistency

### 6.4 Parameter Handling Tests

- Normalize URL handling differences
- Apply looser validation for edge cases in live environment
- Handle header case sensitivity differences

## 7. Verification Strategy

The implementation will be verified through:

1. **Unit Testing** of individual components:
   - Environment detection accuracy
   - Response normalization correctness
   - Assertion behavior in different environments
   - Retry/wait logic effectiveness

2. **Integration Testing** of the complete framework:
   - End-to-end test execution in both environments
   - Verification of identified discrepancy handling
   - Comparison of results between environments

3. **Documentation Verification**:
   - Comprehensive documentation of implemented solutions
   - Mapping of solutions to identified discrepancies
   - Usage examples for each component

## 8. Expected Outcomes

Upon completion, this implementation will:

1. Enable consistent test execution across both local and live environments
2. Eliminate false failures caused by environment differences
3. Provide clear, environment-aware verification of test results
4. Maintain test integrity while adapting to environment-specific behaviors
5. Create a reusable framework for handling similar discrepancies in future tests

## 9. Conclusion

This comprehensive test execution plan addresses all the identified discrepancies between local and live environments through a systematic, environment-aware testing framework. The implementation focuses on five core capabilities that together enable consistent, reliable testing across environments while maintaining test integrity and accuracy.

The modular design allows for easy extension to handle additional discrepancies that may be discovered in the future, and the environment-specific configuration approach ensures tests can be tailored to each environment's unique characteristics without sacrificing verification rigor. 