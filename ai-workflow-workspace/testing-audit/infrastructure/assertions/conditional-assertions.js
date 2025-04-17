/**
 * @fileoverview Environment-Conditional Assertions
 * 
 * This module provides environment-aware assertion utilities that adapt
 * verification criteria based on the current environment (local or live).
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
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
      const headerLower = headerName.toLowerCase();
      
      // Skip Cloudflare-specific headers in local environment
      if (!context.isLiveEnvironment && 
          headerLower.startsWith('cf-')) {
        continue;
      }
      
      // Check if header exists (case-insensitive)
      const hasHeader = Object.keys(headers)
        .some(h => h.toLowerCase() === headerLower);
      
      if (!hasHeader) {
        throw new Error(`Expected header "${headerName}" not found in response`);
      }
    }
    return true;
  }
  
  // Handle object of header name/value pairs
  if (typeof expectedHeaders === 'object' && expectedHeaders !== null) {
    for (const [name, value] of Object.entries(expectedHeaders)) {
      const headerLower = name.toLowerCase();
      
      // Skip Cloudflare-specific headers in local environment
      if (!context.isLiveEnvironment && 
          headerLower.startsWith('cf-')) {
        continue;
      }
      
      // Find header by case-insensitive name
      const headerKey = Object.keys(headers)
        .find(h => h.toLowerCase() === headerLower);
      
      if (!headerKey) {
        throw new Error(`Expected header "${name}" not found in response`);
      }
      
      // Check value if strict matching requested
      if (options.strictHeaderValues && headers[headerKey] !== value) {
        // For live environment, with loose matching, check for substring
        if (context.isLiveEnvironment && !options.strictHeaderValues && 
            typeof headers[headerKey] === 'string' && 
            typeof value === 'string') {
          if (!headers[headerKey].includes(value)) {
            throw new Error(`Expected header "${name}" to contain "${value}", but got "${headers[headerKey]}"`);
          }
        } else {
          throw new Error(`Expected header "${name}" to be "${value}", but got "${headers[headerKey]}"`);
        }
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
    if (actual.length !== expected.length && !options.ignoreArrayLength) {
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
      if (!actualKeys.includes(key) && !options.ignoreExtraProperties) {
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