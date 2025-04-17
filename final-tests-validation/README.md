# Optimizely Edge Agent Live Testing Framework

This framework provides a structured approach to validate the Optimizely Edge Agent against live infrastructure, ensuring all functionality and feature parity with the original implementation.

## Overview

The testing framework is designed to:

1. **Validate live infrastructure functionality** - Ensure the Edge Agent is correctly deployed and accessible
2. **Verify CDN variation settings** - Test URL matching, origin forwarding, caching, and content transformation 
3. **Test decision service functionality** - Validate feature flag decisions, experiment bucketing, and forced variations
4. **Validate parameter handling** - Test headers, query parameters, and JSON body parameters
5. **Verify feature parity** - Ensure all original functionality is preserved in the new implementation

## Directory Structure

```
final-tests-validation/
├── execution-plan.md             # Master checklist with sequential steps
├── infrastructure-config.md      # URLs, SDK keys, and environment setup
├── issue-tracking.md             # Known issues and remediation plan
├── README.md                     # This file
│
├── test-categories/              # Detailed test specifications
│   ├── 01-infrastructure/        # Infrastructure verification tests
│   ├── 02-decision-service/      # Feature flag and experiment tests
│   └── ...                       # Additional test categories
│
├── test-results/                 # Test logs and evidence
│   ├── infrastructure-verification-[timestamp].md
│   ├── cdn-variation-test-[timestamp].md
│   └── ...                       # Other test results
│
├── test-scripts/                 # JavaScript test scripts
│   ├── infrastructure-verification.js
│   ├── cdn-variation-test.js
│   ├── parameter-validation-test.js
│   ├── run-all-tests.js          # Main script to run all tests
│   └── ...                       # Additional test scripts
│
└── templates/                    # Log and report templates
    ├── result-template.md
    └── ...                       # Other templates
```

## Getting Started

### Prerequisites

- Node.js v14+ installed
- Access to the Optimizely Edge Agent deployment
- Valid SDK key for testing

### Setup

1. Install dependencies:

```bash
cd final-tests-validation
npm install
```

2. Set up environment variables:

```bash
# Set required environment variables
export EDGE_AGENT_URL=https://edge-agent-test.expedge.workers.dev
export SDK_KEY=8mR1pGh8u2ztUP8GqjmQq
```

## Running Tests

### Running all tests

```bash
cd final-tests-validation/test-scripts
node run-all-tests.js
```

### Running specific tests

```bash
# Run only infrastructure verification
cd final-tests-validation/test-scripts
node run-all-tests.js --run-only=1

# Or use environment variable
RUN_ONLY=1 node run-all-tests.js
```

### Running individual test scripts

```bash
# Run infrastructure verification tests
cd final-tests-validation/test-scripts
node infrastructure-verification.js

# Run CDN variation tests
node cdn-variation-test.js
```

## Test Results

Test results are saved in the `test-results` directory:

- JSON files contain detailed test data
- Markdown files provide human-readable summaries
- The execution plan is automatically updated with results

## Updating the Execution Plan

After running tests, the `execution-plan.md` file is automatically updated with:

- Test statuses (✅/❌)
- Execution history
- Overall progress

## Adding New Tests

To add new tests:

1. Create a new test script in `test-scripts/`
2. Add the script to the `testScripts` array in `run-all-tests.js`
3. Create a mapping in the `updateExecutionPlan()` function
4. Add the corresponding section in `execution-plan.md`

## Troubleshooting

If you encounter issues:

1. **Connection problems:**
   - Verify the Edge Agent URL is accessible
   - Check network configurations

2. **Authentication failures:**
   - Verify the SDK key is valid
   - Check header formatting

3. **Test failures:**
   - Examine detailed test results in the JSON files
   - Check for error messages in the test output

## Current Status and Known Gaps

As of April 2025, the following is the status of testing coverage:

### Completed Tests ✅
- Basic API functionality (/api/decide endpoint)
- Decide-all API endpoint
- Decide-for-keys API endpoint
- Basic cookie management
- Basic response headers

### Known Testing Gaps 🔍
The following tests are currently missing and need to be implemented:

1. **Forced Variation Tests**:
   - Header-based forced decisions (`X-Optimizely-Forced-Decision`)
   - JSON payload forced decisions (`forcedDecisions` property)
   - Query parameter forced decisions (`variation` parameter)

2. **Parameter Handling Tests**:
   - Tests for query parameters (visitor_id, flag_key, attributes.*, etc.)
   - Tests for header options (X-Optimizely-SDK-Key, X-Optimizely-User-ID, etc.)
   - Tests for JSON payload parameters (userId, attributes, flagKey, etc.)
   - Tests for parameter precedence rules

3. **CDN Variation Tests**:
   - Fix for "body used already" error in existing tests

4. **KV Storage Tests**:
   - Tests for enhanced cache keys
   - Tests for datafile caching
   - Tests for configuration inheritance

### Implementation Plan
To address these gaps, we will:

1. Create dedicated test scripts for each missing test category
2. Update the [execution plan](./execution-plan.md) to include these new tests
3. Fix the existing CDN variation test script
4. Update the [verification matrix](../ai-workflow-workspace/plans/edge-agent-feature-parity-002/implementation-verification-matrix.md) after each test is implemented

### Related Documentation
- [Implementation Verification Matrix](../ai-workflow-workspace/plans/edge-agent-feature-parity-002/implementation-verification-matrix.md) - Detailed status of implementation tasks
- [Execution Plan](./execution-plan.md) - Test execution checklist and status
- [Issue Tracking](./issue-tracking.md) - Known issues and remediation plan
- [Test Categories](./test-categories/) - Detailed test specifications
- [Missing Tests Plan](./test-categories/missing-tests-plan.md) - Specifications for tests that need to be created

## Reference Documents

- [Infrastructure Configuration](./infrastructure-config.md)
- [Issue Tracking](./issue-tracking.md)
- [Execution Plan](./execution-plan.md)

## Support

For additional support or questions, please contact the Optimizely Edge Agent team.

---

This documentation is part of the Optimizely Edge Agent Live Testing Framework. 