---
type: documentation
description: "Overview of test-specific discrepancies between local and live environments"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Test-Specific Discrepancies Between Local and Live Environments

This document provides an overview of discrepancies identified between tests running in the local environment versus the live Cloudflare Workers environment. These discrepancies were detected using the LiveTestRunner's comparison capability.

## Overview of Discrepancy Types

Based on the comparison results, discrepancies can be categorized into the following types:

1. **Status Code Mismatches**: Different HTTP status codes returned by local and live environments
2. **Response Body Differences**: Variations in response content between environments
3. **Headers Differences**: Missing or different HTTP headers between environments
4. **Performance Variations**: Timing differences between local and live execution
5. **Error Handling Differences**: Different error messages or handling mechanisms
6. **Data Processing Differences**: Variations in how data is processed or transformed
7. **Cache Behavior Differences**: Local vs. edge cache behavior variations
8. **Environmental Dependencies**: Behaviors tied to specific environment characteristics

## Common Patterns Observed

The following patterns were frequently observed across multiple tests:

1. **Missing Cloudflare-Specific Headers**: Live environment includes Cloudflare-specific headers (`cf-ray`, `cf-cache-status`, etc.) not present in local environment
2. **Performance Differences**: Live environment typically has higher response times but more consistent performance
3. **URL Normalization**: Different URL normalization behavior between environments
4. **Cache Key Computation**: Differences in how cache keys are computed and utilized
5. **Error Detail Level**: Live environment often provides less detailed error messages than local

## Test Execution Process

All tests were executed using the following process:

1. Run test in local environment using LocalTestRunner
2. Run identical test against live environment using LiveTestRunner
3. Compare responses using the `_compareResults` method
4. Document discrepancies in individual test-specific files
5. Analyze patterns across all test results

## Test-Specific Discrepancies Summary

| Test Name | Status Match | Discrepancy Count | Severity | Categories |
|-----------|--------------|-------------------|----------|------------|
| infrastructure-verification.js | ❌ No | 3 | Medium | Headers, Performance |
| decision-api-test.js | ❌ No | 7 | High | Status Codes, Response Body |
| parameter-validation-test.js | ❌ No | 5 | Medium | Error Handling |
| forced-variation-tests.js | ❌ No | 8 | High | Response Body, Cache Behavior |
| parameter-handling-tests.js | ❌ No | 6 | Medium | Data Processing |
| kv-storage-tests.js | ❌ No | 12 | Critical | Cache Behavior, Data Persistence |
| cdn-variation-test.js | ❌ No | 4 | Medium | Response Headers, Caching |
| lowercase-variation-test.js | ✅ Yes | 0 | N/A | N/A |
| feature-parity-test.js | ❌ No | 9 | High | Response Body, Error Handling |

## Discrepancy Severity Assessment

Discrepancy severity is assessed using the following criteria:

- **Critical**: Fundamentally different behavior that breaks core functionality
- **High**: Significant differences that affect test outcomes or reliability
- **Medium**: Notable differences that require awareness but don't break functionality
- **Low**: Minor differences that don't impact functionality or test outcomes

## Test Discrepancy Documentation

Detailed documentation for each test's specific discrepancies is available in individual files:

- [Infrastructure Verification Discrepancies](./infrastructure-verification-discrepancies.md)
- [Decision API Test Discrepancies](./decision-api-test-discrepancies.md)
- [Parameter Validation Test Discrepancies](./parameter-validation-test-discrepancies.md)
- [Forced Variation Tests Discrepancies](./forced-variation-tests-discrepancies.md)
- [Parameter Handling Tests Discrepancies](./parameter-handling-tests-discrepancies.md)
- [KV Storage Tests Discrepancies](./kv-storage-tests-discrepancies.md)
- [CDN Variation Test Discrepancies](./cdn-variation-test-discrepancies.md)
- [Lowercase Variation Test Discrepancies](./lowercase-variation-test-discrepancies.md)
- [Feature Parity Test Discrepancies](./feature-parity-test-discrepancies.md)

## Next Steps

Based on the identified discrepancies, the following actions are recommended:

1. **Environment-Aware Tests**: Modify tests to be aware of environment-specific behaviors
2. **Normalization Hooks**: Implement response normalization to handle known differences
3. **Tolerance Parameters**: Add configurable tolerance for acceptable differences
4. **Environment-Specific Assertions**: Create environment-conditional assertions
5. **Controlled Test Suite**: Develop a test suite that accounts for all documented discrepancies

These recommendations will be incorporated into the next phase of the implementation plan. 