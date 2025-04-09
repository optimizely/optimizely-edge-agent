import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';

/**
 * Options for content fetching
 */
export interface ContentFetchOptions {
  /** Headers to include in the fetch request */
  headers?: Record<string, string>;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to follow redirects */
  followRedirects?: boolean;
  
  /** Maximum number of redirects to follow */
  maxRedirects?: number;
  
  /** Time-to-live for cache in seconds */
  cacheTTL?: number;
  
  /** Whether to cache the response */
  cache?: boolean;
  
  /** Cache key override */
  cacheKey?: string;
}

/**
 * Result of a content fetch operation
 */
export interface ContentFetchResult {
  /** The response object */
  response: IResponseAdapter;
  
  /** Whether this was a cache hit */
  cacheHit: boolean;
  
  /** Time taken to fetch in milliseconds */
  timeTaken: number;
  
  /** Error if fetch failed */
  error?: Error;
}

/**
 * @interface IContentFetcher
 * @description Service responsible for fetching content from URLs with
 * support for caching, timeouts, and error handling.
 */
export interface IContentFetcher {
  /**
   * Fetches content from a URL
   * 
   * @param url The URL to fetch content from
   * @param originalRequest The original request (for context, headers, etc.)
   * @param options Options for the fetch operation
   * @returns A promise resolving to the content fetch result
   */
  fetchContent(
    url: string,
    originalRequest: IRequestAdapter,
    options?: ContentFetchOptions
  ): Promise<ContentFetchResult>;
  
  /**
   * Clears any cached content for the specified URL
   * 
   * @param url The URL to clear from cache
   * @returns A promise resolving to true if successful
   */
  clearCache(url: string): Promise<boolean>;
  
  /**
   * Generates a cache key for a URL with optional parameters
   * 
   * @param url The URL to generate a cache key for
   * @param params Optional parameters to include in the cache key
   * @returns The generated cache key
   */
  generateCacheKey(url: string, params?: Record<string, string>): string;
} 