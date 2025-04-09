import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlagStorageService } from '../../services/implementations/FlagStorageService';
import { IStorageAdapter } from '../../adapters/interfaces/IStorageAdapter';
import { MockLoggerAdapter } from '../test-utils/MockLoggerAdapter';
import { OptimizelyDecision } from '../../services/interfaces/IDecisionService';

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

describe('FlagStorageService', () => {
  let storageAdapter: MockStorageAdapter;
  let logger: MockLoggerAdapter;
  let flagStorage: FlagStorageService;
  
  beforeEach(() => {
    // Create fresh instances for each test
    storageAdapter = new MockStorageAdapter();
    logger = new MockLoggerAdapter();
    flagStorage = new FlagStorageService(storageAdapter, logger);
  });
  
  afterEach(() => {
    // Clean up after each test
    storageAdapter.clear();
    vi.clearAllMocks();
  });
  
  describe('flag operations', () => {
    it('should store and retrieve a flag', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flagData = { enabled: true, variation: 'A' };
      
      // Store the flag
      const putResult = await flagStorage.putFlag(sdkKey, flagKey, flagData);
      expect(putResult).toBe(true);
      
      // Retrieve the flag
      const retrievedFlag = await flagStorage.getFlag(sdkKey, flagKey);
      expect(retrievedFlag).toEqual(flagData);
    });
    
    it('should return null when getting a non-existent flag', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'non-existent-flag';
      
      const result = await flagStorage.getFlag(sdkKey, flagKey);
      expect(result).toBeNull();
    });
    
    it('should handle errors when storing a flag', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flagData = { enabled: true, variation: 'A' };
      
      // Mock a storage error
      vi.spyOn(storageAdapter, 'put').mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      const result = await flagStorage.putFlag(sdkKey, flagKey, flagData);
      expect(result).toBe(false);
    });
  });
  
  describe('flag decision operations', () => {
    it('should store and retrieve a flag decision', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const userId = 'test-user';
      
      const decision: Partial<OptimizelyDecision> = {
        flagKey,
        enabled: true,
        variationKey: 'variation-a',
        ruleKey: 'rule-1',
        variables: { foo: 'bar' }
      };
      
      // Store the decision
      const putResult = await flagStorage.putFlagDecision(sdkKey, flagKey, userId, decision);
      expect(putResult).toBe(true);
      
      // Retrieve the decision
      const retrievedDecision = await flagStorage.getFlagDecision(sdkKey, flagKey, userId);
      expect(retrievedDecision).toEqual(decision);
    });
    
    it('should return null when getting a non-existent decision', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const userId = 'non-existent-user';
      
      const result = await flagStorage.getFlagDecision(sdkKey, flagKey, userId);
      expect(result).toBeNull();
    });
    
    it('should handle errors when storing a decision', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const userId = 'test-user';
      const decision: Partial<OptimizelyDecision> = {
        flagKey,
        enabled: true,
        variationKey: 'variation-a'
      };
      
      // Mock a storage error
      vi.spyOn(storageAdapter, 'put').mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      const result = await flagStorage.putFlagDecision(sdkKey, flagKey, userId, decision);
      expect(result).toBe(false);
    });
  });
  
  describe('flag keys operations', () => {
    it('should store and retrieve flag keys', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKeys = ['flag-1', 'flag-2', 'flag-3'];
      
      // Store the flag keys
      const putResult = await flagStorage.putFlagKeys(sdkKey, flagKeys);
      expect(putResult).toBe(true);
      
      // Retrieve the flag keys
      const retrievedKeys = await flagStorage.getFlagKeys(sdkKey);
      expect(retrievedKeys).toEqual(flagKeys);
    });
    
    it('should deduplicate flag keys when storing', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKeys = ['flag-1', 'flag-2', 'flag-1', 'flag-3', 'flag-2'];
      const uniqueKeys = ['flag-1', 'flag-2', 'flag-3'];
      
      // Store the flag keys with duplicates
      await flagStorage.putFlagKeys(sdkKey, flagKeys);
      
      // Retrieve the flag keys and expect them to be deduplicated
      const retrievedKeys = await flagStorage.getFlagKeys(sdkKey);
      expect(retrievedKeys).toEqual(uniqueKeys);
    });
    
    it('should return an empty array when getting non-existent flag keys', async () => {
      const sdkKey = 'non-existent-sdk-key';
      
      const result = await flagStorage.getFlagKeys(sdkKey);
      expect(result).toEqual([]);
    });
  });
  
  describe('all flag decisions operations', () => {
    it('should store and retrieve all flag decisions', async () => {
      const sdkKey = 'test-sdk-key';
      const userId = 'test-user';
      
      const decisions: Record<string, Partial<OptimizelyDecision>> = {
        'flag-1': {
          flagKey: 'flag-1',
          enabled: true,
          variationKey: 'variation-a'
        },
        'flag-2': {
          flagKey: 'flag-2',
          enabled: false,
          variationKey: 'variation-b'
        }
      };
      
      // Store all flag decisions
      const putResult = await flagStorage.putAllFlagDecisions(sdkKey, userId, decisions);
      expect(putResult).toBe(true);
      
      // Retrieve all flag decisions
      const retrievedDecisions = await flagStorage.getAllFlagDecisions(sdkKey, userId);
      expect(retrievedDecisions).toEqual(decisions);
    });
    
    it('should return null when getting non-existent all flag decisions', async () => {
      const sdkKey = 'test-sdk-key';
      const userId = 'non-existent-user';
      
      const result = await flagStorage.getAllFlagDecisions(sdkKey, userId);
      expect(result).toBeNull();
    });
    
    it('should also make individual flag decisions available', async () => {
      const sdkKey = 'test-sdk-key';
      const userId = 'test-user';
      
      const decisions: Record<string, Partial<OptimizelyDecision>> = {
        'flag-1': {
          flagKey: 'flag-1',
          enabled: true,
          variationKey: 'variation-a'
        },
        'flag-2': {
          flagKey: 'flag-2',
          enabled: false,
          variationKey: 'variation-b'
        }
      };
      
      // Store all flag decisions
      await flagStorage.putAllFlagDecisions(sdkKey, userId, decisions);
      
      // Try to get an individual flag decision
      const flag1Decision = await flagStorage.getFlagDecision(sdkKey, 'flag-1', userId);
      
      // Should be able to access it from memory cache
      expect(flag1Decision).toEqual(decisions['flag-1']);
    });
  });
  
  describe('memory cache', () => {
    it('should use memory cache for subsequent gets', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flag = { enabled: true, variation: 'A' };
      
      // Store the flag
      await flagStorage.putFlag(sdkKey, flagKey, flag);
      
      // First get will store in memory cache
      await flagStorage.getFlag(sdkKey, flagKey);
      
      // Spy on storage.get to see if it's called
      const getSpy = vi.spyOn(storageAdapter, 'get');
      
      // Second get should use memory cache and not call storage.get
      await flagStorage.getFlag(sdkKey, flagKey);
      
      // This test verifies that the adapter's get method wasn't called
      // since the value should be served from memory cache
      expect(getSpy).not.toHaveBeenCalled();
    });
    
    it('should clear memory cache when requested', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flag = { enabled: true, variation: 'A' };
      
      // Store the flag
      await flagStorage.putFlag(sdkKey, flagKey, flag);
      
      // First get will store in memory cache
      await flagStorage.getFlag(sdkKey, flagKey);
      
      // Clear the memory cache
      flagStorage.clearMemoryCache();
      
      // Spy on storage.get to see if it's called
      const getSpy = vi.spyOn(storageAdapter, 'get');
      
      // After clearing cache, get should call storage.get again
      await flagStorage.getFlag(sdkKey, flagKey);
      expect(getSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should disable memory cache when configured', async () => {
      // Create a new instance with memory cache disabled
      flagStorage = new FlagStorageService(storageAdapter, logger, { cacheEnabled: false });
      
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flag = { enabled: true, variation: 'A' };
      
      // Store the flag
      await flagStorage.putFlag(sdkKey, flagKey, flag);
      
      // Spy on storage.get to see if it's called
      const getSpy = vi.spyOn(storageAdapter, 'get');
      
      // First get should call storage.get since memory cache is disabled
      await flagStorage.getFlag(sdkKey, flagKey);
      expect(getSpy).toHaveBeenCalledTimes(1);
      
      // Reset the spy
      getSpy.mockClear();
      
      // Second get should also call storage.get since memory cache is disabled
      await flagStorage.getFlag(sdkKey, flagKey);
      expect(getSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should purge expired entries from memory cache', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey1 = 'test-flag-1';
      const flagKey2 = 'test-flag-2';
      const flag1 = { enabled: true, variation: 'A' };
      const flag2 = { enabled: false, variation: 'B' };
      
      // Manually set an expired item in the memory cache
      const expiredKey = flagStorage['getFlagStorageKey'](sdkKey, flagKey1);
      const validKey = flagStorage['getFlagStorageKey'](sdkKey, flagKey2);
      
      // Use reflection to access private method
      flagStorage['storeInMemoryCache'](expiredKey, flag1, -1); // Expired (negative TTL)
      flagStorage['storeInMemoryCache'](validKey, flag2, 300); // Valid (5 minutes)
      
      // Purge expired entries
      const purgedCount = await flagStorage.purgeExpiredEntries();
      
      // Should have purged only the expired entry
      expect(purgedCount).toBe(1);
      
      // Verify that expired entry was removed
      const expiredEntry = flagStorage['getFromMemoryCache'](expiredKey);
      expect(expiredEntry).toBeNull();
      
      // Verify that valid entry is still there
      const validEntry = flagStorage['getFromMemoryCache'](validKey);
      expect(validEntry).toEqual(flag2);
    });
    
    it('should purge only entries for specific SDK key', async () => {
      const sdkKey1 = 'sdk-key-1';
      const sdkKey2 = 'sdk-key-2';
      const flagKey = 'test-flag';
      const flag = { enabled: true, variation: 'A' };
      
      // Set expired entries for two different SDKs
      const expiredKey1 = flagStorage['getFlagStorageKey'](sdkKey1, flagKey);
      const expiredKey2 = flagStorage['getFlagStorageKey'](sdkKey2, flagKey);
      
      flagStorage['storeInMemoryCache'](expiredKey1, flag, -1); // Expired
      flagStorage['storeInMemoryCache'](expiredKey2, flag, -1); // Expired
      
      // Purge only entries for sdkKey1
      const purgedCount = await flagStorage.purgeExpiredEntries(sdkKey1);
      
      // Should have purged only the entry for sdkKey1
      expect(purgedCount).toBe(1);
      
      // Verify sdkKey1 entry was removed
      const entry1 = flagStorage['getFromMemoryCache'](expiredKey1);
      expect(entry1).toBeNull();
      
      // Verify sdkKey2 entry is still there (would be found if we didn't filter by SDK)
      const entry2 = flagStorage['getFromMemoryCache'](expiredKey2);
      // This might be null due to automatic TTL checks in getFromMemoryCache, 
      // so let's check the raw cache instead
      expect(flagStorage['memoryCache'].has(expiredKey2)).toBe(true);
    });
  });
  
  describe('key formats', () => {
    it('should use the correct key format for flags', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const flag = { enabled: true };
      
      // Store the flag
      await flagStorage.putFlag(sdkKey, flagKey, flag);
      
      // Check that the storage key follows the expected format
      const expectedKey = `flag:${sdkKey}:${flagKey}`;
      expect(storageAdapter.mockStore.has(expectedKey)).toBe(true);
    });
    
    it('should use the correct key format for flag decisions', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKey = 'test-flag';
      const userId = 'test-user';
      const decision = { flagKey, enabled: true, variationKey: 'variation-a' };
      
      // Store the decision
      await flagStorage.putFlagDecision(sdkKey, flagKey, userId, decision);
      
      // Check that the storage key follows the expected format
      const expectedKey = `flag-decision:${sdkKey}:${flagKey}:${userId}`;
      expect(storageAdapter.mockStore.has(expectedKey)).toBe(true);
    });
    
    it('should use the correct key format for flag keys', async () => {
      const sdkKey = 'test-sdk-key';
      const flagKeys = ['flag-1', 'flag-2'];
      
      // Store the flag keys
      await flagStorage.putFlagKeys(sdkKey, flagKeys);
      
      // Check that the storage key follows the expected format
      const expectedKey = `flagkeys:${sdkKey}`;
      expect(storageAdapter.mockStore.has(expectedKey)).toBe(true);
    });
    
    it('should use the correct key format for all decisions', async () => {
      const sdkKey = 'test-sdk-key';
      const userId = 'test-user';
      const decisions = { 'flag-1': { flagKey: 'flag-1', enabled: true } };
      
      // Store all decisions
      await flagStorage.putAllFlagDecisions(sdkKey, userId, decisions);
      
      // Check that the storage key follows the expected format
      const expectedKey = `all-decisions:${sdkKey}:${userId}`;
      expect(storageAdapter.mockStore.has(expectedKey)).toBe(true);
    });
  });
  
  describe('environment management', () => {
    it('should propagate flag keys across environments', async () => {
      const sourceSdkKey = 'source-sdk';
      const targetSdkKey = 'target-sdk';
      const sourceFlags = ['flag-1', 'flag-2', 'flag-3'];
      
      // Store source flags
      await flagStorage.putFlagKeys(sourceSdkKey, sourceFlags);
      
      // Store some existing target flags
      await flagStorage.putFlagKeys(targetSdkKey, ['flag-4', 'flag-5']);
      
      // Manage flag keys across environments
      const result = await flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        [targetSdkKey]
      );
      
      // Verify result
      expect(result[targetSdkKey]).toBe(true);
      
      // Verify target flags include both source and existing target flags
      const targetFlags = await flagStorage.getFlagKeys(targetSdkKey);
      expect(targetFlags).toContain('flag-1');
      expect(targetFlags).toContain('flag-2');
      expect(targetFlags).toContain('flag-3');
      expect(targetFlags).toContain('flag-4');
      expect(targetFlags).toContain('flag-5');
      expect(targetFlags.length).toBe(5); // No duplicates
    });
    
    it('should respect propagateOnly option', async () => {
      const sourceSdkKey = 'source-sdk';
      const targetSdkKey = 'target-sdk';
      const sourceFlags = ['flag-1', 'flag-2', 'flag-3'];
      
      // Store source flags
      await flagStorage.putFlagKeys(sourceSdkKey, sourceFlags);
      
      // Manage flag keys with propagateOnly option
      const result = await flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        [targetSdkKey],
        { propagateOnly: ['flag-1', 'flag-3'] }
      );
      
      // Verify result
      expect(result[targetSdkKey]).toBe(true);
      
      // Verify only specified flags were propagated
      const targetFlags = await flagStorage.getFlagKeys(targetSdkKey);
      expect(targetFlags).toContain('flag-1');
      expect(targetFlags).not.toContain('flag-2'); // Should be excluded
      expect(targetFlags).toContain('flag-3');
      expect(targetFlags.length).toBe(2);
    });
    
    it('should respect excludeFlags option', async () => {
      const sourceSdkKey = 'source-sdk';
      const targetSdkKey = 'target-sdk';
      const sourceFlags = ['flag-1', 'flag-2', 'flag-3'];
      
      // Store source flags
      await flagStorage.putFlagKeys(sourceSdkKey, sourceFlags);
      
      // Manage flag keys with excludeFlags option
      const result = await flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        [targetSdkKey],
        { excludeFlags: ['flag-2'] }
      );
      
      // Verify result
      expect(result[targetSdkKey]).toBe(true);
      
      // Verify excluded flag was not propagated
      const targetFlags = await flagStorage.getFlagKeys(targetSdkKey);
      expect(targetFlags).toContain('flag-1');
      expect(targetFlags).not.toContain('flag-2'); // Should be excluded
      expect(targetFlags).toContain('flag-3');
      expect(targetFlags.length).toBe(2);
    });
    
    it('should handle multiple target environments', async () => {
      const sourceSdkKey = 'source-sdk';
      const targetSdkKeys = ['target-sdk-1', 'target-sdk-2', 'target-sdk-3'];
      const sourceFlags = ['flag-1', 'flag-2'];
      
      // Store source flags
      await flagStorage.putFlagKeys(sourceSdkKey, sourceFlags);
      
      // Manage flag keys across multiple environments
      const result = await flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        targetSdkKeys
      );
      
      // Verify results
      expect(result['target-sdk-1']).toBe(true);
      expect(result['target-sdk-2']).toBe(true);
      expect(result['target-sdk-3']).toBe(true);
      
      // Verify flags were propagated to all environments
      for (const targetSdkKey of targetSdkKeys) {
        const targetFlags = await flagStorage.getFlagKeys(targetSdkKey);
        expect(targetFlags).toContain('flag-1');
        expect(targetFlags).toContain('flag-2');
        expect(targetFlags.length).toBe(2);
      }
    });
    
    it('should handle errors gracefully', async () => {
      const sourceSdkKey = 'source-sdk';
      const targetSdkKey = 'target-sdk';
      const sourceFlags = ['flag-1', 'flag-2'];
      
      // Store source flags
      await flagStorage.putFlagKeys(sourceSdkKey, sourceFlags);
      
      // Mock an error in putFlagKeys
      vi.spyOn(flagStorage, 'putFlagKeys').mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      // Manage flag keys with error
      const result = await flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        [targetSdkKey]
      );
      
      // Verify result indicates failure
      expect(result[targetSdkKey]).toBe(false);
    });
  });
  
  describe('periodic cleanup', () => {
    beforeEach(() => {
      // Mock setTimeout/clearTimeout to avoid actual timers in tests
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      // Restore original timer functions
      vi.useRealTimers();
    });
    
    it('should start periodic cleanup when enabled', () => {
      // Create a service with auto cleanup enabled
      const startCleanupSpy = vi.spyOn(FlagStorageService.prototype, 'startPeriodicCleanup');
      
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: true, cleanupIntervalMs: 60000 } // 1 minute interval
      );
      
      expect(startCleanupSpy).toHaveBeenCalledWith(60000);
      
      // Clean up
      customFlagStorage.dispose();
      startCleanupSpy.mockRestore();
    });
    
    it('should not start periodic cleanup when disabled', () => {
      // Create a service with auto cleanup disabled
      const startCleanupSpy = vi.spyOn(FlagStorageService.prototype, 'startPeriodicCleanup');
      
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: false }
      );
      
      expect(startCleanupSpy).not.toHaveBeenCalled();
      
      // Clean up
      startCleanupSpy.mockRestore();
    });
    
    it('should stop periodic cleanup when requested', () => {
      // Create a service with auto cleanup
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: true, cleanupIntervalMs: 60000 }
      );
      
      // Spy on clearInterval
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Stop the periodic cleanup
      customFlagStorage.stopPeriodicCleanup();
      
      // Verify clearInterval was called
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      // Clean up
      clearIntervalSpy.mockRestore();
    });
    
    it('should run cleanup when interval fires', async () => {
      // Create a service with auto cleanup
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: true, cleanupIntervalMs: 60000 }
      );
      
      // Spy on purgeExpiredEntries
      const purgeExpiredEntriesSpy = vi.spyOn(customFlagStorage, 'purgeExpiredEntries')
        .mockResolvedValue(5); // Mock 5 entries purged
      
      // Advance timer to trigger interval
      vi.advanceTimersByTime(60000);
      
      // Allow any pending promises to resolve
      await vi.runAllTimersAsync();
      
      // Verify purgeExpiredEntries was called
      expect(purgeExpiredEntriesSpy).toHaveBeenCalled();
      
      // Clean up
      customFlagStorage.dispose();
      purgeExpiredEntriesSpy.mockRestore();
    });
    
    it('should perform immediate cleanup when requested', async () => {
      // Create a service
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: false }
      );
      
      // Spy on purgeExpiredEntries
      const purgeExpiredEntriesSpy = vi.spyOn(customFlagStorage, 'purgeExpiredEntries')
        .mockResolvedValue(3); // Mock 3 entries purged
      
      // Request immediate cleanup
      const purgedCount = await customFlagStorage.performCleanup();
      
      // Verify purgeExpiredEntries was called
      expect(purgeExpiredEntriesSpy).toHaveBeenCalled();
      expect(purgedCount).toBe(3);
      
      // Clean up
      purgeExpiredEntriesSpy.mockRestore();
    });
    
    it('should perform immediate cleanup for specific SDK', async () => {
      // Create a service
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: false }
      );
      
      // Spy on purgeExpiredEntries
      const purgeExpiredEntriesSpy = vi.spyOn(customFlagStorage, 'purgeExpiredEntries')
        .mockResolvedValue(2); // Mock 2 entries purged
      
      // Request immediate cleanup for specific SDK
      const sdkKey = 'test-sdk-key';
      const purgedCount = await customFlagStorage.performCleanup(sdkKey);
      
      // Verify purgeExpiredEntries was called with SDK key
      expect(purgeExpiredEntriesSpy).toHaveBeenCalledWith(sdkKey);
      expect(purgedCount).toBe(2);
      
      // Clean up
      purgeExpiredEntriesSpy.mockRestore();
    });
    
    it('should skip cleanup if another is already running', async () => {
      // Create a service
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: false }
      );
      
      // Spy on purgeExpiredEntries
      const purgeExpiredEntriesSpy = vi.spyOn(customFlagStorage, 'purgeExpiredEntries')
        .mockImplementation(async () => {
          // Simulate long-running cleanup
          await new Promise(resolve => setTimeout(resolve, 1000));
          return 1;
        });
      
      // Start first cleanup (will take time)
      const firstPromise = customFlagStorage.performCleanup();
      
      // Immediately start second cleanup (should be skipped)
      const secondPromise = customFlagStorage.performCleanup();
      
      // Resolve timers to complete the first cleanup
      vi.runAllTimers();
      
      // Wait for both promises
      const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
      
      // Verify purgeExpiredEntries was called only once
      expect(purgeExpiredEntriesSpy).toHaveBeenCalledTimes(1);
      expect(firstResult).toBe(1);
      expect(secondResult).toBe(0); // Skipped cleanup returns 0
      
      // Clean up
      purgeExpiredEntriesSpy.mockRestore();
    });
    
    it('should clean up resources when disposed', () => {
      // Create a service
      const customFlagStorage = new FlagStorageService(
        storageAdapter,
        logger,
        { autoCleanup: true }
      );
      
      // Spy on methods
      const stopCleanupSpy = vi.spyOn(customFlagStorage, 'stopPeriodicCleanup');
      const clearCacheSpy = vi.spyOn(customFlagStorage, 'clearMemoryCache');
      
      // Dispose the service
      customFlagStorage.dispose();
      
      // Verify methods were called
      expect(stopCleanupSpy).toHaveBeenCalled();
      expect(clearCacheSpy).toHaveBeenCalled();
      
      // Clean up
      stopCleanupSpy.mockRestore();
      clearCacheSpy.mockRestore();
    });
  });
}); 