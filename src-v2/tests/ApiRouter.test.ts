import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiRouter } from '../services/implementations/ApiRouter';
import { IDatafileService } from '../services/interfaces/IDatafileService';
import { ICacheService } from '../services/interfaces/ICacheService';
import { IConfigService } from '../services/interfaces/IConfigService';
import { ILoggerAdapter } from '../adapters/interfaces/ILoggerAdapter';
import { IMetricsAdapter } from '../adapters/interfaces/IMetricsAdapter';
import { IRequestAdapter } from '../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../adapters/interfaces/IResponseAdapter';

// Mock implementations
const createMockDatafileService = (): IDatafileService => ({
  getDatafile: vi.fn().mockResolvedValue('{\"revision\":\"123\",\"featureFlags\":[{\"key\":\"flag1\"}]}'),
  setDatafile: vi.fn().mockResolvedValue(true),
  saveDatafile: vi.fn().mockResolvedValue(true),
  getFlagKeys: vi.fn().mockResolvedValue(['flag1', 'flag2']),
  setFlagKeys: vi.fn().mockResolvedValue(true),
  saveFlagKeys: vi.fn().mockResolvedValue(true),
  extractFlagKeys: vi.fn().mockReturnValue(['flag1', 'flag2']),
  refreshDatafile: vi.fn().mockResolvedValue('{\"revision\":\"123\",\"featureFlags\":[{\"key\":\"flag1\"}]}'),
  fetchDatafileFromCDN: vi.fn().mockResolvedValue('{\"revision\":\"123\",\"featureFlags\":[{\"key\":\"flag1\"}]}'),
  purgeDatafile: vi.fn().mockResolvedValue(true),
  purgeFlagKeys: vi.fn().mockResolvedValue(true)
});

const createMockCacheService = (): ICacheService => ({
  get: vi.fn().mockResolvedValue('cached-value'),
  set: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
  has: vi.fn().mockResolvedValue(true),
  generateCacheKey: vi.fn().mockReturnValue('cache-key')
});

const createMockConfigService = (): IConfigService => ({
  getDatafile: vi.fn().mockResolvedValue('{\"revision\":\"123\"}'),
  getEdgeAgentVersion: vi.fn().mockReturnValue('2.0.0'),
  getEnvironment: vi.fn().mockReturnValue('test'),
  getCdnProvider: vi.fn().mockReturnValue('cloudflare'),
  getAdminToken: vi.fn().mockReturnValue('mock-admin-token'),
  onUpdate: vi.fn().mockReturnValue(() => {})
});

const createMockLoggerAdapter = (): ILoggerAdapter => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createMockMetricsAdapter = (): IMetricsAdapter => ({
  incrementCounter: vi.fn(),
  recordHistogram: vi.fn(),
  startTimer: vi.fn().mockReturnValue(() => {}),
  setGauge: vi.fn(),
  recordTimer: vi.fn()
});

const createMockRequestAdapter = (method = 'GET', url = 'https://example.com/api/v1/datafiles/sdk-key', headerObj = {}, body = null): IRequestAdapter => {
  const headers = new Headers();
  Object.entries(headerObj).forEach(([key, value]) => {
    headers.set(key, value as string);
  });

  return {
    getMethod: vi.fn().mockReturnValue(method),
    getUrl: vi.fn().mockReturnValue(new URL(url)),
    getHeader: vi.fn().mockImplementation((name) => headers.get(name)),
    getHeaders: vi.fn().mockReturnValue(headers),
    getBodyText: vi.fn().mockResolvedValue(''),
    getBodyJson: vi.fn().mockResolvedValue({}),
    getBody: vi.fn().mockResolvedValue(body),
    getNativeRequest: vi.fn().mockReturnValue({})
  };
};

const createMockResponseAdapter = (): IResponseAdapter => {
  const headers = new Headers();
  let status = 200;
  let body = '';

  return {
    setHeader: vi.fn().mockImplementation((name, value) => {
      headers.set(name, value);
      return;
    }),
    getHeaders: vi.fn().mockReturnValue(headers),
    status: vi.fn().mockImplementation((code) => {
      status = code;
      return;
    }),
    getStatus: vi.fn().mockReturnValue(status),
    send: vi.fn().mockImplementation((content) => {
      body = content as string;
      return;
    }),
    getBody: vi.fn().mockReturnValue(body),
    json: vi.fn().mockImplementation((obj) => {
      body = JSON.stringify(obj);
      return;
    })
  };
};

describe('ApiRouter', () => {
  let datafileService: ReturnType<typeof createMockDatafileService>;
  let cacheService: ReturnType<typeof createMockCacheService>;
  let configService: ReturnType<typeof createMockConfigService>;
  let loggerAdapter: ReturnType<typeof createMockLoggerAdapter>;
  let metricsAdapter: ReturnType<typeof createMockMetricsAdapter>;
  let apiRouter: ApiRouter;

  beforeEach(() => {
    datafileService = createMockDatafileService();
    cacheService = createMockCacheService();
    configService = createMockConfigService();
    loggerAdapter = createMockLoggerAdapter();
    metricsAdapter = createMockMetricsAdapter();

    apiRouter = new ApiRouter(
      datafileService,
      cacheService,
      configService,
      loggerAdapter,
      metricsAdapter
    );
  });

  describe('GET /api/v1/datafiles/:sdkKey', () => {
    it('should return a datafile when found', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/datafile?sdkKey=test-sdk-key');
      const response = createMockResponseAdapter();

      // Act
      await apiRouter.routeApiRequest(request);
      
      // Create a mock response to pass to the response handler
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      response.setHeader('Content-Type', responseResult.headers['Content-Type']);
      if (responseResult.body && typeof responseResult.body === 'string') {
        response.send(responseResult.body);
      }

      // Assert
      expect(datafileService.getDatafile).toHaveBeenCalledWith('test-sdk-key');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should return 404 when datafile is not found', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/datafile?sdkKey=missing-sdk-key');
      const response = createMockResponseAdapter();
      
      // Mock the getDatafile to return null for this test
      datafileService.getDatafile = vi.fn().mockResolvedValueOnce(null);

      // Act
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      if (responseResult.body && typeof responseResult.body === 'string') {
        const body = JSON.parse(responseResult.body);
        response.json(body);
      }

      // Assert
      expect(datafileService.getDatafile).toHaveBeenCalledWith('missing-sdk-key');
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: expect.stringContaining('not found')
      }));
    });
  });

  describe('GET /api/v1/flag-keys/:sdkKey', () => {
    it('should return flag keys when found', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/flagkeys?sdkKey=test-sdk-key');
      const response = createMockResponseAdapter();

      // Act
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      if (responseResult.body && typeof responseResult.body === 'string') {
        const body = JSON.parse(responseResult.body);
        response.json(body);
      }

      // Assert
      expect(datafileService.getFlagKeys).toHaveBeenCalledWith('test-sdk-key');
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when flag keys are not found', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/flagkeys?sdkKey=missing-sdk-key');
      const response = createMockResponseAdapter();
      
      // Mock the getFlagKeys to return null for this test
      datafileService.getFlagKeys = vi.fn().mockResolvedValueOnce(null);

      // Act
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      if (responseResult.body && typeof responseResult.body === 'string') {
        const body = JSON.parse(responseResult.body);
        response.json(body);
      }

      // Assert
      expect(datafileService.getFlagKeys).toHaveBeenCalledWith('missing-sdk-key');
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: expect.stringContaining('not found')
      }));
    });
  });

  describe('GET /api/v1/info', () => {
    it('should return SDK info', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/sdk');
      const response = createMockResponseAdapter();

      // Act
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      if (responseResult.body && typeof responseResult.body === 'string') {
        const body = JSON.parse(responseResult.body);
        response.json(body);
      }

      // Assert
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
        version: '2.0.0',
        environment: 'test'
      }));
    });
  });

  describe('Route not found', () => {
    it('should return 404 for unknown routes', async () => {
      // Arrange
      const request = createMockRequestAdapter('GET', 'https://example.com/api/unknown-path');
      const response = createMockResponseAdapter();

      // Act
      const responseResult = await apiRouter.routeApiRequest(request);
      
      // Simulate handling of the response
      response.status(responseResult.status);
      if (responseResult.body && typeof responseResult.body === 'string') {
        const body = JSON.parse(responseResult.body);
        response.json(body);
      }

      // Assert
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: expect.stringContaining('Unknown API endpoint')
      }));
    });
  });
}); 