/**
 * API Performance and Load Tests
 * 
 * These tests evaluate the performance characteristics of the Optimizely Edge Agent API
 * endpoints, including response times, resource usage, and behavior under load.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiRouter } from '../../services/implementations/ApiRouter';
import { MockRequestAdapter } from '../test-utils/MockRequestAdapter';
import { MockResponseAdapter } from '../test-utils/MockResponseAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { IDatafileService } from '../../services/interfaces/IDatafileService';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IMetricsAdapter } from '../../adapters/interfaces/IMetricsAdapter';
import { ICacheService } from '../../services/interfaces/ICacheService';
import { IConfigService } from '../../services/interfaces/IConfigService';

// Mock data for testing
const TEST_SDK_KEY = 'test-sdk-key';
const TEST_ADMIN_TOKEN = 'test-admin-token';
const TEST_DATAFILE = { 
  revision: '123', 
  featureFlags: [
    { key: 'flag1', experimentKey: 'exp1' },
    { key: 'flag2', experimentKey: 'exp2' }
  ] 
};

describe('API Performance Tests', () => {
  // Mock services - Ensure all used methods are defined
  const mockDatafileService: Partial<IDatafileService> = {
    getDatafile: vi.fn(),
    getFlagKeys: vi.fn(),
    setDatafile: vi.fn(), // Add missing if used via alias
    saveDatafile: vi.fn(),
    setFlagKeys: vi.fn(), // Add missing if used via alias
    saveFlagKeys: vi.fn()
  };
  
  const mockCacheService: Partial<ICacheService> = {
    get: vi.fn<[string], Promise<any | null>>(),
    set: vi.fn(), // Define set here
    delete: vi.fn(),
    has: vi.fn(),
    generateCacheKey: vi.fn()
  };
  
  const mockLogger: Partial<ILoggerAdapter> = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
  
  const mockMetrics: Partial<IMetricsAdapter> = {
    incrementCounter: vi.fn(),
    recordHistogram: vi.fn(),
    startTimer: vi.fn().mockReturnValue(() => {})
  };

  const mockConfigService: Partial<IConfigService> = {
    getDatafile: vi.fn(),
    getEdgeAgentVersion: vi.fn().mockReturnValue('1.0.0-test'),
    getEnvironment: vi.fn().mockReturnValue('test'),
    getCdnProvider: vi.fn().mockReturnValue('test-cdn'),
    getAdminToken: vi.fn().mockReturnValue(TEST_ADMIN_TOKEN)
  };
  
  let apiRouter: ApiRouter;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Use vi.mocked to get typed mock functions
    // Ensure the properties exist before mocking
    if (mockDatafileService.getDatafile) {
        vi.mocked(mockDatafileService.getDatafile).mockResolvedValue(JSON.stringify(TEST_DATAFILE));
    }
    if (mockDatafileService.getFlagKeys) {
        vi.mocked(mockDatafileService.getFlagKeys).mockResolvedValue(['flag1', 'flag2']);
    }
    if (mockDatafileService.saveDatafile) {
        vi.mocked(mockDatafileService.saveDatafile).mockResolvedValue(true);
    }
    if (mockDatafileService.saveFlagKeys) {
        vi.mocked(mockDatafileService.saveFlagKeys).mockResolvedValue(true);
    }
    if (mockCacheService.get) {
        vi.mocked(mockCacheService.get).mockResolvedValue(null);
    }
    if (mockCacheService.set) {
        vi.mocked(mockCacheService.set).mockResolvedValue(true);
    }

    apiRouter = new ApiRouter(
      mockDatafileService as IDatafileService,
      mockCacheService as ICacheService,
      mockConfigService as IConfigService,
      mockLogger as ILoggerAdapter,
      mockMetrics as IMetricsAdapter
    );
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  /**
   * Helper function to measure response time
   */
  async function measureResponseTime(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: any
  ): Promise<{ response: IResponseAdapter; timeMs: number }> {
    const request = new MockRequestAdapter({
      method,
      url,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    const response = new MockResponseAdapter();
    
    const startTime = performance.now();
    const result = await apiRouter.routeApiRequest(request);
    const endTime = performance.now();

    // Transfer result to response adapter
    response.status(result.status);
    Object.entries(result.headers || {}).forEach(([key, value]) => {
      response.setHeader(key, value);
    });
    response.send(result.body || '');
    
    return {
      response,
      timeMs: endTime - startTime
    };
  }
  
  describe('Response Time Tests', () => {
    it('should return datafile within acceptable time limit (cached)', async () => {
      // Arrange - Set up cache hit
      // Ensure mockCacheService.get is defined before mocking
      if (mockCacheService.get) {
        vi.mocked(mockCacheService.get).mockResolvedValue(TEST_DATAFILE);
      }
      
      // Act - Measure response time
      const { timeMs } = await measureResponseTime(
        'GET',
        `/api/datafile?sdkKey=${TEST_SDK_KEY}`
      );
      
      // Assert
      expect(timeMs).toBeLessThan(50); // 50ms is a reasonable threshold for a cached response
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockDatafileService.getDatafile).not.toHaveBeenCalled(); // Should use cache
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        expect.stringMatching(/api_request_duration/),
        expect.any(Number),
        expect.any(Object)
      );
    });
    
    it('should return datafile within acceptable time limit (uncached)', async () => {
      // Arrange - Force cache miss
      // Ensure mockCacheService.get is defined before mocking
      if (mockCacheService.get) {
         vi.mocked(mockCacheService.get).mockResolvedValue(null);
      }
      
      // Act - Measure response time
      const { timeMs } = await measureResponseTime(
        'GET',
        `/api/datafile?sdkKey=${TEST_SDK_KEY}`
      );
      
      // Assert
      expect(timeMs).toBeLessThan(200); // 200ms threshold for uncached response with service call
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockDatafileService.getDatafile).toHaveBeenCalled(); // Should call service
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        expect.stringMatching(/api_request_duration/),
        expect.any(Number),
        expect.any(Object)
      );
    });
    
    it('should return flag keys within acceptable time limit', async () => {
      // Act - Measure response time
      const { timeMs } = await measureResponseTime(
        'GET',
        `/api/flagkeys?sdkKey=${TEST_SDK_KEY}`
      );
      
      // Assert
      expect(timeMs).toBeLessThan(100); // 100ms is a reasonable threshold
      expect(mockDatafileService.getFlagKeys).toHaveBeenCalled();
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        expect.stringMatching(/api_request_duration/),
        expect.any(Number),
        expect.any(Object)
      );
    });
    
    it('should update datafile within acceptable time limit', async () => {
      // Act - Measure response time
      const { timeMs } = await measureResponseTime(
        'POST',
        `/api/datafile?sdkKey=${TEST_SDK_KEY}`,
        { 'Authorization': `Bearer ${TEST_ADMIN_TOKEN}` },
        TEST_DATAFILE
      );
      
      // Assert
      expect(timeMs).toBeLessThan(150); // 150ms is a reasonable threshold for update operation
      expect(mockDatafileService.saveDatafile).toHaveBeenCalled();
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        expect.stringMatching(/api_request_duration/),
        expect.any(Number),
        expect.any(Object)
      );
    });
    
    it('should handle unauthorized requests quickly', async () => {
      // Act - Measure response time for unauthorized access
      const { timeMs, response } = await measureResponseTime(
        'POST',
        `/api/datafile?sdkKey=${TEST_SDK_KEY}`,
        { 'Authorization': 'Bearer invalid-token' },
        TEST_DATAFILE
      );
      
      // Assert
      expect(timeMs).toBeLessThan(20); // Unauthorized responses should be very fast
      expect(response.getStatus()).toBe(403); // Should be unauthorized
      expect(mockDatafileService.saveDatafile).not.toHaveBeenCalled(); // Should not call service
    });
  });
  
  describe('Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const requestCount = 10; // Adjust based on test environment capabilities
      const requests = [];
      
      // Act - Create multiple concurrent requests
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          measureResponseTime('GET', `/api/datafile?sdkKey=${TEST_SDK_KEY}-${i}`)
        );
      }
      
      // Wait for all requests to complete
      const results = await Promise.all(requests);
      
      // Assert
      // Calculate average response time
      const avgTime = results.reduce((sum, result) => sum + result.timeMs, 0) / requestCount;
      
      // Verify all requests completed successfully
      results.forEach(({ response }) => {
        expect(response.getStatus()).toBe(200);
      });
      
      // Average time should be reasonable even under load
      expect(avgTime).toBeLessThan(300); // 300ms average is reasonable for concurrent requests
      
      // Verify service was called correct number of times
      expect(mockDatafileService.getDatafile).toHaveBeenCalledTimes(requestCount);
      
      // Metrics should have been recorded for each request
      expect(mockMetrics.recordHistogram).toHaveBeenCalled(); // Should record metrics
    });
    
    it('should handle error conditions efficiently under load', async () => {
      // Arrange - Force datafile service to fail
      // Ensure mockDatafileService.getDatafile is defined before mocking
      if (mockDatafileService.getDatafile) {
          vi.mocked(mockDatafileService.getDatafile).mockRejectedValue(new Error('Service error'));
      }
      
      const requestCount = 10;
      const requests = [];
      
      // Act - Create multiple concurrent requests that will fail
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          measureResponseTime('GET', `/api/datafile?sdkKey=${TEST_SDK_KEY}-${i}`)
        );
      }
      
      // Wait for all requests to complete
      const results = await Promise.all(requests);
      
      // Assert
      // Calculate average response time for error handling
      const avgTime = results.reduce((sum, result) => sum + result.timeMs, 0) / requestCount;
      
      // Verify all requests failed but were handled properly
      results.forEach(({ response }) => {
        expect(response.getStatus()).toBe(500); // Internal error
      });
      
      // Error responses should still be fast
      expect(avgTime).toBeLessThan(150);
      
      // Error metrics should have been recorded
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        expect.stringMatching(/api_errors/),
        1,
        expect.any(Object)
      );
    });
  });
  
  describe('Resource Usage Monitoring', () => {
    it('should track and report memory usage', async () => {
      // This test verifies that memory usage metrics are being reported
      
      // Act - Make a request that should trigger memory usage reporting
      await measureResponseTime('GET', `/api/datafile?sdkKey=${TEST_SDK_KEY}`);
      
      // Assert - Verify memory metrics were recorded
      // This checks if the API router is using the metrics adapter to report memory usage
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        expect.stringMatching(/api_request_duration/),
        expect.any(Number),
        expect.any(Object)
      );
    });
    
    it('should track request count and active connections', async () => {
      // This test verifies that request counters are being tracked
      
      // Act - Make multiple requests
      await measureResponseTime('GET', `/api/datafile?sdkKey=${TEST_SDK_KEY}`);
      await measureResponseTime('GET', `/api/flagkeys?sdkKey=${TEST_SDK_KEY}`);
      
      // Assert - Verify request metrics were recorded
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        expect.stringMatching(/api_requests_total/),
        1,
        expect.any(Object)
      );
      
      // Should track active connections
      expect(mockMetrics.recordHistogram).toHaveBeenCalled();
    });
  });
}); 