import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoreLogic from './coreLogic';
import defaultSettings from './_config_/defaultSettings';
import RequestConfig from './_config_/requestConfig';

describe('CoreLogic', () => {
  let coreLogic;
  let mockOptimizelyProvider;
  let mockEnv;
  let mockCtx;
  let mockSdkKey;
  let mockAbstractionHelper;
  let mockKvStore;
  let mockKvStoreUserProfile;
  let mockLogger;
  let mockRequest;

  beforeEach(() => {
    mockOptimizelyProvider = {
      createInstance: vi.fn(),
      execute: vi.fn()
    };
    mockEnv = {};
    mockCtx = {};
    mockSdkKey = 'test-sdk-key';
    mockAbstractionHelper = {
      getRequestURL: vi.fn(),
      getRequestMethod: vi.fn(),
      getRequestPathname: vi.fn(),
      getRequestHeaders: vi.fn(),
      getRequestUserAgent: vi.fn(),
      abstractRequest: {
        request: {}
      }
    };
    mockKvStore = {
      get: vi.fn(),
      put: vi.fn()
    };
    mockKvStoreUserProfile = {
      get: vi.fn(),
      put: vi.fn()
    };
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugExt: vi.fn(),
      error: vi.fn()
    };
    mockRequest = {};

    coreLogic = new CoreLogic(
      mockOptimizelyProvider,
      mockEnv,
      mockCtx,
      mockSdkKey,
      mockAbstractionHelper,
      mockKvStore,
      mockKvStoreUserProfile,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(coreLogic.logger).toBe(mockLogger);
      expect(coreLogic.env).toBeUndefined();
      expect(coreLogic.ctx).toBeUndefined();
      expect(coreLogic.kvStore).toBe(mockKvStore);
      expect(coreLogic.sdkKey).toBe(mockSdkKey);
      expect(coreLogic.abstractionHelper).toBe(mockAbstractionHelper);
      expect(coreLogic.optimizelyProvider).toBe(mockOptimizelyProvider);
      expect(coreLogic.kvStoreUserProfile).toBe(mockKvStoreUserProfile);
      expect(coreLogic.eventListeners).toBeDefined();
      expect(coreLogic.cdnAdapter).toBeUndefined();
      expect(coreLogic.reqResponseObjectType).toBe('response');
      expect(coreLogic.allDecisions).toBeUndefined();
      expect(coreLogic.serializedDecisions).toBeUndefined();
      expect(coreLogic.cdnExperimentSettings).toBeUndefined();
      expect(coreLogic.cdnExperimentURL).toBeUndefined();
      expect(coreLogic.cdnResponseURL).toBeUndefined();
      expect(coreLogic.forwardRequestToOrigin).toBeUndefined();
      expect(coreLogic.cacheKey).toBeUndefined();
      expect(coreLogic.isDecideOperation).toBeUndefined();
      expect(coreLogic.isPostMethod).toBeUndefined();
      expect(coreLogic.isGetMethod).toBeUndefined();
      expect(coreLogic.forwardToOrigin).toBeUndefined();
      expect(coreLogic.activeFlags).toBeUndefined();
      expect(coreLogic.savedCookieDecisions).toBeUndefined();
      expect(coreLogic.validCookiedDecisions).toBeUndefined();
      expect(coreLogic.invalidCookieDecisions).toBeUndefined();
      expect(coreLogic.datafileOperation).toBe(false);
      expect(coreLogic.configOperation).toBe(false);
      expect(coreLogic.request).toBeUndefined();
    });

    it('should log initialization message', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(`CoreLogic instance created for SDK Key: ${mockSdkKey}`);
    });

    it('should process request correctly', async () => {
      // Mock CDN adapter
      const mockCdnAdapter = {
        getNewResponseObject: vi.fn().mockResolvedValue({ type: 'response' })
      };
      coreLogic.setCdnAdapter(mockCdnAdapter);

      // Set up request in abstractionHelper
      mockAbstractionHelper.abstractRequest.request = mockRequest;
      mockAbstractionHelper.env = mockEnv;
      mockAbstractionHelper.ctx = mockCtx;

      // Mock RequestConfig class
      const mockRequestConfig = {
        metadata: {},
        url: {
          pathname: '/v1/decide',
          href: 'http://example.com/v1/decide'
        },
        initialize: vi.fn().mockResolvedValue(undefined)
      };
      vi.mock('./_config_/requestConfig', () => ({
        default: vi.fn().mockImplementation(() => mockRequestConfig)
      }));

      // Call processRequest
      await coreLogic.processRequest(mockRequest, mockEnv, mockCtx);

      // Verify RequestConfig was instantiated correctly
      expect(RequestConfig).toHaveBeenCalledWith(
        mockRequest,
        mockEnv,
        mockCtx,
        mockCdnAdapter,
        mockAbstractionHelper
      );

      // Verify request was set on abstractionHelper
      expect(mockAbstractionHelper.abstractRequest.request).toBe(mockRequest);
    });
  });

  describe('setCdnAdapter and getCdnAdapter', () => {
    it('should set and get CDN adapter', () => {
      const mockAdapter = { name: 'testAdapter' };
      coreLogic.setCdnAdapter(mockAdapter);
      expect(coreLogic.cdnAdapter).toBe(mockAdapter);
    });
  });

  describe('deleteAllUserContexts', () => {
    it('should delete userContext from decisions when trimmedDecisions is true', () => {
      const decisions = [
        { flagKey: 'flag1', userContext: { id: '1' } },
        { flagKey: 'flag2', userContext: { id: '2' } }
      ];
      coreLogic.requestConfig = { trimmedDecisions: true };
      
      const result = coreLogic.deleteAllUserContexts(decisions);
      
      expect(result).toEqual(decisions);
    });

    it('should return decisions unchanged when trimmedDecisions is false', () => {
      const decisions = [
        { flagKey: 'flag1', userContext: { id: '1' } },
        { flagKey: 'flag2', userContext: { id: '2' } }
      ];
      coreLogic.requestConfig = { trimmedDecisions: false };
      
      const result = coreLogic.deleteAllUserContexts(decisions);
      
      expect(result).toEqual(decisions);
    });
  });

  describe('extractCdnSettings', () => {
    it('should extract CDN settings from decisions', () => {
      const decisions = [{
        flagKey: 'test-flag',
        variationKey: 'test-variation',
        variables: {
          cdnVariationSettings: {
            cdnExperimentURL: 'https://test.com/exp',
            cdnResponseURL: 'https://test.com/resp',
            cacheKey: 'test-key',
            forwardRequestToOrigin: 'true',
            cacheRequestToOrigin: 'true',
            isControlVariation: 'false'
          }
        }
      }];

      const expected = [{
        'test-flag': {
          'test-variation': {
            cdnExperimentURL: 'https://test.com/exp',
            cdnResponseURL: 'https://test.com/resp',
            cacheKey: 'test-key',
            forwardRequestToOrigin: true,
            cacheRequestToOrigin: true,
            isControlVariation: false
          }
        }
      }];

      const result = coreLogic.extractCdnSettings(decisions);
      expect(result).toEqual(expected);
    });

    it('should handle missing cdnVariationSettings', () => {
      const decisions = [{
        flagKey: 'test-flag',
        variationKey: 'test-variation',
        variables: {}
      }];

      const expected = [{
        'test-flag': {
          'test-variation': {
            cdnExperimentURL: undefined,
            cdnResponseURL: undefined,
            cacheKey: undefined,
            forwardRequestToOrigin: false,
            cacheRequestToOrigin: false,
            isControlVariation: false
          }
        }
      }];

      const result = coreLogic.extractCdnSettings(decisions);
      expect(result).toEqual(expected);
    });
  });

  describe('getConfigForDecision', () => {
    it('should find and return matching configuration', async () => {
      const decisions = [{
        'test-flag': {
          'test-variation': {
            cdnExperimentURL: 'https://test.com',
            isControlVariation: false
          }
        }
      }];

      const result = await coreLogic.getConfigForDecision(decisions, 'test-flag', 'test-variation');
      expect(result).toEqual({
        cdnExperimentURL: 'https://test.com',
        isControlVariation: false
      });
    });

    it('should return undefined for non-matching configuration', async () => {
      const decisions = [{
        'test-flag': {
          'test-variation': {
            cdnExperimentURL: 'https://test.com'
          }
        }
      }];

      const result = await coreLogic.getConfigForDecision(decisions, 'non-existent', 'non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('processDecisions', () => {
    it('should process decisions by removing userContext and extracting CDN settings', () => {
      const decisions = [{
        flagKey: 'test-flag',
        variationKey: 'test-variation',
        userContext: { id: '1' },
        variables: {
          cdnVariationSettings: {
            cdnExperimentURL: 'https://test.com',
            isControlVariation: 'false'
          }
        }
      }];

      const expected = [{
        'test-flag': {
          'test-variation': {
            cdnExperimentURL: 'https://test.com',
            cdnResponseURL: undefined,
            cacheKey: undefined,
            forwardRequestToOrigin: false,
            cacheRequestToOrigin: false,
            isControlVariation: false
          }
        }
      }];

      const result = coreLogic.processDecisions(decisions);
      expect(result).toEqual(expected);
    });
  });
});
