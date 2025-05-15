# Optimizely Edge Agent Documentation Index

This directory contains documentation for the Optimizely Edge Agent, focusing on the `src-v2` implementation.

## Test Status and Results

✅ **ALL TESTS PASSING** - The Optimizely SDK integration tests have been fixed and verified.

- [**Test Results**](./test-results.md) - Comprehensive test status report with verification commands
- [**Verification Summary**](./verification-summary.md) - Overview of the test fixes applied
- [**Optimizely Testing Patterns**](./optimizely-testing-patterns.md) - Guide to effective testing patterns for the Optimizely SDK

## Implementation Documentation

- [**Completion Report**](./completion-report.md) - Final report on the test fixing process
- [**Implementation Summary**](./implementation-summary.md) - Overview of the implementation approach
- [**CDN Adapters**](./cdn-adapters.md) - Documentation for using multiple CDN environments (Cloudflare, Vercel, Fastly)
- [**Adapter Implementation Summary**](./adapter-implementation-summary.md) - Summary of the CDN adapter implementation process
- [**Metrics Implementation**](./metrics-implementation.md) - Comprehensive documentation of the metrics system and enhancement plans
- [**Metrics Enhancements Status**](./metrics-enhancements-status.md) - Status report of requested metrics enhancements
- [**Metrics Enhancements PR Template**](./metrics-enhancements-pr-template.md) - Ready-to-use PR template for implementing metrics enhancements

## Troubleshooting and Reference Guides

- [**Testing Troubleshooting**](./testing-troubleshooting.md) - Solutions to common testing issues
- [**Optimizely Testing**](./optimizely-testing.md) - Guide to testing with the Optimizely SDK

## Architecture Documentation

For the overall project architecture, please see the main [Architecture Documentation](../../docs/ARCHITECTURE.md).

## Recent Updates

- May 14, 2025: Added comprehensive metrics system documentation and enhancement plans
- May 14, 2025: Created metrics enhancements status report and PR template
- May 14, 2025: Updated implementation plan with detailed metrics enhancement instructions
- April 5, 2025: Implemented Vercel and Fastly adapters for multi-CDN support
- April 5, 2025: Updated Composition Root to support multiple CDN environments
- April 5, 2025: Added CDN adapter documentation
- April 4, 2025: Fixed and verified all Optimizely SDK integration tests
- April 4, 2025: Added comprehensive test documentation
- April 4, 2025: Created testing patterns guide for the Optimizely SDK

## How to Run Tests

To verify the test status:

```bash
# Run all Optimizely SDK tests
npx vitest run src-v2/tests/services/optimizely

# Run specific test files
npx vitest run src-v2/tests/services/optimizely/config.test.ts
npx vitest run src-v2/tests/services/optimizely/event-tracking.test.ts
npx vitest run src-v2/tests/services/optimizely/forced-decisions.test.ts

# Run all fixed test files together
npx vitest run src-v2/tests/services/optimizely/integration.test.ts src-v2/tests/services/optimizely/decision.test.ts src-v2/tests/services/optimizely/config.test.ts src-v2/tests/services/optimizely/event-tracking.test.ts src-v2/tests/services/optimizely/forced-decisions.test.ts src-v2/tests/services/optimizely/types.test.ts src-v2/tests/services/optimizely/sdk-types.test.ts
```

For more detailed information about the test fixes and patterns established, refer to the [Test Results](./test-results.md) documentation. 