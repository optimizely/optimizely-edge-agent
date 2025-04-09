import { IStorageAdapter } from "../../adapters/interfaces/IStorageAdapter";

/**
 * @interface ICacheService
 * @description Defines the contract for caching content for Optimizely Edge Agent.
 */
export interface ICacheService {
  /**
   * Retrieves a cached item by key.
   * @param cacheKey - The key of the item to retrieve.
   * @returns A promise resolving to the cached value or null if not found or expired.
   */
  get<T = any>(cacheKey: string): Promise<T | null>;

  /**
   * Stores an item in the cache.
   * @param cacheKey - The key to store the item under.
   * @param value - The value to store.
   * @param ttl - Time to live in seconds (optional).
   * @returns A promise resolving to true if the operation was successful.
   */
  set<T = any>(cacheKey: string, value: T, ttl?: number): Promise<boolean>;

  /**
   * Checks if an item exists in the cache and is not expired.
   * @param cacheKey - The key to check.
   * @returns A promise resolving to true if the item exists and is not expired.
   */
  has(cacheKey: string): Promise<boolean>;

  /**
   * Deletes an item from the cache.
   * @param cacheKey - The key of the item to delete.
   * @returns A promise resolving to true if the operation was successful.
   */
  delete(cacheKey: string): Promise<boolean>;

  /**
   * Generates a cache key based on the provided parameters.
   * Handles special "VARIATION_KEY" format by constructing a key using flagKey and variationKey.
   * @param baseCacheKey - The base cache key (may be "VARIATION_KEY" or a custom string).
   * @param flagKey - The flag key (used when baseCacheKey is "VARIATION_KEY").
   * @param variationKey - The variation key (used when baseCacheKey is "VARIATION_KEY").
   * @returns The generated cache key.
   */
  generateCacheKey(baseCacheKey: string, flagKey?: string, variationKey?: string): string;
} 