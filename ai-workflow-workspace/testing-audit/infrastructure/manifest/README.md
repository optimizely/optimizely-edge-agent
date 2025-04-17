# Test Run Manifest Generator

This directory contains the Manifest Generator system, which is designed to create comprehensive test run manifests that consolidate information from the logging, evidence storage, and verification systems into a single, structured document.

## Overview

The Test Run Manifest Generator provides a framework for creating detailed, verifiable records of test execution. These manifests serve as proof of test execution and can be used for reporting, reconciliation, and audit purposes.

## Key Features

- **Comprehensive Test Documentation**: Combines logs, evidence, and verification results into a single document
- **Cryptographic Integrity**: Signs manifests with SHA-256 hashes to ensure tamper resistance
- **Multiple Output Formats**: Generates both JSON (for machine processing) and Markdown (for human readability)
- **Timeline Generation**: Creates a chronological view of test execution
- **Consolidated Reporting**: Can generate reports that summarize multiple test runs
- **Verification Support**: Integrates with the verification hooks system to include verification results

## Components

### 1. ManifestGenerator

The core `ManifestGenerator` class provides methods for generating manifests:

- `generateManifest()`: Creates a manifest from raw test run data
- `generateFromRunnerResult()`: Creates a manifest from an IntegratedTestRunner result
- `generateFromVerifiedResult()`: Creates a manifest from a VerifiedTestRunner result
- `findManifestsByTestId()`: Finds manifests for a specific test ID
- `generateConsolidatedReport()`: Creates a consolidated report of multiple test runs

## Manifest Structure

A generated manifest contains the following sections:

1. **Test Execution Summary**: Overall test results, including start/end times, duration, and pass/fail status
2. **Log Summary**: Summary of log events, error counts, and integrity verification
3. **Evidence Summary**: Summary of collected evidence, artifact counts, and Cloudflare evidence status
4. **Verification Results**: Results from each verification type performed during the test
5. **Execution Timeline**: Chronological list of key events during test execution
6. **References**: Links to related artifacts, log files, and evidence
7. **System Information**: Details about the environment where the test was executed
8. **Signature**: Cryptographic signature to verify manifest integrity

## Usage Examples

### Basic Usage with IntegratedTestRunner

```javascript
const { ManifestGenerator } = require('./manifest-generator');
const { IntegratedTestRunner } = require('../integrated-test-runner');

async function runTestWithManifest() {
  // Create and initialize test runner
  const testRunner = new IntegratedTestRunner('my-test');
  await testRunner.initialize();
  
  // Run test
  const result = await testRunner.runTest(async (test) => {
    // Test implementation...
    return { success: true };
  });
  
  // Create manifest generator
  const manifestGenerator = new ManifestGenerator();
  
  // Generate manifest from test result
  const manifestResult = await manifestGenerator.generateFromRunnerResult(result);
  
  console.log(`Manifest generated at: ${manifestResult.path}`);
  console.log(`Markdown version at: ${manifestResult.markdownPath}`);
  
  return manifestResult;
}
```

### Using with VerifiedTestRunner

```javascript
const { ManifestGenerator } = require('./manifest-generator');
const { VerifiedTestRunner } = require('../verification/verified-test-runner');

async function runVerifiedTestWithManifest() {
  // Create verified test runner
  const verifiedRunner = new VerifiedTestRunner('my-verified-test');
  await verifiedRunner.initialize();
  
  // Run verified test
  const result = await verifiedRunner.runTest(async (context) => {
    // Test implementation with verification...
    return { success: true };
  });
  
  // Create manifest generator
  const manifestGenerator = new ManifestGenerator();
  
  // Generate manifest from verified test result
  const manifestResult = await manifestGenerator.generateFromVerifiedResult(result);
  
  return manifestResult;
}
```

### Creating a Consolidated Report

```javascript
const { ManifestGenerator } = require('./manifest-generator');

async function generateReport() {
  const manifestGenerator = new ManifestGenerator();
  
  // Generate consolidated report for multiple tests
  const reportResult = await manifestGenerator.generateConsolidatedReport(
    ['test-id-1', 'test-id-2', 'test-id-3'],
    'Weekly Test Summary'
  );
  
  console.log(`Report generated at: ${reportResult.path}`);
  
  return reportResult;
}
```

## Configuration Options

The manifest generator can be configured with the following options:

```javascript
const config = {
  basePath: '/path/to/manifest/directory', // Where to store manifests
  includeLogSummary: true,                // Include log summary section
  includeEvidenceSummary: true,           // Include evidence summary section
  includeVerificationResults: true,       // Include verification results section
  includeTimeline: true,                  // Include execution timeline section
  includeSystemInfo: true,                // Include system information section
  createDirectory: true,                  // Create output directory if needed
  signManifest: true                      // Cryptographically sign the manifest
};

const manifestGenerator = new ManifestGenerator(config);
```

## Integration with Testing Workflow

The Manifest Generator is designed to be used as the final step in the testing process:

1. Run tests with the IntegratedTestRunner or VerifiedTestRunner
2. Generate manifests for each test run
3. Generate consolidated reports as needed for reporting and auditing
4. Use the manifest files as evidence of test execution

This workflow ensures that all test runs are properly documented and can be verified for integrity and authenticity. 