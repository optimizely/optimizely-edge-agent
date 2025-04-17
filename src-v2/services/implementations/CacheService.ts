import { ICacheService } from "../interfaces/ICacheService";
import { IStorageAdapter, StoragePutOptions } from "../../adapters/interfaces/IStorageAdapter";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";

/**
 * Interface for cached items with metadata.
 */
interface CachedItem<T> {
  value: T;
  timestamp: number;
  expiry?: number;
}

/**
 * Implements the cache service for Optimizely Edge Agent.
 * Uses the storage adapter to persist and retrieve cached content.
 */
export class CacheService implements ICacheService {
  private storageAdapter: IStorageAdapter;
  private logger: ILoggerAdapter;
  private readonly namespace = "optimizely-cache";
  private readonly defaultTTL = 3600; // 1 hour in seconds

  /**
   * Creates a new instance of CacheService.
   * @param storageAdapter - The storage adapter to use for persistence.
   * @param logger - The logger adapter.
   */
  constructor(storageAdapter: IStorageAdapter, logger: ILoggerAdapter) {
    if (!storageAdapter) {
      throw new Error("Storage adapter is required for CacheService");
    }
    this.storageAdapter = storageAdapter;
    this.logger = logger;
  }

  /**
   * Retrieves a cached item by key.
   * @param cacheKey - The key of the item to retrieve.
   * @returns A promise resolving to the cached value or null if not found or expired.
   */
  async get<T = any>(cacheKey: string): Promise<T | null> {
    try {
      // Generate the namespaced storage key
      const storageKey = this.getStorageKey(cacheKey);
      
      // Retrieve the cached item as string and parse it
      const cachedItemJson = await this.storageAdapter.get(storageKey, 'text');
      
      // Check if the item exists
      if (!cachedItemJson) {
        this.logger.debug(`Cache miss for key: ${cacheKey}`);
        return null;
      }
      
      // Parse the JSON string to get the cached item
      const cachedItem = JSON.parse(cachedItemJson) as CachedItem<T>;
      
      // Check if the item is expired
      const now = Date.now();
      if (cachedItem.expiry && cachedItem.expiry < now) {
        this.logger.debug(`Cache item expired for key: ${cacheKey}`);
        // Clean up expired item asynchronously
        this.delete(cacheKey).catch(err => 
          this.logger.error(`Failed to delete expired cache item: ${cacheKey}`, err)
        );
        return null;
      }
      
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return cachedItem.value;
    } catch (error) {
      this.logger.error(`Error retrieving cached item for key: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Stores an item in the cache.
   * @param cacheKey - The key to store the item under.
   * @param value - The value to store.
   * @param ttl - Time to live in seconds (optional).
   * @returns A promise resolving to true if the operation was successful.
   */
  async set<T = any>(cacheKey: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const storageKey = this.getStorageKey(cacheKey);
      
      // Calculate expiry time
      const expiryTime = ttl !== undefined && ttl > 0
        ? Date.now() + (ttl * 1000)
        : ttl === 0
          ? undefined // No expiry if ttl is 0
          : Date.now() + (this.defaultTTL * 1000); // Default expiry
      
      // Create the cached item
      const cachedItem: CachedItem<T> = {
        value,
        timestamp: Date.now(),
        expiry: expiryTime
      };
      
      // Stringify the item for storage
      const cachedItemJson = JSON.stringify(cachedItem);
      
      // Create storage options with TTL if needed
      const options: StoragePutOptions = {};
      if (ttl !== undefined && ttl > 0) {
        options.expirationTtl = ttl;
      }
      
      // Store the item
      await this.storageAdapter.put(storageKey, cachedItemJson, options);
      this.logger.debug(`Cached item stored for key: ${cacheKey}, expires: ${expiryTime ? new Date(expiryTime).toISOString() : 'never'}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error storing cached item for key: ${cacheKey}`, error);
      return false;
    }
  }

  /**
   * Checks if an item exists in the cache and is not expired.
   * @param cacheKey - The key to check.
   * @returns A promise resolving to true if the item exists and is not expired.
   */
  async has(cacheKey: string): Promise<boolean> {
    const item = await this.get(cacheKey);
    return item !== null;
  }

  /**
   * Deletes an item from the cache.
   * @param cacheKey - The key of the item to delete.
   * @returns A promise resolving to true if the operation was successful.
   */
  async delete(cacheKey: string): Promise<boolean> {
    try {
      const storageKey = this.getStorageKey(cacheKey);
      await this.storageAdapter.delete(storageKey);
      this.logger.debug(`Deleted cache item for key: ${cacheKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cached item for key: ${cacheKey}`, error);
      return false;
    }
  }

  /**
   * Generates a cache key based on the provided parameters.
   * Handles special "VARIATION_KEY" format by constructing a key using flagKey and variationKey.
   * @param baseCacheKey - The base cache key (may be "VARIATION_KEY" or a custom string).
   * @param flagKey - The flag key (used when baseCacheKey is "VARIATION_KEY").
   * @param variationKey - The variation key (used when baseCacheKey is "VARIATION_KEY").
   * @returns The generated cache key.
   */
  generateCacheKey(baseCacheKey: string, flagKey?: string, variationKey?: string): string {
    // If it's not an enhanced cache key, use the basic logic
    if (baseCacheKey !== "enhanced") {
      if (baseCacheKey === "VARIATION_KEY") {
        if (!flagKey || !variationKey) {
          throw new Error("flagKey and variationKey are required when using VARIATION_KEY cache key format");
        }
        return `variation-${flagKey}-${variationKey}`;
      }
      return baseCacheKey;
    }
    
    // Handle enhanced cache key generation with performance optimization
    // Enhanced cache keys use a combination of flagKey, variationKey, and potentially other parameters
    try {
      // Start with required components
      const components = [`flag:${flagKey || 'unknown'}`];
      
      // Add variation if available
      if (variationKey) {
        components.push(`var:${variationKey}`);
      }
      
      // For enhanced cache keys with many attributes, use a hash-based approach
      // for better performance instead of including all attributes directly
      if (arguments.length > 3) {
        // Collect all additional arguments
        const additionalArgs = Array.prototype.slice.call(arguments, 3);
        
        // Use a faster JSON.stringify for the additional arguments with a depth limit
        const limitedJson = this.fastLimitedStringify(additionalArgs);
        
        // Create a hash of the JSON string for shorter keys and better performance
        const hash = this.createFastHash(limitedJson);
        components.push(`args:${hash}`);
      }
      
      // Join components with a separator
      return components.join('|');
    } catch (error) {
      this.logger.error("Error generating enhanced cache key", error);
      // Fallback to a simple unique key based on timestamp and a random number
      return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
  }

  /**
   * Creates a fast hash of a string for cache key generation.
   * @param str - The string to hash.
   * @returns A hash string.
   * @private
   */
  private createFastHash(str: string): string {
    // A simple and fast hashing algorithm (djb2)
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    
    // Convert to a string and ensure it's positive
    return (hash >>> 0).toString(36);
  }
  
  /**
   * Fast limited stringification for complex objects to avoid deep traversal.
   * @param obj - The object to stringify.
   * @param maxDepth - Maximum depth to traverse (default: 2).
   * @returns A JSON string representation with limited depth.
   * @private
   */
  private fastLimitedStringify(obj: any, maxDepth: number = 2): string {
    const seen = new WeakSet();
    
    const stringifyWithDepth = (o: any, depth: number): any => {
      // Handle basic types directly
      if (o === null) return 'null';
      if (o === undefined) return 'undefined';
      if (typeof o === 'number' || typeof o === 'boolean') return o.toString();
      if (typeof o === 'string') return o;
      
      // Avoid circular references
      if (typeof o === 'object' && o !== null) {
        if (seen.has(o)) return '[Circular]';
        seen.add(o);
      }
      
      // Limit depth for better performance
      if (depth >= maxDepth) {
        if (Array.isArray(o)) return '[Array]';
        return '[Object]';
      }
      
      // Handle arrays
      if (Array.isArray(o)) {
        // For large arrays, truncate and only stringify first few items
        if (o.length > 10) {
          return `[${o.slice(0, 10).map(v => stringifyWithDepth(v, depth + 1)).join(',')},...]`;
        }
        return `[${o.map(v => stringifyWithDepth(v, depth + 1)).join(',')}]`;
      }
      
      // Handle objects
      if (typeof o === 'object') {
        const props = Object.keys(o);
        // For objects with many properties, only use a subset for the cache key
        if (props.length > 10) {
          const importantProps = props.slice(0, 10);
          return `{${importantProps.map(k => `"${k}":${stringifyWithDepth(o[k], depth + 1)}`).join(',')}}`;
        }
        return `{${props.map(k => `"${k}":${stringifyWithDepth(o[k], depth + 1)}`).join(',')}}`;
      }
      
      // Fallback
      return String(o);
    };
    
    return stringifyWithDepth(obj, 0);
  }

  /**
   * Generates a namespaced storage key.
   * @param cacheKey - The cache key.
   * @returns The namespaced storage key.
   * @private
   */
  private getStorageKey(cacheKey: string): string {
    return `${this.namespace}:${cacheKey}`;
  }
} 