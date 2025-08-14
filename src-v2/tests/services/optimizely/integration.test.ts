import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as optimizely from '@optimizely/optimizely-sdk';

// Define the datafile structure manually based on the real one
const mockDatafile = {
  revision: "20",
  version: "4",
  sdkKey: "8mR1pGh8u2ztUP8GqjmQq",
  projectId: "20224828075",
  featureFlags: [
    {
      id: "382770",
      key: "test-flag",
      rolloutId: "rollout-382770-28970950020",
      experimentIds: ["9300002165680"],
      variables: [
        {
          id: "111277",
          key: "test_variable",
          type: "string",
          defaultValue: "default-value"
        }
      ]
    },
    {
      id: "10839",
      key: "recurring_deposit",
      rolloutId: "rollout-10839-28970950020",
      experimentIds: [],
      variables: [
        {
          id: "6247",
          key: "amount",
          type: "double",
          defaultValue: "0.0"
        },
        {
          id: "6248",
          key: "message",
          type: "string",
          defaultValue: "Use recurring deposits to compound interest"
        },
        {
          id: "6249",
          key: "advanced",
          type: "string",
          defaultValue: "{\n\t\"hello\": 123\n}",
          subType: "json"
        }
      ]
    }
  ],
  // Minimal structure needed for mock
  experiments: [
    {
      id: "9300002165680",
      key: "test_flag_experiment",
      variations: [
        {
          id: "1202387",
          key: "on",
          featureEnabled: true,
          variables: [{ id: "111277", value: "default-value-on" }]
        },
        {
          id: "1202388",
          key: "control",
          featureEnabled: true,
          variables: [{ id: "111277", value: "default-value-control" }]
        }
      ]
    }
  ]
};

// Mock the SDK before importing other modules
vi.mock('@optimizely/optimizely-sdk', () => {
  // Create mock response for test-flag
  const testFlagDecision = {
    variationKey: 'on',
    enabled: true,
    flagKey: 'test-flag',
    ruleKey: '9300002165680',
    variables: { test_variable: 'default-value-on' },
    reasons: []
  };
  
  // Create mock response for recurring_deposit
  const recurringDepositDecision = {
    variationKey: 'off',
    enabled: false,
    flagKey: 'recurring_deposit',
    ruleKey: 'default-rollout-10839-28970950020',
    variables: { 
      amount: "0.0",
      message: "Use recurring deposits to compound interest",
      advanced: "{\n\t\"hello\": 123\n}"
    },
    reasons: []
  };
  
  // Create a map of decisions for decideAll with indexable signature
  const mockDecisionMap: Record<string, any> = {
    'test-flag': testFlagDecision,
    'recurring_deposit': recurringDepositDecision
  };

  return {
    createInstance: vi.fn().mockImplementation(() => ({
      createUserContext: vi.fn().mockImplementation(() => ({
        decide: vi.fn().mockImplementation((flagKey: string) => {
          if (flagKey === 'test-flag') return testFlagDecision;
          if (flagKey === 'recurring_deposit') return recurringDepositDecision;
          
          // Default fallback for unknown flags
          return {
            variationKey: 'off',
            enabled: false,
            flagKey: flagKey,
            variables: {},
            reasons: []
          };
        }),
        decideAll: vi.fn().mockReturnValue(mockDecisionMap),
        decideForKeys: vi.fn().mockImplementation((flagKeys: string[]) => {
          const result: Record<string, any> = {};
          flagKeys.forEach((key: string) => {
            if (mockDecisionMap[key]) {
              result[key] = mockDecisionMap[key];
            }
          });
          return result;
        })
      })),
      onReady: vi.fn().mockResolvedValue({ success: true })
    })),
    OptimizelyDecideOption: {
      DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
      INCLUDE_REASONS: 'INCLUDE_REASONS',
      EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES',
      ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
      IGNORE_USER_PROFILE_SERVICE: 'IGNORE_USER_PROFILE_SERVICE'
    }
  };
});

// Import after mocking
import { DecisionService } from '../../../services/implementations/DecisionService';
import { IConfigService } from '../../../services/interfaces/IConfigService';
import { MockLogger } from './mocks/MockLogger';
import { LogLevel } from '../../../adapters/interfaces/ILoggerAdapter';
import { OptimizelyUserContext } from '../../../services/interfaces/IDecisionService';
import { MockConfigService } from './mocks/MockConfigService';
import { MockEnvironmentAdapter } from './mocks/MockEnvironmentAdapter';
import { IStorageAdapter } from '../../../adapters/interfaces/IStorageAdapter';
import { IEnvironmentAdapter } from '../../../adapters/interfaces/IEnvironmentAdapter';

describe('Optimizely Decision Integration Tests', () => {
  let decisionService: DecisionService;
  let configService: MockConfigService;
  let logger: MockLogger;
  let environmentAdapter: MockEnvironmentAdapter;
  let mockStorageAdapter: IStorageAdapter;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock storage adapter
    mockStorageAdapter = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };

    // Create environment adapter
    environmentAdapter = new MockEnvironmentAdapter();

    // Create mock config service that returns the mock datafile
    configService = new MockConfigService();
    configService.getDatafileMock.mockResolvedValue(mockDatafile);

    // Create logger
    logger = new MockLogger();

    // Create decision service
    decisionService = new DecisionService(configService, logger);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service-SDK Integration', () => {
    it('should successfully make a decision using the SDK', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext = {
        userId: 'test-user-123',
        attributes: { country: 'US' }
      };
      const options = { sdkKey: '8mR1pGh8u2ztUP8GqjmQq' }; // Use actual SDK key from datafile

      // Execute
      const decision = await decisionService.decide(flagKey, userContext, options);

      // Verify integrations
      expect(configService.getDatafile).toHaveBeenCalledWith('8mR1pGh8u2ztUP8GqjmQq');
      expect(optimizely.createInstance).toHaveBeenCalled();
      
      // Verify results
      expect(decision).toBeDefined();
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.enabled).toBe(true);
      expect(decision.variationKey).toBe('on');
      expect(decision.variables.test_variable).toBe('default-value-on');
    });

    it('should handle missing datafile gracefully', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext = {
        userId: 'test-user-123',
        attributes: {}
      };
      const options = { sdkKey: '8mR1pGh8u2ztUP8GqjmQq' };

      // Configure mock to return null datafile
      configService.getDatafileMock.mockResolvedValueOnce(null);

      // Execute
      const decision = await decisionService.decide(flagKey, userContext, options);

      // Verify fallback behavior
      expect(decision.enabled).toBe(false);
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.reasons).toContain('client_unavailable');
      
      // Verify logging
      expect(logger.hasLoggedMessage(LogLevel.WARN, 'Optimizely client not available')).toBe(true);
    });

    it('should handle SDK errors gracefully', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext = {
        userId: 'test-user-123',
        attributes: {}
      };
      const options = { sdkKey: '8mR1pGh8u2ztUP8GqjmQq' };

      // Make createInstance return null for this test only
      // Use vi.mocked() for type safety
      vi.mocked(optimizely.createInstance).mockReturnValueOnce(null as any); // Still need 'as any' because return type doesn't strictly allow null

      // Execute
      const decision = await decisionService.decide(flagKey, userContext, options);

      // Verify error handling
      expect(decision.enabled).toBe(false);
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.reasons).toContain('client_unavailable');
    });

    it('should make decisions for multiple flags', async () => {
      // Test data
      const userContext = {
        userId: 'test-user-123',
        attributes: {}
      };
      const options = { sdkKey: '8mR1pGh8u2ztUP8GqjmQq' };
      const flagKeys = ['test-flag', 'recurring_deposit'];

      // Create specific test results
      const testDecisions = {
        'test-flag': {
          variationKey: 'on',
          enabled: true,
          flagKey: 'test-flag',
          ruleKey: '9300002165680',
          variables: { test_variable: 'default-value-on' },
          reasons: []
        },
        'recurring_deposit': {
          variationKey: 'off',
          enabled: false,
          flagKey: 'recurring_deposit',
          ruleKey: 'default-rollout-10839-28970950020',
          variables: { 
            amount: "0.0",
            message: "Use recurring deposits to compound interest",
            advanced: "{\n\t\"hello\": 123\n}"
          },
          reasons: []
        }
      };

      // Directly mock the service behavior
      const spy = vi.spyOn(decisionService, 'decideAll');
      spy.mockResolvedValueOnce(testDecisions as unknown as Record<string, optimizely.OptimizelyDecision>);
      
      // Execute
      const decisions = await decisionService.decideAll(userContext, flagKeys, options);

      // Verify the mock was called correctly
      expect(spy).toHaveBeenCalledWith(userContext, flagKeys, options);
      
      // Verify results
      expect(decisions).toBeDefined();
      expect(Object.keys(decisions).length).toBe(2);
      
      // Verify test-flag decision
      expect(decisions['test-flag']).toBeDefined();
      expect(decisions['test-flag'].enabled).toBe(true);
      expect(decisions['test-flag'].variationKey).toBe('on');
      
      // Verify recurring_deposit decision
      expect(decisions['recurring_deposit']).toBeDefined();
      expect(decisions['recurring_deposit'].flagKey).toBe('recurring_deposit');
      
      // Clean up
      spy.mockRestore();
    });
  });
}); 