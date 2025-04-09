import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlagStorageService } from '../../services/implementations/FlagStorageService';
import { DatafileService } from '../../services/implementations/DatafileService';
import { IStorageAdapter } from '../../adapters/interfaces/IStorageAdapter';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';

/**
 * Mock implementation of IStorageAdapter for testing
 */
class MockStorageAdapter implements IStorageAdapter {
  private store: Map<string, { value: any, type: string }> = new Map();
  
  async get(key: string, type: 'text'): Promise<string | null>;
  async get<T>(key: string, type: 'json'): Promise<T | null>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (type === 'json' && item.type === 'text') {
      try {
        return JSON.parse(item.value);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return null;
      }
    }
    
    return item.value;
  }
  
  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void> {
    // For testing, we'll convert everything to string and store with type
    let storedValue: any;
    let valueType: string;
    
    if (typeof value === 'string') {
      storedValue = value;
      valueType = 'text';
    } else if (value instanceof ArrayBuffer) {
      storedValue = value;
      valueType = 'arrayBuffer';
    } else {
      storedValue = value;
      valueType = 'stream';
    }
    
    this.store.set(key, { value: storedValue, type: valueType });
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  get mockStore(): Map<string, { value: any, type: string }> {
    return this.store;
  }
  
  clear(): void {
    this.store.clear();
  }
}

/**
 * Mock implementation of IEnvironmentAdapter for testing
 */
class MockEnvironmentAdapter {
  async fetch(url: string): Promise<{ ok: boolean; status: number; statusText: string; text: () => Promise<string> }> {
    // Mock a datafile response from CDN
    if (url.includes('/datafiles/')) {
      const sampleDatafile = JSON.stringify({
        revision: '42',
        version: '4',
        featureFlags: [
          { key: 'flag-1', experimentKey: 'exp-1' },
          { key: 'flag-2', experimentKey: 'exp-2' }
        ],
        experiments: [
          { key: 'exp-1', variations: [{ key: 'var-1' }] },
          { key: 'exp-2', variations: [{ key: 'var-2' }] },
          { key: 'exp-3', variations: [{ key: 'var-3' }] }
        ]
      });
      
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => sampleDatafile
      };
    }
    
    return { 
      ok: false, 
      status: 404, 
      statusText: 'Not Found', 
      text: async () => 'Not found' 
    };
  }
}

describe('FlagStorageService Integration', () => {
  let storageAdapter: MockStorageAdapter;
  let logger: MockLoggerAdapter;
  let environmentAdapter: MockEnvironmentAdapter;
  let flagStorage: FlagStorageService;
  let datafileService: DatafileService;
  
  beforeEach(() => {
    // Create fresh instances for each test
    storageAdapter = new MockStorageAdapter();
    logger = new MockLoggerAdapter();
    environmentAdapter = new MockEnvironmentAdapter();
    flagStorage = new FlagStorageService(storageAdapter, logger);
    datafileService = new DatafileService(storageAdapter, environmentAdapter as any, logger, undefined, flagStorage);
  });
  
  afterEach(() => {
    // Clean up after each test
    storageAdapter.clear();
    vi.clearAllMocks();
  });
  
  describe('DatafileService integration', () => {
    it('should extract and store flag keys from datafile', async () => {
      const sdkKey = 'test-sdk-key';
      
      // Spy on FlagStorageService.putFlagKeys to see if it's called
      const putFlagKeysSpy = vi.spyOn(flagStorage, 'putFlagKeys');
      
      // This should trigger a datafile fetch from the mock CDN, which will extract
      // flag keys from the datafile and store them using FlagStorageService
      const flagKeys = await datafileService.getFlagKeys(sdkKey);
      
      // Expect 5 flag keys (3 from experiments + 2 from feature flags)
      expect(flagKeys).toHaveLength(5);
      expect(flagKeys).toContain('flag-1');
      expect(flagKeys).toContain('flag-2');
      expect(flagKeys).toContain('exp-1');
      expect(flagKeys).toContain('exp-2');
      expect(flagKeys).toContain('exp-3');
      
      // FlagStorageService.putFlagKeys should have been called
      // It might be called multiple times due to the implementation details
      expect(putFlagKeysSpy).toHaveBeenCalled();
      
      // Storage should have keys in the right format
      let hasKey = false;
      for (const key of storageAdapter.mockStore.keys()) {
        if (key.startsWith('flagkeys:')) {
          hasKey = true;
          break;
        }
      }
      expect(hasKey).toBe(true);
    });
    
    it('should use FlagStorageService for subsequent flag key requests', async () => {
      const sdkKey = 'test-sdk-key';
      
      // First request gets flag keys from datafile
      await datafileService.getFlagKeys(sdkKey);
      
      // Spy on FlagStorageService.getFlagKeys
      const getFlagKeysSpy = vi.spyOn(flagStorage, 'getFlagKeys');
      
      // Make another request that should use the cached flag keys in FlagStorageService
      await datafileService.getFlagKeys(sdkKey);
      
      // FlagStorageService.getFlagKeys should have been called
      expect(getFlagKeysSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('DatafileService enhanced integration', () => {
    it('should synchronize flag keys between environments', async () => {
      const sourceSdkKey = 'source-sdk-key';
      const targetSdkKeys = ['target-sdk-key-1', 'target-sdk-key-2'];
      
      // Set up source flags via FlagStorageService directly
      await flagStorage.putFlagKeys(sourceSdkKey, ['flag-1', 'flag-2', 'flag-3']);
      
      // Spy on the flagStorage.manageFlagKeysAcrossEnvironments method
      const syncSpy = vi.spyOn(flagStorage, 'manageFlagKeysAcrossEnvironments')
        .mockResolvedValueOnce({ 
          'target-sdk-key-1': true,
          'target-sdk-key-2': true
        });
      
      // Call DatafileService's synchronizeFlagKeys method
      const result = await datafileService.synchronizeFlagKeys(sourceSdkKey, targetSdkKeys);
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(syncSpy).toHaveBeenCalledWith(
        sourceSdkKey, 
        targetSdkKeys,
        expect.any(Object)
      );
      
      syncSpy.mockRestore();
    });
    
    it('should handle synchronization when some environments fail', async () => {
      const sourceSdkKey = 'source-sdk-key';
      const targetSdkKeys = ['target-sdk-key-1', 'target-sdk-key-2'];
      
      // Set up source flags via FlagStorageService directly
      await flagStorage.putFlagKeys(sourceSdkKey, ['flag-1', 'flag-2', 'flag-3']);
      
      // Mock partial failure in synchronization
      const syncSpy = vi.spyOn(flagStorage, 'manageFlagKeysAcrossEnvironments')
        .mockResolvedValueOnce({ 
          'target-sdk-key-1': true,
          'target-sdk-key-2': false // This one failed
        });
      
      // Call DatafileService's synchronizeFlagKeys method
      const result = await datafileService.synchronizeFlagKeys(sourceSdkKey, targetSdkKeys);
      
      // Verify results show partial failure
      expect(result.success).toBe(false);
      expect(result.results).toBeDefined();
      expect(result.results!['target-sdk-key-1']).toBe(true);
      expect(result.results!['target-sdk-key-2']).toBe(false);
      
      syncSpy.mockRestore();
    });
    
    it('should handle case when flagStorage is not available', async () => {
      // Create DatafileService without FlagStorageService
      const datafileServiceWithoutStorage = new DatafileService(
        storageAdapter, 
        environmentAdapter as any, 
        logger
      );
      
      // Attempt synchronization
      const result = await datafileServiceWithoutStorage.synchronizeFlagKeys(
        'source-sdk-key', 
        ['target-sdk-key']
      );
      
      // Verify it gracefully fails
      expect(result.success).toBe(false);
      expect(result.message).toContain('not available');
    });
    
    it('should clean up expired flags', async () => {
      // Spy on FlagStorageService.performCleanup
      const cleanupSpy = vi.spyOn(flagStorage, 'performCleanup')
        .mockResolvedValueOnce(5); // Mock 5 items cleaned up
      
      // Call DatafileService's cleanupExpiredFlags method
      const cleanedCount = await datafileService.cleanupExpiredFlags();
      
      // Verify results
      expect(cleanedCount).toBe(5);
      expect(cleanupSpy).toHaveBeenCalled();
      
      cleanupSpy.mockRestore();
    });
    
    it('should clean up expired flags for specific SDK key', async () => {
      const sdkKey = 'test-sdk-key';
      
      // Spy on FlagStorageService.performCleanup
      const cleanupSpy = vi.spyOn(flagStorage, 'performCleanup')
        .mockResolvedValueOnce(3); // Mock 3 items cleaned up
      
      // Call DatafileService's cleanupExpiredFlags method with SDK key
      const cleanedCount = await datafileService.cleanupExpiredFlags(sdkKey);
      
      // Verify results
      expect(cleanedCount).toBe(3);
      expect(cleanupSpy).toHaveBeenCalledWith(sdkKey);
      
      cleanupSpy.mockRestore();
    });
    
    it('should handle cleanup when flagStorage is not available', async () => {
      // Create DatafileService without FlagStorageService
      const datafileServiceWithoutStorage = new DatafileService(
        storageAdapter, 
        environmentAdapter as any, 
        logger
      );
      
      // Attempt cleanup
      const cleanedCount = await datafileServiceWithoutStorage.cleanupExpiredFlags();
      
      // Verify it gracefully returns 0
      expect(cleanedCount).toBe(0);
    });
  });
}); 