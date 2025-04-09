# Optimizely Edge Agent Testing Documentation

This directory contains documentation and guides for testing the Optimizely Edge Agent implementation.

## Testing Approach

The Optimizely Edge Agent uses a multi-layered testing approach:

1. **Unit Tests** - Validate individual components and their contracts
2. **Integration Tests** - Verify end-to-end workflows for Edge Mode and Agent Mode
3. **Live Deployment Tests** - Validate functionality against real Cloudflare, Vercel, or Fastly deployments

## Available Documentation

- [Live Deployment Testing Guide](./live-deployment-testing.md) - Comprehensive guide for testing against real Cloudflare Workers deployments

## Test Running

Tests can be run using the following commands:

```bash
# Run all tests
npm run test

# Run integration tests with mock environment
npm run test:integration

# Run only Edge Mode tests
npm run test:integration -- --edge-only

# Run only Agent Mode tests
npm run test:integration -- --agent-only
```

## Test Infrastructure

- **Test Runners**
  - `src-v2/tests/run-integration-tests.ts` - Runs integration tests for Edge Mode and Agent Mode
  - `src-v2/tests/run-url-matching-tests.ts` - Specialized runner for URL matching tests

- **Test Utilities**
  - `src-v2/tests/test-utils/TestEnvironment.ts` - Mock environments for each CDN platform
  - `src-v2/tests/test-utils/config.ts` - Configuration loading for tests

- **Test Files**
  - `src-v2/tests/integration/EdgeMode.test.ts` - Tests for GET requests (URL matching, content serving)
  - `src-v2/tests/integration/AgentMode.test.ts` - Tests for POST requests (decisions, events)
  - Various adapter-specific test files for each CDN provider

## Recent Enhancements

The following enhancements have been made to the testing infrastructure:

1. **Extended Agent Mode Test Coverage**
   - Decision options (includeReasons, excludeVariables) testing
   - Request configuration from different sources (headers, query params, body)
   - Multiple flag variation decisions
   - Advanced event tracking scenarios
   - Error handling and resilience
   - User profile service integration

2. **Improved Test Runner**
   - Better environment variable handling
   - Enhanced documentation for test configuration
   - Clear indication of live vs. mock testing

3. **Live Deployment Testing Guide**
   - Comprehensive setup instructions
   - Test environment configuration
   - Troubleshooting guidance
   - Best practices for CI/CD integration

## Next Steps

1. Run the complete test suite against a live Cloudflare Workers deployment
2. Add more specialized tests for edge cases and complex scenarios
3. Expand test coverage for Vercel and Fastly implementations 