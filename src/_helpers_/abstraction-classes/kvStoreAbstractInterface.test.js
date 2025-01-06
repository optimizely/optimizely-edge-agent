import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KVStoreAbstractInterface } from './kvStoreAbstractInterface';

// Mock the logger
vi.mock('../optimizelyHelper', () => ({
  logger: () => ({
    debugExt: vi.fn()
  })
}));

describe('KVStoreAbstractInterface', () => {
  let kvStore;
  let mockProvider;

  beforeEach(() => {
    // Create a mock provider with all required methods
    mockProvider = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };
    kvStore = new KVStoreAbstractInterface(mockProvider);
  });

  describe('constructor', () => {
    it('should initialize with the provided provider', () => {
      expect(kvStore.provider).toBe(mockProvider);
    });
  });

  describe('get', () => {
    it('should call provider.get with the correct key', async () => {
      const testKey = 'test-key';
      const expectedValue = 'test-value';
      mockProvider.get.mockResolvedValue(expectedValue);

      const result = await kvStore.get(testKey);

      expect(mockProvider.get).toHaveBeenCalledWith(testKey);
      expect(result).toBe(expectedValue);
    });

    it('should handle null response from provider', async () => {
      const testKey = 'non-existent-key';
      mockProvider.get.mockResolvedValue(null);

      const result = await kvStore.get(testKey);

      expect(mockProvider.get).toHaveBeenCalledWith(testKey);
      expect(result).toBeNull();
    });

    it('should propagate provider errors', async () => {
      const testKey = 'error-key';
      const error = new Error('Provider error');
      mockProvider.get.mockRejectedValue(error);

      await expect(kvStore.get(testKey)).rejects.toThrow('Provider error');
      expect(mockProvider.get).toHaveBeenCalledWith(testKey);
    });
  });

  describe('put', () => {
    it('should call provider.put with correct key and value', async () => {
      const testKey = 'test-key';
      const testValue = 'test-value';
      mockProvider.put.mockResolvedValue(undefined);

      await kvStore.put(testKey, testValue);

      expect(mockProvider.put).toHaveBeenCalledWith(testKey, testValue);
    });

    it('should propagate provider errors', async () => {
      const testKey = 'error-key';
      const testValue = 'error-value';
      const error = new Error('Provider error');
      mockProvider.put.mockRejectedValue(error);

      await expect(kvStore.put(testKey, testValue)).rejects.toThrow('Provider error');
      expect(mockProvider.put).toHaveBeenCalledWith(testKey, testValue);
    });
  });

  describe('delete', () => {
    it('should call provider.delete with the correct key', async () => {
      const testKey = 'test-key';
      mockProvider.delete.mockResolvedValue(undefined);

      await kvStore.delete(testKey);

      expect(mockProvider.delete).toHaveBeenCalledWith(testKey);
    });

    it('should propagate provider errors', async () => {
      const testKey = 'error-key';
      const error = new Error('Provider error');
      mockProvider.delete.mockRejectedValue(error);

      await expect(kvStore.delete(testKey)).rejects.toThrow('Provider error');
      expect(mockProvider.delete).toHaveBeenCalledWith(testKey);
    });
  });
});
