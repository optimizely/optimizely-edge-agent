/**
 * CloudflareStorageAdapter Tests
 * 
 * Tests for the Cloudflare KV Storage adapter implementation,
 * focusing on functionality, error handling, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareStorageAdapter } from '../../../adapters/implementations/cloudflare/CloudflareStorageAdapter';

// Import Cloudflare Worker Types for accurate mocking
import type * as CF from '@cloudflare/workers-types';

describe('CloudflareStorageAdapter', () => {
  // Create mock functions for KV methods
  const mockGet = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();
  const mockList = vi.fn();
  const mockGetWithMetadata = vi.fn();

  // Create a more complete mock KV namespace adhering to the CF.KVNamespace type
  const mockKV: CF.KVNamespace = {
    get: mockGet,
    put: mockPut,
    delete: mockDelete,
    list: mockList,
    getWithMetadata: mockGetWithMetadata
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully initialize with KV binding', () => {
    // Arrange & Act
    const storage = new CloudflareStorageAdapter(mockKV);

    // Assert
    expect(storage).toBeDefined();
  });

  it('should throw error when KV binding is missing', () => {
    // Arrange & Act & Assert
    expect(() => new CloudflareStorageAdapter(null as any)).toThrow();
    expect(() => new CloudflareStorageAdapter(undefined as any)).toThrow();
  });

  describe('get method', () => {
    it('should successfully get a value from KV as text', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      const mockValue = 'text-value';
      mockGet.mockResolvedValue(mockValue);

      // Act
      const result = await storage.get('test-key', 'text');

      // Assert
      expect(mockGet).toHaveBeenCalledWith('test-key', { type: 'text' });
      expect(result).toEqual(mockValue);
    });

    it('should successfully get a value from KV as JSON', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      const mockValue = { test: 'value' };
      mockGet.mockResolvedValue(mockValue);

      // Act
      const result = await storage.get('test-key', 'json');

      // Assert
      expect(mockGet).toHaveBeenCalledWith('test-key', { type: 'json' });
      expect(result).toEqual(mockValue);
    });

    it('should return null for non-existent keys', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockGet.mockResolvedValue(null);

      // Act
      const result = await storage.get('non-existent-key', 'text');

      // Assert
      expect(mockGet).toHaveBeenCalledWith('non-existent-key', { type: 'text' });
      expect(result).toBeNull();
    });

    it('should handle KV errors gracefully', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockGet.mockRejectedValue(new Error('KV error'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const result = await storage.get('test-key', 'text');

      // Assert
      expect(mockGet).toHaveBeenCalledWith('test-key', { type: 'text' });
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('put method', () => {
    it('should successfully store a value in KV', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      const testValue = 'test-value';
      mockPut.mockResolvedValue(undefined);

      // Act
      await storage.put('test-key', testValue);

      // Assert
      expect(mockPut).toHaveBeenCalledWith('test-key', testValue, {});
    });

    it('should use expirationTtl when specified', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      const testValue = 'test-value';
      mockPut.mockResolvedValue(undefined);

      // Act
      await storage.put('test-key', testValue, { expirationTtl: 600 });

      // Assert
      expect(mockPut).toHaveBeenCalledWith('test-key', testValue, { expirationTtl: 600 });
    });

    it('should handle KV errors during put operation', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockPut.mockRejectedValue(new Error('KV error'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(storage.put('test-key', 'test-value')).rejects.toThrow('KV error');
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('delete method', () => {
    it('should successfully delete a value from KV', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockDelete.mockResolvedValue(undefined);

      // Act
      await storage.delete('test-key');

      // Assert
      expect(mockDelete).toHaveBeenCalledWith('test-key');
    });

    it('should handle KV errors during delete operation', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockDelete.mockRejectedValue(new Error('KV error'));
      
      // Act & Assert
      // The delete method doesn't throw, so it should complete without error
      await storage.delete('test-key');
      
      // Verify the delete was called
      expect(mockDelete).toHaveBeenCalledWith('test-key');
    });
  });

  describe('list method', () => {
    it('should successfully list keys from KV', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      const mockKeys: CF.KVNamespaceListResult<unknown> = {
        keys: [
          { name: 'key1', expiration: 123, metadata: null },
          { name: 'key2', expiration: 456, metadata: null }
        ],
        list_complete: true,
        cacheStatus: null
      };
      mockList.mockResolvedValue(mockKeys);

      // Act
      const result = await storage.list({ prefix: 'prefix' });

      // Assert
      expect(mockList).toHaveBeenCalledWith({ prefix: 'prefix' });
      expect(result.keys).toHaveLength(2);
      expect(result.keys[0].name).toBe('key1');
      expect(result.keys[1].name).toBe('key2');
    });

    it('should return empty array when no keys found', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockList.mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null });

      // Act
      const result = await storage.list();

      // Assert
      expect(result.keys).toEqual([]);
    });

    it('should handle KV errors during list operation', async () => {
      // Arrange
      const storage = new CloudflareStorageAdapter(mockKV);
      mockList.mockRejectedValue(new Error('KV error'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(async () => {
        await storage.list();
      }).rejects.toThrow();
      
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
}); 