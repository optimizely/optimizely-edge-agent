# Live Test Execution Infrastructure

This directory contains the infrastructure for executing tests against the live Cloudflare Workers environment. It extends the local test infrastructure to enable controlled testing against the production environment with proper evidence collection, verification, and result comparison.

## Overview

The live test execution infrastructure provides the following capabilities:

- Running tests against the live Cloudflare Workers environment
- Comparing results between local and live environments
- Rate limiting to prevent overloading the live environment
- Safe mode to prevent destructive operations
- Enhanced evidence collection for audit purposes
- Detailed comparison reports highlighting discrepancies
- Windows-compatible batch script for easy execution

## Components

- **LiveTestRunner**: Extends the LocalTestRunner to support live environment testing
- **run-live-tests.js**: Command-line interface for running live tests
- **run-live-tests.bat**: Windows batch script for easy execution of live tests
- **example-live-test.js**: Example demonstrating live test execution and comparison

## Usage

### Environment Variables

Before running live tests, you should set the following environment variables:

```bash
# Windows
set CLOUDFLARE_WORKER_URL=https://edge-agent.optimizely.com
set OPTIMIZELY_SDK_KEY=your-sdk-key-here
```

Alternatively, you can pass these values as command-line arguments when running tests.

### Running Tests

#### Using the Batch Script (Windows)

The easiest way to run tests is using the provided batch script:

```bash
# Run a specific test against the live environment
run-live-tests.bat decision-api-test.js

# Run all tests against the live environment
run-live-tests.bat --all

# Run a specific test in comparison mode (local vs. live)
run-live-tests.bat --test decision-api-test.js --comparison

# Run all tests in comparison mode
run-live-tests.bat --all --comparison

# List available tests
run-live-tests.bat --list

# Get help
run-live-tests.bat --help
```

#### Using Node.js Directly

You can also run the tests directly using Node.js:

```bash
# Run a specific test against the live environment
node run-live-tests.js decision-api-test.js

# Run all tests against the live environment
node run-live-tests.js --all

# Run a specific test in comparison mode (local vs. live)
node run-live-tests.js --test decision-api-test.js --comparison

# Run all tests in comparison mode
node run-live-tests.js --all --comparison
```

### Command-Line Options

The `run-live-tests.js` script supports the following options:

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

## Safety Features

The live test infrastructure includes several safety features to prevent accidental damage to the production environment:

1. **Rate Limiting**: Tests automatically limit the rate of requests to the live environment to prevent overwhelming the service.

2. **Safe Mode**: By default, tests run in safe mode which prevents destructive operations like data deletion or modifications that could impact production services.

3. **Confirmation Prompt**: Before running tests against the live environment, users are prompted to confirm their intention to proceed.

4. **Masked Sensitive Data**: Sensitive data like API keys are masked in logs and reports.

## Results and Reports

When tests are run against the live environment (or in comparison mode), the following artifacts are generated:

- **Test Logs**: Detailed logs of test execution in both environments
- **Evidence**: Network requests/responses, console output, and other evidence
- **Manifests**: Structured reports of test execution
- **Comparison Reports**: Detailed reports highlighting discrepancies between local and live results

These artifacts can be found in the following directories:

- **Logs**: `ai-workflow-workspace/testing-audit/results/live/logs/`
- **Evidence**: `ai-workflow-workspace/testing-audit/results/live/evidence/`
- **Reports**: `ai-workflow-workspace/testing-audit/results/live/reports/`
- **Comparisons**: `ai-workflow-workspace/testing-audit/results/live/comparisons/`
- **Manifests**: `ai-workflow-workspace/testing-audit/manifest/live/`

## API Usage

You can also use the live test infrastructure programmatically:

```javascript
const { LiveTestRunner } = require('./live-test-runner');

// Create a new LiveTestRunner instance
const testRunner = new LiveTestRunner({
  liveEnvironment: {
    url: 'https://edge-agent.optimizely.com',
    apiKey: 'your-sdk-key-here',
    enableRateLimiting: true,
    enableSafeMode: true
  }
});

// Initialize the test runner
await testRunner.initialize();

// Run a test against the live environment
const liveResult = await testRunner.runLiveTest('decision-api-test.js');

// Run a comparison test (local vs. live)
const comparisonResult = await testRunner.runComparisonTest('decision-api-test.js');

// Run all tests in comparison mode
const allResults = await testRunner.runAllComparisonTests();
```

## Example

Check out `example-live-test.js` for a demonstration of how to use the live test infrastructure programmatically, including running tests in both environments and comparing results.

## Important Notes

- **Windows Command Line**: Always use Windows command line (cmd.exe) and not PowerShell when running tests to ensure proper visibility of logs and responses.
- **Rate Limiting**: Be mindful of rate limits when running tests against the live environment.
- **SDK Key**: A valid SDK key is required for most tests against the live environment.
- **Test Order**: Tests are executed in a specific order based on dependencies. See `TEST_EXECUTION_ORDER` for details.
- **Evidence**: All tests collect evidence of execution for audit purposes.
- **Verification**: All tests must pass verification criteria checks. 