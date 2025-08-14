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
  private devContentBaseUrl?: string;
  
  /**
   * Creates a new instance of ContentFetcher
   * 
   * @param logger Logger adapter
   * @param cacheService Cache service for storing responses
   * @param createResponseAdapter Factory function to create response adapters
   * @param defaultOptions Default options for fetch operations
   * @param devContentBaseUrl Optional base URL for content rewriting in development
   */
  constructor(
    logger: ILoggerAdapter,
    cacheService: ICacheService,
    createResponseAdapter: ResponseAdapterFactory,
    defaultOptions: ContentFetchOptions = {},
    devContentBaseUrl?: string
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
    this.devContentBaseUrl = devContentBaseUrl;
    
    if (this.devContentBaseUrl) {
      this.logger.debug('ContentFetcher: Development content base URL configured', { 
        devContentBaseUrl: this.devContentBaseUrl 
      });
    }
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
      
      // Apply URL rewriting for development environments if configured
      let fetchUrl = url;
      const isExternal = this.isExternalUrl(url);
      
      // NEVER rewrite external URLs - they should be fetched as-is
      if (this.devContentBaseUrl && !isExternal) {
        try {
          const originalUrl = new URL(url);
          
          // Check if the URL should be rewritten
          // Only rewrite localhost and development test domains
          // DON'T rewrite external URLs like GitHub Pages, CDNs, production sites, etc.
          const shouldRewrite = (originalUrl.hostname === 'localhost' || 
                                originalUrl.hostname === '127.0.0.1' ||
                                originalUrl.hostname === 'edgeagent.demo.optimizely.com') &&
                               !originalUrl.hostname.includes('github.io') &&
                               !originalUrl.hostname.includes('cdn.optimizely.com');
          
          if (shouldRewrite) {
            // Create a new URL using the dev content base URL
            const devUrl = new URL(this.devContentBaseUrl);
            
            // Preserve the original path and search parameters
            devUrl.pathname = originalUrl.pathname;
            devUrl.search = originalUrl.search;
            
            fetchUrl = devUrl.toString();
            
            this.logger.debug('ContentFetcher: URL rewritten for development', {
              originalUrl: url,
              rewrittenUrl: fetchUrl
            });
          }
        } catch (error) {
          this.logger.warn('ContentFetcher: Failed to rewrite URL for development', {
            url,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with original URL if rewriting fails
        }
      } else if (isExternal) {
        this.logger.debug('ContentFetcher: Skipping URL rewriting for external URL', {
          url,
          isExternal
        });
      }
      
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          // For external URLs (like GitHub Pages), use minimal headers
          ...(this.isExternalUrl(fetchUrl) ? {
            'User-Agent': 'EdgeAgent-ContentFetcher/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            // Remove Accept-Encoding to avoid compression issues in Vercel Edge Functions
            // This is a known issue where compressed responses cause empty bodies
            // 'Accept-Encoding': 'gzip, deflate',
            // Removed 'Cache-Control': 'no-cache' to allow upstream CDN caching
            // Only add cache-busting headers if explicitly needed for debugging
            ...(mergedOptions.bustCache ? { 'Cache-Control': 'no-cache' } : {})
          } : {
            ...mergedOptions.headers,
            // Add bypass header when fetching rewritten URLs to prevent infinite loops
            ...(this.devContentBaseUrl && fetchUrl !== url ? {
              'X-Optimizely-Enable-FEX': 'false',
              'X-Forwarded-By': 'EdgeAgent-ContentFetcher'
            } : {})
          })
        },
        redirect: mergedOptions.followRedirects ? 'follow' : 'manual'
        // Remove mode setting - let fetch use default mode
      };
      
      // Add timeout handling
      const fetchPromise = fetch(fetchUrl, fetchOptions);
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${mergedOptions.timeout}ms`));
        }, mergedOptions.timeout);
      });
      
      // Race fetch against timeout
      const fetchResponse = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Enhanced logging for debugging
      const responseHeaders: Record<string, string> = {};
      fetchResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      this.logger.debug('ContentFetcher: Fetch response received', {
        url: fetchUrl,
        originalUrl: url,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        ok: fetchResponse.ok,
        type: fetchResponse.type,
        redirected: fetchResponse.redirected,
        headers: responseHeaders,
        isExternal: this.isExternalUrl(fetchUrl)
      });
      
      if (!fetchResponse.ok) {
        const errorMessage = `Failed to fetch content: ${fetchResponse.status} ${fetchResponse.statusText}`;
        const errorHeaders: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          errorHeaders[key] = value;
        });
        
        this.logger.error('ContentFetcher: Fetch failed', {
          url: fetchUrl,
          originalUrl: url,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          isExternal: this.isExternalUrl(fetchUrl),
          headers: errorHeaders
        });
        throw new Error(errorMessage);
      }
      
      // Get the content as text
      const content = await fetchResponse.text();
      
      this.logger.info('ContentFetcher: Fetched content', {
        url: fetchUrl,
        contentLength: content.length,
        first100Chars: content.substring(0, 100),
        last100Chars: content.substring(Math.max(0, content.length - 100))
      });
      
      // Set status and content to the response adapter
      responseAdapter.status(fetchResponse.status);
      responseAdapter.send(content);
      
      // Create headers record for caching
      const headersRecord: Record<string, string> = {};
      
      // Copy headers from fetch response, but skip problematic ones for Edge runtime
      // Skip content-encoding, transfer-encoding, and content-length headers as they can cause
      // issues with Vercel Edge Functions (known issue with streaming responses)
      const problematicHeaders = ['content-encoding', 'transfer-encoding', 'content-length'];
      fetchResponse.headers.forEach((value, key) => {
        if (!problematicHeaders.includes(key.toLowerCase())) {
          responseAdapter.setHeader(key, value);
          headersRecord[key] = value;
        }
      });
      
      // Fix Content-Type for HTML content if not properly set
      const contentType = fetchResponse.headers.get('content-type') || fetchResponse.headers.get('Content-Type');
      const trimmedContent = content.trim().toLowerCase();
      const isHtmlContent = trimmedContent.startsWith('<!doctype html') || 
                           trimmedContent.startsWith('<html') ||
                           trimmedContent.includes('<html');
      
      this.logger.debug('ContentFetcher: Content type analysis', {
        url: fetchUrl,
        originalContentType: contentType,
        contentLength: content.length,
        contentStart: content.substring(0, 100),
        isHtmlContent: isHtmlContent
      });
      
      if (isHtmlContent && (!contentType || !contentType.includes('text/html'))) {
        this.logger.debug('ContentFetcher: Detected HTML content, setting Content-Type to text/html');
        responseAdapter.setHeader('Content-Type', 'text/html; charset=utf-8');
        headersRecord['Content-Type'] = 'text/html; charset=utf-8';
      }
      
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
   * Determines if a URL is external (not on the same origin)
   * 
   * @param url The URL to check
   * @returns True if the URL is external, false otherwise
   */
  private isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Consider URLs external if they're not localhost, 127.0.0.1, or our development domains
      const isLocal = urlObj.hostname === 'localhost' || 
                     urlObj.hostname === '127.0.0.1' ||
                     urlObj.hostname.endsWith('.pages.dev') ||
                     urlObj.hostname === 'edgeagent.demo.optimizely.com';
      
      return !isLocal;
    } catch (error) {
      // If URL parsing fails, assume it's external to be safe
      this.logger.warn('ContentFetcher: Failed to parse URL for external check', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return true;
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