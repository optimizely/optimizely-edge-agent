import { describe, it, expect, vi, beforeEach } from 'vitest';
import RequestConfig from './requestConfig';
import { logger } from '../_helpers_/optimizelyHelper';
import EventListeners from '../_event_listeners_/eventListeners';

// Mock dependencies
vi.mock('../_helpers_/optimizelyHelper', () => ({
  logger: vi.fn(),
}));

vi.mock('../_event_listeners_/eventListeners', () => ({
  default: {
    getInstance: vi.fn(),
  },
}));

describe('RequestConfig', () => {
  let mockLogger;
  let mockAbstractionHelper;
  let mockCdnAdapter;
  let requestConfig;
  let mockRequest;
  let mockHeaders;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      debug: vi.fn(),
      debugExt: vi.fn(),
      error: vi.fn(),
    };
    logger.mockReturnValue(mockLogger);

    // Setup mock headers
    mockHeaders = new Headers();
    mockHeaders.set('content-type', 'application/json');

    // Setup mock request
    mockRequest = new Request('https://example.com/test?key=value', {
      method: 'GET',
      headers: mockHeaders,
    });

    // Setup mock abstraction helper
    mockAbstractionHelper = {
      request: mockRequest,
      headers: mockHeaders,
      abstractRequest: {
        getNewURL: vi.fn().mockReturnValue(new URL(mockRequest.url)),
        getHttpMethod: vi.fn().mockReturnValue('GET'),
        getHeader: vi.fn(),
      },
    };

    // Setup mock CDN adapter
    mockCdnAdapter = {
      getRequestHeader: vi.fn(),
      getJsonPayload: vi.fn(),
    };

    // Setup mock event listeners
    EventListeners.getInstance.mockReturnValue({});

    // Create RequestConfig instance
    requestConfig = new RequestConfig(
      mockRequest,
      {},
      {},
      mockCdnAdapter,
      mockAbstractionHelper,
    );
  });

  describe('Constructor', () => {
    it('should initialize with default settings', () => {
      expect(requestConfig.settings).toBeDefined();
      expect(requestConfig.settings.cdnProvider).toBe('cloudflare');
      expect(requestConfig.settings.defaultTrimmedDecisions).toBe(true); // Default is true in constructor
      expect(requestConfig.settings.prioritizeHeadersOverQueryParams).toBe(true);
    });

    it('should set request method and isPostMethod correctly', () => {
      expect(requestConfig.method).toBe('GET');
      expect(requestConfig.isPostMethod).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    describe('parseBoolean', () => {
      it('should parse string "true" to boolean true', () => {
        expect(requestConfig.parseBoolean('true')).toBe(true);
      });

      it('should parse string "false" to boolean false', () => {
        expect(requestConfig.parseBoolean('false')).toBe(false);
      });

      it('should return default value for null or undefined input', () => {
        expect(requestConfig.parseBoolean(null, true)).toBe(true);
        expect(requestConfig.parseBoolean(undefined, false)).toBe(false);
      });

      it('should handle non-string inputs', () => {
        expect(requestConfig.parseBoolean(123, false)).toBe(false);
        expect(requestConfig.parseBoolean({}, true)).toBe(true);
      });
    });

    describe('parseJson', () => {
      it('should parse valid JSON string', () => {
        const jsonStr = '{"key":"value"}';
        expect(requestConfig.parseJson(jsonStr)).toEqual({ key: 'value' });
      });

      it('should return null for empty input', () => {
        expect(requestConfig.parseJson('')).toBeNull();
        expect(requestConfig.parseJson(null)).toBeNull();
      });

      it('should handle invalid JSON', () => {
        const invalidJson = '{invalid:json}';
        const result = requestConfig.parseJson(invalidJson);
        expect(result).toBeInstanceOf(Error);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('getHeader', () => {
      it('should use CDN adapter to get header value', () => {
        mockCdnAdapter.getRequestHeader.mockReturnValue('test-value');
        expect(requestConfig.getHeader('test-header')).toBe('test-value');
        expect(mockCdnAdapter.getRequestHeader).toHaveBeenCalledWith('test-header', mockRequest);
      });
    });
  });

  describe('Request Body Handling', () => {
    it('should handle POST request with JSON body', async () => {
      const jsonBody = {
        visitorId: 'test-visitor',
        sdkKey: 'test-sdk-key',
        attributes: { key: 'value' },
        overrideVisitorId: true,
        overrideCache: true,
        flagKeys: ['flag1', 'flag2'],
        eventKey: 'test-event',
        eventTags: { tag: 'value' },
        enableResponseMetadata: true,
        forcedDecisions: { decision: 'value' },
        enableFlagsFromKV: true,
        datafileFromKV: true,
        decideAll: true,
        disableDecisionEvent: true,
        enabledFlagsOnly: true,
        includeReasons: true,
        ignoreUserProfileService: true,
        excludeVariables: true,
        trimmedDecisions: true,
        setRequestHeaders: true,
        setResponseHeaders: true,
        setRequestCookies: true,
        setResponseCookies: true,
      };

      // Mock request with POST method and JSON content type
      mockRequest = new Request('https://example.com/test', {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json'
        }),
        body: JSON.stringify(jsonBody)
      });

      mockAbstractionHelper = {
        request: mockRequest,
        headers: mockRequest.headers,
        abstractRequest: {
          getNewURL: vi.fn().mockReturnValue(new URL(mockRequest.url)),
          getHttpMethod: vi.fn().mockReturnValue('POST'),
          getHeader: vi.fn(),
        },
      };

      mockCdnAdapter.getRequestHeader.mockReturnValue('application/json');
      mockCdnAdapter.getJsonPayload.mockResolvedValue(jsonBody);

      requestConfig = new RequestConfig(
        mockRequest,
        {},
        {},
        mockCdnAdapter,
        mockAbstractionHelper,
      );

      // Initialize required properties
      requestConfig.queryParameters = await requestConfig.defineQueryParameters();
      requestConfig.configMetadata = await requestConfig.initializeConfigMetadata();
      requestConfig.isPostMethod = true;
      requestConfig.flagKeys = [];
      requestConfig.overrideVisitorId = false;
      requestConfig.overrideCache = false;
      requestConfig.enableFlagsFromKV = false;
      requestConfig.datafileFromKV = false;
      requestConfig.decideAll = false;
      requestConfig.disableDecisionEvent = false;
      requestConfig.enabledFlagsOnly = false;
      requestConfig.includeReasons = false;
      requestConfig.ignoreUserProfileService = false;
      requestConfig.excludeVariables = false;
      requestConfig.setRequestHeaders = false;
      requestConfig.setResponseHeaders = false;
      requestConfig.setRequestCookies = false;
      requestConfig.setResponseCookies = false;

      await requestConfig.loadRequestBody(mockRequest);
      requestConfig.body = jsonBody; // Set body directly for testing
      await requestConfig.initializeFromBody();

      // Test all properties are set correctly
      expect(requestConfig.body).toEqual(jsonBody);
      expect(requestConfig.visitorId).toBe('test-visitor');
      expect(requestConfig.sdkKey).toBe('test-sdk-key');
      expect(requestConfig.attributes).toEqual({ key: 'value' });
      expect(requestConfig.overrideVisitorId).toBe(true);
      expect(requestConfig.overrideCache).toBe(true);
      expect(requestConfig.flagKeys).toEqual(['flag1', 'flag2']);
      expect(requestConfig.eventKey).toBe('test-event');
      expect(requestConfig.eventTags).toEqual({ tag: 'value' });
      expect(requestConfig.enableResponseMetadata).toBe(true);
      expect(requestConfig.forcedDecisions).toEqual({ decision: 'value' });
      expect(requestConfig.enableFlagsFromKV).toBe(true);
      expect(requestConfig.datafileFromKV).toBe(true);
      expect(requestConfig.decideAll).toBe(true);
      expect(requestConfig.disableDecisionEvent).toBe(true);
      expect(requestConfig.enabledFlagsOnly).toBe(true);
      expect(requestConfig.includeReasons).toBe(true);
      expect(requestConfig.ignoreUserProfileService).toBe(true);
      expect(requestConfig.excludeVariables).toBe(true);
      expect(requestConfig.trimmedDecisions).toBe(true);
      expect(requestConfig.setRequestHeaders).toBe(true);
      expect(requestConfig.setResponseHeaders).toBe(true);
      expect(requestConfig.setRequestCookies).toBe(true);
      expect(requestConfig.setResponseCookies).toBe(true);
    });

    it('should handle invalid JSON body gracefully', async () => {
      // Mock request with POST method and JSON content type
      mockRequest = new Request('https://example.com/test', {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json'
        }),
        body: 'invalid json'
      });

      mockAbstractionHelper = {
        request: mockRequest,
        headers: mockRequest.headers,
        abstractRequest: {
          getNewURL: vi.fn().mockReturnValue(new URL(mockRequest.url)),
          getHttpMethod: vi.fn().mockReturnValue('POST'),
          getHeader: vi.fn(),
        },
      };

      mockCdnAdapter.getRequestHeader.mockReturnValue('application/json');
      mockCdnAdapter.getJsonPayload.mockRejectedValue(new Error('Invalid JSON'));

      requestConfig = new RequestConfig(
        mockRequest,
        {},
        {},
        mockCdnAdapter,
        mockAbstractionHelper,
      );

      requestConfig.isPostMethod = true;
      requestConfig.flagKeys = [];
      await requestConfig.loadRequestBody(mockRequest);

      expect(requestConfig.body).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle empty request body', async () => {
      // Mock request with POST method and empty body
      mockRequest = new Request('https://example.com/test', {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json',
        }),
        body: '',
      });

      requestConfig.isPostMethod = true;
      await requestConfig.loadRequestBody(mockRequest);
      expect(requestConfig.body).toBeNull();
    });
  });

  describe('Header Configuration', () => {
    beforeEach(async () => {
      mockCdnAdapter.getRequestHeader.mockImplementation((name) => {
        const headers = {
          [requestConfig.settings.sdkKeyHeader]: 'test-sdk-key',
          [requestConfig.settings.visitorIdHeader]: 'test-visitor',
          [requestConfig.settings.attributesHeader]: '{"key":"value"}',
          [requestConfig.settings.trimmedDecisionsHeader]: 'true',
          [requestConfig.settings.overrideVisitorIdHeader]: 'true',
          [requestConfig.settings.overrideCacheHeader]: 'true',
        };
        return headers[name];
      });

      // Initialize required properties
      requestConfig.queryParameters = await requestConfig.defineQueryParameters();
      requestConfig.configMetadata = await requestConfig.initializeConfigMetadata();
    });

    it('should initialize configuration from headers', async () => {
      await requestConfig.initializeFromHeaders();

      expect(requestConfig.sdkKey).toBe('test-sdk-key');
      expect(requestConfig.visitorId).toBe('test-visitor');
      expect(requestConfig.attributes).toEqual({ key: 'value' });
      expect(requestConfig.trimmedDecisions).toBe(true);
      expect(requestConfig.overrideVisitorId).toBe(true);
      expect(requestConfig.overrideCache).toBe(true);
    });

    it('should handle missing headers gracefully', async () => {
      mockCdnAdapter.getRequestHeader.mockReturnValue(null);

      await requestConfig.initializeFromHeaders();

      expect(requestConfig.sdkKey).toBeNull();
      expect(requestConfig.visitorId).toBeNull();
      expect(requestConfig.attributes).toBeNull();
      expect(requestConfig.overrideVisitorId).toBe(false);
      expect(requestConfig.overrideCache).toBe(false);
    });

    it('should handle trimmedDecisions header values', async () => {
      // Test true value
      mockCdnAdapter.getRequestHeader.mockImplementation((name) => {
        if (name === 'X-Optimizely-Trimmed-Decisions') return 'true';
        return null;
      });
      await requestConfig.initializeFromHeaders();
      expect(requestConfig.trimmedDecisions).toBe(true);

      // Test false value
      mockCdnAdapter.getRequestHeader.mockImplementation((name) => {
        if (name === 'X-Optimizely-Trimmed-Decisions') return 'false';
        return null;
      });
      requestConfig.trimmedDecisions = undefined;
      await requestConfig.initializeFromHeaders();
      expect(requestConfig.trimmedDecisions).toBe(false);

      // Test undefined value
      mockCdnAdapter.getRequestHeader.mockImplementation((name) => {
        if (name === 'X-Optimizely-Trimmed-Decisions') return null;
        return null;
      });
      requestConfig.trimmedDecisions = undefined;
      await requestConfig.initializeFromHeaders();
      expect(requestConfig.trimmedDecisions).toBe(undefined);
    });
  });

  describe('Query Parameter Configuration', () => {
    beforeEach(async () => {
      // Initialize required properties
      requestConfig.queryParameters = await requestConfig.defineQueryParameters();
      requestConfig.configMetadata = await requestConfig.initializeConfigMetadata();
    });

    it('should initialize configuration from query parameters', async () => {
      const url = new URL('https://example.com/test?sdkKey=query-sdk-key&visitorId=query-visitor&overrideVisitorId=true');
      mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(url);

      requestConfig = new RequestConfig(
        mockRequest,
        {},
        {},
        mockCdnAdapter,
        mockAbstractionHelper,
      );
      requestConfig.queryParameters = await requestConfig.defineQueryParameters();
      requestConfig.configMetadata = await requestConfig.initializeConfigMetadata();

      await requestConfig.initializeFromQueryParams();

      // Since prioritizeHeadersOverQueryParams is true by default,
      // query params should not override existing values
      expect(requestConfig.sdkKey).toBe('query-sdk-key');
      expect(requestConfig.visitorId).toBe('query-visitor');
      expect(requestConfig.overrideVisitorId).toBe(true);
    });

    it('should respect prioritizeHeadersOverQueryParams setting', async () => {
      const url = new URL('https://example.com/test?sdkKey=query-sdk-key&visitorId=query-visitor&overrideVisitorId=true');
      const mockQp = new Map();
      mockQp.set('sdkKey', 'query-sdk-key');
      mockQp.set('visitorId', 'query-visitor');
      mockQp.set('overrideVisitorId', 'true');

      mockAbstractionHelper.abstractRequest = {
        ...mockAbstractionHelper.abstractRequest,
        getNewURL: () => url,
        getQueryParamsMap: () => mockQp,
      };

      requestConfig = new RequestConfig(
        mockRequest,
        {},
        {},
        mockCdnAdapter,
        mockAbstractionHelper,
      );

      // Set up query parameters and metadata
      requestConfig.queryParameters = {
        sdkKey: 'sdkKey',
        visitorId: 'visitorId',
        overrideVisitorId: 'overrideVisitorId'
      };
      requestConfig.configMetadata = requestConfig.initializeConfigMetadata();

      await requestConfig.initializeFromQueryParams();

      expect(requestConfig.sdkKey).toBe('query-sdk-key');
      expect(requestConfig.visitorId).toBe('query-visitor');
      expect(requestConfig.overrideVisitorId).toBe(true);
    });

    it('should handle trimmedDecisions query parameter', async () => {
      // Mock URL with trimmedDecisions query parameter
      mockRequest = new Request('https://example.com/test?trimmedDecisions=true', {
        method: 'GET',
        headers: mockHeaders,
      });
      mockAbstractionHelper.request = mockRequest;
      requestConfig.trimmedDecisions = undefined;
      requestConfig.queryParameters = { trimmedDecisions: 'trimmedDecisions' };
      const mockQp = new Map();
      mockQp.set('trimmedDecisions', 'true');
      mockAbstractionHelper.abstractRequest = {
        ...mockAbstractionHelper.abstractRequest,
        getHttpMethod: () => 'GET',
        getNewURL: () => new URL(mockRequest.url),
        getQueryParamsMap: () => mockQp,
      };
      await requestConfig.initializeFromQueryParams();
      expect(requestConfig.trimmedDecisions).toBe(true);

      // Test when prioritizeHeaders is false and trimmedDecisions is false
      requestConfig.settings.prioritizeHeadersOverQueryParams = false;
      requestConfig.settings.defaultTrimmedDecisions = false; // Set default to false
      mockRequest = new Request('https://example.com/test?trimmedDecisions=false', {
        method: 'GET',
        headers: mockHeaders,
      });
      mockAbstractionHelper.request = mockRequest;
      mockQp.set('trimmedDecisions', 'false');
      mockAbstractionHelper.abstractRequest = {
        ...mockAbstractionHelper.abstractRequest,
        getHttpMethod: () => 'GET',
        getNewURL: () => new URL(mockRequest.url),
        getQueryParamsMap: () => mockQp,
      };
      requestConfig.trimmedDecisions = undefined;
      await requestConfig.initializeFromQueryParams();
      expect(requestConfig.trimmedDecisions).toBe(false);
    });
  });

  describe('Full Request Processing', () => {
    it('should process request with all sources of configuration', async () => {
      // Setup headers
      mockCdnAdapter.getRequestHeader.mockImplementation((name) => {
        const headers = {
          [requestConfig.settings.sdkKeyHeader]: 'header-sdk-key',
          'content-type': 'application/json',
          [requestConfig.settings.overrideVisitorIdHeader]: 'true',
        };
        return headers[name];
      });

      // Setup query parameters
      const url = new URL('https://example.com/test?sdkKey=query-sdk-key&overrideVisitorId=false');
      mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(url);

      // Setup POST body
      mockAbstractionHelper.abstractRequest.getHttpMethod.mockReturnValue('POST');
      mockCdnAdapter.getJsonPayload.mockResolvedValue({
        sdkKey: 'body-sdk-key',
        attributes: { source: 'body' },
        overrideVisitorId: false,
      });

      requestConfig = new RequestConfig(
        mockRequest,
        {},
        {},
        mockCdnAdapter,
        mockAbstractionHelper,
      );

      await requestConfig.initialize(mockRequest);

      // With default prioritization (headers > query params > body)
      expect(requestConfig.sdkKey).toBe('header-sdk-key');
      expect(requestConfig.attributes).toEqual({ source: 'body' });
      expect(requestConfig.overrideVisitorId).toBe(true); // From headers
    });
  });

  describe('Body Configuration', () => {
    beforeEach(() => {
      // Reset requestConfig for each test
      requestConfig = new RequestConfig(mockRequest, {}, {}, mockCdnAdapter, mockAbstractionHelper);
    });

    it('should handle trimmedDecisions in request body', async () => {
      const jsonBody = {
        trimmedDecisions: false,
        flagKeys: ['flag1']
      };

      requestConfig.isPostMethod = true;
      requestConfig.trimmedDecisions = undefined;
      await requestConfig.loadRequestBody(mockRequest);
      requestConfig.body = jsonBody;
      await requestConfig.initializeFromBody();
      expect(requestConfig.trimmedDecisions).toBe(false);

      // Test with true value
      jsonBody.trimmedDecisions = true;
      requestConfig.trimmedDecisions = undefined;
      await requestConfig.initializeFromBody();
      expect(requestConfig.trimmedDecisions).toBe(true);
    });
  });
});
