import { CacheManager } from '../../services/implementations/CacheManager';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { ICacheService } from '../../services/interfaces/ICacheService';
import { CacheKeyGenerator, CacheStrategyOptions } from '../../services/interfaces/ICacheManager';

// Add Jest types to fix linter errors
declare const global: {
  fetch: jest.Mock;
};
declare const jest: {
  fn: () => jest.Mock;
  clearAllMocks: () => void;
};
declare const describe: (name: string, fn: () => void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

interface jest {
  Mock: any;
}

/**
 * Mock implementations for testing
 */
class MockLoggerAdapter implements ILoggerAdapter {
  public logs: Array<{ level: string; message: string; metadata?: unknown }> = [];
  
  debug(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'debug', message, metadata });
  }
  
  info(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'info', message, metadata });
  }
  
  warn(message: string, metadata?: unknown): void {
    this.logs.push({ level: 'warn', message, metadata });
  }
  
  error(message: string, error?: unknown, metadata?: unknown): void {
    this.logs.push({ level: 'error', message, metadata: { error, ...metadata as object } });
  }
  
  clear(): void {
    this.logs = [];
  }
}

class MockCacheService implements ICacheService {
  private cache: Map<string, any> = new Map();
  public getCalls: string[] = [];
  public setCalls: Array<{ key: string, value: any, ttl?: number }> = [];
  public deleteCalls: string[] = [];
  
  async get<T = any>(key: string): Promise<T | null> {
    this.getCalls.push(key);
    return this.cache.get(key) as T || null;
  }
  
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    this.setCalls.push({ key, value, ttl });
    this.cache.set(key, value);
    return true;
  }
  
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
  
  async delete(key: string): Promise<boolean> {
    this.deleteCalls.push(key);
    return this.cache.delete(key);
  }
  
  generateCacheKey(baseCacheKey: string, flagKey?: string, variationKey?: string): string {
    if (baseCacheKey === 'VARIATION_KEY' && flagKey && variationKey) {
      return `${flagKey}:${variationKey}`;
    }
    return baseCacheKey;
  }
  
  clear(): void {
    this.cache.clear();
    this.getCalls = [];
    this.setCalls = [];
    this.deleteCalls = [];
  }
}

describe('CacheManager', () => {
  let logger: MockLoggerAdapter;
  let cacheService: MockCacheService;
  let cacheManager: CacheManager;
  
  beforeEach(() => {
    logger = new MockLoggerAdapter();
    cacheService = new MockCacheService();
    cacheManager = new CacheManager(cacheService, logger);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    logger.clear();
    cacheService.clear();
  });
  
  describe('getCacheService', () => {
    it('should return the underlying cache service', () => {
      expect(cacheManager.getCacheService()).toBe(cacheService);
    });
  });
  
  describe('set', () => {
    it('should set a value in the cache', async () => {
      // Arrange
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      // Act
      const result = await cacheManager.set(key, value);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.value).toBe(value);
      expect(result.fromCache).toBe(false);
      expect(result.cacheKey).toContain(key);
      expect(result.timeTaken).toBeGreaterThanOrEqual(0);
      
      // Verify cache service was called
      expect(cacheService.setCalls.length).toBe(1);
      expect(cacheService.setCalls[0].key).toContain(key);
      expect(cacheService.setCalls[0].value).toBe(value);
      expect(cacheService.setCalls[0].ttl).toBe(3600); // Default TTL
    });
    
    it('should set a value with custom TTL', async () => {
      // Arrange
      const key = 'custom-ttl';
      const value = 'test-value';
      const options: CacheStrategyOptions = { ttl: 60 }; // 1 minute
      
      // Act
      const result = await cacheManager.set(key, value, options);
      
      // Assert
      expect(result.success).toBe(true);
      
      // Verify TTL was passed to cache service
      expect(cacheService.setCalls[0].ttl).toBe(60);
    });
    
    it('should handle errors when setting cache', async () => {
      // Arrange
      const key = 'error-key';
      const value = 'test-value';
      
      // Mock error in cache service
      const mockError = new Error('Cache error');
      cacheService.set = jest.fn().mockRejectedValue(mockError);
      
      // Act
      const result = await cacheManager.set(key, value);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Cache error');
      
      // Verify error was logged
      const errorLog = logger.logs.find(log => log.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Error setting cache entry');
    });
  });
  
  describe('get', () => {
    it('should return a cached value when available', async () => {
      // Arrange
      const key = 'cached-key';
      const value = { data: 'cached-data' };
      
      // Pre-populate cache
      await cacheManager.set(key, value);
      cacheService.getCalls = []; // Clear for clean test
      
      // Act
      const result = await cacheManager.get(key);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.value).toEqual(value);
      expect(result.fromCache).toBe(true);
      expect(result.cacheKey).toContain(key);
      
      // Verify cache service was called
      expect(cacheService.getCalls.length).toBe(1);
      expect(cacheService.getCalls[0]).toContain(key);
    });
    
    it('should return cache miss when not in cache', async () => {
      // Arrange
      const key = 'missing-key';
      
      // Act
      const result = await cacheManager.get(key);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.fromCache).toBe(false);
    });
    
    it('should handle errors when getting from cache', async () => {
      // Arrange
      const key = 'error-key';
      
      // Mock error in cache service
      const mockError = new Error('Cache retrieval error');
      cacheService.get = jest.fn().mockRejectedValue(mockError);
      
      // Act
      const result = await cacheManager.get(key);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Cache retrieval error');
    });
  });
  
  describe('getOrCompute', () => {
    it('should return cached value when available', async () => {
      // Arrange
      const key = 'cached-compute-key';
      const value = { computed: false, data: 'cached-value' };
      
      // Pre-populate cache
      await cacheManager.set(key, value);
      
      // Create compute function (should not be called)
      const computeFn = jest.fn().mockResolvedValue({ computed: true, data: 'computed-value' });
      
      // Act
      const result = await cacheManager.getOrCompute(key, computeFn);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.value).toEqual(value);
      expect(result.fromCache).toBe(true);
      
      // Verify compute function was not called
      expect(computeFn).not.toHaveBeenCalled();
    });
    
    it('should compute and cache value when not available', async () => {
      // Arrange
      const key = 'compute-key';
      const computedValue = { computed: true, data: 'fresh-value' };
      
      // Create compute function
      const computeFn = jest.fn().mockResolvedValue(computedValue);
      
      // Act
      const result = await cacheManager.getOrCompute(key, computeFn);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.value).toEqual(computedValue);
      expect(result.fromCache).toBe(false);
      
      // Verify compute function was called
      expect(computeFn).toHaveBeenCalledTimes(1);
      
      // Verify value was cached
      const cachedResult = await cacheManager.get(key);
      expect(cachedResult.success).toBe(true);
      expect(cachedResult.value).toEqual(computedValue);
    });
    
    it('should handle compute function errors', async () => {
      // Arrange
      const key = 'compute-error-key';
      const computeError = new Error('Computation failed');
      
      // Create compute function that throws
      const computeFn = jest.fn().mockRejectedValue(computeError);
      
      // Act
      const result = await cacheManager.getOrCompute(key, computeFn);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Computation failed');
      
      // Verify compute function was called
      expect(computeFn).toHaveBeenCalledTimes(1);
      
      // Verify error was logged
      const errorLog = logger.logs.find(log => log.level === 'error' && log.message.includes('Computing value'));
      expect(errorLog).toBeDefined();
    });
  });
  
  describe('invalidate', () => {
    it('should invalidate a cache entry', async () => {
      // Arrange
      const key = 'invalidate-key';
      const value = 'value-to-invalidate';
      
      // Pre-populate cache
      await cacheManager.set(key, value);
      
      // Verify it's in cache
      const beforeResult = await cacheManager.get(key);
      expect(beforeResult.success).toBe(true);
      
      // Clear tracking for clean test
      cacheService.deleteCalls = [];
      
      // Act
      const result = await cacheManager.invalidate(key);
      
      // Assert
      expect(result.success).toBe(true);
      
      // Verify cache service delete was called
      expect(cacheService.deleteCalls.length).toBe(1);
      expect(cacheService.deleteCalls[0]).toContain(key);
      
      // Verify it's no longer in cache
      const afterResult = await cacheManager.get(key);
      expect(afterResult.success).toBe(false);
    });
    
    it('should handle errors when invalidating', async () => {
      // Arrange
      const key = 'invalidate-error-key';
      
      // Mock error in cache service
      const mockError = new Error('Delete error');
      cacheService.delete = jest.fn().mockRejectedValue(mockError);
      
      // Act
      const result = await cacheManager.invalidate(key);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Delete error');
    });
  });
  
  describe('generateCacheKey', () => {
    it('should generate a basic cache key', () => {
      // Arrange
      const key = 'basic-key';
      
      // Act
      const result = cacheManager.generateCacheKey(key);
      
      // Assert
      expect(result).toBe(`cm:${key}`);
    });
    
    it('should include all query params when varyByQueryParams is true', () => {
      // Arrange
      const key = 'query-key';
      const params = { a: '1', b: '2', c: { nested: 'value' } };
      
      // Act
      const result = cacheManager.generateCacheKey(key, params);
      
      // Assert
      expect(result).toContain(key);
      expect(result).toContain('a=1');
      expect(result).toContain('b=2');
      expect(result).toContain('c={"nested":"value"}');
    });
    
    it('should only include specified query params when varyByQueryParams is an array', () => {
      // Arrange
      const key = 'specific-params';
      const params = { a: '1', b: '2', c: '3' };
      const options: CacheStrategyOptions = { varyByQueryParams: ['a', 'c'] };
      
      // Act
      const result = cacheManager.generateCacheKey(key, params, options);
      
      // Assert
      expect(result).toContain(key);
      expect(result).toContain('a=1');
      expect(result).toContain('c=3');
      expect(result).not.toContain('b=2');
    });
    
    it('should include header variations when varyByHeaders is specified', () => {
      // Arrange
      const key = 'header-key';
      const options: CacheStrategyOptions = { varyByHeaders: ['accept-language', 'user-agent'] };
      
      // Act
      const result = cacheManager.generateCacheKey(key, {}, options);
      
      // Assert
      expect(result).toContain(key);
      expect(result).toContain('vh:accept-language,user-agent');
    });
    
    it('should use custom key generator when provided', () => {
      // Arrange
      const key = 'custom-generator';
      const params = { id: '123' };
      const customGenerator: CacheKeyGenerator = (baseKey, params) => `custom:${baseKey}:${params.id}`;
      const options: CacheStrategyOptions = { keyGenerator: customGenerator };
      
      // Act
      const result = cacheManager.generateCacheKey(key, params, options);
      
      // Assert
      expect(result).toBe(`custom:${key}:123`);
    });
  });
  
  describe('getMetrics', () => {
    it('should return zero metrics initially', () => {
      // Act
      const metrics = cacheManager.getMetrics();
      
      // Assert
      expect(metrics.gets).toBe(0);
      expect(metrics.sets).toBe(0);
      expect(metrics.invalidations).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.avgGetTime).toBe(0);
      expect(metrics.avgSetTime).toBe(0);
    });
    
    it('should track cache operations in metrics', async () => {
      // Arrange - Perform operations
      const key1 = 'metrics-key-1';
      const key2 = 'metrics-key-2';
      
      // Two sets, one successful get, one miss, one invalidation
      await cacheManager.set(key1, 'value1');
      await cacheManager.set(key2, 'value2');
      await cacheManager.get(key1); // Hit
      await cacheManager.get('nonexistent'); // Miss
      await cacheManager.invalidate(key2);
      
      // Act
      const metrics = cacheManager.getMetrics();
      
      // Assert
      expect(metrics.gets).toBe(2);
      expect(metrics.sets).toBe(2);
      expect(metrics.invalidations).toBe(1);
      expect(metrics.hitRate).toBe(0.5); // 1 hit out of 2 gets
      expect(metrics.avgGetTime).toBeGreaterThanOrEqual(0);
      expect(metrics.avgSetTime).toBeGreaterThanOrEqual(0);
    });
  });
}); 