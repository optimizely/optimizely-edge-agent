# Optimizely SDK Integration Testing Guide

This document provides an overview of the testing approach for the Optimizely Feature Experimentation SDK integration in our application. It covers the test structure, mocking strategy, and how to run and extend the tests.

## Overview

Our testing approach ensures type safety, functionality, and error handling when integrating with the Optimizely SDK. Key aspects tested include:

- Type compatibility between our interfaces and the SDK's interfaces
- Feature flag decision functionality
- Event tracking
- Forced decisions (for debugging and testing)
- Error handling in various scenarios

## Test Structure

```
src-v2/tests/services/optimizely/
├── README.md                    # Overview documentation
├── types.test.ts                # Basic SDK type integration tests
├── sdk-types.test.ts            # Advanced SDK type validation
├── decision.test.ts             # Decision service functionality
├── event-tracking.test.ts       # Event tracking tests
├── forced-decisions.test.ts     # Forced variation tests
├── integration.test.ts          # Service integration tests
└── mocks/                       # Reusable mock implementations
    ├── MockLogger.ts            # Mock logger implementation
    ├── MockConfigService.ts     # Mock config service
    ├── MockEventDispatcher.ts   # Mock event dispatcher
    └── optimizely-sdk-mock.ts   # SDK mocking utilities
```

## Mocking Strategy

Our tests use a combination of:

1. **Direct SDK mocking**: The Optimizely SDK is mocked using Vitest's `vi.mock()` to provide controlled behavior.

2. **Reusable mock implementations**:
   - `MockLogger`: Captures log events for test verification
   - `MockConfigService`: Simulates datafile retrieval functionality
   - `MockEventDispatcher`: Simulates event dispatching functionality
   - `optimizely-sdk-mock.ts`: Provides consistent SDK mocking across test files

3. **Specialized mocks**: Some tests use specialized mocks to simulate specific behaviors (e.g., forced decisions).

## Running the Tests

To run the full test suite:

```bash
npx vitest run src-v2/tests/services/optimizely/
```

To run a specific test file:

```bash
npx vitest run src-v2/tests/services/optimizely/decision.test.ts
```

To run in watch mode during development:

```bash
npx vitest src-v2/tests/services/optimizely/
```

## Test Coverage Details

### Type Safety Tests

The type safety tests ensure:

- Our `OptimizelyUserContext` type is compatible with SDK requirements
- Our `OptimizelyDecision` type correctly maps to SDK decision objects
- Decision option enums are correctly defined
- Complex nested variable types are handled correctly
- The SDK client creation options and methods are correctly typed

### Decision Tests

These tests verify:

- Decision making using the SDK client
- Handling of specific flag types and variations
- Error handling for invalid flags
- Fallback behavior for missing datafiles
- Usage of decision options
- Multiple flag decisions (decideAll)

### Event Tracking Tests

These tests verify:

- Event tracking through the SDK user context
- Support for various event tag types (strings, numbers, objects)
- Multiple events in sequence
- Error handling during event tracking

### Forced Decisions Tests

These tests verify:

- Setting and applying forced decisions
- Retrieving forced decision information
- Removing specific forced decisions
- Removing all forced decisions
- Persistence of forced decisions across multiple decide calls

### Integration Tests

These tests verify:

- Interactions between our service implementations
- End-to-end decision flow
- Datafile handling
- Graceful degradation under error conditions

## Extending the Tests

When adding new tests:

1. **Use existing mocks**: Leverage the mock implementations in the `mocks/` directory.

2. **Add specialized mocks when needed**: For specific behaviors, extend the existing mocks or create new ones.

3. **Maintain test isolation**: Each test file should be independent and not rely on state from other tests.

4. **Mock the SDK consistently**: Preferably use the utilities in `optimizely-sdk-mock.ts` for consistent SDK mocking.

## Best Practices

1. **Test both successful and error scenarios**: Always include tests for error handling.

2. **Type safety**: Focus on maintaining type compatibility with the Optimizely SDK.

3. **Isolation**: Tests should be able to run independently and not affect each other.

4. **Clean up mocks**: Use `afterEach()` to reset mocks between tests.

5. **Documentation**: Update README.md when adding new test files or significant functionality.

## Future Improvements

The test suite could be expanded to include:

1. **Datafile synchronization**: Tests for automatic datafile updates.

2. **Advanced audience targeting**: Tests for complex targeting rules.

3. **SDK notification listeners**: Tests for event notifications from the SDK.

4. **Performance benchmarks**: Tests to ensure optimization changes don't degrade performance.

5. **Integration with actual API endpoints**: Using mock servers to simulate real API interactions.

6. **SDK lifecycle testing**: Tests for SDK initialization, configuration, and cleanup. 