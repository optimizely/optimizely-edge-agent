---
type: documentation
description: "Documentation for the evidence storage system"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Evidence Storage for Edge Agent Testing

This directory contains the evidence storage system for Edge Agent testing, created as part of the Testing Audit Reconciliation project. The system provides a structured, verifiable way to store test evidence with cryptographic integrity protection.

## Key Components

- **evidence-storage.js**: Core utility for storing, retrieving, and verifying test evidence
- **evidence-schema.md**: Detailed documentation of the evidence storage schema
- **test-evidence-storage.js**: Test script to validate the evidence storage utility

## Features

The evidence storage system provides the following features:

- **Structured Evidence Storage**: Consistent, schema-validated evidence artifacts
- **Cryptographic Integrity**: Hash chain ensuring evidence cannot be tampered with
- **Flexible Artifact Types**: Support for network, screenshot, assertion, and generic data artifacts
- **Searchable Registry**: Registry of all test runs with metadata and integrity verification
- **Verification Utilities**: Tools to verify the integrity of stored evidence

## Directory Structure

The evidence storage system automatically creates the following directory structure:

```
ai-workflow-workspace/testing-audit/evidence/
├── metadata/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]-[run-id]-metadata.json
│   │   └── ...
│   └── ...
├── artifacts/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [artifact-id].json
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── screenshots/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [timestamp]-[description].png
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── network/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [timestamp]-[request-id].har
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── registry/
    ├── [YYYY-MM-DD]-registry.json
    └── ...
```

## Usage

### Basic Usage

```javascript
const { EvidenceStorage, RESULT_TYPES } = require('./evidence-storage');

async function runTest() {
  // Create an evidence storage instance
  const evidence = new EvidenceStorage('test-name');
  
  // Initialize with environment info
  await evidence.initialize({
    workerUrl: 'https://edge-agent.example.workers.dev',
    sdkKey: 'SDK-123456'
  });
  
  // Store network artifacts (HTTP request/response)
  await evidence.storeNetworkArtifact(
    {
      url: 'https://edge-agent.example.workers.dev/decide',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"userId":"12345"}',
      statusCode: 200,
      responseHeaders: { 'Content-Type': 'application/json', 'cf-ray': '8168c5df8c5d3183-DFW' },
      responseBody: { flagKey: 'test-flag', enabled: true }
    },
    'API request to /decide endpoint'
  );
  
  // Store data artifacts
  await evidence.storeDataArtifact(
    { key: 'value', nested: { array: [1, 2, 3] } },
    'Test configuration'
  );
  
  // Store screenshots
  await evidence.storeScreenshotArtifact(
    screenshotBuffer, // or base64 string or file path
    'Homepage screenshot'
  );
  
  // Store assertions
  await evidence.storeAssertionArtifact({
    message: 'Response should contain flag data',
    status: 'PASS',
    expected: 'object with flagKey',
    actual: 'object with flagKey="test-flag"'
  });
  
  // Finalize evidence collection
  await evidence.finalize(RESULT_TYPES.PASS, 1500); // result, duration in ms
}
```

### Evidence Verification

```javascript
const { EvidenceStorage } = require('./evidence-storage');

async function verifyEvidence(metadataPath) {
  const result = await EvidenceStorage.verifyEvidence(metadataPath);
  
  if (result.verified) {
    console.log('Evidence integrity verified!');
  } else {
    console.error('Evidence integrity verification failed!');
    console.error('Errors:', result.errors);
  }
}
```

### Finding Evidence

```javascript
const { EvidenceStorage } = require('./evidence-storage');

async function findEvidence() {
  // Find evidence by test ID
  const testEvidence = await EvidenceStorage.findEvidenceByTestId('test-name', { limit: 10 });
  
  // Get evidence summary by date
  const today = new Date().toISOString().split('T')[0];
  const summary = await EvidenceStorage.getEvidenceSummaryByDate(today);
}
```

## Integration with Logging Framework

The evidence storage system is designed to integrate with the logging framework in `ai-workflow-workspace/testing-audit/infrastructure/logging/`:

```javascript
const { TestLogger } = require('../../infrastructure/logging/logger');
const { EvidenceStorage } = require('../evidence-storage');

async function runIntegratedTest() {
  // Create logger
  const logger = new TestLogger('test-name');
  await logger.initialize();
  
  // Create evidence storage
  const evidence = new EvidenceStorage('test-name');
  await evidence.initialize();
  
  // Log events and store evidence
  logger.log('TEST_START', 'INFO', 'Starting test execution');
  
  // HTTP request/response
  const reqEvent = logger.httpRequest('POST', 'https://api.example.com', {});
  const respEvent = logger.httpResponse(200, { 'cf-ray': '8168c5df8c5d3183-DFW' }, {});
  
  // Store the HTTP interaction as evidence
  await evidence.storeNetworkArtifact({
    url: reqEvent.metadata.httpUrl,
    method: reqEvent.metadata.httpMethod,
    headers: reqEvent.metadata.httpHeaders,
    statusCode: respEvent.metadata.httpStatusCode,
    responseHeaders: respEvent.metadata.httpHeaders,
    cfRay: respEvent.metadata.cfRay
  });
  
  // Finalize
  await logger.finalize('PASS', 'Test completed successfully');
  await evidence.finalize('PASS', logger.summary.duration);
}
```

## Integrity Verification Mechanism

The evidence storage system uses a multi-level integrity verification mechanism:

1. **Individual Artifact Hashes**: Each artifact has a SHA-256 hash calculated on its content
2. **Metadata Integrity Hash**: The metadata file contains a hash of all artifact hashes
3. **Registry Integrity Hash**: The registry contains a hash of all metadata entries

This creates a chain of integrity that makes it impossible to tamper with evidence without detection.

## Running the Test Script

To test the evidence storage system:

```bash
cd ai-workflow-workspace/testing-audit/evidence
npm install
node test-evidence-storage.js
```

The test script will:
1. Create an evidence storage instance
2. Store various types of artifacts
3. Finalize the evidence collection
4. Verify the integrity of the stored evidence
5. Report the results 