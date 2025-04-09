/**
 * CacheService Integration Tests
 * 
 * Tests the CacheService component, focusing on its interactions with 
 * storage adapters and handling of cache hits, misses, and errors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../../services/implementations/CacheService';
import { IStorageAdapter } from '../../adapters/interfaces/IStorageAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

// Mock data for testing
const TEST_DATAFILE = { revision: '123', featureFlags: [{ key: 'test_flag' }] };
const TEST_KEY = 'sdk-key-123';
const TEST_CACHE_KEY = `optimizely-cache:${TEST_KEY}`;

describe('CacheService Integration Tests', () => {
  // Mock storage adapter
  const mockStorage: Partial<IStorageAdapter> = {
    get: vi.fn().mockImplementation((key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream') => {
      if (type === 'text') {
        return Promise.resolve(null);
      } else if (type === 'json') {
        return Promise.resolve(null);
      } else if (type === 'arrayBuffer') {
        return Promise.resolve(null);
      } else {
        return Promise.resolve(null);
      }
    }),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  };

  // Mock logger adapter
  const mockLogger: Partial<ILoggerAdapter> = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  // Create a cache service instance for testing
  let cacheService: CacheService;

  beforeEach(() => {
    vi.resetAllMocks();
    cacheService = new CacheService(mockStorage as IStorageAdapter, mockLogger as ILoggerAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get method', () => {
    it('should retrieve an item from cache when present', async () => {
      // Arrange
      // Mock the storage.get to return a cached item string
      const cachedItemJson = JSON.stringify({
        value: TEST_DATAFILE,
        timestamp: Date.now(),
        expiry: Date.now() + 3600000 // 1 hour in the future
      });
      
      mockStorage.get = vi.fn().mockImplementation((key, type) => {
        if (key === TEST_CACHE_KEY && type === 'text') {
          return Promise.resolve(cachedItemJson);
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await cacheService.get(TEST_KEY);

      // Assert
      expect(result).toEqual(TEST_DATAFILE);
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('hit'));
    });

    it('should return null when item is not in cache', async () => {
      // Arrange
      mockStorage.get = vi.fn().mockResolvedValue(null);

      // Act
      const result = await cacheService.get(TEST_KEY);

      // Assert
      expect(result).toBeNull();
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('miss'));
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      mockStorage.get = vi.fn().mockRejectedValue(new Error('Storage error'));

      // Act
      const result = await cacheService.get(TEST_KEY);

      // Assert
      expect(result).toBeNull();
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error retrieving'), expect.any(Error));
    });
  });

  describe('set method', () => {
    it('should successfully store an item in cache', async () => {
      // Arrange
      const ttl = 3600; // 1 hour
      mockStorage.put = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await cacheService.set(TEST_KEY, TEST_DATAFILE, ttl);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.put).toHaveBeenCalledWith(
        TEST_CACHE_KEY, 
        expect.any(String), // JSON string of the wrapped data
        expect.objectContaining({ expirationTtl: ttl })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('stored'));
    });

    it('should use default TTL when not specified', async () => {
      // Arrange
      mockStorage.put = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await cacheService.set(TEST_KEY, TEST_DATAFILE);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.put).toHaveBeenCalledWith(
        TEST_CACHE_KEY, 
        expect.any(String), // JSON string of the wrapped data
        expect.any(Object)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('stored'));
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      mockStorage.put = vi.fn().mockRejectedValue(new Error('Storage error'));

      // Act
      const result = await cacheService.set(TEST_KEY, TEST_DATAFILE);

      // Assert
      expect(result).toBe(false);
      expect(mockStorage.put).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error storing'), 
        expect.any(Error)
      );
    });
  });

  describe('delete method', () => {
    it('should successfully delete an item from cache', async () => {
      // Arrange
      mockStorage.delete = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await cacheService.delete(TEST_KEY);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.delete).toHaveBeenCalledWith(TEST_CACHE_KEY);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Deleted'));
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      mockStorage.delete = vi.fn().mockRejectedValue(new Error('Storage error'));

      // Act
      const result = await cacheService.delete(TEST_KEY);

      // Assert
      expect(result).toBe(false);
      expect(mockStorage.delete).toHaveBeenCalledWith(TEST_CACHE_KEY);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting'), 
        expect.any(Error)
      );
    });
  });

  describe('has method', () => {
    it('should return true when an item exists in cache', async () => {
      // Arrange - Mock the get method to return a value
      const cachedItemJson = JSON.stringify({
        value: TEST_DATAFILE,
        timestamp: Date.now(),
        expiry: Date.now() + 3600000 // 1 hour in the future
      });
      
      mockStorage.get = vi.fn().mockResolvedValue(cachedItemJson);

      // Act
      const result = await cacheService.has(TEST_KEY);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
    });

    it('should return false when an item does not exist in cache', async () => {
      // Arrange
      mockStorage.get = vi.fn().mockResolvedValue(null);

      // Act
      const result = await cacheService.has(TEST_KEY);

      // Assert
      expect(result).toBe(false);
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
    });
  });

  describe('Complex Scenarios', () => {
    it('should maintain data integrity through the cache lifecycle', async () => {
      // Arrange - Mock for initial miss, then successful set, then hit
      mockStorage.get = vi.fn()
        .mockResolvedValueOnce(null); // First call - cache miss
      
      mockStorage.put = vi.fn().mockImplementation((key, value) => {
        // After successful put, next get should return this value
        mockStorage.get = vi.fn().mockResolvedValue(value);
        return Promise.resolve(undefined);
      });

      // Act - Complete cache lifecycle
      const initialResult = await cacheService.get(TEST_KEY); // Should be null (miss)
      const setResult = await cacheService.set(TEST_KEY, TEST_DATAFILE);
      const cachedResult = await cacheService.get(TEST_KEY); // Should be datafile (hit)

      // Assert
      expect(initialResult).toBeNull();
      expect(setResult).toBe(true);
      expect(cachedResult).toEqual(TEST_DATAFILE);
    });

    it('should correctly handle expired cached items', async () => {
      // Arrange - Mock an expired cache item
      const expiredCachedItemJson = JSON.stringify({
        value: TEST_DATAFILE,
        timestamp: Date.now() - 7200000, // 2 hours ago
        expiry: Date.now() - 3600000 // Expired 1 hour ago
      });
      
      mockStorage.get = vi.fn().mockResolvedValue(expiredCachedItemJson);
      mockStorage.delete = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await cacheService.get(TEST_KEY);

      // Assert
      expect(result).toBeNull(); // Should return null for expired items
      expect(mockStorage.get).toHaveBeenCalledWith(TEST_CACHE_KEY, 'text');
      // Should try to delete the expired item
      expect(mockStorage.delete).toHaveBeenCalledWith(TEST_CACHE_KEY);
    });
  });
}); 