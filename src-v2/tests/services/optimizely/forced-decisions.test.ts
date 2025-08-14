import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Optimizely SDK directly with an inline mock
vi.mock('@optimizely/optimizely-sdk', () => {
  // Create a mock decision response
  const mockDecision = {
    variationKey: 'variation-1',
    enabled: true,
    flagKey: 'test-flag',
    variables: { test_variable: 'default' },
    reasons: [],
    ruleKey: 'rule-1'
  };

  const forcedDecisionMock = {
    variationKey: 'forced-variation',
    enabled: true,
    flagKey: 'test-flag',
    variables: { test_variable: 'forced' },
    reasons: ['forced_decision'],
    ruleKey: 'rule-1'
  };

  // Use a simple object to track forced decisions
  const mockForcedFlags: Record<string, string> = {};

  // Mock user context with forced decision support
  const mockUserContext = {
    decide: vi.fn().mockImplementation((flagKey: string) => {
      if (mockForcedFlags[flagKey]) {
        return { 
          ...forcedDecisionMock, 
          flagKey,
          variationKey: mockForcedFlags[flagKey] 
        };
      }
      return { ...mockDecision, flagKey };
    }),
    decideAll: vi.fn().mockImplementation(() => {
      const result: Record<string, any> = {};
      const allFlags = ['test-flag', 'another-flag', 'third-flag'];
      
      for (const flagKey of allFlags) {
        if (mockForcedFlags[flagKey]) {
          result[flagKey] = { 
            ...forcedDecisionMock, 
            flagKey,
            variationKey: mockForcedFlags[flagKey] 
          };
        } else {
          result[flagKey] = { ...mockDecision, flagKey };
        }
      }
      
      return result;
    }),
    decideForKeys: vi.fn().mockImplementation((flagKeys: string[]) => {
      const result: Record<string, any> = {};
      flagKeys.forEach(flagKey => {
        if (mockForcedFlags[flagKey]) {
          result[flagKey] = { 
            ...forcedDecisionMock, 
            flagKey,
            variationKey: mockForcedFlags[flagKey] 
          };
        } else {
          result[flagKey] = { ...mockDecision, flagKey };
        }
      });
      return result;
    }),
    trackEvent: vi.fn(),
    setAttribute: vi.fn(),
    getAttributes: vi.fn().mockReturnValue({}),

    // Forced decision methods
    setForcedDecision: vi.fn().mockImplementation((context: { flagKey: string }, decision: { variationKey: string }) => {
      const flagKey = context.flagKey;
      mockForcedFlags[flagKey] = decision.variationKey;
      return true;
    }),
    getForcedDecision: vi.fn().mockImplementation((context: { flagKey: string }) => {
      const flagKey = context.flagKey;
      if (mockForcedFlags[flagKey]) {
        return { variationKey: mockForcedFlags[flagKey] };
      }
      return null;
    }),
    removeForcedDecision: vi.fn().mockImplementation((context: { flagKey: string }) => {
      const flagKey = context.flagKey;
      if (mockForcedFlags[flagKey]) {
        delete mockForcedFlags[flagKey];
        return true;
      }
      return false;
    }),
    removeAllForcedDecisions: vi.fn().mockImplementation(() => {
      Object.keys(mockForcedFlags).forEach(key => delete mockForcedFlags[key]);
      return true;
    })
  };

  // Mock client
  const mockClient = {
    createUserContext: vi.fn().mockImplementation((userId, attributes) => {
      // Special handling for attributes with forcedDecisions
      if (attributes && attributes.forcedDecisions) {
        // Apply the forced decisions from attributes
        for (const [flagKey, decision] of Object.entries(attributes.forcedDecisions)) {
          if (typeof decision === 'object' && decision !== null && 'variationKey' in decision) {
            mockForcedFlags[flagKey] = decision.variationKey;
          }
        }
      }
      return mockUserContext;
    }),
    onReady: vi.fn().mockResolvedValue({ success: true }),
    close: vi.fn(),
    setForcedVariation: vi.fn().mockImplementation((flagKey, userId, variationKey) => {
      if (variationKey === null) {
        delete mockForcedFlags[flagKey];
      } else {
        mockForcedFlags[flagKey] = variationKey;
      }
      return true;
    }),
    getForcedVariation: vi.fn().mockImplementation((flagKey, userId) => {
      return mockForcedFlags[flagKey] || null;
    })
  };

  // The mock SDK with consistent implementation
  return {
    // Return createInstance that consistently returns the mockClient
    createInstance: vi.fn().mockReturnValue(mockClient),
    
    // Required enum values
    OptimizelyDecideOption: {
      DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
      INCLUDE_REASONS: 'INCLUDE_REASONS',
      EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES',
      ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
      IGNORE_USER_PROFILE_SERVICE: 'IGNORE_USER_PROFILE_SERVICE'
    }
  };
});

// Import all dependencies after vi.mock
import * as optimizely from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';
import { DecisionService } from '../../../services/implementations/DecisionService';
import { MockLogger } from './mocks/MockLogger';
import { OptimizelyUserContext } from '../../../services/interfaces/IDecisionService';
import { MockConfigService } from './mocks/MockConfigService';

/**
 * Comprehensive Unit Tests for Forced Decisions
 * 
 * These tests validate:
 * 1. Configuration-passed forcedDecisions (attributes.forcedDecisions)
 * 2. SDK's setForcedDecision method interaction
 * 3. Precedence between config-based and SDK-based forced decisions
 * 4. Removal functionality (removeForcedDecision, removeAllForcedDecisions)
 * 5. Complex scenarios with multiple flags
 */
describe('Optimizely Forced Decisions - Comprehensive Tests', () => {
  let decisionService: DecisionService;
  let configService: MockConfigService;
  let logger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new MockLogger();
    configService = new MockConfigService();
    configService.setupDefaultDatafile('test-key');
    decisionService = new DecisionService(configService, logger);
    
    // Reset the mockForcedFlags object by calling removeAllForcedDecisions
    const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (client) {
      const userCtx = client.createUserContext('reset-user', {});
      userCtx.removeAllForcedDecisions();
    }
  });

  /**
   * Section 1: Configuration-passed forcedDecisions
   * Tests that forcedDecisions provided via attributes are correctly applied
   */
  describe('Configuration-passed forcedDecisions', () => {
    it('should apply forcedDecisions from user attributes', async () => {
      // Define test data with forcedDecisions in attributes
      const userContext: OptimizelyUserContext = { 
        userId: 'test-user',
        attributes: {
          country: 'US',
          forcedDecisions: {
            'test-flag': { variationKey: 'attr-forced-variation' }
          }
        }
      };
      const options = { sdkKey: 'test-key' };
      
      // Get decision for the flag with a forced decision
      const decision = await decisionService.decide('test-flag', userContext, options);
      
      // Verify the forced decision was applied
      expect(decision.variationKey).toBe('attr-forced-variation');
      expect(decision.reasons).toContain('forced_decision');
    });
    
    it('should apply forcedDecisions from attributes for multiple flags', async () => {
      // Define test data with multiple forcedDecisions
      const userContext: OptimizelyUserContext = { 
        userId: 'test-user',
        attributes: {
          country: 'US',
          forcedDecisions: {
            'test-flag': { variationKey: 'attr-forced-1' },
            'another-flag': { variationKey: 'attr-forced-2' }
          }
        }
      };
      const options = { sdkKey: 'test-key' };
      const flagKeys = ['test-flag', 'another-flag', 'third-flag'];
      
      // Get decisions for all flags
      const decisions = await decisionService.decideAll(userContext, flagKeys, options);
      
      // Verify the forced decisions were applied
      expect(decisions['test-flag'].variationKey).toBe('attr-forced-1');
      expect(decisions['another-flag'].variationKey).toBe('attr-forced-2');
      // Third flag should not be forced
      expect(decisions['third-flag'].variationKey).not.toBe('attr-forced-1');
      expect(decisions['third-flag'].variationKey).not.toBe('attr-forced-2');
    });

    it('should handle complex attribute structures containing forcedDecisions', async () => {
      // Define test data with forcedDecisions nested in a complex attributes object
      const userContext: OptimizelyUserContext = { 
        userId: 'test-user',
        attributes: {
          demographics: {
            country: 'US',
            age: 30
          },
          subscription: {
            tier: 'premium',
            startDate: '2023-01-01'
          },
          forcedDecisions: {
            'complex-flag': { variationKey: 'complex-variation' }
          }
        }
      };
      const options = { sdkKey: 'test-key' };
      
      // Get decision for the flag
      const decision = await decisionService.decide('complex-flag', userContext, options);
      
      // Verify the forced decision was applied despite complex attributes
      expect(decision.variationKey).toBe('complex-variation');
    });
  });

  /**
   * Section 2: SDK's setForcedDecision method
   * Tests that setForcedDecision works correctly and overrides default bucketing
   */
  describe('SDK setForcedDecision method', () => {
    it('should force decision via setForcedDecision method', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'test-user' };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'test-flag';

      // First decide call - normal decision
      const decision1 = await decisionService.decide(flagKey, userContext, options);
      expect(decision1.variationKey).toBe('variation-1');
      
      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set a forced decision
      const setResult = userCtx.setForcedDecision({ flagKey }, { variationKey: 'sdk-forced-variation' });
      expect(setResult).toBe(true);

      // Second decide call with the same user - should use forced decision
      const decision2 = await decisionService.decide(flagKey, userContext, options);
      expect(decision2.variationKey).toBe('sdk-forced-variation');
      expect(decision2.reasons).toContain('forced_decision');
    });
    
    it('should verify getForcedDecision returns the correct forced decision', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'test-user' };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'test-flag';

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Initially, there should be no forced decision
      const initialForcedDecision = userCtx.getForcedDecision({ flagKey });
      expect(initialForcedDecision).toBeNull();
      
      // Set a forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'get-test-variation' });
      
      // Now getForcedDecision should return the forced decision
      const forcedDecision = userCtx.getForcedDecision({ flagKey });
      expect(forcedDecision).not.toBeNull();
      expect(forcedDecision?.variationKey).toBe('get-test-variation');
    });
    
    it('should expose setForcedVariation and getForcedVariation methods', async () => {
      // These are lower-level SDK methods that should also be available
      
      // Prepare test data
      const userId = 'direct-api-user';
      const flagKey = 'direct-api-flag';
      const options = { sdkKey: 'test-key' };
      
      // Get reference to the mock client
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      // Set a forced variation directly on the client
      const setResult = client.setForcedVariation(flagKey, userId, 'direct-forced-var');
      expect(setResult).toBe(true);
      
      // Get the forced variation
      const forcedVar = client.getForcedVariation(flagKey, userId);
      expect(forcedVar).toBe('direct-forced-var');
      
      // Verify it affects decisions
      const userContext: OptimizelyUserContext = { userId };
      const decision = await decisionService.decide(flagKey, userContext, options);
      expect(decision.variationKey).toBe('direct-forced-var');
    });
  });

  /**
   * Section 3: Precedence between config-based and SDK-based forced decisions
   * Tests which type of forced decision takes precedence when both are present
   */
  describe('Precedence between config and SDK forced decisions', () => {
    it('should respect SDK forced decisions over attribute forced decisions', async () => {
      // Define test data with forcedDecisions in attributes
      const userContext: OptimizelyUserContext = { 
        userId: 'precedence-test-user',
        attributes: {
          forcedDecisions: {
            'precedence-flag': { variationKey: 'attr-forced-variation' }
          }
        }
      };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'precedence-flag';
      
      // First decision should use attribute-based forced decision
      const decision1 = await decisionService.decide(flagKey, userContext, options);
      expect(decision1.variationKey).toBe('attr-forced-variation');
      
      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Now set an SDK-based forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'sdk-forced-variation' });
      
      // Second decision should use SDK-based forced decision, overriding attributes
      const decision2 = await decisionService.decide(flagKey, userContext, options);
      expect(decision2.variationKey).toBe('sdk-forced-variation');
    });
    
    it('should use the most recently set SDK forced decision', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'test-user' };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'recent-test-flag';

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set a first forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'first-variation' });
      
      // Set a second forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'second-variation' });
      
      // Decision should use the most recent forced decision
      const decision = await decisionService.decide(flagKey, userContext, options);
      expect(decision.variationKey).toBe('second-variation');
    });
  });

  /**
   * Section 4: Removal functionality
   * Tests for removeForcedDecision and removeAllForcedDecisions
   */
  describe('Removal of forced decisions', () => {
    it('should remove a specific forced decision with removeForcedDecision', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'removal-test-user' };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'removal-test-flag';

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set a forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'forced-to-remove' });
      
      // First decision should use the forced decision
      const decision1 = await decisionService.decide(flagKey, userContext, options);
      expect(decision1.variationKey).toBe('forced-to-remove');
      
      // Remove the forced decision
      const removeResult = userCtx.removeForcedDecision({ flagKey });
      expect(removeResult).toBe(true);
      
      // Second decision should use normal bucketing
      const decision2 = await decisionService.decide(flagKey, userContext, options);
      expect(decision2.variationKey).toBe('variation-1'); // The default from the mock
    });
    
    it('should return false when removing a non-existent forced decision', async () => {
      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Try to remove a forced decision that doesn't exist
      const removeResult = userCtx.removeForcedDecision({ flagKey: 'nonexistent-flag' });
      expect(removeResult).toBe(false);
    });
    
    it('should remove all forced decisions with removeAllForcedDecisions', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'bulk-removal-user' };
      const options = { sdkKey: 'test-key' };
      const flagKeys = ['flag1', 'flag2', 'flag3'];

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set forced decisions for multiple flags
      flagKeys.forEach((flagKey, index) => {
        userCtx.setForcedDecision({ flagKey }, { variationKey: `forced-var-${index}` });
      });
      
      // Verify forced decisions are applied
      for (const flagKey of flagKeys) {
        const decision = await decisionService.decide(flagKey, userContext, options);
        expect(decision.variationKey).toContain('forced-var');
      }
      
      // Remove all forced decisions
      const removeAllResult = userCtx.removeAllForcedDecisions();
      expect(removeAllResult).toBe(true);
      
      // Verify all forced decisions are removed
      for (const flagKey of flagKeys) {
        const decision = await decisionService.decide(flagKey, userContext, options);
        expect(decision.variationKey).toBe('variation-1'); // The default from the mock
      }
    });
  });

  /**
   * Section 5: Multiple flags and complex scenarios
   * Tests involving multiple flags and more complex use cases
   */
  describe('Complex scenarios with multiple flags', () => {
    it('should handle different forced decisions for different flags', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'multi-flag-user' };
      const options = { sdkKey: 'test-key' };
      const flagKeys = ['flag1', 'flag2', 'flag3'];

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set different forced decisions for each flag
      flagKeys.forEach((flagKey, index) => {
        userCtx.setForcedDecision({ flagKey }, { variationKey: `multi-var-${index}` });
      });
      
      // Get all decisions at once
      const allDecisions = await decisionService.decideAll(userContext, flagKeys, options);
      
      // Verify each flag has its own forced decision
      flagKeys.forEach((flagKey, index) => {
        expect(allDecisions[flagKey].variationKey).toBe(`multi-var-${index}`);
      });
    });
    
    it('should maintain forced decisions across multiple decide calls', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'persistence-user' };
      const options = { sdkKey: 'test-key' };
      const flagKey = 'persistence-flag';

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set forced decision
      userCtx.setForcedDecision({ flagKey }, { variationKey: 'persistent-variation' });
      
      // Make multiple decide calls
      const decision1 = await decisionService.decide(flagKey, userContext, options);
      const decision2 = await decisionService.decide(flagKey, userContext, options);
      const decision3 = await decisionService.decide(flagKey, userContext, options);
      
      // All decisions should be the same forced decision
      expect(decision1.variationKey).toBe('persistent-variation');
      expect(decision2.variationKey).toBe('persistent-variation');
      expect(decision3.variationKey).toBe('persistent-variation');
    });
    
    it('should handle mixed forced and non-forced decisions in decideAll', async () => {
      // Prepare test data
      const userContext: OptimizelyUserContext = { userId: 'mixed-user' };
      const options = { sdkKey: 'test-key' };
      const flagKeys = ['forced-flag-1', 'normal-flag', 'forced-flag-2'];

      // Get reference to the mock client and user context
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      const userCtx = client.createUserContext.mock.results[0].value;
      
      // Set forced decisions for some flags but not all
      userCtx.setForcedDecision({ flagKey: 'forced-flag-1' }, { variationKey: 'mixed-var-1' });
      userCtx.setForcedDecision({ flagKey: 'forced-flag-2' }, { variationKey: 'mixed-var-2' });
      
      // Get all decisions at once
      const allDecisions = await decisionService.decideAll(userContext, flagKeys, options);
      
      // Verify the expected variations
      expect(allDecisions['forced-flag-1'].variationKey).toBe('mixed-var-1');
      expect(allDecisions['normal-flag'].variationKey).toBe('variation-1'); // Default
      expect(allDecisions['forced-flag-2'].variationKey).toBe('mixed-var-2');
    });
    
    it('should properly propagate forced decision information through helper methods', async () => {
      // This tests that the higher-level methods (getDecision, getAllDecisions) properly handle forced decisions
      
      // Prepare test data
      const userId = 'helper-test-user';
      const attributes = {};
      const options = { sdkKey: 'test-key' };
      const flagKey = 'helper-test-flag';

      // Get reference to the mock client and set a forced variation directly
      const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
      client.setForcedVariation(flagKey, userId, 'helper-forced-var');
      
      // Use the helper method getDecision
      const decision = await decisionService.getDecision(userId, flagKey, attributes, options);
      expect(decision.variationKey).toBe('helper-forced-var');
      
      // Use the helper method getAllDecisions
      const allDecisions = await decisionService.getAllDecisions(userId, attributes, options);
      expect(allDecisions[flagKey].variationKey).toBe('helper-forced-var');
    });
  });
}); 