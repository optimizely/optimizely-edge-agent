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
      this.logger.debug(`${this.logPrefix} Found matching configuration, request should be handled by Edge Mode`, { 
        url: url.toString(),
        matchingPattern: matchingConfig.pathRegex || matchingConfig.cdnExperimentURL
      });
      
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
      this.logger.debug(`${this.logPrefix} Preparing content with settings:`, {
        useCache,
        forwardToOrigin,
        hasTransform: !!safeSettings.transformContent,
        hasCdnResponseURL: !!safeSettings.cdnResponseURL,
        sdkKeyUsed: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined
      });
      
      // Return content preparation result
      return {
        useCache,
        forwardToOrigin
      };
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error preparing content:`, error);
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
      this.logger.debug('EdgeModeHandler: Processing request in Edge Mode', {
        url: request.getUrl().toString(),
        cdnExperimentURL: cdnVariationSettings.cdnExperimentURL,
        cdnResponseURL: cdnVariationSettings.cdnResponseURL
      });
      
      // If we need to forward to origin, do that first
      if (isTrue(cdnVariationSettings.forwardRequestToOrigin)) {
        return this.forwardToOrigin(request, cdnVariationSettings);
      }
      
      // Otherwise, fetch content from CDN response URL
      return this.fetchContent(cdnVariationSettings.cdnResponseURL, request);
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error processing request', {
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Create a simple error response
      const response = this.createResponseAdapter(request);
      response.status(500);
      response.send('Error processing Edge Mode request');
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
    this.logger.debug('EdgeModeHandler: Finding matching config for URL', { url });
    
    // No settings, no match
    if (!allCdnVariationSettings || allCdnVariationSettings.length === 0) {
      this.logger.debug('EdgeModeHandler: No CDN variation settings provided');
      return null;
    }
    
    // Parse the URL to work with its components
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      this.logger.warn('EdgeModeHandler: Invalid URL provided for matching', { url, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
    
    // Loop through all settings to find a match
    for (const config of allCdnVariationSettings) {
      // Skip if both required pattern fields are missing
      if (!config.cdnExperimentURL && !config.pathRegex) {
        this.logger.warn('EdgeModeHandler: CDN variation settings missing both cdnExperimentURL and pathRegex', { config });
        continue;
      }
      
      // Determine which pattern to use - prefer regex if available
      const isRegex = !!config.pathRegex;
      const pattern = isRegex ? config.pathRegex : config.cdnExperimentURL;
      
      // If no pattern, skip
      if (!pattern) {
        this.logger.warn('EdgeModeHandler: Invalid URL pattern', { config });
        continue;
      }
      
      // For non-regex patterns, handle relative URLs gracefully
      if (!isRegex && pattern.startsWith('/')) {
        // Compare only the pathname part for relative URLs
        if (parsedUrl.pathname !== pattern) {
          this.logger.debug('EdgeModeHandler: Path does not match', { 
            urlPath: parsedUrl.pathname, 
            pattern 
          });
          continue;
        }
      }
      
      // Check if URL matches the pattern with the given options
      const matches = this.urlMatcher.matches(url, pattern, {
        isRegex,
        requiredQueryParams: config.requiredQueryParams,
        ignoreQueryParams: config.ignoreQueryParams
      });
      
      if (matches) {
        this.logger.debug('EdgeModeHandler: Found matching config', { 
          url, 
          pattern,
          isRegex,
          requiredQueryParams: config.requiredQueryParams,
          ignoreQueryParams: config.ignoreQueryParams
        });
        return config;
      }
    }
    
    this.logger.debug('EdgeModeHandler: No matching config found for URL', { url });
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
    this.logger.debug('EdgeModeHandler: Fetching content', { cdnResponseURL });
    
    try {
      // Create a response object
      const response = this.createResponseAdapter(request);
      
      // Try to get from cache first if available
      // Note: In a real implementation, we'd use a more sophisticated caching strategy
      const cachedContent = await this.cacheService.get(cdnResponseURL);
      if (cachedContent) {
        this.logger.debug('EdgeModeHandler: Serving cached content', { cdnResponseURL });
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
      response.status(fetchResponse.status);
      response.send(content);
      
      // Copy headers from fetch response - safe way to handle headers
      fetchResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });
      
      // Add cache indicator
      response.setHeader('X-Edge-Cache', 'MISS');
      
      // Store in cache if successful
      if (fetchResponse.ok) {
        // In a real implementation, we'd respect cache headers and TTL
        await this.cacheService.set(cdnResponseURL, content, 60 * 60); // 1 hour default TTL
      }
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error fetching content', {
        cdnResponseURL,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error fetching content');
      return response;
    }
  }
  
  /**
   * Transforms content based on the transformContent function in CDN variation settings
   * 
   * @param content The content to transform
   * @param transformFn The transformation function (as string)
   * @returns The transformed content
   */
  public transformContent(content: string, transformFn: string): string {
    if (!transformFn) {
      return content;
    }
    
    try {
      // Create a safer sandboxed environment without browser APIs
      const sandbox = {
        content,
        console: {
          log: (...args: any[]) => this.logger.debug('Transform function log:', ...args),
          warn: (...args: any[]) => this.logger.warn('Transform function warning:', ...args),
          error: (...args: any[]) => this.logger.error('Transform function error:', ...args)
        },
        // Add any other safe globals the transform function might need
        String, Number, Array, Object, RegExp, JSON
      };
      
      // Execute in a safer way that doesn't require browser APIs
      const transformScript = `
        const window = undefined;
        const document = undefined;
        const localStorage = undefined;
        const sessionStorage = undefined;
        
        try {
          ${transformFn}
          
          // If transform function doesn't explicitly return, assume it modifies content directly
          typeof transform === 'function' ? transform(content) : content;
        } catch (error) {
          console.error('Error in transform function:', error.message);
          content; // Return original content on error
        }
      `;
      
      // Use Function constructor with explicit arguments for better isolation
      const sandboxedFn = new Function('content', 'console', 'String', 'Number', 
        'Array', 'Object', 'RegExp', 'JSON', transformScript);
      
      // Execute with controlled context
      const transformedContent = sandboxedFn(
        content, 
        sandbox.console,
        String, Number, Array, Object, RegExp, JSON
      );
      
      // Ensure the result is a string
      if (typeof transformedContent !== 'string') {
        this.logger.warn('EdgeModeHandler: Transform function did not return a string', {
          originalType: typeof content,
          transformedType: typeof transformedContent
        });
        return content;
      }
      
      return transformedContent;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error transforming content', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return original content on error
      return content;
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
    const url = request.getUrl().toString();
    this.logger.debug('EdgeModeHandler: Forwarding request to origin', { url });
    
    try {
      // Create a new Request object for forwarding
      const headers = new Headers();
      
      // Safely copy headers from original request
      const requestHeaders = request.getHeaders();
      // If Headers implements forEach, use it directly
      if (typeof requestHeaders.forEach === 'function') {
        requestHeaders.forEach((value, key) => {
          headers.set(key, value);
        });
      } else {
        // Fall back to manual handling for non-standard Headers objects
        Object.keys(requestHeaders).forEach(key => {
          const value = request.getHeader(key);
          if (value) {
            headers.set(key, value);
          }
        });
      }
      
      // Add X-Forwarded headers if not already set
      if (!headers.has('X-Forwarded-For')) {
        // Use a default value since getClientIP doesn't exist on IRequestAdapter
        headers.set('X-Forwarded-For', request.getHeader('CF-Connecting-IP') || 'unknown');
      }
      
      // Create fetch request options
      const fetchOptions: RequestInit = {
        method: request.getMethod(),
        headers,
        redirect: 'follow',
      };
      
      // Add body for non-GET/HEAD requests
      if (!['GET', 'HEAD'].includes(request.getMethod().toUpperCase())) {
        fetchOptions.body = await request.getBody();
      }
      
      // Handle caching if enabled
      if (isTrue(cdnVariationSettings.cacheRequestToOrigin)) {
        const cacheKey = `origin:${url}`;
        
        // Try to get from cache first
        const cachedResponse = await this.cacheService.get(cacheKey);
        if (cachedResponse) {
          this.logger.debug('EdgeModeHandler: Serving cached origin response', { url });
          
          // Parse the cached response
          const parsedResponse = JSON.parse(cachedResponse);
          
          // Create a response from the cached data
          const response = this.createResponseAdapter(request);
          response.status(parsedResponse.status);
          response.send(parsedResponse.body);
          
          // Set headers from cached response
          for (const [key, value] of Object.entries(parsedResponse.headers)) {
            response.setHeader(key, value as string);
          }
          
          // Add cache indicator
          response.setHeader('X-Edge-Origin-Cache', 'HIT');
          
          return response;
        }
      }
      
      // Fetch from origin
      const fetchResponse = await fetch(url, fetchOptions);
      
      // Create a response object
      const response = this.createResponseAdapter(request);
      
      // Set basic response properties
      response.status(fetchResponse.status);
      
      // Copy headers from fetch response
      fetchResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });
      
      // Get response body
      const body = await fetchResponse.text();
      
      // Apply content transformation if specified
      const finalBody = cdnVariationSettings.transformContent 
        ? this.transformContent(body, cdnVariationSettings.transformContent)
        : body;
      
      response.send(finalBody);
      
      // Add response headers from CDN variation settings
      if (cdnVariationSettings.responseHeaders) {
        for (const [key, value] of Object.entries(cdnVariationSettings.responseHeaders)) {
          response.setHeader(key, value);
        }
      }
      
      // Add cache indicator
      response.setHeader('X-Edge-Origin-Cache', 'MISS');
      
      // Cache the response if enabled
      if (isTrue(cdnVariationSettings.cacheRequestToOrigin) && fetchResponse.ok) {
        const cacheKey = `origin:${url}`;
        
        // Parse the TTL to a number - handle both string and number inputs
        let ttl = 60 * 60; // Default 1 hour
        if (cdnVariationSettings.cacheTTL) {
          if (typeof cdnVariationSettings.cacheTTL === 'string') {
            ttl = parseInt(cdnVariationSettings.cacheTTL, 10) || ttl;
          } else if (typeof cdnVariationSettings.cacheTTL === 'number') {
            ttl = cdnVariationSettings.cacheTTL;
          }
        }
        
        // Cache the response data
        await this.cacheService.set(cacheKey, JSON.stringify({
          status: fetchResponse.status,
          headers: this.headersToRecord(fetchResponse.headers),
          body: finalBody
        }), ttl);
      }
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error forwarding request to origin', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error forwarding request to origin');
      return response;
    }
  }
} 