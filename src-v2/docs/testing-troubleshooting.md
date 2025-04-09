# Optimizely SDK Testing Troubleshooting Guide

This document provides guidance for addressing common issues when running tests for the Optimizely SDK integration.

## Configuration Issues

### Vitest Configuration Error

When running the tests, you might encounter the following error:

```
Error: In project vitest.config.ts, `test.poolOptions.workers.miniflare.compatibilityFlags` must contain "export_commonjs_default"
```

#### How to Fix

This error relates to the Vitest configuration for testing Cloudflare Workers. To fix this issue:

1. Open `vitest.config.ts` in the project root
2. Locate the `test.poolOptions.workers.miniflare.compatibilityFlags` configuration
3. Add `"export_commonjs_default"` to the array of compatibility flags:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Other config...
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityFlags: [
            // Existing flags...
            "export_commonjs_default"
          ]
        }
      }
    }
  }
});
```

4. Save the file and run the tests again

## Type Errors in Test Files

### Mock Object Type Errors

If you encounter type errors like:

```
Object literal may only specify known properties, and 'property' does not exist in type 'Interface'
```

#### How to Fix

Use type assertions to satisfy TypeScript while keeping the mock functionality:

```typescript
const createMockAdapter = () => ({
  someMethod: vi.fn()
}) as unknown as ExpectedInterface;

// When using the mock
(mockObject as any).property.mockReturnValue(...);
```

## Testing Specific Components

### Running Individual Test Files

To test specific components or functionality:

```bash
# Run only the decision service tests
npx vitest run src-v2/tests/services/optimizely/decision.test.ts

# Run only the event tracking tests
npx vitest run src-v2/tests/services/optimizely/event-tracking.test.ts

# Run only the type safety tests
npx vitest run src-v2/tests/services/optimizely/sdk-types.test.ts
```

### Running Tests in Watch Mode

During development, you can use watch mode to automatically re-run tests when files change:

```bash
npx vitest src-v2/tests/services/optimizely/
```

## Debugging Test Failures

If tests are failing, try these strategies:

1. **Check Interface Compatibility**: Ensure mock implementations match the expected interfaces
2. **Verify Type Assertions**: Make sure all type assertions are properly applied
3. **Review Mock Behavior**: Confirm mocks return the expected values and formats
4. **Check for Missing Properties**: Verify all required properties are included in mock objects
5. **Run Tests Individually**: Run tests one by one to isolate the failing test

## Getting Test Coverage Reports

To get test coverage reports:

```bash
npx vitest run --coverage src-v2/tests/services/optimizely/
```

This will generate a coverage report showing which parts of the code are covered by tests.

## Maintaining Test Mocks

As the interfaces evolve, the test mocks may need to be updated. Keep these guidelines in mind:

1. **Keep Mocks Focused**: Mocks should only implement the methods needed for testing
2. **Update Mocks When Interfaces Change**: When interfaces are updated, update the corresponding mocks
3. **Share Common Mock Logic**: Use helper functions for common mock behavior
4. **Document Special Mock Behavior**: Comment any special behavior in mocks 