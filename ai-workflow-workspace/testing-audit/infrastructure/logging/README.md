---
type: documentation
description: "Documentation for the structured logging framework"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Structured Logging Framework for Edge Agent Testing

This directory contains the structured logging framework for Edge Agent testing, created as part of the Testing Audit Reconciliation project. The framework provides verifiable, integrity-protected logging for test executions against the Cloudflare Worker environment.

## Key Components

- **logger.js**: Core logging utility that implements the JSON schema with cryptographic integrity protection
- **test-wrapper.js**: Wrapper for test scripts to easily integrate with the logging framework
- **log-schema.md**: Detailed documentation of the logging schema
- **test-logger.js**: Test script to validate the logging framework

## Features

The logging framework provides the following features:

- **Structured JSON Logging**: Consistent, schema-validated log entries
- **Cryptographic Integrity**: Hash chain ensuring logs cannot be tampered with
- **Evidence Collection**: Automatic storage of HTTP request/response data
- **Cloudflare Verification**: Special handling of Cloudflare-specific headers (e.g., cf-ray)
- **Timestamp Verification**: Accurate timestamps for all events
- **Test Wrapping**: Easy integration with existing test scripts

## Usage

### Basic Logging

```javascript
const { TestLogger } = require('./logger');

async function runTest() {
  // Create a logger instance
  const logger = new TestLogger('test-name');
  
  // Initialize the logger
  await logger.initialize();
  
  // Log events
  logger.log('INFO', 'INFO', 'This is an informational message');
  logger.log('TEST_STEP', 'INFO', 'Executing test step', { component: 'my-component' });
  
  // Log HTTP interactions
  logger.httpRequest('GET', 'https://api.example.com/endpoint', { 'Content-Type': 'application/json' });
  logger.httpResponse(200, { 'Content-Type': 'application/json' }, { result: 'success' }, 123);
  
  // Log assertions
  logger.assertion('component', 'PASS', 'Validation successful', 'expected', 'actual');
  
  // Finalize (closes log file and writes manifest)
  await logger.finalize('PASS', 'Test completed successfully');
}
```

### Using the Test Wrapper

```javascript
const { TestWrapper } = require('./test-wrapper');

async function runWithWrapper() {
  const wrapper = new TestWrapper('test-name');
  
  // Run a test function with full logging and evidence collection
  const result = await wrapper.runTest(async (test) => {
    // Access the provided utilities
    const { assert, step, evidence, logger } = test;
    
    // Log test steps
    const stepResult = step.start('component', 'Executing an operation');
    
    // Perform assertions
    assert.isTrue(true, 'This should be true');
    assert.equal(123, 123, 'Values should be equal');
    
    // Save evidence
    evidence.save('test-data', { key: 'value' });
    
    // Complete the step
    stepResult.pass('Operation completed');
    
    // Return test results
    return { customData: 'test-output' };
  });
  
  console.log('Test result:', result);
}
```

## Directory Structure

When using the logging framework, the following directory structure is created:

```
ai-workflow-workspace/testing-audit/
├── infrastructure/
│   └── logging/
│       ├── storage/
│       │   └── [YYYY-MM-DD]/
│       │       └── [test-name]-[runId].log
│       └── manifest/
│           └── [YYYY-MM-DD]-manifest.json
└── evidence/
    └── [YYYY-MM-DD]/
        └── [test-name]/
            └── [runId]/
                ├── evidence-summary.md
                ├── evidence-summary.json
                └── [evidence files]
```

## Log Integrity Verification

The logging framework automatically ensures log integrity through a hash chain mechanism. You can verify the integrity of a log file at any time:

```javascript
const { TestLogger } = require('./logger');

async function verifyLogIntegrity(logFilePath) {
  const result = await TestLogger.verifyLogIntegrity(logFilePath);
  
  if (result.verified) {
    console.log('Log integrity verified successfully!');
  } else {
    console.error('Log integrity verification failed!');
    console.error('Errors:', result.errors);
  }
} 