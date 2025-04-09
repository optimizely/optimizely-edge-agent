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
      return { 'test-flag': mockDecision };
    }),
    decideForKeys: vi.fn().mockImplementation((flagKeys: string[]) => {
      const result: Record<string, any> = {};
      flagKeys.forEach(flagKey => {
        result[flagKey] = mockDecision;
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
    createUserContext: vi.fn().mockReturnValue(mockUserContext),
    onReady: vi.fn().mockResolvedValue({ success: true }),
    close: vi.fn()
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
import * as optimizely from '@optimizely/optimizely-sdk';
import { DecisionService } from '../../../services/implementations/DecisionService';
import { MockLogger } from './mocks/MockLogger';
import { OptimizelyUserContext } from '../../../services/interfaces/IDecisionService';
import { MockConfigService } from './mocks/MockConfigService';

describe('Optimizely Forced Decisions - Simple Tests', () => {
  let decisionService: DecisionService;
  let configService: MockConfigService;
  let logger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new MockLogger();
    configService = new MockConfigService();
    configService.setupDefaultDatafile('test-key');
    decisionService = new DecisionService(configService, logger);
  });

  it('should force decisions and use them for subsequent calls', async () => {
    // Prepare test data
    const userContext: OptimizelyUserContext = { userId: 'test-user' };
    const options = { sdkKey: 'test-key' };
    const flagKey = 'test-flag';

    // 1. First decide call - normal decision
    const decision1 = await decisionService.decide(flagKey, userContext, options);
    expect(decision1.variationKey).toBe('variation-1');
    
    // Get reference to the mock client instance - use proper typing for vitest mocks
    const client = (optimizely.createInstance as ReturnType<typeof vi.fn>).mock.results[0].value;
    const userCtx = client.createUserContext.mock.results[0].value;
    
    // Set a forced decision
    userCtx.setForcedDecision({ flagKey }, { variationKey: 'forced-variation' });

    // 2. Second decide call with the same user - should use forced decision
    const decision2 = await decisionService.decide(flagKey, userContext, options);
    expect(decision2.variationKey).toBe('forced-variation');
  });
}); 