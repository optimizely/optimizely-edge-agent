# Optimizely Testing Patterns Guide

This document outlines the established patterns for testing with the Optimizely SDK in the Optimizely Edge Agent project. These patterns ensure reliable and consistent testing of SDK integrations, particularly in the Cloudflare Workers environment.

## Core Testing Patterns

### 1. Vitest Configuration for Cloudflare Workers

The Vitest configuration needs to include the `nodejs_compat` flag to work correctly with the Cloudflare Workers environment:

```ts
// vitest.config.ts
export default defineConfig({
  // other configuration...
  compatibilityFlags: ['nodejs_compat'],
  // ...
});
```

### 2. Inline Mocking of Optimizely SDK

Always use inline mocking within the `vi.mock` callback to avoid hoisting issues:

```ts
// CORRECT approach - All mocking logic defined within the callback
vi.mock('@optimizely/optimizely-sdk', () => {
  // Define mock objects inside the callback
  const mockDecision = { /* ... */ };
  const mockUserContext = { /* ... */ };
  const mockClient = { /* ... */ };
  
  // Return the mock implementation
  return {
    createInstance: vi.fn().mockReturnValue(mockClient),
    OptimizelyDecideOption: { /* ... */ }
  };
});

// INCORRECT approach - importing external mock setup (will cause hoisting issues)
import { setupOptimizelySDKMock } from './mocks/optimizely-sdk-mock';
vi.mock('@optimizely/optimizely-sdk', async () => {
  return setupOptimizelySDKMock(); // This may cause reference errors due to hoisting
});
```

### 3. Mock Structure

Create a complete mock structure that matches the SDK's interface:

```ts
vi.mock('@optimizely/optimizely-sdk', () => {
  // Create a mock decision response
  const mockDecision = {
    variationKey: 'variation-1',
    enabled: true,
    flagKey: 'test-flag',
    variables: { test_variable: 'value' },
    reasons: [],
    ruleKey: 'rule-1'
  };

  // Mock user context
  const mockUserContext = {
    decide: vi.fn().mockReturnValue(mockDecision),
    decideAll: vi.fn().mockReturnValue({ 'test-flag': mockDecision }),
    decideForKeys: vi.fn().mockReturnValue({ 'test-flag': mockDecision }),
    trackEvent: vi.fn(),
    setAttribute: vi.fn(),
    getAttributes: vi.fn().mockReturnValue({})
    // Add other methods as needed
  };

  // Mock client
  const mockClient = {
    createUserContext: vi.fn().mockReturnValue(mockUserContext),
    onReady: vi.fn().mockResolvedValue({ success: true }),
    close: vi.fn()
  };

  return {
    createInstance: vi.fn().mockReturnValue(mockClient),
    OptimizelyDecideOption: {
      DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
      INCLUDE_REASONS: 'INCLUDE_REASONS',
      EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES',
      ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
      IGNORE_USER_PROFILE_SERVICE: 'IGNORE_USER_PROFILE_SERVICE'
    }
  };
});
```

### 4. Accessing Mock Instances in Tests

To access and verify mock instances:

```ts
it('should call the SDK correctly', async () => {
  await decisionService.decide('test-flag', userContext, options);
  
  // Get access to the mock client and user context that were created
  const mockClientInstance = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
  const mockUserContextInstance = mockClientInstance.createUserContext.mock.results[0].value;
  
  // Now you can verify calls on these specific instances
  expect(mockClientInstance.createUserContext).toHaveBeenCalledWith(
    userContext.userId,
    userContext.attributes
  );
  
  expect(mockUserContextInstance.decide).toHaveBeenCalledWith(
    'test-flag',
    expect.any(Array)
  );
});
```

### 5. Type Safety

Ensure proper type annotations for all mocks:

```ts
vi.mock('@optimizely/optimizely-sdk', () => {
  // Use proper type annotations
  const mockForcedFlags: Record<string, string> = {};
  
  const mockUserContext = {
    decide: vi.fn().mockImplementation((flagKey: string) => {
      // Implementation...
    }),
    setForcedDecision: vi.fn().mockImplementation((
      context: { flagKey: string }, 
      decision: { variationKey: string }
    ) => {
      // Implementation...
    })
    // Other methods...
  };
  
  // Rest of implementation...
});
```

### 6. Handling State in Tests

For tests requiring state (like forced decisions):

```ts
vi.mock('@optimizely/optimizely-sdk', () => {
  // Store state in a variable inside the mock closure
  const mockForcedFlags: Record<string, string> = {};
  
  const mockUserContext = {
    // Methods that update state
    setForcedDecision: vi.fn().mockImplementation((context, decision) => {
      mockForcedFlags[context.flagKey] = decision.variationKey;
      return true;
    }),
    
    // Methods that read state
    getForcedDecision: vi.fn().mockImplementation((context) => {
      if (mockForcedFlags[context.flagKey]) {
        return { variationKey: mockForcedFlags[context.flagKey] };
      }
      return null;
    }),
    
    // Methods that use state to determine behavior
    decide: vi.fn().mockImplementation((flagKey) => {
      if (mockForcedFlags[flagKey]) {
        return { 
          variationKey: mockForcedFlags[flagKey],
          // Other properties...
        };
      }
      // Return default decision
    })
  };
  
  // Rest of implementation...
});
```

## Test-Specific Patterns

### Testing Config Service

```ts
it('should fetch a datafile from storage', async () => {
  // Set up storage adapter mock
  (storageAdapter.get as any).mockResolvedValue(mockDatafile);
  
  // Execute
  const datafile = await configService.getDatafile('test-key');
  
  // Verify
  expect(storageAdapter.get).toHaveBeenCalledWith(
    expect.stringContaining('test-key'),
    'json'
  );
  expect(datafile).toEqual(mockDatafile);
});
```

### Testing Decision Service

```ts
it('should make a decision for a flag', async () => {
  // Set up a test flag and user
  const flagKey = 'test-flag';
  const userContext = { userId: 'user-123', attributes: {} };
  const options = { sdkKey: 'test-key' };
  
  // Execute
  const decision = await decisionService.decide(flagKey, userContext, options);
  
  // Verify SDK integration
  expect(optimizely.createInstance).toHaveBeenCalled();
  const mockClient = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
  expect(mockClient.createUserContext).toHaveBeenCalledWith(userContext.userId, userContext.attributes);
  
  // Verify decision result
  expect(decision.flagKey).toBe('test-flag');
  expect(decision.enabled).toBe(true);
});
```

### Testing Event Tracking

```ts
it('should track events', async () => {
  // Initialize SDK through a decision call
  await decisionService.decide('test-flag', { userId: 'user1' }, { sdkKey: 'test-key' });
  
  // Get reference to the user context
  const mockUserContext = (optimizely as any).__MOCK_USER_CONTEXT;
  
  // Track an event
  mockUserContext.trackEvent('purchase', { revenue: 100 });
  
  // Verify event was tracked
  expect(mockUserContext.trackEvent).toHaveBeenCalledWith('purchase', { revenue: 100 });
});
```

## Best Practices

1. **Always place imports after vi.mock calls** to avoid hoisting issues
2. **Reset mocks before each test** with `vi.clearAllMocks()`
3. **Create fresh test dependencies** in each test's setup
4. **Validate actual behavior** rather than implementation details where possible
5. **Use TypeScript to ensure type safety** for all mock objects
6. **Access specific mock instances** rather than using globally exported mock references
7. **Be aware of browser environment differences** in the Cloudflare Workers context

## Common Troubleshooting

1. **Hoisting issues**: Move all variable dependencies inside the vi.mock callback
2. **Mock reference problems**: Get the specific instance from the mock results rather than using shared references
3. **TypeScript errors**: Add proper type annotations to mock objects and functions
4. **Stateful test issues**: Reset state before each test; be aware of shared closure variables

By following these patterns, your Optimizely SDK tests will be more robust, maintainable, and reliable when running in the Cloudflare Workers environment. 