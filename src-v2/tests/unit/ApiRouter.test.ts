import { ApiRouter } from '../../services/implementations/ApiRouter';

describe('Response metadata handling', () => {
  const mockDatafileService = {
    getDatafile: jest.fn(),
    saveDatafile: jest.fn(),
    getFlagKeys: jest.fn(),
    saveFlagKeys: jest.fn()
  };
  
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn()
  };
  
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  
  const mockMetrics = {
    incrementCounter: jest.fn(),
    startTimer: jest.fn(),
    recordHistogram: jest.fn()
  };
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should include metadata in response when enableResponseMetadata is true', async () => {
    // Set up config service to enable response metadata
    const mockConfigService = {
      getDatafile: jest.fn(),
      getEdgeAgentVersion: jest.fn().mockReturnValue("1.0.0"),
      getEnvironment: jest.fn().mockReturnValue("test"),
      getCdnProvider: jest.fn().mockReturnValue("test-cdn"),
      getAdminToken: jest.fn(),
      getAttributesHeaderName: jest.fn(),
      getEventTagsHeaderName: jest.fn(),
      getEventKeyHeaderName: jest.fn(),
      getEnableFex: jest.fn().mockReturnValue(false),
      getOverrideCache: jest.fn().mockReturnValue(false),
      getEnableResponseMetadata: jest.fn().mockReturnValue(true),
      getEnableFlagsFromKV: jest.fn(),
      getEnableDatafileFromKV: jest.fn()
    };
    
    // Create ApiRouter instance
    const apiRouter = new ApiRouter(
      mockDatafileService,
      mockCacheService,
      mockConfigService,
      mockLogger,
      mockMetrics
    );
    
    // Mock a request adapter for a simple endpoint
    const mockRequestAdapter = {
      getMethod: jest.fn().mockReturnValue("GET"),
      getUrl: jest.fn().mockReturnValue({
        pathname: "/api/sdk",
        search: ""
      }),
      getHeader: jest.fn(),
      getBody: jest.fn(),
      setBody: jest.fn()
    };
    
    // Send request to SDK info endpoint
    const result = await apiRouter.routeApiRequest(mockRequestAdapter);
    
    // Parse the response body to verify metadata is included
    const responseBody = JSON.parse(result.body);
    
    // Verify metadata exists and has expected properties
    expect(responseBody).toHaveProperty('metadata');
    expect(responseBody.metadata).toHaveProperty('sdkVersion', '1.0.0');
    expect(responseBody.metadata).toHaveProperty('environment', 'test');
    expect(responseBody.metadata).toHaveProperty('cdnProvider', 'test-cdn');
    expect(responseBody.metadata).toHaveProperty('timestamp');
  });
  
  it('should exclude metadata in response when enableResponseMetadata is false', async () => {
    // Set up config service to disable response metadata
    const mockConfigService = {
      getDatafile: jest.fn(),
      getEdgeAgentVersion: jest.fn().mockReturnValue("1.0.0"),
      getEnvironment: jest.fn().mockReturnValue("test"),
      getCdnProvider: jest.fn().mockReturnValue("test-cdn"),
      getAdminToken: jest.fn(),
      getAttributesHeaderName: jest.fn(),
      getEventTagsHeaderName: jest.fn(),
      getEventKeyHeaderName: jest.fn(),
      getEnableFex: jest.fn().mockReturnValue(false),
      getOverrideCache: jest.fn().mockReturnValue(false),
      getEnableResponseMetadata: jest.fn().mockReturnValue(false),
      getEnableFlagsFromKV: jest.fn(),
      getEnableDatafileFromKV: jest.fn()
    };
    
    // Create ApiRouter instance
    const apiRouter = new ApiRouter(
      mockDatafileService,
      mockCacheService,
      mockConfigService,
      mockLogger,
      mockMetrics
    );
    
    // Mock a request adapter for a simple endpoint
    const mockRequestAdapter = {
      getMethod: jest.fn().mockReturnValue("GET"),
      getUrl: jest.fn().mockReturnValue({
        pathname: "/api/sdk",
        search: ""
      }),
      getHeader: jest.fn(),
      getBody: jest.fn(),
      setBody: jest.fn()
    };
    
    // Send request to SDK info endpoint
    const result = await apiRouter.routeApiRequest(mockRequestAdapter);
    
    // Parse the response body to verify metadata is not included
    const responseBody = JSON.parse(result.body);
    
    // Verify metadata does not exist
    expect(responseBody).not.toHaveProperty('metadata');
  });
}); 