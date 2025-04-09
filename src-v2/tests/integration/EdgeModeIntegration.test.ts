import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeModeIntegration } from '../../services/implementations/EdgeModeIntegration';
import { URLMatcher } from '../../services/implementations/URLMatcher';
import { EdgeModeHandler } from '../../services/implementations/EdgeModeHandler';
import { ContentFetcher } from '../../services/implementations/ContentFetcher';
import { CacheManager } from '../../services/implementations/CacheManager';
import { ContentTransformer } from '../../services/implementations/ContentTransformer';
import { RequestForwarder } from '../../services/implementations/RequestForwarder';
import { CDNVariationSettings } from '../../services/interfaces/IEdgeModeHandler';
import { RequestForwardResult } from '../../services/interfaces/IRequestForwarder';

// Mock implementations of dependencies
const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createMockURLMatcher = () => ({
  findMatch: vi.fn(),
  matches: vi.fn(),
  normalizePath: vi.fn(),
  matchesPath: vi.fn(),
  matchesQueryParams: vi.fn()
});

const createMockEdgeModeHandler = () => ({
  shouldHandleRequest: vi.fn(),
  prepareContent: vi.fn(),
  processRequest: vi.fn(),
  findMatchingConfig: vi.fn(),
  fetchContent: vi.fn(),
  transformContent: vi.fn(),
  forwardToOrigin: vi.fn()
});

const createMockContentFetcher = () => ({
  fetchContent: vi.fn()
});

const createMockCacheManager = () => ({
  generateCacheKey: vi.fn(),
  retrieveFromCache: vi.fn(),
  storeInCache: vi.fn(),
  invalidateCache: vi.fn(),
  getCacheStats: vi.fn()
});

const createMockContentTransformer = () => ({
  transform: vi.fn()
});

const createMockRequestForwarder = () => ({
  forwardRequest: vi.fn(),
  forwardRequestAndApplyResponse: vi.fn(),
  buildForwardUrl: vi.fn()
});

const createMockRequestAdapter = () => ({
  getUrl: vi.fn(() => new URL('https://example.com/test')),
  getMethod: vi.fn(() => 'GET'),
  getHeader: vi.fn(),
  getHeaders: vi.fn(() => new Headers()),
  getBody: vi.fn(),
  getBodyJson: vi.fn(),
  getBodyText: vi.fn(),
  getBodyBuffer: vi.fn(),
  getClientInfo: vi.fn()
});

const createMockUserContext = () => ({
  userId: 'test-user',
  attributes: {}
});

describe('EdgeModeIntegration', () => {
  let edgeModeIntegration: EdgeModeIntegration;
  let mockLogger: any;
  let mockURLMatcher: any;
  let mockEdgeModeHandler: any;
  let mockContentFetcher: any;
  let mockCacheManager: any;
  let mockContentTransformer: any;
  let mockRequestForwarder: any;
  let mockRequestAdapter: any;
  let mockUserContext: any;

  beforeEach(() => {
    // Create mocks
    mockLogger = createMockLogger();
    mockURLMatcher = createMockURLMatcher();
    mockEdgeModeHandler = createMockEdgeModeHandler();
    mockContentFetcher = createMockContentFetcher();
    mockCacheManager = createMockCacheManager();
    mockContentTransformer = createMockContentTransformer();
    mockRequestForwarder = createMockRequestForwarder();
    mockRequestAdapter = createMockRequestAdapter();
    mockUserContext = createMockUserContext();

    // Create the EdgeModeIntegration instance with mocks
    edgeModeIntegration = new EdgeModeIntegration(
      mockURLMatcher,
      mockEdgeModeHandler,
      mockContentFetcher,
      mockCacheManager,
      mockContentTransformer,
      mockRequestForwarder,
      mockLogger
    );
  });

  it('should initialize correctly', () => {
    expect(edgeModeIntegration).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initialized with all required components'));
  });

  it('should forward to origin when request is not eligible for Edge Mode', async () => {
    // Setup mocks
    mockEdgeModeHandler.shouldHandleRequest.mockResolvedValue({
      handle: false,
      reason: 'Not a GET request'
    });

    mockRequestForwarder.forwardRequest.mockResolvedValue({
      success: true,
      body: 'Origin response',
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      originalRequest: mockRequestAdapter,
      targetUrl: 'https://origin.example.com',
      timeTaken: 100
    } as RequestForwardResult);

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockEdgeModeHandler.shouldHandleRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockUserContext
    );
    expect(mockRequestForwarder.forwardRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      null
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Origin response');
  });

  it('should forward to origin when no URL match is found', async () => {
    // Setup mocks
    mockEdgeModeHandler.shouldHandleRequest.mockResolvedValue({
      handle: true,
      variationSettings: [{ cdnExperimentURL: 'https://example.com/other' }]
    });

    mockURLMatcher.findMatch.mockResolvedValue({
      matched: false,
      settings: null
    });

    mockRequestForwarder.forwardRequest.mockResolvedValue({
      success: true,
      body: 'Origin response',
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      originalRequest: mockRequestAdapter,
      targetUrl: 'https://origin.example.com',
      timeTaken: 100
    } as RequestForwardResult);

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockEdgeModeHandler.shouldHandleRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockUserContext
    );
    expect(mockURLMatcher.findMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array)
    );
    expect(mockRequestForwarder.forwardRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      null
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Origin response');
  });

  it('should forward to origin as specified by content preparation', async () => {
    // Create mock CDN variation settings
    const mockSettings: CDNVariationSettings = {
      cdnExperimentURL: 'https://example.com/test',
      cdnResponseURL: 'https://cdn.example.com/content',
      forwardRequestToOrigin: true
    };

    // Setup mocks
    mockEdgeModeHandler.shouldHandleRequest.mockResolvedValue({
      handle: true,
      variationSettings: [mockSettings]
    });

    mockURLMatcher.findMatch.mockResolvedValue({
      matched: true,
      settings: mockSettings
    });

    mockEdgeModeHandler.prepareContent.mockResolvedValue({
      forwardToOrigin: true,
      useCache: true
    });

    mockCacheManager.generateCacheKey.mockReturnValue('test-cache-key');
    mockCacheManager.retrieveFromCache.mockResolvedValue(null);

    mockRequestForwarder.forwardRequest.mockResolvedValue({
      success: true,
      body: 'Origin response',
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      originalRequest: mockRequestAdapter,
      targetUrl: 'https://origin.example.com',
      timeTaken: 100
    } as RequestForwardResult);

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockEdgeModeHandler.shouldHandleRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockUserContext
    );
    expect(mockURLMatcher.findMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array)
    );
    expect(mockEdgeModeHandler.prepareContent).toHaveBeenCalledWith(
      mockSettings,
      mockUserContext,
      mockRequestAdapter
    );
    expect(mockCacheManager.generateCacheKey).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockSettings
    );
    expect(mockCacheManager.retrieveFromCache).toHaveBeenCalledWith(
      'test-cache-key'
    );
    expect(mockRequestForwarder.forwardRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockSettings
    );
    expect(mockCacheManager.storeInCache).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Origin response');
  });

  it('should serve cached content when available', async () => {
    // Create mock CDN variation settings
    const mockSettings: CDNVariationSettings = {
      cdnExperimentURL: 'https://example.com/test',
      cdnResponseURL: 'https://cdn.example.com/content',
      forwardRequestToOrigin: true,
      transformContent: 'function(content) { return content + " transformed"; }'
    };

    // Setup mocks
    mockEdgeModeHandler.shouldHandleRequest.mockResolvedValue({
      handle: true,
      variationSettings: [mockSettings]
    });

    mockURLMatcher.findMatch.mockResolvedValue({
      matched: true,
      settings: mockSettings
    });

    mockEdgeModeHandler.prepareContent.mockResolvedValue({
      forwardToOrigin: true,
      useCache: true
    });

    mockCacheManager.generateCacheKey.mockReturnValue('test-cache-key');
    mockCacheManager.retrieveFromCache.mockResolvedValue({
      content: 'Cached content',
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

    mockContentTransformer.transform.mockResolvedValue('Cached content transformed');

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockEdgeModeHandler.shouldHandleRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockUserContext
    );
    expect(mockURLMatcher.findMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array)
    );
    expect(mockEdgeModeHandler.prepareContent).toHaveBeenCalledWith(
      mockSettings,
      mockUserContext,
      mockRequestAdapter
    );
    expect(mockCacheManager.generateCacheKey).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockSettings
    );
    expect(mockCacheManager.retrieveFromCache).toHaveBeenCalledWith(
      'test-cache-key'
    );
    expect(mockContentTransformer.transform).toHaveBeenCalledWith(
      'Cached content',
      mockSettings,
      mockUserContext
    );
    expect(mockRequestForwarder.forwardRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Cached content transformed');
  });

  it('should fetch content directly when not forwarding to origin', async () => {
    // Create mock CDN variation settings
    const mockSettings: CDNVariationSettings = {
      cdnExperimentURL: 'https://example.com/test',
      cdnResponseURL: 'https://cdn.example.com/content',
      forwardRequestToOrigin: false
    };

    // Setup mocks
    mockEdgeModeHandler.shouldHandleRequest.mockResolvedValue({
      handle: true,
      variationSettings: [mockSettings]
    });

    mockURLMatcher.findMatch.mockResolvedValue({
      matched: true,
      settings: mockSettings
    });

    mockEdgeModeHandler.prepareContent.mockResolvedValue({
      forwardToOrigin: false,
      useCache: true
    });

    mockCacheManager.generateCacheKey.mockReturnValue('test-cache-key');
    mockCacheManager.retrieveFromCache.mockResolvedValue(null);

    mockContentFetcher.fetchContent.mockResolvedValue({
      content: 'Direct content',
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockEdgeModeHandler.shouldHandleRequest).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockUserContext
    );
    expect(mockURLMatcher.findMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array)
    );
    expect(mockEdgeModeHandler.prepareContent).toHaveBeenCalledWith(
      mockSettings,
      mockUserContext,
      mockRequestAdapter
    );
    expect(mockCacheManager.generateCacheKey).toHaveBeenCalledWith(
      mockRequestAdapter,
      mockSettings
    );
    expect(mockCacheManager.retrieveFromCache).toHaveBeenCalledWith(
      'test-cache-key'
    );
    expect(mockContentFetcher.fetchContent).toHaveBeenCalledWith(
      mockSettings.cdnResponseURL,
      mockUserContext
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Direct content');
  });

  it('should handle errors gracefully', async () => {
    // Setup mocks to throw an error
    mockEdgeModeHandler.shouldHandleRequest.mockRejectedValue(new Error('Test error'));

    // Call the method
    const response = await edgeModeIntegration.processEdgeModeRequest(
      mockRequestAdapter,
      mockUserContext,
      'test-request-id'
    );

    // Verify results
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing Edge Mode request'),
      expect.any(Error)
    );
    expect(response.status).toBe(500);
    const responseBody = await response.text();
    const parsedBody = JSON.parse(responseBody);
    expect(parsedBody.error).toBe('Error processing Edge Mode request');
    expect(parsedBody.message).toBe('Test error');
  });
}); 