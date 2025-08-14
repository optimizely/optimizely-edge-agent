import { describe, it, expect } from 'vitest';
import * as optimizely from '@optimizely/optimizely-sdk';

describe('Optimizely SDK Type Integration', () => {
  it('should properly type check SDK usage', () => {
    // Initialize the SDK client
    const client = optimizely.createInstance({ sdkKey: 'test-key' });
    expect(client).toBeDefined();

    if (client) {
      // Create a user context
      const userContext = client.createUserContext('user-123', {
        country: 'US'
      });
      expect(userContext).toBeDefined();

      if (userContext) {
        // Get a decision using the SDK's methods
        const decision = userContext.decide('flag-key');
        expect(decision).toBeDefined();
        expect(typeof decision.enabled).toBe('boolean');
        expect(typeof decision.flagKey).toBe('string');

        // Track an event
        userContext.trackEvent('test-event', {
          value: 100
        });
      }
    }
  });
}); 