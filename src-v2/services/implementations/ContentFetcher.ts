import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ICacheService } from '../interfaces/ICacheService';
import { ContentFetchOptions, ContentFetchResult, IContentFetcher } from '../interfaces/IContentFetcher';

/**
 * Factory function to create a response adapter based on the request
 */
type ResponseAdapterFactory = (request: IRequestAdapter) => IResponseAdapter;

/**
 * Implementation of the ContentFetcher service responsible for fetching content from URLs
 * with support for caching, timeouts, and error handling.
 */
export class ContentFetcher implements IContentFetcher {
  private logger: ILoggerAdapter;
  private cacheService: ICacheService;
  private createResponseAdapter: ResponseAdapterFactory;
  private defaultOptions: ContentFetchOptions;
  
  /**
   * Creates a new instance of ContentFetcher
   * 
   * @param logger Logger adapter
   * @param cacheService Cache service for storing responses
   * @param createResponseAdapter Factory function to create response adapters
   * @param defaultOptions Default options for fetch operations
   */
  constructor(
    logger: ILoggerAdapter,
    cacheService: ICacheService,
    createResponseAdapter: ResponseAdapterFactory,
    defaultOptions: ContentFetchOptions = {}
  ) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.createResponseAdapter = createResponseAdapter;
    this.defaultOptions = {
      timeout: 10000, // 10 seconds
      followRedirects: true,
      maxRedirects: 5,
      cache: true,
      cacheTTL: 3600, // 1 hour
      ...defaultOptions
    };
  }
  
  /**
   * Fetches content from a URL
   * 
   * @param url The URL to fetch content from
   * @param originalRequest The original request (for context, headers, etc.)
   * @param options Options for the fetch operation
   * @returns A promise resolving to the content fetch result
   */
  public async fetchContent(
    url: string,
    originalRequest: IRequestAdapter,
    options?: ContentFetchOptions
  ): Promise<ContentFetchResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const cacheKey = mergedOptions.cacheKey || this.generateCacheKey(url);
    
    this.logger.debug('ContentFetcher: Fetching content', { 
      url, 
      options: mergedOptions,
      cacheKey 
    });
    
    try {
      // Create a response adapter for the result
      const responseAdapter = this.createResponseAdapter(originalRequest);
      
      // Check cache if caching is enabled
      if (mergedOptions.cache) {
        const cachedContent = await this.cacheService.get<{
          body: string;
          status: number;
          headers: Record<string, string>;
        }>(cacheKey);
        
        if (cachedContent) {
          this.logger.debug('ContentFetcher: Serving cached content', { url, cacheKey });
          
          // Populate response from cache
          responseAdapter.status(cachedContent.status);
          responseAdapter.send(cachedContent.body);
          
          // Set headers from cached response
          Object.entries(cachedContent.headers).forEach(([key, value]) => {
            responseAdapter.setHeader(key, value);
          });
          
          // Add cache indicator header
          responseAdapter.setHeader('X-Edge-Cache', 'HIT');
          
          return {
            response: responseAdapter,
            cacheHit: true,
            timeTaken: Date.now() - startTime
          };
        }
      }
      
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: mergedOptions.headers || {},
        redirect: mergedOptions.followRedirects ? 'follow' : 'manual'
      };
      
      // Add timeout handling
      const fetchPromise = fetch(url, fetchOptions);
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${mergedOptions.timeout}ms`));
        }, mergedOptions.timeout);
      });
      
      // Race fetch against timeout
      const fetchResponse = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch content: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      // Get the content as text
      const content = await fetchResponse.text();
      
      // Set status and content to the response adapter
      responseAdapter.status(fetchResponse.status);
      responseAdapter.send(content);
      
      // Create headers record for caching
      const headersRecord: Record<string, string> = {};
      
      // Copy headers from fetch response
      fetchResponse.headers.forEach((value, key) => {
        responseAdapter.setHeader(key, value);
        headersRecord[key] = value;
      });
      
      // Add cache indicator header
      responseAdapter.setHeader('X-Edge-Cache', 'MISS');
      
      // Store in cache if successful and caching is enabled
      if (fetchResponse.ok && mergedOptions.cache) {
        const cacheData = {
          body: content,
          status: fetchResponse.status,
          headers: headersRecord
        };
        
        await this.cacheService.set(
          cacheKey,
          cacheData,
          mergedOptions.cacheTTL
        );
        
        this.logger.debug('ContentFetcher: Cached content', { 
          url, 
          cacheKey,
          ttl: mergedOptions.cacheTTL 
        });
      }
      
      return {
        response: responseAdapter,
        cacheHit: false,
        timeTaken: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('ContentFetcher: Error fetching content', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Create an error response
      const errorResponse = this.createResponseAdapter(originalRequest);
      errorResponse.status(error instanceof Error && error.message.includes('timeout') ? 504 : 502);
      errorResponse.setHeader('Content-Type', 'application/json');
      errorResponse.json({
        error: 'Failed to fetch content',
        message: error instanceof Error ? error.message : String(error)
      });
      
      return {
        response: errorResponse,
        cacheHit: false,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Clears any cached content for the specified URL
   * 
   * @param url The URL to clear from cache
   * @returns A promise resolving to true if successful
   */
  public async clearCache(url: string): Promise<boolean> {
    const cacheKey = this.generateCacheKey(url);
    this.logger.debug('ContentFetcher: Clearing cache', { url, cacheKey });
    
    try {
      return await this.cacheService.delete(cacheKey);
    } catch (error) {
      this.logger.error('ContentFetcher: Error clearing cache', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Generates a cache key for a URL with optional parameters
   * 
   * @param url The URL to generate a cache key for
   * @param params Optional parameters to include in the cache key
   * @returns The generated cache key
   */
  public generateCacheKey(url: string, params?: Record<string, string>): string {
    // Create base key from URL
    let cacheKey = `content:${url}`;
    
    // Add params to key if provided
    if (params && Object.keys(params).length > 0) {
      const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      
      cacheKey = `${cacheKey}:${paramString}`;
    }
    
    this.logger.debug('ContentFetcher: Generated cache key', { url, params, cacheKey });
    return cacheKey;
  }
} 