#!/usr/bin/env node
/**
 * @fileoverview Simplified Test Runner for Individual Test Adapter
 * 
 * This script provides a minimal approach to run a single test adapter
 * with proper path resolution. It's designed as a fallback when batch scripts 
 * are encountering issues.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

const fs = require('fs');
const path = require('path');

// Simple environment context
const context = {
  utils: {
    fetch: async (url, options) => {
      const fetch = require('node-fetch');
      return fetch(url, options);
    },
    normalize: {
      response: (response, options) => {
        // Simple response normalization
        const normalizedResponse = { 
          status: response.status,
          headers: {},
          body: null
        };
        
        // Add headers
        for (const [key, value] of Object.entries(response.headers.raw())) {
          normalizedResponse.headers[key] = value[0];
        }
        
        // Remove Cloudflare headers if requested
        if (options?.removeCloudflareHeaders) {
          Object.keys(normalizedResponse.headers).forEach(key => {
            if (key.toLowerCase().startsWith('cf-')) {
              delete normalizedResponse.headers[key];
            }
          });
        }
        
        // Add body if available
        if (response.body) {
          try {
            normalizedResponse.body = JSON.parse(response.body);
          } catch (e) {
            normalizedResponse.body = response.body;
          }
        }
        
        return normalizedResponse;
      }
    },
    assert: {
      responseStatus: (response, expectedStatus) => {
        if (response.status !== expectedStatus) {
          throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
        }
        return true;
      },
      conditionalValue: ({ value, condition, expected, message }) => {
        let isValid = false;
        
        switch (condition) {
          case 'equals':
            isValid = value === expected;
            break;
          case 'oneOf':
            isValid = Array.isArray(expected) && expected.includes(value);
            break;
          default:
            isValid = false;
        }
        
        if (!isValid) {
          throw new Error(message || `Assertion failed: ${value} does not match condition ${condition} with expected ${expected}`);
        }
        
        return true;
      }
    },
    retry: {
      operation: async (fn, validator, options) => {
        const maxRetries = options?.maxRetries || 3;
        const delayMs = options?.delayMs || 100;
        
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const result = await fn();
            
            if (!validator || validator(result)) {
              return result;
            }
          } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
        
        throw lastError || new Error('Operation failed after multiple retries');
      },
      waitFor: async (condition, options) => {
        const timeoutMs = options?.timeoutMs || 5000;
        const intervalMs = options?.intervalMs || 100;
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
          if (await condition()) {
            return true;
          }
          
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        
        throw new Error(`Condition not met within ${timeoutMs}ms`);
      }
    },
    environment: {
      config: {
        timing: {
          requestTimeout: 5000,
          retryDelay: 100
        },
        validation: {
          allowLiveStatusVariance: false
        }
      }
    }
  },
  baseUrl: 'http://localhost:8787',
  environmentName: 'Local',
  environmentType: 'local',
  isLiveEnvironment: false
};

// Parse command line args
const args = process.argv.slice(2);
const testAdapterPath = args[0];

if (!testAdapterPath) {
  console.error('Error: No test adapter path provided');
  console.log('Usage: node run-single-test.js <path-to-adapter>');
  process.exit(1);
}

// Resolve the adapter path
const resolvedPath = path.resolve(process.cwd(), testAdapterPath);

// Check if the adapter exists
if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: Test adapter not found at path: ${resolvedPath}`);
  process.exit(1);
}

console.log(`Running test adapter: ${resolvedPath}`);
console.log(`Connecting to: ${context.baseUrl}`);
console.log('----------------------------------------');

async function runTest() {
  try {
    // Dynamically load the test adapter
    const testAdapter = require(resolvedPath);
    
    // Check if it's a function
    if (typeof testAdapter !== 'function') {
      throw new Error('Test adapter is not a function');
    }
    
    // Run the test adapter
    const result = await testAdapter(context);
    
    // Output results
    console.log('----------------------------------------');
    console.log('Test completed with result:');
    console.log('----------------------------------------');
    console.log(JSON.stringify(result, null, 2));
    
    // Write results to file
    const resultFilePath = path.join(process.cwd(), 'test-result.json');
    fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2));
    console.log(`Results saved to: ${resultFilePath}`);
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Error running test adapter:', error);
    process.exit(1);
  }
}

// Run the test
runTest(); 