---
type: documentation
description: "Test Execution Infrastructure Documentation"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Test Execution Infrastructure

This documentation provides a comprehensive guide to the test execution infrastructure created for the Edge Agent Testing Audit Reconciliation project. This system enables running tests in both local and live environments with full integration of verification criteria, logging, evidence collection, and comparison capabilities.

## Purpose

The test execution infrastructure serves several critical purposes:

1. Execute tests against local and live Cloudflare Worker environments
2. Apply verification criteria to ensure test integrity
3. Collect and validate evidence during test execution
4. Generate detailed reports and manifests for audit review
5. Compare results between local and live environments
6. Maintain the test dependency chain
7. Ensure consistency with expected behavior

## Components

### Core Components

* **LocalTestRunner** (`local-test-runner.js`): For executing tests in a local environment
* **LiveTestRunner** (`live/live-test-runner.js`): For executing tests against the live environment
* **Command-Line Interfaces**: 
  * `run-tests.js`: For local test execution
  * `live/run-live-tests.js`: For live environment testing
* **IntegratedTestRunner**: Framework for test execution with logging and evidence collection
* **VerificationHooks**: System for verifying test integrity
* **ManifestGenerator**: Creates test manifests for audit documentation

### Key Files

* **Local Testing**:
  * `local-test-runner.js`: Implementation of the local test runner class
  * `run-tests.js`: Command-line script for running local tests
  * `run-tests.bat`: Windows batch script for local test execution

* **Live Testing**:
  * `live/live-test-runner.js`: Implementation of the live test runner class
  * `live/run-live-tests.js`: Command-line script for running live tests
  * `live/run-live-tests.bat`: Windows batch script for live test execution
  * `live/example-live-test.js`: Example demonstrating live test execution

## Environment Support

The infrastructure supports the following test environments:

### Local Environment

The local environment uses Wrangler in development mode to simulate a Cloudflare Worker locally. This provides:

* Fast execution for development and debugging
* No impact on production environments
* Ability to test with local modifications
* Full visibility into request/response cycles

### Live Environment

The live environment connects to the actual Cloudflare Worker deployment. This provides:

* Verification against the actual production environment
* Testing of CDN behavior that cannot be simulated locally
* Validation of actual production configuration and behavior
* Ability to detect discrepancies between environments

### Comparison Capabilities

The system provides robust comparison between environments:

* Side-by-side execution in both environments
* Detailed comparison of responses and behavior
* Identification of discrepancies in status codes, headers, and response bodies
* Reports highlighting environment-specific differences

## Using the Command-Line Interfaces

### Local Test Execution

```bash
# Run a specific test locally
node run-tests.js infrastructure-verification.js

# Run all tests in dependency order
node run-tests.js --all

# List available tests
node run-tests.js --list
```

### Live Test Execution

```bash
# Run a specific test against the live environment
node live/run-live-tests.js decision-api-test.js

# Run all tests against the live environment
node live/run-live-tests.js --all

# Run a comparison test (local vs. live)
node live/run-live-tests.js --test decision-api-test.js --comparison

# Run all tests in comparison mode
node live/run-live-tests.js --all --comparison
```

## Command-Line Options

### Local Test Options

| Option | Description |
|--------|-------------|
| `--test, -t <name>` | Run a specific test by name |
| `--all, -a` | Run all tests in dependency order |
| `--no-wrangler` | Disable Wrangler dev process |
| `--abort-on-failure` | Stop test suite execution on first test failure |
| `--output, -o <path>` | Set custom output path for results |
| `--list, -l` | List available tests |
| `--verbose, -v` | Enable verbose logging |
| `--help, -h` | Show help message |

### Live Test Options

| Option | Description |
|--------|-------------|
| `--test, -t <name>` | Run a specific test by name |
| `--all, -a` | Run all tests in dependency order |
| `--comparison, -c` | Run comparison tests (local vs. live) |
| `--no-rate-limit` | Disable rate limiting for requests |
| `--abort-on-failure` | Stop test suite execution on first test failure |
| `--no-safe-mode` | Disable safe mode (allows potentially destructive operations) |
| `--output, -o <path>` | Set custom output path for results |
| `--url <url>` | Specify Cloudflare Worker URL |
| `--key <key>` | Specify SDK Key |
| `--list, -l` | List available tests |
| `--verbose, -v` | Enable verbose logging |
| `--help, -h` | Show help message |

## Verification Criteria Integration

The system integrates with verification criteria documents created for each test. These criteria define:

- Required evidence for each test
- Pass criteria for connectivity, functionality, data, and performance
- Verification methods for both automated and manual verification
- Verification workflow procedures
- Result documentation requirements

When a test is executed, the appropriate verification criteria are loaded and made available to the test context, enabling the test to validate itself against the established standards.

## Evidence Collection and Verification

During test execution, the system automatically collects evidence including:

- Full HTTP request/response details
- Cloudflare-specific headers
- Test execution logs
- Performance metrics
- Assertion results

This evidence is then verified against the criteria defined for the test, ensuring that all required evidence is collected and meets the established standards.

## Test Reports and Manifests

The system generates the following artifacts:

1. **Test Logs**: Detailed execution logs with all steps and assertions
2. **Evidence Collection**: Structured evidence artifacts with integrity verification
3. **Test Reports**: Summary of test execution with pass/fail status
4. **Test Manifests**: Consolidated documents linking all artifacts with cryptographic signatures
5. **Comparison Reports**: When running comparison tests, detailed reports of discrepancies

These reports provide a complete audit trail for test execution, satisfying the requirements for verifiable and trustworthy testing.

## Safe Testing in Live Environments

The live test infrastructure includes safety features to prevent accidental damage:

1. **Rate Limiting**: Automatically limits request rates to prevent overloading services
2. **Safe Mode**: Prevents destructive operations by default
3. **Confirmation Prompts**: Requires explicit confirmation before running against live environments
4. **Data Masking**: Hides sensitive information like API keys in logs and reports

## Running in Windows Environment

This system has been specifically designed to work in Windows environments:

1. Uses Windows-compatible path handling
2. Properly executes Wrangler with `npx.cmd` on Windows
3. Handles Windows-specific process management
4. Provides batch scripts for easy execution

### Running Wrangler on Windows

The system executes Wrangler in development mode using:

```js
// Windows-compatible Wrangler execution
const { spawn } = require('child_process');
const wranglerProcess = spawn('npx.cmd', ['wrangler', 'dev'], {
  cwd: process.cwd(),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
```

## Example: Running Comparison Tests

To run comparison tests between local and live environments:

```bash
# Navigate to the project directory
cd /path/to/project

# Set environment variables for live testing
set CLOUDFLARE_WORKER_URL=https://edge-agent.optimizely.com
set OPTIMIZELY_SDK_KEY=your-sdk-key-here

# Run a comparison test for a specific test
node ai-workflow-workspace/testing-audit/infrastructure/execution/live/run-live-tests.js --test infrastructure-verification.js --comparison

# Or run all tests in comparison mode
node ai-workflow-workspace/testing-audit/infrastructure/execution/live/run-live-tests.js --all --comparison
```

## Directory Structure

The test execution infrastructure is organized as follows:

```
infrastructure/execution/
├── local-test-runner.js    # Local test execution class
├── run-tests.js            # CLI for local test execution
├── run-tests.bat           # Windows script for local tests
├── example-test.js         # Example local test
├── index.js                # Module exports for local testing
├── README.md               # This documentation
└── live/                   # Live environment testing
    ├── live-test-runner.js # Live test execution class
    ├── run-live-tests.js   # CLI for live test execution
    ├── run-live-tests.bat  # Windows script for live tests
    ├── example-live-test.js# Example live test
    ├── index.js            # Module exports for live testing
    └── README.md           # Live testing documentation
```

## Extending the System

The test execution infrastructure can be extended with additional features:

1. **Custom Verification Rules**: Add new verification hooks for specific requirements
2. **Additional Evidence Collectors**: Implement new evidence collection mechanisms
3. **Report Formatters**: Create custom report formats for specific stakeholders
4. **Test Environment Configurations**: Define different environment configurations
5. **New Comparison Methods**: Add advanced comparison logic for specific test types

## Troubleshooting

### Common Issues

1. **Wrangler Not Starting**:
   - Check that Wrangler is installed (`npm install -g wrangler`)
   - Verify appropriate Node.js version

2. **Live Environment Connection Failures**:
   - Verify the Cloudflare Worker URL is correct
   - Check that the SDK key is valid
   - Confirm network connectivity to the Cloudflare Worker

3. **Verification Criteria Not Loaded**:
   - Check naming convention of criteria files
   - Verify the criteria directory path

4. **Rate Limiting Issues**:
   - Increase the request delay in the live test configuration
   - Reduce the number of concurrent tests

## Technical Reference

### Test Runner Configuration Options

#### LocalTestRunner

```js
const runner = new LocalTestRunner({
  testScriptsPath: '/path/to/test/scripts',
  outputPath: '/path/to/output',
  manifestPath: '/path/to/manifests',
  verificationCriteriaPath: '/path/to/criteria',
  localEnvironment: {
    mode: 'local',
    wranglerEnabled: true,
    enableNetworkLogging: true
  },
  createReports: true,
  saveEvidence: true,
  verifyResults: true,
  abortOnFailure: false,
  generateManifest: true,
  followDependencies: true
});
```

#### LiveTestRunner

```js
const runner = new LiveTestRunner({
  testScriptsPath: '/path/to/test/scripts',
  outputPath: '/path/to/output/live',
  manifestPath: '/path/to/manifests/live',
  verificationCriteriaPath: '/path/to/criteria',
  compareWithLocal: true,
  liveEnvironment: {
    mode: 'live',
    url: 'https://edge-agent.optimizely.com',
    apiKey: 'sdk-key-here',
    enableRateLimiting: true,
    requestDelay: 500,
    enableSafeMode: true,
    captureAllHeaders: true,
    maxConcurrentRequests: 1
  },
  createReports: true,
  saveEvidence: true,
  verifyResults: true,
  abortOnFailure: false,
  generateManifest: true,
  followDependencies: true,
  createComparisonReports: true
});
```

### Test Dependencies and Execution Order

The system follows the test dependency order defined in `TEST_EXECUTION_ORDER`:

1. infrastructure-verification.js
2. decision-api-test.js
3. parameter-validation-test.js
4. forced-variation-tests.js
5. parameter-handling-tests.js
6. kv-storage-tests.js
7. cdn-variation-test.js
8. lowercase-variation-test.js
9. feature-parity-test.js

This order ensures that tests are executed in the correct sequence, with prerequisite tests running before dependent tests.

## Additional Documentation

For more detailed information about specific components:

- Local Test Execution: See this document
- Live Test Execution: See `live/README.md` for detailed documentation on live testing capabilities 