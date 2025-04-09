import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { ICacheService } from '../interfaces/ICacheService';
import { CacheKeyGenerator, CacheMetrics, CacheOperationResult, CacheStrategyOptions, ICacheManager } from '../interfaces/ICacheManager';

/**
 * Implementation of CacheManager that provides sophisticated caching strategies
 * on top of the base ICacheService.
 */
export class CacheManager implements ICacheManager {
  private cacheService: ICacheService;
  private logger: ILoggerAdapter;
  private defaultOptions: CacheStrategyOptions;
  private metrics: {
    gets: number;
    hits: number;
    sets: number;
    invalidations: number;
    getTotalTime: number;
    setTotalTime: number;
  };
  
  /**
   * Creates a new instance of CacheManager
   * 
   * @param cacheService The underlying cache service
   * @param logger Logger adapter for diagnostics
   * @param defaultOptions Default strategy options to apply
   */
  constructor(
    cacheService: ICacheService,
    logger: ILoggerAdapter,
    defaultOptions: CacheStrategyOptions = {}
  ) {
    this.cacheService = cacheService;
    this.logger = logger;
    this.defaultOptions = {
      ttl: 3600, // 1 hour default TTL
      varyByQueryParams: true,
      staleWhileRevalidate: false,
      compress: false,
      ...defaultOptions
    };
    
    // Initialize metrics
    this.metrics = {
      gets: 0,
      hits: 0,
      sets: 0,
      invalidations: 0,
      getTotalTime: 0,
      setTotalTime: 0
    };
  }
  
  /**
   * Gets the underlying cache service
   */
  public getCacheService(): ICacheService {
    return this.cacheService;
  }
  
  /**
   * Creates or updates a cache entry using a provided value
   * 
   * @param key Base cache key
   * @param value Value to cache
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  public async set<T>(
    key: string,
    value: T,
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateCacheKey(key, {}, mergedOptions);
    
    this.logger.debug('CacheManager: Setting cache entry', {
      key,
      cacheKey,
      options: mergedOptions
    });
    
    try {
      // If compression is enabled, handle it
      let valueToStore: any = value;
      if (mergedOptions.compress && typeof value === 'string') {
        // In a real implementation, we would compress the string here
        // This is just a placeholder for the concept
        this.logger.debug('Compression enabled but not implemented in this version');
      }
      
      // Store in cache with the specified TTL
      const success = await this.cacheService.set(
        cacheKey, 
        valueToStore, 
        mergedOptions.ttl
      );
      
      const timeTaken = Date.now() - startTime;
      
      // Update metrics
      this.metrics.sets++;
      this.metrics.setTotalTime += timeTaken;
      
      return {
        success,
        value,
        fromCache: false,
        cacheKey,
        timeTaken
      };
    } catch (error) {
      this.logger.error('CacheManager: Error setting cache entry', {
        key,
        cacheKey,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        fromCache: false,
        cacheKey,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Retrieves a cached value based on the key and strategy
   * 
   * @param key Base cache key
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  public async get<T>(
    key: string,
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateCacheKey(key, {}, mergedOptions);
    
    this.logger.debug('CacheManager: Getting cache entry', {
      key,
      cacheKey,
      options: mergedOptions
    });
    
    try {
      // Update metrics
      this.metrics.gets++;
      
      // Get from cache
      const cachedValue = await this.cacheService.get<T>(cacheKey);
      const timeTaken = Date.now() - startTime;
      this.metrics.getTotalTime += timeTaken;
      
      if (cachedValue !== null) {
        this.logger.debug('CacheManager: Cache hit', { key, cacheKey });
        this.metrics.hits++;
        
        // Handle any decompression needed
        let valueToReturn: any = cachedValue;
        if (mergedOptions.compress && typeof cachedValue === 'string') {
          // In a real implementation, we would decompress the string here
          // This is just a placeholder for the concept
          this.logger.debug('Decompression enabled but not implemented in this version');
        }
        
        return {
          success: true,
          value: valueToReturn,
          fromCache: true,
          cacheKey,
          timeTaken
        };
      }
      
      this.logger.debug('CacheManager: Cache miss', { key, cacheKey });
      
      return {
        success: false,
        fromCache: false,
        cacheKey,
        timeTaken
      };
    } catch (error) {
      this.logger.error('CacheManager: Error getting cache entry', {
        key,
        cacheKey,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        fromCache: false,
        cacheKey,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Performs a "get or compute" operation - gets from cache if available, 
   * otherwise computes using the provided function and caches the result
   * 
   * @param key Base cache key
   * @param computeFn Function to compute the value if not in cache
   * @param options Cache strategy options
   * @returns A promise resolving to the cache operation result
   */
  public async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    
    // First try to get from cache
    const getResult = await this.get<T>(key, mergedOptions);
    
    // If successful, return the cached value
    if (getResult.success) {
      return getResult;
    }
    
    // Handle stale-while-revalidate logic
    let staleValue: T | undefined;
    if (mergedOptions.staleWhileRevalidate && getResult.value) {
      staleValue = getResult.value;
      this.logger.debug('CacheManager: Using stale value while revalidating', { key });
    }
    
    try {
      // Cache miss, need to compute
      this.logger.debug('CacheManager: Computing value', { key });
      
      const computedValue = await computeFn();
      
      // Store in cache asynchronously
      this.set(key, computedValue, mergedOptions).catch(error => {
        this.logger.error('CacheManager: Error caching computed value', {
          key,
          error: error instanceof Error ? error.message : String(error)
        });
      });
      
      return {
        success: true,
        value: computedValue,
        fromCache: false,
        cacheKey: getResult.cacheKey,
        timeTaken: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('CacheManager: Error computing value', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If we have a stale value, return it despite the error
      if (staleValue !== undefined) {
        return {
          success: true,
          value: staleValue,
          fromCache: true,
          cacheKey: getResult.cacheKey,
          timeTaken: Date.now() - startTime,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
      
      return {
        success: false,
        fromCache: false,
        cacheKey: getResult.cacheKey,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Invalidates a cache entry
   * 
   * @param key Base cache key
   * @param options Cache strategy options (needed to match the key generation)
   * @returns A promise resolving to the cache operation result
   */
  public async invalidate(
    key: string,
    options?: CacheStrategyOptions
  ): Promise<CacheOperationResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateCacheKey(key, {}, mergedOptions);
    
    this.logger.debug('CacheManager: Invalidating cache entry', {
      key,
      cacheKey
    });
    
    try {
      // Update metrics
      this.metrics.invalidations++;
      
      // Delete from cache
      const success = await this.cacheService.delete(cacheKey);
      
      return {
        success,
        fromCache: false,
        cacheKey,
        timeTaken: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('CacheManager: Error invalidating cache entry', {
        key,
        cacheKey,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        fromCache: false,
        cacheKey,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Generates a cache key using the strategy options
   * 
   * @param baseKey Base cache key
   * @param params Additional parameters to include in key generation
   * @param options Cache strategy options
   * @returns The generated cache key
   */
  public generateCacheKey(
    baseKey: string,
    params: Record<string, any> = {},
    options?: CacheStrategyOptions
  ): string {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // If a custom key generator is provided, use it
    if (mergedOptions.keyGenerator) {
      return mergedOptions.keyGenerator(baseKey, params);
    }
    
    // Start with the base key
    let cacheKey = `cm:${baseKey}`;
    
    // Add params based on varyByQueryParams setting
    if (mergedOptions.varyByQueryParams) {
      const relevantParams: Record<string, any> = {};
      
      if (Array.isArray(mergedOptions.varyByQueryParams)) {
        // Only include the specified query params
        for (const param of mergedOptions.varyByQueryParams) {
          if (params[param] !== undefined) {
            relevantParams[param] = params[param];
          }
        }
      } else if (mergedOptions.varyByQueryParams === true) {
        // Include all params
        Object.assign(relevantParams, params);
      }
      
      // Sort params by key for consistent ordering
      if (Object.keys(relevantParams).length > 0) {
        const paramString = Object.entries(relevantParams)
          .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
          .map(([key, value]) => `${key}=${this.stringifyValue(value)}`)
          .join('&');
        
        if (paramString) {
          cacheKey = `${cacheKey}:${paramString}`;
        }
      }
    }
    
    // Add vary by headers if specified
    if (Array.isArray(mergedOptions.varyByHeaders) && mergedOptions.varyByHeaders.length > 0) {
      cacheKey = `${cacheKey}:vh:${mergedOptions.varyByHeaders.join(',')}`;
    }
    
    this.logger.debug('CacheManager: Generated cache key', {
      baseKey,
      params,
      cacheKey
    });
    
    return cacheKey;
  }
  
  /**
   * Gets cache performance metrics
   * 
   * @returns Cache metrics including hit rate, avg retrieval time, etc.
   */
  public getMetrics(): CacheMetrics {
    const hitRate = this.metrics.gets > 0 
      ? this.metrics.hits / this.metrics.gets 
      : 0;
    
    const avgGetTime = this.metrics.gets > 0 
      ? this.metrics.getTotalTime / this.metrics.gets 
      : 0;
    
    const avgSetTime = this.metrics.sets > 0 
      ? this.metrics.setTotalTime / this.metrics.sets 
      : 0;
    
    return {
      hitRate,
      gets: this.metrics.gets,
      sets: this.metrics.sets,
      invalidations: this.metrics.invalidations,
      avgGetTime,
      avgSetTime
    };
  }
  
  /**
   * Helper method to stringify a value for cache key generation
   * 
   * @param value The value to stringify
   * @returns String representation of the value
   * @private
   */
  private stringifyValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  }
} 