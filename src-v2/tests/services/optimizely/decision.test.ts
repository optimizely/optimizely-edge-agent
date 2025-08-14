import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as optimizelySdk from '@optimizely/optimizely-sdk/dist/optimizely.lite.es'; // Use alias for clarity
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
  userContext: null as any // Still pragmatic here for mock structure
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
import { ILoggerAdapter, LogLevel } from '../../../adapters/interfaces/ILoggerAdapter';
import { OptimizelyUserContext } from '../../../services/interfaces/IDecisionService';
import { MockLogger } from './mocks/MockLogger';
import { MockConfigService } from './mocks/MockConfigService';

describe('DecisionService', () => {
  let decisionService: DecisionService;
  let configService: MockConfigService;
  let logger: MockLogger;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Recreate mock user context and client for each test
    mockUserContext = {
      decide: vi.fn().mockImplementation((flagKey, decideOptions) => {
        if (decideOptions && Array.isArray(decideOptions) && decideOptions.includes(optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS)) {
          return { ...mockDecision, flagKey: flagKey || 'test-flag', reasons: ['mock-reason'] };
        }
        return { ...mockDecision, flagKey: flagKey || 'test-flag', variationKey: flagKey === 'test-flag' ? 'variation-1' : 'default-variation' };
      }),
      decideAll: vi.fn().mockReturnValue(mockDecisionMap),
      decideForKeys: vi.fn().mockImplementation((flagKeys: string[], decideOptions) => {
        const result: Record<string, any> = {};
        (flagKeys || []).forEach((key: string) => {
          result[key] = mockDecisionMap[key as keyof typeof mockDecisionMap] || { ...mockDecision, flagKey: key };
        });
        return result;
      }),
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

    // Create logger and config service
    logger = new MockLogger();
    configService = new MockConfigService();
    configService.setupDefaultDatafile('test-key');

    // Create the service under test
    decisionService = new DecisionService(
      configService,
      logger as unknown as ILoggerAdapter
    );
  });

  afterEach(() => {
    // Optional: Can reset mocks here too if needed, but beforeEach should cover it
    // vi.resetAllMocks(); 
  });

  describe('decide method', () => {
    it('should successfully make a decision for a flag', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext: OptimizelyUserContext = {
        userId: 'user-123',
        attributes: { country: 'US' }
      };
      const options = { sdkKey: 'test-key' };

      // Execute
      const decision = await decisionService.decide(flagKey, userContext, options);

      // Verify
      expect(configService.getDatafileMock).toHaveBeenCalledWith('test-key');
      expect(optimizelySdk.createInstance).toHaveBeenCalled();
      expect(decision).toBeDefined();
      expect(decision.enabled).toBe(true);
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.variationKey).toBe('variation-1');
      expect(decision.variables).toHaveProperty('test_variable');
    });

    it('should throw an error if sdkKey is missing', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext: OptimizelyUserContext = {
        userId: 'user-123',
        attributes: { country: 'US' }
      };

      // Execute and verify
      await expect(decisionService.decide(flagKey, userContext)).rejects.toThrow(
        'DecisionService.decide requires an sdkKey in options'
      );
    });

    it('should return a default decision when datafile cannot be fetched', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext: OptimizelyUserContext = {
        userId: 'user-123',
        attributes: { country: 'US' }
      };
      const options = { sdkKey: 'test-key' };

      // Configure mock to return null datafile
      configService.clearDatafile('test-key');

      // Execute
      const decision = await decisionService.decide(flagKey, userContext, options);

      // Verify
      expect(decision).toBeDefined();
      expect(decision.enabled).toBe(false);
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.reasons).toContain('client_unavailable');
    });

    it('should make a decision with decide options', async () => {
      // Test data
      const flagKey = 'test-flag';
      const userContext = { userId: 'user-123', attributes: { country: 'US' } };
      const options = { 
        sdkKey: 'test-key',
        decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS] 
      };

      // Execute
      await decisionService.decide(flagKey, userContext, options);

      // Verify mocks were called correctly
      // Use the mockClient defined in beforeEach scope
      expect(mockClient.createUserContext).toHaveBeenCalledWith(userContext.userId, userContext.attributes);
      // Use the mockUserContext defined in beforeEach scope
      expect(mockUserContext.decide).toHaveBeenCalled();
      const callArgs = vi.mocked(mockUserContext.decide!).mock.calls[0];
      expect(callArgs[0]).toBe(flagKey);
      // Use the imported enum value for comparison
      expect(callArgs[1]).toContain(optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS);
    });
  });

  describe('decideAll method', () => {
    it('should return decisions for all flags', async () => {
      // Test data
      const userContext = { userId: 'user-123', attributes: { country: 'US' } };
      const options = { sdkKey: 'test-key' };

      // Execute
      const decisions = await decisionService.decideAll(userContext, undefined, options);
      
      // Verify mocks
      expect(mockClient.createUserContext).toHaveBeenCalledWith(userContext.userId, userContext.attributes);
      expect(mockUserContext.decideAll).toHaveBeenCalled();
      expect(decisions).toEqual(mockDecisionMap); // Check against the defined mock map
    });

    it('should return decisions for specific flags when flagKeys are provided', async () => {
      // Test data
      const userContext = { userId: 'user-123', attributes: { country: 'US' } };
      const flagKeys = ['test-flag', 'another-flag'];
      const options = { sdkKey: 'test-key' };

      // Execute
      const decisions = await decisionService.decideAll(userContext, flagKeys, options);

      // Verify mocks
      expect(mockClient.createUserContext).toHaveBeenCalledWith(userContext.userId, userContext.attributes);
      expect(mockUserContext.decideForKeys).toHaveBeenCalled();
      const callArgs = vi.mocked(mockUserContext.decideForKeys!).mock.calls[0];
      expect(callArgs[0]).toEqual(flagKeys);
      
      expect(decisions).toBeDefined();
      expect(Object.keys(decisions)).toEqual(flagKeys); // Ensure only requested keys are returned
    });

    it('should throw an error if sdkKey is missing', async () => {
      // Test data
      const userContext: OptimizelyUserContext = {
        userId: 'user-123',
        attributes: { country: 'US' }
      };

      // Execute and verify
      await expect(decisionService.decideAll(userContext)).rejects.toThrow(
        'DecisionService.decideAll requires an sdkKey in options'
      );
    });

    it('should return empty decisions when client is unavailable', async () => {
      // Test data
      const userContext: OptimizelyUserContext = {
        userId: 'user-123',
        attributes: { country: 'US' }
      };
      const options = { sdkKey: 'test-key' };

      // Configure mock to return null datafile
      configService.clearDatafile('test-key');

      // Execute
      const decisions = await decisionService.decideAll(userContext, undefined, options);

      // Verify
      expect(decisions).toEqual({});
      expect(logger.hasLoggedMessage(
        LogLevel.WARN, 
        'Optimizely client not available'
      )).toBe(true);
    });

    it('should handle errors from the SDK gracefully', async () => {
      // Test data
      const userContext = { userId: 'user-123', attributes: { country: 'US' } };
      const options = { sdkKey: 'test-key' };

      // Force the decideAll mock on the specific instance to throw an error
      const originalDecideAll = mockUserContext.decideAll ? vi.fn(mockUserContext.decideAll) : vi.fn();
      if(mockUserContext.decideAll) { // Check if method exists before mocking
          vi.mocked(mockUserContext.decideAll).mockImplementationOnce(() => {
              console.log('Debug: Throwing SDK error in mock');
              throw new Error('SDK error');
          });
      }

      // Execute
      const decisions = await decisionService.decideAll(userContext, undefined, options);

      // Restore original mock implementation if it existed
      if(mockUserContext.decideAll) {
          mockUserContext.decideAll = originalDecideAll;
      }

      // Verify behavior with error
      expect(decisions).toEqual({});
      expect(logger.hasLoggedMessage(
        LogLevel.ERROR, 
        'Error making decisions' // Ensure this matches the log message in DecisionService
      )).toBe(true);
    });
  });

  describe('getDecision helper method', () => {
    it('should correctly pass sdkKey from options to decide method', async () => {
      // Spy on the decide method
      const decideSpy = vi.spyOn(decisionService, 'decide');
      
      // Test data
      const userId = 'user-123';
      const flagKey = 'test-flag';
      const attributes = { country: 'US' };
      const options = { 
        sdkKey: 'specific-sdk-key',
        decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS] 
      };

      // Execute
      await decisionService.getDecision(userId, flagKey, attributes, options);

      // Verify decide was called with correct parameters
      expect(decideSpy).toHaveBeenCalledWith(
        flagKey,
        { userId, attributes },
        { 
          sdkKey: 'specific-sdk-key',
          decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS]
        }
      );
    });

    it('should use defaultSdkKey when options.sdkKey is not provided', async () => {
      // Create decision service with a default SDK key
      const decisionServiceWithDefault = new DecisionService(
        configService, 
        logger as unknown as ILoggerAdapter,
        'default-sdk-key' // Set a default SDK key
      );
      
      // Spy on the decide method
      const decideSpy = vi.spyOn(decisionServiceWithDefault, 'decide');
      
      // Test data
      const userId = 'user-123';
      const flagKey = 'test-flag';
      const attributes = { country: 'US' };
      const options = { 
        decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS] 
      };

      // Execute
      await decisionServiceWithDefault.getDecision(userId, flagKey, attributes, options);

      // Verify decide was called with correct parameters, including the default SDK key
      expect(decideSpy).toHaveBeenCalledWith(
        flagKey,
        { userId, attributes },
        { 
          sdkKey: 'default-sdk-key',
          decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS]
        }
      );
    });

    it('should return fallback decision when no sdkKey is available', async () => {
      // Execute without sdkKey
      const decision = await decisionService.getDecision('user-123', 'test-flag');

      // Verify
      expect(decision).toBeDefined();
      expect(decision.enabled).toBe(false);
      expect(decision.flagKey).toBe('test-flag');
      expect(decision.reasons).toContain('no_sdk_key');
    });
  });

  describe('getAllDecisions helper method', () => {
    it('should correctly pass sdkKey from options to decideAll method', async () => {
      // Spy on the decideAll method
      const decideAllSpy = vi.spyOn(decisionService, 'decideAll');
      
      // Test data
      const userId = 'user-123';
      const attributes = { country: 'US' };
      const options = { 
        sdkKey: 'specific-sdk-key',
        decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS] 
      };

      // Execute
      await decisionService.getAllDecisions(userId, attributes, options);

      // Verify decideAll was called with correct parameters
      expect(decideAllSpy).toHaveBeenCalledWith(
        { userId, attributes },
        undefined,
        { 
          sdkKey: 'specific-sdk-key',
          decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS]
        }
      );
    });

    it('should use defaultSdkKey when options.sdkKey is not provided', async () => {
      // Create decision service with a default SDK key
      const decisionServiceWithDefault = new DecisionService(
        configService, 
        logger as unknown as ILoggerAdapter,
        'default-sdk-key' // Set a default SDK key
      );
      
      // Spy on the decideAll method
      const decideAllSpy = vi.spyOn(decisionServiceWithDefault, 'decideAll');
      
      // Test data
      const userId = 'user-123';
      const attributes = { country: 'US' };
      const options = { 
        decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS] 
      };

      // Execute
      await decisionServiceWithDefault.getAllDecisions(userId, attributes, options);

      // Verify decideAll was called with correct parameters, including the default SDK key
      expect(decideAllSpy).toHaveBeenCalledWith(
        { userId, attributes },
        undefined,
        { 
          sdkKey: 'default-sdk-key',
          decideOptions: [optimizelySdk.OptimizelyDecideOption.INCLUDE_REASONS]
        }
      );
    });

    it('should return empty object when no sdkKey is available', async () => {
      // Execute without sdkKey
      const decisions = await decisionService.getAllDecisions('user-123');

      // Verify
      expect(decisions).toEqual({});
      expect(logger.hasLoggedMessage(
        LogLevel.WARN, 
        'No SDK key provided and no default set for getAllDecisions'
      )).toBe(true);
    });

    it('should handle fallback to individual flag decisions when decideAll is not available', async () => {
      // Create a service with modified decideAll property to simulate old clients
      const decisionServiceNoDecideAll = new DecisionService(configService, logger as unknown as ILoggerAdapter);
      // @ts-ignore: Force-replace the decideAll method for testing
      decisionServiceNoDecideAll.decideAll = null;
      
      // Spy on methods we expect to be called
      const decideSpy = vi.spyOn(decisionServiceNoDecideAll, 'decide');
      const getOptimizelyClientSpy = vi.spyOn(decisionServiceNoDecideAll as any, 'getOptimizelyClient');
      
      // Mock the getOptimizelyClient method
      getOptimizelyClientSpy.mockResolvedValue({
        ...mockClient,
        getOptimizelyConfig: () => ({
          getDatafile: () => JSON.stringify({
            featureFlags: [
              { key: 'flag-1' },
              { key: 'flag-2' }
            ]
          })
        })
      });
      
      // Execute
      await decisionServiceNoDecideAll.getAllDecisions('user-123', {}, { sdkKey: 'test-key' });

      // Verify we called decide for each flag
      expect(decideSpy).toHaveBeenCalledTimes(2);
      expect(decideSpy).toHaveBeenCalledWith(
        'flag-1',
        { userId: 'user-123', attributes: {} },
        { sdkKey: 'test-key', decideOptions: undefined }
      );
      expect(decideSpy).toHaveBeenCalledWith(
        'flag-2',
        { userId: 'user-123', attributes: {} },
        { sdkKey: 'test-key', decideOptions: undefined }
      );
    });
  });

  it('should call the override when one is registered', async () => {
    // Setup
    const overrideDecisionService = new DecisionService(
      configService,
      logger as unknown as ILoggerAdapter
    );

    // Register an override handler
    const overrideHandler = vi.fn().mockReturnValue({
      variationKey: 'override-variation',
      enabled: true,
      flagKey: 'test-flag',
      variables: { custom: 'value' },
      reasons: ['override_applied'],
      ruleKey: 'override',
      userContext: null
    });

    // TODO: Implement the actual override registration test logic
  });

  it('should handle errors in customized logger', async () => {
    const errorLogger = {
      ...logger,
      warn: jest.fn().mockImplementation(() => {
        throw new Error('Simulated error in logger');
      }),
    };
    
    const errorLoggerDecisionService = new DecisionService(
      configService,
      errorLogger as unknown as ILoggerAdapter
    );

    // TODO: Implement the actual logger error handling test logic
  });

  it('should have all decide methods as promised', async () => {
    // Create a service without decide all
    const decisionServiceNoDecideAll = new DecisionService(configService, logger as unknown as ILoggerAdapter);

    // Test for all methods
    // ... existing code ...
  });
}); 