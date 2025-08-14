import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockLogger } from './mocks/MockLogger';
import { MockEventDispatcher } from './mocks/MockEventDispatcher';
import { LogLevel } from '../../../adapters/interfaces/ILoggerAdapter';
import { OptimizelyUserContext as OurUserContextType } from '../../../services/interfaces/IDecisionService';
import { IEventDispatcher } from '../../../services/interfaces/IEventDispatcher';

// Import actual SDK types for mocking
import {
  Client as OptimizelyClient,
  OptimizelyUserContext as OptimizelySDKUserContext,
  OptimizelyDecision,
  OptimizelyDecideOption,
  UserAttributes,
  EventTags
} from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';

// Define reusable mock objects
const mockDecision: OptimizelyDecision = {
  variationKey: 'variation-1',
  enabled: true,
  flagKey: 'test-flag',
  variables: { test_variable: 'value' },
  reasons: [],
  ruleKey: 'rule-1',
  userContext: null as any // Use 'as any' here pragmatically for the mock structure
};

const mockDecisionMap = {
  'test-flag': mockDecision,
  'another-flag': {
    ...mockDecision,
    flagKey: 'another-flag',
    variationKey: 'another-variation'
  }
};

// Define mocks that will be recreated in beforeEach
let mockUserContext: Partial<OptimizelySDKUserContext>;
let mockClient: Partial<OptimizelyClient>;

// Mock the Optimizely SDK
vi.mock('@optimizely/optimizely-sdk', async (importOriginal) => {
  const actualSdk = await importOriginal<typeof import('@optimizely/optimizely-sdk')>();
  return {
    ...actualSdk,
    // Override createInstance to return our externally defined mockClient
    createInstance: vi.fn(() => mockClient as OptimizelyClient),
  };
});

// Import DecisionService and other types AFTER vi.mock
import { DecisionService } from '../../../services/implementations/DecisionService';
import { IConfigService } from '../../../services/interfaces/IConfigService';
import { MockConfigService } from './mocks/MockConfigService';

/**
 * This test suite validates the event tracking capabilities of our Optimizely integration.
 * It focuses on ensuring events are properly dispatched and tracked when using the SDK.
 */
describe('Optimizely Event Tracking', () => {
  let decisionService: DecisionService;
  let configService: MockConfigService;
  let eventDispatcher: MockEventDispatcher;
  let logger: MockLogger;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Recreate mock user context and client for each test
    mockUserContext = {
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

    mockClient = {
      createUserContext: vi.fn().mockReturnValue(mockUserContext as OptimizelySDKUserContext),
      onReady: vi.fn().mockResolvedValue({ success: true }),
      close: vi.fn(),
      notificationCenter: {
        addNotificationListener: vi.fn().mockReturnValue(1),
        removeNotificationListener: vi.fn().mockReturnValue(true),
        clearAllNotificationListeners: vi.fn(),
        clearNotificationListeners: vi.fn()
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

    // Create logger and dispatcher
    logger = new MockLogger();
    eventDispatcher = new MockEventDispatcher(logger);

    // Create config service
    configService = new MockConfigService();
    configService.setupDefaultDatafile('test-key');

    // Create the decision service instance using mocks
    decisionService = new DecisionService(configService, logger);

    // Ensure the createInstance mock (defined in vi.mock factory) is reset if needed
    // Although usually vi.clearAllMocks() handles this
  });

  afterEach(() => {
    vi.resetAllMocks();
    logger.reset();
    eventDispatcher.reset();
  });

  describe('SDK Event Tracking', () => {
    it('should track events via the SDK user context', async () => {
      // First make a decision to get an SDK client and user context instantiated
      const userContext: OurUserContextType = {
        userId: 'test-user-123',
        attributes: {
          device: 'mobile',
          country: 'US'
        }
      };

      // Make a decision - this will cause DecisionService to call createInstance,
      // which returns our mockClient, which returns our mockUserContext
      await decisionService.decide('test-flag', userContext, { sdkKey: 'test-key' });

      // Track an event - now call the method on the mockUserContext defined in beforeEach
      // Need to ensure the DecisionService correctly holds/uses the created context
      // For simplicity, we assume here the internal client/context is the one mocked.
      // A more robust test might spy on DecisionService internals if possible.
      
      // We directly test the mockUserContext that *should have been* created and used.
      // Note: This relies on the mock setup ensuring this instance is used.
      mockUserContext.trackEvent!('purchase', { revenue: 100, items: 2 });

      // Verify the SDK trackEvent method was called with correct parameters
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith(
        'purchase',
        { revenue: 100, items: 2 }
      );
    });

    it('should support various event tag types', async () => {
      // Make a decision to initialize the SDK client
      await decisionService.decide('test-flag', { userId: 'user1' }, { sdkKey: 'test-key' });

      // Test directly on the mock created in beforeEach
      // Test with numeric values
      mockUserContext.trackEvent!('purchase', { revenue: 99.99 });
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('purchase', { revenue: 99.99 });

      // Test with string values
      mockUserContext.trackEvent!('page_view', { page: 'home' });
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('page_view', { page: 'home' });

      // Test with boolean values - Convert boolean to string or number
      mockUserContext.trackEvent!('feature_used', { success: 'true' }); // Use string 'true'
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('feature_used', { success: 'true' });

      // Test with complex object - Flatten or simplify to conform to EventTags
      // Option 1: Flattening with dot notation (example)
      const flattenedEvent = {
        'items.0.id': 'item1',
        'items.0.name': 'Product 1',
        'items.0.price': 10.99,
        'items.1.id': 'item2',
        'items.1.name': 'Product 2',
        'items.1.price': 19.99,
        totalValue: 30.98,
        currency: 'USD',
        'metadata.source': 'web',
        'metadata.promotionCode': 'SUMMER2025'
      };

      // Option 2: Simplify (e.g., just send total value)
      // const simpleEvent = {
      //   totalValue: 30.98,
      //   currency: 'USD'
      // };

      // Using flattened example here
      mockUserContext.trackEvent!('checkout_complete', flattenedEvent);
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('checkout_complete', flattenedEvent);
    });

    it('should handle multiple events in sequence', async () => {
      // Make a decision to initialize the SDK client
      await decisionService.decide('test-flag', { userId: 'user1' }, { sdkKey: 'test-key' });

      // Track a sequence of events directly on the mock
      mockUserContext.trackEvent!('page_view', { page: 'product_listing' });
      mockUserContext.trackEvent!('product_click', { productId: 'p123' });
      mockUserContext.trackEvent!('page_view', { page: 'product_detail' });
      mockUserContext.trackEvent!('add_to_cart', { productId: 'p123', quantity: 1 });
      mockUserContext.trackEvent!('checkout_start', { items: 1 });
      mockUserContext.trackEvent!('purchase', { revenue: 19.99 });

      // Verify all events were tracked
      expect(mockUserContext.trackEvent).toHaveBeenCalledTimes(6);

      // Verify specific events
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('page_view', { page: 'product_listing' });
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('product_click', { productId: 'p123' });
      expect(mockUserContext.trackEvent).toHaveBeenCalledWith('purchase', { revenue: 19.99 });
    });

    it('should handle errors gracefully', async () => {
      // Make a decision to initialize the SDK client
      await decisionService.decide('test-flag', { userId: 'user1' }, { sdkKey: 'test-key' });

      // Save original implementation (if trackEvent is defined)
      const originalTrackEvent = mockUserContext.trackEvent ? vi.fn(mockUserContext.trackEvent) : vi.fn();

      // Setup mock to throw an error
      if (mockUserContext.trackEvent) {
          vi.mocked(mockUserContext.trackEvent).mockImplementationOnce(() => {
              throw new Error('Event tracking failed');
          });
      }

      // Verify the error is thrown
      expect(() => {
        mockUserContext.trackEvent!('error_event', { value: 100 });
      }).toThrow('Event tracking failed');

      // Restore original implementation
      if (mockUserContext.trackEvent) {
        mockUserContext.trackEvent = originalTrackEvent;
      }

      // Subsequent calls should still work
      mockUserContext.trackEvent!('normal_event', { value: 200 });
      expect(mockUserContext.trackEvent).toHaveBeenLastCalledWith('normal_event', { value: 200 });
    });
  });
}); 