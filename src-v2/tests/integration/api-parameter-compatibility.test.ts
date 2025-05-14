import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { ApiRouter } from '../../services/implementations/ApiRouter';

describe('ApiRouter parameter compatibility tests', () => {
  const mockDatafileService = {
    getDatafile: vi.fn(),
    saveDatafile: vi.fn(),
    getFlagKeys: vi.fn(),
    saveFlagKeys: vi.fn()
  };
  
  const mockCacheService = {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn()
  };
  
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
  
  const mockMetrics = {
    incrementCounter: vi.fn(),
    startTimer: vi.fn().mockReturnValue(() => 100),
    recordHistogram: vi.fn()
  };

  const mockDecisionService = {
    getDecision: vi.fn().mockReturnValue({ 
      variationKey: 'test-variation',
      enabled: true,
      variables: {},
      ruleKey: 'test-rule'
    }),
    getDecisions: vi.fn(),
    getAllDecisions: vi.fn(),
    getAvailableDecideOptions: vi.fn(),
    setForcedDecision: vi.fn(),
    getForcedDecision: vi.fn(),
    removeForcedDecision: vi.fn(),
    removeAllForcedDecisions: vi.fn(),
  };
  
  const mockConfigService = {
    getValue: vi.fn().mockImplementation((key) => {
      if (key === 'sdkKey') return 'test-sdk-key';
      return null;
    }),
    getDatafile: vi.fn(),
    getEdgeAgentVersion: vi.fn().mockReturnValue("2.0.0"),
    getEnvironment: vi.fn().mockReturnValue("test"),
    getCdnProvider: vi.fn().mockReturnValue("test-cdn"),
    getAdminToken: vi.fn(),
    getAttributesHeaderName: vi.fn(),
    getEventTagsHeaderName: vi.fn(),
    getEventKeyHeaderName: vi.fn(),
    getEnableFex: vi.fn().mockReturnValue(false),
    getOverrideCache: vi.fn().mockReturnValue(false),
    getEnableResponseMetadata: vi.fn().mockReturnValue(true),
    getEnableFlagsFromKV: vi.fn(),
    getEnableDatafileFromKV: vi.fn(),
    getImplementationVersionHeader: vi.fn().mockReturnValue({
      'X-Implementation-Version': '2.0.0'
    })
  };
  
  let apiRouter: ApiRouter;
  
  beforeEach(() => {
    apiRouter = new ApiRouter(
      mockDatafileService,
      mockCacheService,
      mockConfigService,
      mockLogger,
      mockMetrics,
      mockDecisionService
    );
    vi.clearAllMocks();
  });
  
  describe('Single flag decision endpoint', () => {
    it('should accept flagKey in request body', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: ""
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({
          userId: "test-user",
          flagKey: "test-flag",
          sdkKey: "test-sdk-key"
        }),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify decision service was called with flagKey
      expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
        expect.objectContaining({ 
          flagKey: "test-flag",
          userId: "test-user" 
        }),
        expect.anything()
      );
    });

    it('should accept key in request body for backward compatibility', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: ""
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({
          userId: "test-user",
          key: "test-flag", // Using key instead of flagKey
          sdkKey: "test-sdk-key"
        }),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify decision service was called with flagKey
      expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
        expect.objectContaining({ 
          flagKey: "test-flag",
          userId: "test-user" 
        }),
        expect.anything()
      );
    });

    it('should accept flagKey in URL parameters', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: "?userId=test-user&flagKey=test-flag&sdkKey=test-sdk-key"
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({}),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify decision service was called with flagKey
      expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
        expect.objectContaining({ 
          flagKey: "test-flag",
          userId: "test-user" 
        }),
        expect.anything()
      );
    });

    it('should accept key in URL parameters for backward compatibility', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: "?userId=test-user&key=test-flag&sdkKey=test-sdk-key"
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({}),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify decision service was called with flagKey
      expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
        expect.objectContaining({ 
          flagKey: "test-flag",
          userId: "test-user" 
        }),
        expect.anything()
      );
    });

    it('should prioritize flagKey over key if both are present', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: ""
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({
          userId: "test-user",
          flagKey: "preferred-flag",
          key: "fallback-flag",
          sdkKey: "test-sdk-key"
        }),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify decision service was called with the flagKey value
      expect(mockDecisionService.getDecision).toHaveBeenCalledWith(
        expect.objectContaining({ 
          flagKey: "preferred-flag",
          userId: "test-user" 
        }),
        expect.anything()
      );
    });

    it('should return a clear error when neither flagKey nor key is provided', async () => {
      // Create mock request adapter
      const mockRequestAdapter = {
        getMethod: vi.fn().mockReturnValue("POST"),
        getUrl: vi.fn().mockReturnValue({
          pathname: "/api/decide",
          search: ""
        }),
        getHeader: vi.fn(),
        getBody: vi.fn().mockReturnValue({
          userId: "test-user",
          sdkKey: "test-sdk-key"
        }),
        setBody: vi.fn()
      };
      
      // Send request to decide endpoint
      const result = await apiRouter.routeApiRequest(mockRequestAdapter);
      
      // Verify response has error about missing flag key
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body)).toHaveProperty('error');
      expect(JSON.parse(result.body).error).toContain('flagKey parameter is required');
    });
  });
});