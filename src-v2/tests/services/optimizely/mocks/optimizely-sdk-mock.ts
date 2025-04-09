import { vi } from 'vitest';

/**
 * Creates a standard mock for the Optimizely SDK with customizable behavior
 */
export function createOptimizelySDKMock(options: {
  variationKey?: string;
  enabled?: boolean;
  variables?: Record<string, any>;
  reasons?: string[];
  shouldFail?: boolean;
} = {}) {
  // Default option values
  const finalOptions = {
    variationKey: 'variation-1',
    enabled: true,
    variables: { test_variable: 'value' },
    reasons: [],
    shouldFail: false,
    ...options
  };

  // Create a mock decision response
  const mockDecision = {
    variationKey: finalOptions.variationKey,
    enabled: finalOptions.enabled,
    flagKey: 'test-flag',
    variables: finalOptions.variables,
    reasons: finalOptions.reasons,
    ruleKey: 'rule-1',
    userContext: {
      userId: 'test-user',
      attributes: {}
    }
  };

  // Create mock decision map
  const mockDecisionMap = {
    'test-flag': mockDecision,
    'another-flag': {
      ...mockDecision,
      flagKey: 'another-flag',
      variationKey: 'another-variation'
    }
  };

  // Mock user context
  const mockUserContext = {
    decide: vi.fn().mockReturnValue(mockDecision),
    decideAll: vi.fn().mockReturnValue(mockDecisionMap),
    decideForKeys: vi.fn().mockReturnValue(mockDecisionMap),
    trackEvent: vi.fn(),
    setAttribute: vi.fn(),
    getAttributes: vi.fn().mockReturnValue({}),
    setForcedDecision: vi.fn().mockReturnValue(true),
    getForcedDecision: vi.fn().mockReturnValue(null),
    removeForcedDecision: vi.fn().mockReturnValue(true),
    removeAllForcedDecisions: vi.fn().mockReturnValue(true)
  };

  // Mock client
  const mockClient = {
    createUserContext: vi.fn().mockReturnValue(mockUserContext),
    onReady: vi.fn().mockResolvedValue({ success: !finalOptions.shouldFail, reason: finalOptions.shouldFail ? 'Error initializing' : undefined }),
    close: vi.fn(),
    notificationCenter: {
      addNotificationListener: vi.fn().mockReturnValue(1),
      removeNotificationListener: vi.fn().mockReturnValue(true)
    },
    getOptimizelyConfig: vi.fn().mockReturnValue({
      revision: '123',
      sdkKey: 'test-key',
      environmentKey: 'production',
      featuresMap: {
        'test-flag': {
          id: 'flag-1',
          key: 'test-flag',
          experimentRules: [],
          deliveryRules: []
        }
      },
      experimentsMap: {},
      getDatafile: vi.fn().mockReturnValue('{}')
    })
  };

  // Mock SDK methods including the createInstance
  const mockSDK = {
    createInstance: vi.fn().mockReturnValue(finalOptions.shouldFail ? null : mockClient),
    OptimizelyDecideOption: {
      DISABLE_DECISION_EVENT: 'DISABLE_DECISION_EVENT',
      INCLUDE_REASONS: 'INCLUDE_REASONS',
      EXCLUDE_VARIABLES: 'EXCLUDE_VARIABLES',
      ENABLED_FLAGS_ONLY: 'ENABLED_FLAGS_ONLY',
      IGNORE_USER_PROFILE_SERVICE: 'IGNORE_USER_PROFILE_SERVICE'
    }
  };

  return {
    mockSDK,
    mockClient,
    mockUserContext,
    mockDecision,
    mockDecisionMap
  };
}

/**
 * Sets up a vi.mock for @optimizely/optimizely-sdk
 * Used within a vi.mock call
 */
export function setupOptimizelySDKMock(options: {
  variationKey?: string;
  enabled?: boolean;
  variables?: Record<string, any>;
  reasons?: string[];
  shouldFail?: boolean;
} = {}) {
  const { mockSDK } = createOptimizelySDKMock(options);
  
  return {
    __esModule: true,
    ...mockSDK
  };
} 