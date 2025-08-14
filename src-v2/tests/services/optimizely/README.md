# Optimizely SDK Integration Tests

This directory contains tests for validating the Optimizely Feature Experimentation SDK integration and type safety.

## Test Structure

The test suite is organized into the following files:

1. **types.test.ts**: Basic SDK type integration validation
2. **sdk-types.test.ts**: Advanced SDK type validations covering edge cases and API integrations
3. **decision.test.ts**: Tests for the DecisionService implementation and SDK decision methods
4. **event-tracking.test.ts**: Advanced tests for SDK event tracking functionality
5. **forced-decisions.test.ts**: Tests for SDK forced decision functionality
6. **integration.test.ts**: Higher-level integration tests between our services and the SDK

## Mock Implementations

Reusable mocks are located in the `mocks/` directory:

1. **MockLogger.ts**: Mock implementation of the ILoggerAdapter for testing
2. **MockConfigService.ts**: Mock implementation of the IConfigService for testing
3. **MockEventDispatcher.ts**: Mock implementation of the IEventDispatcher for testing
4. **optimizely-sdk-mock.ts**: Utilities for mocking the Optimizely SDK with customizable behavior

## Test Coverage

The test suite covers:

1. **Type Safety**: 
   - Verifying that our type definitions match the SDK's requirements
   - Testing complex and nested variable types
   - Validating type compatibility with SDK methods and objects

2. **Feature Flag Decisions**:
   - Testing the basic flag decision functionality
   - Validating decision options
   - Testing decision methods for multiple flags
   - Error handling for SDK decision failures

3. **Event Tracking**:
   - Validating event tracking functionality
   - Testing different event tag types
   - Error handling for event tracking
   - User attribute modification between events

4. **Forced Decisions**:
   - Setting and removing forced variations
   - Managing forced decisions across multiple flags
   - Verifying persistence of forced decisions
   - Testing interaction with regular decision flow

5. **Error Handling and Edge Cases**:
   - Handling missing datafiles
   - SDK client creation failures
   - Network errors
   - Invalid responses
   - Null values in decision results

## Running the Tests

Run the tests with:

```bash
npx vitest run src-v2/tests/services/optimizely/
```

Or run a specific test file:

```bash
npx vitest run src-v2/tests/services/optimizely/types.test.ts
```

## Future Test Improvements

Potential areas for expanding test coverage:

1. Testing SDK datafile synchronization
2. Advanced audience targeting tests
3. SDK notification listener tests
4. Performance benchmarks
5. Integration tests with actual Optimizely API endpoints (using mock servers)
6. Testing SDK client lifecycle (initialization, close) 