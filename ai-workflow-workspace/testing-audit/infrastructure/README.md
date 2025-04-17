---
type: documentation
description: "Documentation for the test infrastructure components"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Environment-Aware Testing Infrastructure

This infrastructure provides a comprehensive solution for handling the discrepancies between local and live Cloudflare Workers environments when running tests.

## Overview

The testing infrastructure includes five core capabilities:

1. **Environment Detection & Context Enhancement** - Automatically detects the execution environment (local or live) and enhances the test context with environment-specific information.
2. **Response Normalization Framework** - Normalizes responses for consistent comparison between environments.
3. **Environment-Conditional Assertions** - Provides assertions that adapt to the current environment, allowing for variations in live environments.
4. **Wait/Retry Logic for Data Operations** - Handles eventual consistency and other timing-related issues in the live environment.
5. **Environment-Specific Configurations** - Provides configurations tailored to the specific environment and test type.

## Directory Structure

```
infrastructure/
├── environment/              # Environment detection and configuration
│   ├── environment-detector.js     # Detects the current environment
│   ├── environment-config.js       # Provides environment-specific configs
│   └── enhanced-test-executor.js   # Core executor with enhanced capabilities
├── normalization/           # Response normalization
│   └── response-normalizer.js      # Normalizes responses for comparison
├── assertions/              # Conditional assertions
│   └── conditional-assertions.js   # Environment-aware assertions
├── operations/              # Retry/wait operations
│   └── retry-operations.js         # Retry and wait logic
├── execution/               # Test execution
│   └── enhanced-test-runner.js     # Enhanced test runner
├── cli/                     # Command-line interface
│   ├── run-test.js                # Node.js CLI for running tests
│   └── run-test.bat              # Windows batch script
└── integrated-test-runner.js  # Existing test runner (base class)
```

## Getting Started

### Prerequisites

- Node.js 14+
- Wrangler installed for local Cloudflare Workers testing
- Access to a Cloudflare Workers deployment (for live testing)

### Environment Variables

- `CLOUDFLARE_WORKER_URL` - URL of the live Cloudflare Worker (e.g., `https://edge-agent.optimizely.com`)
- `OPTIMIZELY_SDK_KEY` - SDK key for testing (if required by tests)

### Running Tests

#### Using the Windows Command Line (recommended)

```
cd ai-workflow-workspace/testing-audit/infrastructure/cli
run-test.bat --test path/to/your-test.js --type decision-api
```

#### Using Node.js directly

```
cd ai-workflow-workspace/testing-audit/infrastructure/cli
node run-test.js --test path/to/your-test.js --type decision-api
```

### Command-Line Options

```
--test, -t <file>            Test file to run
--directory, -d <dir>        Directory containing test files to run
--type <type>                Test type (default, kv-storage, decision-api, etc.)
--base-url, -b <url>         Base URL for test requests
--output, -o <file>          Save results to JSON file
--compare, -c                Run test in both local and live environments
--force-mode, -m <mode>      Force environment mode ('local' or 'live')
--no-retry                   Disable retry logic for operations
--time-difference <ms>       Maximum acceptable time difference for comparison
--verbose, -v                Enable verbose logging
--help, -h                   Show this help message
```

## Using in Your Tests

### Basic Test Example

```javascript
// my-test.js
module.exports = async function(context) {
  const { utils } = context;
  const { environment, assert, normalize, retry } = utils;
  
  // Make a request using environment-aware fetch
  const response = await utils.fetch('https://edge-agent.optimizely.com/v1/decide');
  
  // Normalize the response
  const normalizedResponse = normalize.response(response);
  
  // Assert with environment-specific rules
  assert.responseStatus(normalizedResponse, 200);
  
  return { success: true, data: normalizedResponse.body };
};
```

### Comparing Environments

Run a test in both local and live environments and see the differences:

```
run-test.bat --test my-test.js --compare --output comparison-results.json
```

### Testing with Retry Logic

```javascript
// retry-example.js
module.exports = async function(context) {
  const { utils } = context;
  
  // Operation with retry logic for eventual consistency
  const result = await utils.retry.operation(
    async () => {
      // Make a write request
      await utils.fetch('/api/write', { method: 'POST', body: JSON.stringify({ key: 'test' }) });
      
      // Try to read it back immediately
      return utils.fetch('/api/read?key=test');
    },
    async (response) => {
      // Validation function - return true if operation successful
      return response.status === 200;
    },
    {
      maxRetries: 5,
      delayMs: 500
    }
  );
  
  return { success: true, data: await result.json() };
};
```

## Test Types

The infrastructure supports different test types with tailored configurations:

- `default` - Basic configuration
- `kv-storage` - Optimized for KV storage testing (longer timeouts, more retries)
- `decision-api` - Optimized for Decision API testing (caching behavior, timestamp normalization)
- `infrastructure` - Optimized for infrastructure testing (header handling, longer timeouts)
- `parameter-handling` - Optimized for parameter handling tests (looser body matching)
- `feature-parity` - Strict comparison between environments

## Important Notes for Windows Command Line

Always use Windows command line (cmd.exe) and not PowerShell for running tests because:

1. Command line provides proper visibility of logs and responses
2. PowerShell would block terminal output and make you think there's a disconnect
3. Using Wrangler Dev and testing against localhost:8787 allows you to see Cloudflare worker behavior in real-time
4. This approach makes error detection and correction much more straightforward 