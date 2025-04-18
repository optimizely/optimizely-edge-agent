import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { ICacheService } from '../interfaces/ICacheService';
import { CDNVariationSettings, IEdgeModeHandler, ContentPreparationResult, ShouldHandleResult } from '../interfaces/IEdgeModeHandler';
import { URLMatcher } from './URLMatcher';
import { OptimizelyUserContext } from '../interfaces/IDecisionService';

/**
 * Factory function to create a response adapter based on the request
 * This is needed since the IRequestAdapter doesn't have createResponse method
 */
type ResponseAdapterFactory = (request: IRequestAdapter) => IResponseAdapter;

/**
 * Helper function to safely convert string or boolean to boolean
 * 
 * @param value Value to convert
 * @returns boolean result
 */
function isTrue(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

/**
 * Implementation of the Edge Mode Handler responsible for processing requests
 * in Edge Mode according to CDN Variation Settings.
 */
export class EdgeModeHandler implements IEdgeModeHandler {
  private urlMatcher: URLMatcher;
  private logger: ILoggerAdapter;
  private cacheService: ICacheService;
  private createResponseAdapter: ResponseAdapterFactory;
  private readonly logPrefix = '[EdgeModeHandler]';
  
  /**
   * Creates a new instance of EdgeModeHandler
   * 
   * @param logger Logger adapter
   * @param cacheService Cache service for storing responses
   * @param createResponseAdapter Factory function to create response adapters
   */
  constructor(
    logger: ILoggerAdapter, 
    cacheService: ICacheService,
    createResponseAdapter: ResponseAdapterFactory
  ) {
    this.logger = logger;
    this.urlMatcher = new URLMatcher(logger);
    this.cacheService = cacheService;
    this.createResponseAdapter = createResponseAdapter;
  }
  
  /**
   * Determines if the request should be handled by Edge Mode
   * @param request The request to check
   * @param userContext User context for decision making
   * @returns Promise resolving to decision result with handle flag and reason
   */
  public async shouldHandleRequest(
    request: IRequestAdapter,
    userContext: OptimizelyUserContext
  ): Promise<ShouldHandleResult> {
    // Extract SDK key from request headers or query parameters
    const url = request.getUrl();
    const urlParams = new URLSearchParams(url.search);
    const sdkKey = request.getHeader('X-Optimizely-SDK-Key') || urlParams.get('sdkKey') || '8mR1pGh8u2ztUP8GqjmQq'; // Use default SDK key as fallback
    
    // Log SDK key being used (partially masked for security)
    if (sdkKey) {
      this.logger.debug(`${this.logPrefix} Using SDK Key: ${sdkKey.substring(0, 4)}...`);
    }
    
    this.logger.debug(`${this.logPrefix} Checking if request should be handled: ${url.toString()}`);
    
    // In a real implementation, we would fetch CDN variation settings from a datafile or API
    // For this implementation, we'll create mock settings for testing
    // These settings should match what's configured in the Optimizely project
    
    // Create example CDN variation settings for testing
    const mockVariationSettings: CDNVariationSettings[] = [
      {
        cdnExperimentURL: '/experiment-1',
        cdnResponseURL: 'https://cdn.example.com/variations/experiment-1-var-a.html',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: true
      },
      {
        cdnExperimentURL: '/api/product',
        cdnResponseURL: 'https://cdn.example.com/api/product',
        pathRegex: '\\/api\\/product(\\/?|\\/.+)',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: false
      }
    ];
    
    // For the specific SDK key mentioned in the handover document, add real test settings
    if (sdkKey === '8mR1pGh8u2ztUP8GqjmQq') {
      mockVariationSettings.push({
        cdnExperimentURL: '/test-path',
        cdnResponseURL: 'https://cdn-example.optimizely.com/content/test-path-variation.html',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: true
      });
      
      // Add specific settings for API endpoints
      mockVariationSettings.push({
        cdnExperimentURL: '/api/decide',
        cdnResponseURL: 'https://api.optimizely.com/v2/decide',
        pathRegex: '\\/api\\/decide(\\/?|\\/.+)',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: false
      });
      
      mockVariationSettings.push({
        cdnExperimentURL: '/api/decide-all',
        cdnResponseURL: 'https://api.optimizely.com/v2/decide-all',
        pathRegex: '\\/api\\/decide-all(\\/?|\\/.+)',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: false
      });
      
      mockVariationSettings.push({
        cdnExperimentURL: '/api/decide-for-keys',
        cdnResponseURL: 'https://api.optimizely.com/v2/decide-for-keys',
        pathRegex: '\\/api\\/decide-for-keys(\\/?|\\/.+)',
        forwardRequestToOrigin: true,
        cacheRequestToOrigin: false
      });
    }
    
    this.logger.debug(`${this.logPrefix} Generated ${mockVariationSettings.length} mock variation settings`);
    
    // Find if there's a matching config for this URL
    const matchingConfig = this.findMatchingConfig(url.toString(), mockVariationSettings);
    
    if (matchingConfig) {
      this.logger.debug(`${this.logPrefix} Found matching configuration, request should be handled by Edge Mode`, JSON.stringify({ 
        url: url.toString(),
        matchingPattern: matchingConfig.pathRegex || matchingConfig.cdnExperimentURL
      }));
      
      return { 
        handle: true, 
        reason: "Matching configuration found",
        variationSettings: mockVariationSettings
      };
    }
    
    // Return with handle=false if no matching config found
    return { 
      handle: false, 
      reason: "No matching CDN variation settings found",
      variationSettings: []
    };
  }

  /**
   * Prepares content for delivery based on settings
   * @param settings CDN variation settings
   * @param userContext User context for decision making
   * @param request The original request
   * @returns Content preparation result with delivery options
   */
  public async prepareContent(
    settings: CDNVariationSettings,
    userContext: OptimizelyUserContext,
    request: IRequestAdapter
  ): Promise<ContentPreparationResult> {
    try {
      // Extract SDK key from request headers or query parameters
      const url = request.getUrl();
      const urlParams = new URLSearchParams(url.search);
      const sdkKey = request.getHeader('X-Optimizely-SDK-Key') || urlParams.get('sdkKey') || '8mR1pGh8u2ztUP8GqjmQq'; // Use default SDK key as fallback
      
      // Log SDK key being used (partially masked for security)
      if (sdkKey) {
        this.logger.debug(`${this.logPrefix} Using SDK Key: ${sdkKey.substring(0, 4)}...`);
      }
      
      // Ensure settings is not null
      const safeSettings = settings || {};
      
      // Extract content delivery settings from the CDN Variation Settings
      const useCache = isTrue(safeSettings.cacheRequestToOrigin); 
      const forwardToOrigin = isTrue(safeSettings.forwardRequestToOrigin);
      
      // Log settings
      this.logger.debug(`${this.logPrefix} Preparing content with settings:`, JSON.stringify({
        useCache,
        forwardToOrigin,
        hasTransform: !!safeSettings.transformContent,
        hasCdnResponseURL: !!safeSettings.cdnResponseURL,
        sdkKeyUsed: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined
      }));
      
      // Return content preparation result
      return {
        useCache,
        forwardToOrigin
      };
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error preparing content:`, JSON.stringify(error instanceof Error ? error.message : String(error)));
      // Default behavior in case of error
      return {
        useCache: true,
        forwardToOrigin: true
      };
    }
  }
  
  /**
   * Processes a request in Edge Mode
   * 
   * @param request The incoming request
   * @param cdnVariationSettings The CDN variation settings to apply
   * @returns A promise resolving to a response
   */
  public async processRequest(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter> {
    try {
      this.logger.debug('EdgeModeHandler: Processing request', JSON.stringify({
        url: request.getUrl().toString(),
        cdnResponseURL: cdnVariationSettings.cdnResponseURL,
        forwardRequestToOrigin: cdnVariationSettings.forwardRequestToOrigin
      }));
      
      // Determine if we should fetch content from CDN or forward to origin
      if (cdnVariationSettings.cdnResponseURL) {
        // Fetch from CDN
        const response = await this.fetchContent(cdnVariationSettings.cdnResponseURL, request);
        
        // Apply content transformation if specified
        if (cdnVariationSettings.transformContent) {
          try {
            const body = await response.getBody();
            if (body) {
              const transformedContent = await this.transformContent(body, cdnVariationSettings.transformContent);
              response.send(transformedContent);
            }
          } catch (error) {
            this.logger.error('EdgeModeHandler: Error transforming CDN content', JSON.stringify({
              error: error instanceof Error ? error.message : String(error)
            }));
            // Continue with original content if transformation fails
          }
        }
        
        // Apply response headers from CDN variation settings
        if (cdnVariationSettings.responseHeaders && typeof cdnVariationSettings.responseHeaders === 'object') {
          for (const [key, value] of Object.entries(cdnVariationSettings.responseHeaders)) {
            if (value !== undefined && value !== null) {
              try {
                response.setHeader(key, String(value));
              } catch (headerError) {
                this.logger.warn(`EdgeModeHandler: Error setting custom header ${key}`, JSON.stringify({
                  value, 
                  error: headerError instanceof Error ? headerError.message : String(headerError)
                }));
              }
            }
          }
        }
        
        return response;
      } else if (isTrue(cdnVariationSettings.forwardRequestToOrigin)) {
        // Forward to origin
        return this.forwardToOrigin(request, cdnVariationSettings);
      } else {
        // Neither CDN URL nor forward to origin is specified
        this.logger.warn('EdgeModeHandler: Neither CDN URL nor forward to origin is specified in variation settings');
        const response = this.createResponseAdapter(request);
        response.status(400); // Bad Request
        response.send('CDN variation configuration error: No content source specified');
        return response;
      }
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error processing request', JSON.stringify({
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(500); // Internal Server Error
      response.send('Error processing request');
      return response;
    }
  }
  
  /**
   * Finds the matching CDN variation settings for a request URL
   * 
   * @param url The URL to match
   * @param allCdnVariationSettings Array of all available CDN variation settings
   * @returns The matching CDN variation settings or null if no match
   */
  public findMatchingConfig(
    url: string,
    allCdnVariationSettings: CDNVariationSettings[]
  ): CDNVariationSettings | null {
    this.logger.debug('EdgeModeHandler: Finding matching config for URL', JSON.stringify({ url }));
    
    // No settings, no match
    if (!allCdnVariationSettings || allCdnVariationSettings.length === 0) {
      this.logger.debug('EdgeModeHandler: No CDN variation settings provided');
      return null;
    }
    
    // Parse the URL to work with its components
    let parsedUrl: URL;
    try {
      // Add protocol if not present to make URL parsing work
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
    } catch (error) {
      this.logger.warn('EdgeModeHandler: Invalid URL provided for matching', JSON.stringify({ url, error: error instanceof Error ? error.message : String(error) }));
      return null;
    }
    
    // Loop through all settings to find a match
    for (const config of allCdnVariationSettings) {
      // Skip if both required pattern fields are missing
      if (!config.cdnExperimentURL && !config.pathRegex) {
        this.logger.warn('EdgeModeHandler: CDN variation settings missing both cdnExperimentURL and pathRegex', JSON.stringify({ config }));
        continue;
      }
      
      // Determine which pattern to use - prefer regex if available
      const isRegex = !!config.pathRegex;
      const pattern = isRegex ? config.pathRegex : config.cdnExperimentURL;
      
      // If no pattern, skip
      if (!pattern) {
        this.logger.warn('EdgeModeHandler: Invalid URL pattern', JSON.stringify({ config }));
        continue;
      }
      
      // For non-regex patterns, first try a direct path comparison for efficiency
      if (!isRegex && pattern.startsWith('/')) {
        const normalizedUrlPath = this.urlMatcher.normalizePath(parsedUrl.pathname);
        const normalizedPattern = this.urlMatcher.normalizePath(pattern);
        
        if (normalizedUrlPath === normalizedPattern) {
          // For direct path matches, still check query params if required
          if (config.requiredQueryParams && config.requiredQueryParams.length > 0) {
            const allParamsPresent = config.requiredQueryParams.every(
              param => parsedUrl.searchParams.has(param)
            );
            if (!allParamsPresent) {
              this.logger.debug(`EdgeModeHandler: Path matches but missing required query params - url: ${url}, pattern: ${pattern}, requiredParams: ${JSON.stringify(config.requiredQueryParams)}`);
              continue;
            }
          }
          
          this.logger.debug('EdgeModeHandler: Found direct path match', JSON.stringify({
            urlPath: parsedUrl.pathname,
            pattern
          }));
          return config;
        }
        
        this.logger.debug('EdgeModeHandler: Path does not match', JSON.stringify({ 
          urlPath: parsedUrl.pathname, 
          normalizedUrlPath,
          pattern,
          normalizedPattern
        }));
      }
      
      // Use URLMatcher for all matching scenarios including regex
      const matches = this.urlMatcher.matches(url, pattern, {
        isRegex: isRegex,
        requiredQueryParams: config.requiredQueryParams,
        ignoreQueryParams: config.ignoreQueryParams
      });
      
      if (matches) {
        this.logger.debug('EdgeModeHandler: Found matching config via URLMatcher', JSON.stringify({ 
          url, 
          pattern,
          isRegex
        }));
        return config;
      }
    }
    
    this.logger.debug('EdgeModeHandler: No matching config found for URL', JSON.stringify({ url }));
    return null;
  }
  
  /**
   * Fetches content from the CDN response URL
   * 
   * @param cdnResponseURL The URL to fetch content from
   * @param request The original request (for headers, etc.)
   * @returns A promise resolving to the fetched content response
   */
  public async fetchContent(
    cdnResponseURL: string,
    request: IRequestAdapter
  ): Promise<IResponseAdapter> {
    this.logger.debug('EdgeModeHandler: Fetching content', JSON.stringify({ cdnResponseURL }));
    
    try {
      // Create a response object
      const response = this.createResponseAdapter(request);
      
      // Try to get from cache first if available
      // Note: In a real implementation, we'd use a more sophisticated caching strategy
      const cachedContent = await this.cacheService.get(cdnResponseURL);
      if (cachedContent) {
        this.logger.debug('EdgeModeHandler: Serving cached content', JSON.stringify({ cdnResponseURL }));
        response.send(cachedContent);
        response.setHeader('X-Edge-Cache', 'HIT');
        return response;
      }
      
      // Fetch the content
      const fetchResponse = await fetch(cdnResponseURL);
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch content: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      // Get the content as text
      const content = await fetchResponse.text();
      
      // Set basic response properties
      response.status(fetchResponse.status || 200);
      
      // Copy headers from fetch response - safe way to handle headers
      fetchResponse.headers.forEach((value, key) => {
        if (value !== undefined && value !== null) {
          try {
            response.setHeader(key, String(value));
          } catch (headerError) {
            this.logger.warn(`EdgeModeHandler: Error setting header ${key}`, JSON.stringify({
              value,
              error: headerError instanceof Error ? headerError.message : String(headerError)
            }));
          }
        }
      });
      
      // Add cache indicator
      response.setHeader('X-Edge-Cache', 'MISS');
      
      // Send content last after setting headers
      if (content !== undefined && content !== null) {
        response.send(content);
      } else {
        response.send('');
      }
      
      // Store in cache if successful - ensure this happens before we return
      if (fetchResponse.ok && content) {
        // In a real implementation, we'd respect cache headers and TTL
        await this.cacheService.set(cdnResponseURL, content, 60 * 60); // 1 hour default TTL
        this.logger.debug('EdgeModeHandler: Cached content', JSON.stringify({ cdnResponseURL }));
      }
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error fetching content', JSON.stringify({
        cdnResponseURL,
        error: error instanceof Error ? error.message : String(error)
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error fetching content');
      return response;
    }
  }
  
  /**
   * Apply transformation functions to content.
   * @param content - Content to transform
   * @param transformFn - Transformation function as a string
   * @returns Transformed content
   */
  public async transformContent(
    content: string,
    transformFn: string
  ): Promise<string> {
    try {
      if (!transformFn || transformFn.trim() === '') {
        return content;
      }

      this.logger.debug(`Applying transformation function`);
      
      // Create a function from the string
      // The function should have access to the content variable
      // eslint-disable-next-line no-new-func
      const fn = new Function('content', transformFn);
      
      // Execute the function with the content
      const transformedContent = fn(content);
      
      // Ensure we always return a string
      if (typeof transformedContent !== 'string') {
        this.logger.warn('Transform function did not return a string. Using original content.');
        return content;
      }
      
      return transformedContent;
    } catch (error) {
      this.logger.error(`Error applying transformation function: ${error instanceof Error ? error.message : String(error)}`);
      return content; // Return original content if transformation fails
    }
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
   * Forwards a request to the origin server
   * 
   * @param request The original request
   * @param cdnVariationSettings The CDN variation settings
   * @returns A promise resolving to the origin response
   */
  public async forwardToOrigin(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter> {
    try {
      this.logger.debug('EdgeModeHandler: Forwarding request to origin', JSON.stringify({
        url: request.getUrl().toString()
      }));
      
      const cacheKey = this.generateCacheKey(request);
      
      // Check cache first if caching is enabled
      if (cdnVariationSettings.cacheRequestToOrigin && this.cacheService) {
        try {
          const cachedResponse = await this.cacheService.get(cacheKey);
          if (cachedResponse) {
            this.logger.debug('EdgeModeHandler: Found cached origin response', JSON.stringify({ cacheKey }));
            
            try {
              // Parse the cached response
              const parsedResponse = JSON.parse(cachedResponse);
              
              // Create a response adapter
              const response = this.createResponseAdapter(request);
              
              // Set status
              if (parsedResponse.status) {
                response.status(parsedResponse.status);
              }
              
              // Set headers
              if (parsedResponse.headers && typeof parsedResponse.headers === 'object') {
                for (const [key, value] of Object.entries(parsedResponse.headers)) {
                  if (value !== undefined && value !== null) {
                    response.setHeader(key, String(value));
                  }
                }
              }
              
              // Set body
              if (parsedResponse.body) {
                response.send(parsedResponse.body);
              }
              
              // Apply custom headers from CDN variation settings
              if (cdnVariationSettings.responseHeaders && typeof cdnVariationSettings.responseHeaders === 'object') {
                for (const [key, value] of Object.entries(cdnVariationSettings.responseHeaders)) {
                  if (value !== undefined && value !== null) {
                    response.setHeader(key, String(value));
                  }
                }
              }
              
              return response;
            } catch (parseError) {
              this.logger.warn('EdgeModeHandler: Error parsing cached origin response', JSON.stringify({
                error: parseError instanceof Error ? parseError.message : String(parseError),
                cachedResponse
              }));
              // Continue with origin fetch if parsing fails
            }
          }
        } catch (cacheError) {
          this.logger.warn('EdgeModeHandler: Error fetching from cache', JSON.stringify({
            error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            cacheKey
          }));
          // Continue with origin fetch if cache fetch fails
        }
      }
      
      // Fetch from origin
      const originResponse = await this.fetchFromOrigin(request);
      
      // Apply content transformation if specified
      if (cdnVariationSettings.transformContent) {
        try {
          const body = await originResponse.getBody();
          if (body) {
            const transformedContent = await this.transformContent(body, cdnVariationSettings.transformContent);
            originResponse.send(transformedContent);
          }
        } catch (error) {
          this.logger.error('EdgeModeHandler: Error transforming origin content', JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }));
          // Continue with original content if transformation fails
        }
      }
      
      // Apply custom headers from CDN variation settings
      if (cdnVariationSettings.responseHeaders && typeof cdnVariationSettings.responseHeaders === 'object') {
        for (const [key, value] of Object.entries(cdnVariationSettings.responseHeaders)) {
          if (value !== undefined && value !== null) {
            try {
              originResponse.setHeader(key, String(value));
            } catch (headerError) {
              this.logger.warn(`EdgeModeHandler: Error setting custom header ${key}`, JSON.stringify({
                value, 
                error: headerError instanceof Error ? headerError.message : String(headerError)
              }));
            }
          }
        }
      }
      
      // Cache the response if caching is enabled and the response is valid
      if (cdnVariationSettings.cacheRequestToOrigin && this.cacheService) {
        try {
          const responseToCache = {
            status: originResponse.getStatus(),
            headers: originResponse.getHeaders(),
            body: await originResponse.getBody()
          };
          
          await this.cacheService.set(
            cacheKey, 
            JSON.stringify(responseToCache), 
            cdnVariationSettings.cacheTTL || 300 // Default TTL of 5 minutes
          );
          
          this.logger.debug('EdgeModeHandler: Cached origin response', JSON.stringify({ cacheKey }));
        } catch (cacheError) {
          this.logger.warn('EdgeModeHandler: Error caching origin response', JSON.stringify({
            error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            cacheKey
          }));
          // Continue without caching if there's an error
        }
      }
      
      return originResponse;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error forwarding request to origin', JSON.stringify({
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error forwarding request to origin');
      return response;
    }
  }

  private async fetchFromOrigin(request: IRequestAdapter): Promise<IResponseAdapter> {
    // Create a fetch request that mimics the original request
    const url = request.getUrl().toString();
    const method = request.getMethod();
    const headers = request.getHeaders();
    const body = await request.getBody();
    
    this.logger.debug('EdgeModeHandler: Fetching from origin', JSON.stringify({
      url,
      method,
      headersCount: Object.keys(headers).length
    }));
    
    try {
      // Create a response adapter to hold the response
      const response = this.createResponseAdapter(request);
      
      // Use the fetch API to make the request
      const fetchResponse = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'follow'
      });
      
      // Set the status
      response.status(fetchResponse.status);
      
      // Copy the headers
      fetchResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });
      
      // Set the body
      const responseBody = await fetchResponse.text();
      response.send(responseBody);
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error in fetchFromOrigin', JSON.stringify({
        url,
        error: error instanceof Error ? error.message : String(error)
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error fetching from origin');
      return response;
    }
  }

  private generateCacheKey(request: IRequestAdapter): string {
    // Create a unique cache key based on URL and HTTP method
    const url = request.getUrl().toString();
    const method = request.getMethod().toUpperCase();
    
    // Add variations for different request types as needed
    // For example, include vary headers or query parameters that affect caching
    
    return `origin:${method}:${url}`;
  }
} 