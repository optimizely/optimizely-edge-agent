import { ICacheService } from './ICacheService';

/**
 * Cache strategy options
 */
export interface CacheStrategyOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  
  /** Custom key generation logic or prefix */
  keyGenerator?: CacheKeyGenerator;
  
  /** Whether to vary cache by query parameters */
  varyByQueryParams?: boolean | string[];
  
  /** Whether to vary cache by specific headers */
  varyByHeaders?: string[];
  
  /** Whether to allow stale content while revalidating */
  staleWhileRevalidate?: boolean;
  
  /** Maximum stale time in seconds if staleWhileRevalidate is true */
  maxStaleTime?: number;
  
  /** Whether to compress cached content */
  compress?: boolean;
}

/**
 * Function type for generating cache keys
 */
export type CacheKeyGenerator = (
  url: string, 
  params: Record<string, any>
) => string;

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = any> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The value from the operation (if applicable) */
  value?: T;
  
  /** Whether the result was from cache */
  fromCache: boolean;
  
  /** The cache key that was used */
  cacheKey: string;
  
  /** Time taken to complete the operation in milliseconds */
  timeTaken: number;
  
  /** Error details if the operation failed */
  error?: Error;
}

/**
 * @interface ICacheManager
 * @description Advanced cache management service that sits on top of the base ICacheService 
 * to provide more sophisticated caching strategies, control, and metrics.
 */
export interface ICacheManager {
  /**
   * Gets the underlying cache service
   */
  getCacheService(): ICacheService;
  
  /**
   * Creates or updates a cache entry using a provided value
   * 
   * @param key Base cache key (without strategy modifications)
   * @param value Value to cache
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  set<T>(
    key: string, 
    value: T, 
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>>;
  
  /**
   * Retrieves a cached value based on the key and strategy
   * 
   * @param key Base cache key (without strategy modifications)
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  get<T>(
    key: string, 
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>>;
  
  /**
   * Performs a "get or compute" operation - gets from cache if available, 
   * otherwise computes using the provided function and caches the result
   * 
   * @param key Base cache key (without strategy modifications)
   * @param computeFn Function to compute the value if not in cache
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  getOrCompute<T>(
    key: string, 
    computeFn: () => Promise<T>, 
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>>;
  
  /**
   * Invalidates a cache entry
   * 
   * @param key Base cache key (without strategy modifications)
   * @param options Cache strategy options (needed to match the key generation)
   * @returns A promise resolving to the cache operation result
   */
  invalidate(
    key: string, 
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult>;
  
  /**
   * Generates a cache key using the strategy options
   * 
   * @param baseKey Base cache key
   * @param params Additional parameters to include in key generation
   * @param options Cache strategy options
   * @returns The generated cache key
   */
  generateCacheKey(
    baseKey: string, 
    params?: Record<string, any>, 
    options?: CacheStrategyOptions
  ): string;
  
  /**
   * Gets cache performance metrics
   * 
   * @returns Cache metrics including hit rate, avg retrieval time, etc.
   */
  getMetrics(): CacheMetrics;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  /** Cache hit rate (0-1) */
  hitRate: number;
  
  /** Total number of get operations */
  gets: number;
  
  /** Total number of set operations */
  sets: number;
  
  /** Total number of invalidation operations */
  invalidations: number;
  
  /** Average get operation time in milliseconds */
  avgGetTime: number;
  
  /** Average set operation time in milliseconds */
  avgSetTime: number;
} 