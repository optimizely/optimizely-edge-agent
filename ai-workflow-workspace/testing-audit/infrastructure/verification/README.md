# Verification Hooks System

This directory contains the Verification Hooks system, which is designed to integrate with test scripts to ensure test integrity, execution validation, and proper evidence collection.

## Overview

The Verification Hooks system provides a comprehensive framework for ensuring the integrity and reliability of test execution. It works in conjunction with the TestLogger and EvidenceStorage systems to create a trustworthy testing framework that prevents fabrication and ensures verifiable results against the live Cloudflare Workers infrastructure.

## Key Features

- **Log Integrity Verification**: Ensures that log files have not been tampered with by validating the cryptographic hash chain.
- **Cloudflare Evidence Verification**: Validates that tests are running against actual Cloudflare infrastructure by verifying Cloudflare-specific headers.
- **Timestamp Verification**: Ensures all timestamps are in valid UTC ISO 8601 format for consistency.
- **Signature Verification**: Validates cryptographic signatures of test artifacts to prevent tampering.
- **Evidence Collection Verification**: Ensures sufficient evidence has been collected during test execution.
- **Execution Chain Verification**: Validates that test execution was performed with proper setup and components.

## Components

### 1. VerificationHooks

The core `VerificationHooks` class provides methods for verifying various aspects of test execution:

- `initialize()`: Sets up the verification hooks system
- `preExecution()`: Runs before test execution to establish a baseline
- `postExecution()`: Runs after test execution to perform comprehensive verification
- `verifyTimestamp()`: Validates timestamp format
- `verifyCloudflare()`: Validates Cloudflare evidence in HTTP responses
- `verifySignature()`: Validates cryptographic signatures
- `verifyLogIntegrity()`: Validates log file integrity
- `verifyEvidenceCollection()`: Ensures sufficient evidence was collected
- `verifyExecutionChain()`: Validates proper test setup and execution

### 2. VerifiedTestRunner

A higher-level abstraction that combines `IntegratedTestRunner` with `VerificationHooks` to provide a simpler API for running verified tests:

- `runTest()`: Runs a test function with verification hooks integrated
- `runSimpleTest()` (static): Utility method for running simple tests with verification

## Usage Examples

### Basic Usage with IntegratedTestRunner

```javascript
const { IntegratedTestRunner } = require('../integrated-test-runner');
const { VerificationHooks } = require('./verification-hooks');

async function runTest() {
  // Create and initialize test runner
  const testRunner = new IntegratedTestRunner('my-test');
  await testRunner.initialize();
  
  // Run test with verification
  return await testRunner.runTest(async (test) => {
    const { logger, evidence, assert } = test;
    
    // Create verification hooks
    const verification = new VerificationHooks({ logger, evidence });
    await verification.preExecution();
    
    // Your test code here...
    
    // Run post-execution verification
    const verificationResult = await verification.postExecution();
    
    return {
      success: true,
      verificationStatus: verificationResult.status
    };
  });
}
```

### Using VerifiedTestRunner

```javascript
const { VerifiedTestRunner } = require('./verified-test-runner');

async function runTest() {
  // Create verified test runner
  const runner = new VerifiedTestRunner('my-test', {
    enforcePassing: true // Fail test if verification fails
  });
  
  // Initialize
  await runner.initialize();
  
  // Run test with verification integrated
  return await runner.runTest(async (context) => {
    const { logger, evidence, assert, verification } = context;
    
    // Your test code here...
    // verification.verifyCloudflare(), etc. are available
    
    return { success: true };
  });
}
```

### Using the Simple Test API

```javascript
const { VerifiedTestRunner } = require('./verified-test-runner');

async function main() {
  // Run a simple test with verification
  const result = await VerifiedTestRunner.runSimpleTest('my-simple-test', 
    async (context) => {
      const { assert, evidence, verification } = context;
      
      // Perform test operations
      const response = await fetch('https://api.optimizely.com/v3/edge-agent');
      
      // Verify Cloudflare evidence
      verification.verifyCloudflare({
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Assert something
      assert.isTrue(response.ok, 'Response should be successful');
      
      return { responseStatus: response.status };
    }
  );
  
  console.log('Test result:', result.success);
  console.log('Verification status:', result.verificationStatus);
}
```

## Configuration Options

The verification hooks system can be configured with the following options:

```javascript
const config = {
  verifyIntegrity: true,        // Verify log integrity
  verifyCloudflare: true,       // Verify Cloudflare evidence
  requireTimestampUTC: true,    // Require UTC timestamps
  requireSignatures: true,      // Require and verify signatures
  evidenceThreshold: 3,         // Minimum evidence artifacts required
  cloudflareEvidenceRequired: true, // Require Cloudflare evidence
  validateExecutionChain: true  // Validate execution chain
};

const verification = new VerificationHooks(context, config);
```

## Integration with Existing Test Scripts

To integrate verification hooks with existing test scripts:

1. Import the verification hooks module
2. Create a verification hooks instance with the test context
3. Call `preExecution()` before the test
4. Perform test operations, using verification methods as needed
5. Call `postExecution()` after the test
6. Check verification status and handle accordingly

## Verification Status Values

The following status values indicate the result of verification:

- `PENDING`: Verification not yet performed
- `PASS`: Verification passed successfully
- `FAIL`: Verification failed
- `WARNING`: Verification found issues, but not critical
- `ERROR`: Error occurred during verification 