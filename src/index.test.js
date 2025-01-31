import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  normalizePathname, 
  isAssetRequest, 
  setLoggerFactory, 
  handleApiRequest, 
  handleOptimizelyRequest, 
  handleDefaultRequest 
} from './index';
import Logger from './_helpers_/logger';

describe('Edge Worker Index', () => {
  let mockLogger;

  beforeEach(() => {
    // Create mock logger instance
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugExt: vi.fn(),
      error: vi.fn(),
    };

    // Set up the logger factory to return our mock logger
    setLoggerFactory(() => mockLogger);
  });

  describe('normalizePathname', () => {
    it('should remove leading double slash', () => {
      expect(normalizePathname('//test/path')).toBe('/test/path');
    });

    it('should not modify path without double slash', () => {
      expect(normalizePathname('/test/path')).toBe('/test/path');
    });

    it('should handle empty path', () => {
      expect(normalizePathname('')).toBe('');
    });

    it('should handle paths with multiple slashes', () => {
      expect(normalizePathname('///test/path')).toBe('//test/path');
    });
  });

  describe('isAssetRequest', () => {
    beforeEach(() => {
      mockLogger.debug.mockClear();
    });

    it('should identify image asset requests', () => {
      expect(isAssetRequest('/assets/image.jpg')).toBe(true);
      expect(isAssetRequest('/images/photo.jpeg')).toBe(true);
      expect(isAssetRequest('/static/icon.png')).toBe(true);
      expect(isAssetRequest('/logo.gif')).toBe(true);
      expect(isAssetRequest('/icons/menu.svg')).toBe(true);
    });

    it('should identify web asset requests', () => {
      expect(isAssetRequest('/styles/main.css')).toBe(true);
      expect(isAssetRequest('/scripts/app.js')).toBe(true);
      expect(isAssetRequest('/favicon.ico')).toBe(true);
    });

    it('should identify font asset requests', () => {
      expect(isAssetRequest('/fonts/roboto.woff')).toBe(true);
      expect(isAssetRequest('/fonts/opensans.woff2')).toBe(true);
      expect(isAssetRequest('/fonts/lato.ttf')).toBe(true);
      expect(isAssetRequest('/fonts/arial.eot')).toBe(true);
    });

    it('should identify non-asset requests', () => {
      expect(isAssetRequest('/api/data')).toBe(false);
      expect(isAssetRequest('/optimizely')).toBe(false);
      expect(isAssetRequest('/')).toBe(false);
      expect(isAssetRequest('/users/profile')).toBe(false);
      expect(isAssetRequest('/assets/documents/report.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isAssetRequest('/image.JPG')).toBe(true);
      expect(isAssetRequest('/style.CSS')).toBe(true);
      expect(isAssetRequest('/font.WOFF')).toBe(true);
    });

    it('should log debug messages', () => {
      isAssetRequest('/test.jpg');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Edgeworker index.js - Checking if request is for an asset [isAssetRequest]',
        true,
      );

      isAssetRequest('/api/data');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Edgeworker index.js - Checking if request is for an asset [isAssetRequest]',
        false,
      );
    });
  });

  describe('handleApiRequest', () => {
    let mockAbstractionHelper;
    let mockKvStore;
    let mockDefaultSettings;
    let mockHandleRequest;

    beforeEach(() => {
      mockAbstractionHelper = {
        createResponse: vi.fn(),
      };
      mockKvStore = {};
      mockDefaultSettings = {};
      mockHandleRequest = vi.fn();
      global.handleRequest = mockHandleRequest;
    });

    it.skip('should handle successful API request', async () => {
      const mockRequest = new Request('https://example.com/api/test');
      const mockResponse = new Response('success', { status: 200 });
      mockHandleRequest.mockResolvedValue(mockResponse);

      const result = await handleApiRequest(mockRequest, mockAbstractionHelper, mockKvStore, mockLogger, mockDefaultSettings);
      expect(mockHandleRequest).toHaveBeenCalledWith(mockRequest, mockAbstractionHelper, mockKvStore, mockLogger, mockDefaultSettings);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle API request failure', async () => {
      const mockRequest = new Request('https://example.com/api/test');
      const mockErrorResponse = new Response('error', { status: 500 });
      mockHandleRequest.mockRejectedValue(new Error('API error'));
      mockAbstractionHelper.createResponse.mockResolvedValue(mockErrorResponse);

      const result = await handleApiRequest(mockRequest, mockAbstractionHelper, mockKvStore, mockLogger, mockDefaultSettings);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalled();
    });
  });

  describe('handleOptimizelyRequest', () => {
    let mockAbstractionHelper;
    let mockKvStore;
    let mockKvStoreUserProfile;
    let mockEnv;
    let mockCtx;
    let mockCdnAdapter;
    let mockRequest;

    beforeEach(() => {
      mockAbstractionHelper = {
        createResponse: vi.fn(),
      };
      mockKvStore = {};
      mockKvStoreUserProfile = {};
      mockEnv = {};
      mockCtx = {};
      mockRequest = new Request('https://example.com/test');
      mockCdnAdapter = {
        fetchHandler: vi.fn(),
      };
      global.cdnAdapter = mockCdnAdapter;
      global.incomingRequest = mockRequest;
      global.environmentVariables = mockEnv;
      global.context = mockCtx;
    });

    it.skip('should handle successful Optimizely request', async () => {
      const mockResponse = new Response('success', { status: 200 });
      mockCdnAdapter.fetchHandler.mockResolvedValue(mockResponse);

      const result = await handleOptimizelyRequest(
        'test-sdk-key',
        mockRequest,
        mockEnv,
        mockCtx,
        mockAbstractionHelper,
        mockKvStore,
        mockKvStoreUserProfile
      );
      // expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockCdnAdapter.fetchHandler).toHaveBeenCalled();
    });

    it('should handle Optimizely request error', async () => {
      const mockErrorResponse = new Response('error', { status: 500 });
      mockCdnAdapter.fetchHandler.mockRejectedValue(new Error('Optimizely error'));
      mockAbstractionHelper.createResponse.mockResolvedValue(mockErrorResponse);

      const result = await handleOptimizelyRequest(
        'test-sdk-key',
        mockRequest,
        mockEnv,
        mockCtx,
        mockAbstractionHelper,
        mockKvStore,
        mockKvStoreUserProfile
      );
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAbstractionHelper.createResponse).toHaveBeenCalled();
    });
  });

  describe('handleDefaultRequest', () => {
    let mockEnv;
    let mockCtx;
    let mockCdnAdapter;
    let mockAbstractionHelper;
    let mockRequest;
    let mockFetch;

    beforeEach(() => {
      mockEnv = {};
      mockCtx = {};
      mockRequest = new Request('https://example.com/test');
      mockAbstractionHelper = {
        createResponse: vi.fn(),
      };
      mockCdnAdapter = {
        defaultFetch: vi.fn(),
      };
      mockFetch = vi.fn();
      global.fetch = mockFetch;
      global.cdnAdapter = mockCdnAdapter;
      global.incomingRequest = mockRequest;
      global.abstractionHelper = mockAbstractionHelper;
      global.abstractRequest = {
        getHttpMethod: vi.fn().mockReturnValue('GET'),
        getPathname: vi.fn().mockReturnValue('/test'),
      };
    });

    it('should handle asset request', async () => {
      mockRequest = new Request('https://example.com/image.jpg');
      const mockResponse = new Response('success', {
        headers: { 'X-Proxied-From': 'test' },
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await handleDefaultRequest(
        mockRequest,
        mockEnv,
        mockCtx,
        '/image.jpg',
        false,
        null,
        false
      );
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    });

    it.skip('should handle worker operation request', async () => {
      mockRequest = new Request('https://example.com/v1/datafile');
      const mockResponse = new Response('success', { status: 200 });
      mockCdnAdapter.defaultFetch.mockResolvedValue(mockResponse);

      const result = await handleDefaultRequest(
        mockRequest,
        mockEnv,
        mockCtx,
        '/v1/datafile',
        true,
        'test-sdk-key',
        true
      );
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockCdnAdapter.defaultFetch).toHaveBeenCalled();
    });
  });
});
