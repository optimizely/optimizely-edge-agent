/**
 * @fileoverview Retry and Wait Operations
 * 
 * This module provides utilities for handling retry logic and wait conditions,
 * particularly useful for operations affected by eventual consistency in
 * the live environment.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
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

/**
 * Executes operations in sequence with retry capability
 * @param {Array<Function>} operations - Array of operations to execute
 * @param {object} options - Options for sequence execution
 * @returns {Promise<Array>} Array of operation results
 */
async function executeSequence(operations, options = {}) {
  const {
    continueOnError = false,
    retryOptions = {},
    context = {}
  } = options;
  
  const results = [];
  
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const operationDesc = options.descriptions?.[i] || `operation ${i + 1}`;
    
    try {
      // Execute with retry if enabled
      const result = options.enableRetry
        ? await retryOperation(operation, null, {
            ...retryOptions, 
            description: operationDesc,
            context
          })
        : await operation();
      
      results.push(result);
    } catch (error) {
      if (continueOnError) {
        results.push({ error: error.message });
      } else {
        throw new Error(`Sequence failed at ${operationDesc}: ${error.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Creates a function that waits for data consistency before proceeding
 * Useful for KV storage operations and other eventually consistent data systems
 * @param {Function} fn - The function to wrap
 * @param {Function} consistencyCheck - Function to check data consistency
 * @param {object} options - Options for consistency handling
 * @returns {Function} Wrapped function with consistency checking
 */
function withConsistencyCheck(fn, consistencyCheck, options = {}) {
  return async (...args) => {
    // Execute the original function
    const result = await fn(...args);
    
    // Skip consistency check in local environment if requested
    if (!options.context?.isLiveEnvironment && options.skipInLocalEnvironment) {
      return result;
    }
    
    // Wait for data consistency
    await waitForCondition(
      () => consistencyCheck(result, ...args),
      {
        timeoutMs: options.consistencyTimeout || 5000,
        intervalMs: options.checkInterval || 100,
        description: options.description || 'data consistency',
        throwOnTimeout: options.throwOnTimeout !== false,
        context: options.context
      }
    );
    
    return result;
  };
}

module.exports = {
  retryOperation,
  waitForCondition,
  withRetry,
  executeSequence,
  withConsistencyCheck
}; 