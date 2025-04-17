import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestForwarder, RequestForwardOptions, RequestForwardResult } from '../interfaces/IRequestForwarder';

/**
 * Implementation of the request forwarder service
 */
export class RequestForwarder implements IRequestForwarder {
  private logger: ILoggerAdapter;
  private fetch: typeof fetch;
  
  /**
   * Creates a new instance of RequestForwarder
   * 
   * @param logger Logger adapter
   * @param fetch Optional fetch implementation (defaults to global fetch)
   */
  constructor(logger: ILoggerAdapter, fetch?: typeof global.fetch) {
    this.logger = logger;
    this.fetch = fetch || global.fetch;
  }
  
  /**
   * Forwards a request to another service
   * 
   * @param request The request to forward
   * @param options Options for forwarding the request
   * @returns Promise resolving to the result of the forwarded request
   */
  public async forwardRequest(
    request: IRequestAdapter,
    options: RequestForwardOptions
  ): Promise<RequestForwardResult> {
    const startTime = Date.now();
    const originalUrl = request.getUrl().toString();
    
    // Ensure targetUrl exists - use originalUrl as fallback if it doesn't
    if (options.targetUrl === null || options.targetUrl === undefined) {
      this.logger.warn('RequestForwarder: options.targetUrl is null or undefined, using originalUrl as fallback', {
        originalUrl
      });
      options.targetUrl = originalUrl;
    }
    
    const targetUrl = this.buildForwardUrl(originalUrl, options.targetUrl, {
      additionalQueryParams: options.additionalQueryParams,
      removeQueryParams: options.removeQueryParams,
      preserveOriginalQueryParams: true
    });
    
    this.logger.debug('RequestForwarder: Forwarding request', {
      originalUrl,
      targetUrl,
      method: options.method || request.getMethod()
    });
    
    const redirectChain: string[] = [];
    
    try {
      // Prepare headers for the forwarded request
      const headers = this.prepareHeaders(request, options);
      
      // Prepare request body
      let body: any = null;
      if (options.includeBody !== false && ['POST', 'PUT', 'PATCH'].includes(request.getMethod().toUpperCase())) {
        body = await request.getBody();
        
        if (options.compressBody && body) {
          // In a real implementation, we would compress the body here
          this.logger.debug('RequestForwarder: Compressing request body');
        }
      }
      
      // Make the fetch request with appropriate options
      const fetchOptions: RequestInit = {
        method: options.method || request.getMethod(),
        headers,
        body,
        redirect: options.followRedirects === false ? 'manual' : 'follow'
      };
      
      // Add timeout handling
      const timeoutMs = options.timeout || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      fetchOptions.signal = controller.signal;
      
      this.logger.debug('RequestForwarder: Executing fetch request', {
        url: targetUrl,
        options: {
          ...fetchOptions,
          body: body ? `[${typeof body}:${(body instanceof Uint8Array) ? 'Uint8Array' : 'data'}]` : null
        }
      });
      
      // Execute the fetch
      const fetchResponse = await this.fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);
      
      // Create a response adapter from the fetch response
      const responseAdapter = await this.createResponseAdapter(fetchResponse);
      
      // Record redirect chain if any
      if (fetchResponse.redirected && fetchResponse.url) {
        redirectChain.push(fetchResponse.url);
      }
      
      this.logger.debug('RequestForwarder: Request forwarded successfully', {
        status: responseAdapter.getStatus(),
        headers: responseAdapter.getHeaders(),
        redirected: fetchResponse.redirected,
        timeTaken: Date.now() - startTime
      });
      
      const responseBody = await responseAdapter.getBody();
      
      return {
        originalRequest: request,
        targetUrl,
        success: true,
        response: responseAdapter,
        timeTaken: Date.now() - startTime,
        redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
        body: responseBody,
        status: responseAdapter.getStatus(),
        headers: this.headersToRecord(responseAdapter.getHeaders())
      };
    } catch (error) {
      this.logger.error('RequestForwarder: Error forwarding request', {
        error: error instanceof Error ? error.message : String(error),
        originalUrl,
        targetUrl
      });
      
      return {
        originalRequest: request,
        targetUrl,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        timeTaken: Date.now() - startTime,
        redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
        body: '',
        status: 500,
        headers: {}
      };
    }
  }
  
  /**
   * Forwards a request and applies the response to the original response
   * 
   * @param request The request to forward
   * @param response The response to apply the forwarded response to
   * @param options Options for forwarding the request
   * @returns Promise resolving to the result of the forwarded request
   */
  public async forwardRequestAndApplyResponse(
    request: IRequestAdapter,
    response: IResponseAdapter,
    options: RequestForwardOptions
  ): Promise<RequestForwardResult> {
    const result = await this.forwardRequest(request, options);
    
    if (result.success && result.response) {
      try {
        // Apply status code
        response.status(result.response.getStatus());
        
        // Apply headers from the forwarded response
        const headers = result.response.getHeaders();
        headers.forEach((value, key) => {
          response.setHeader(key, value);
        });
        
        // Apply body from the forwarded response
        const body = await result.response.getBody();
        if (body) {
          response.send(body);
        }
        
        this.logger.debug('RequestForwarder: Applied forwarded response', {
          status: response.getStatus(),
          headers: response.getHeaders()
        });
      } catch (error) {
        this.logger.error('RequestForwarder: Error applying forwarded response', {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Set result success to false to indicate the operation wasn't fully successful
        result.success = false;
        result.error = error instanceof Error ? error : new Error(String(error));
      }
    }
    
    return result;
  }
  
  /**
   * Builds a URL for forwarding a request
   * 
   * @param originalUrl The original URL
   * @param targetUrl The target URL
   * @param options Options for building the URL
   * @returns The URL for forwarding the request
   */
  public buildForwardUrl(
    originalUrl: string,
    targetUrl: string | null | undefined,
    options?: {
      additionalQueryParams?: Record<string, string>;
      removeQueryParams?: string[];
      preserveOriginalQueryParams?: boolean;
    }
  ): string {
    // If targetUrl is null or undefined, use originalUrl as fallback
    if (targetUrl === null || targetUrl === undefined) {
      this.logger.warn('RequestForwarder: targetUrl is null or undefined, using originalUrl as fallback', {
        originalUrl
      });
      targetUrl = originalUrl;
    }
    
    // Parse the original and target URLs
    let parsedOriginalUrl: URL;
    let parsedTargetUrl: URL;
    
    try {
      // Handle relative URLs
      if (originalUrl.startsWith('/')) {
        // For relative URLs, we need a base URL
        parsedOriginalUrl = new URL(originalUrl, 'http://example.com');
      } else {
        parsedOriginalUrl = new URL(originalUrl);
      }
      
      // Handle relative target URLs
      if (targetUrl.startsWith('/')) {
        // For relative target URLs, we use the original URL's origin
        parsedTargetUrl = new URL(targetUrl, parsedOriginalUrl.origin);
      } else {
        parsedTargetUrl = new URL(targetUrl);
      }
    } catch (error) {
      this.logger.error('RequestForwarder: Error parsing URLs', {
        error: error instanceof Error ? error.message : String(error),
        originalUrl,
        targetUrl
      });
      
      // Return the original URL as fallback if we can't parse the target URL
      return originalUrl;
    }
    
    // Preserve query parameters from the original URL if requested
    if (options?.preserveOriginalQueryParams) {
      parsedOriginalUrl.searchParams.forEach((value, key) => {
        // Skip if parameter should be removed
        if (options.removeQueryParams && options.removeQueryParams.includes(key)) {
          return;
        }
        
        // Only add if not already present in the target URL
        if (!parsedTargetUrl.searchParams.has(key)) {
          parsedTargetUrl.searchParams.set(key, value);
        }
      });
    }
    
    // Add additional query parameters
    if (options?.additionalQueryParams) {
      Object.entries(options.additionalQueryParams).forEach(([key, value]) => {
        parsedTargetUrl.searchParams.set(key, value);
      });
    }
    
    // Remove specified query parameters
    if (options?.removeQueryParams) {
      options.removeQueryParams.forEach(param => {
        parsedTargetUrl.searchParams.delete(param);
      });
    }
    
    return parsedTargetUrl.toString();
  }
  
  /**
   * Helper function to safely convert Headers to a record object
   * 
   * @param headers The Headers object
   * @returns A record of header key-value pairs
   */
  private headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  /**
   * Prepares headers for the forwarded request
   * 
   * @param request Original request
   * @param options Forward options
   * @returns Headers for the forwarded request
   * @private
   */
  private prepareHeaders(
    request: IRequestAdapter,
    options: RequestForwardOptions
  ): Record<string, string> {
    // Start with the original request headers
    const originalHeaders = request.getHeaders();
    const forwardHeaders: Record<string, string> = {};
    
    // Filter headers based on include/exclude options
    originalHeaders.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      
      // Skip if header should be excluded
      if (options.excludeHeaders && options.excludeHeaders.some(h => h.toLowerCase() === lowerKey)) {
        return;
      }
      
      // Skip if includeHeaders is specified and this header is not in the list
      if (options.includeHeaders && options.includeHeaders.length > 0 &&
          !options.includeHeaders.some(h => h.toLowerCase() === lowerKey)) {
        return;
      }
      
      forwardHeaders[key] = value;
    });
    
    // Add/override with headers specified in options
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        forwardHeaders[key] = options.headers![key];
      });
    }
    
    return forwardHeaders;
  }
  
  /**
   * Creates a response adapter from a fetch response
   * 
   * @param fetchResponse Fetch response
   * @returns Promise resolving to a response adapter
   * @private
   */
  private async createResponseAdapter(fetchResponse: Response): Promise<IResponseAdapter> {
    // For this implementation, we'll use an adapter pattern
    // The actual implementation would depend on the adapters available in your system
    
    const responseText = await fetchResponse.text();
    
    // Create an adapter with the same interface as IResponseAdapter
    const adapter: IResponseAdapter = {
      getStatus: () => fetchResponse.status,
      getHeaders: () => fetchResponse.headers,
      setHeader: (name: string, value: string) => {
        // This is a read-only adapter, so setting headers is a no-op
        this.logger.warn('RequestForwarder: Attempted to set header on read-only adapter', {
          name,
          value
        });
      },
      status: (code: number) => {
        // This is a read-only adapter, so setting status is a no-op
        this.logger.warn('RequestForwarder: Attempted to set status on read-only adapter', {
          code
        });
      },
      getBody: () => responseText,
      send: (content: string) => {
        // This is a read-only adapter, so setting body is a no-op
        this.logger.warn('RequestForwarder: Attempted to send content on read-only adapter', {
          contentLength: content.length
        });
      },
      json: (data: any) => {
        // This is a read-only adapter, so sending JSON is a no-op
        this.logger.warn('RequestForwarder: Attempted to send JSON on read-only adapter', {
          data
        });
      }
    };
    
    return adapter;
  }
} 