import { IURLMatcher } from '../interfaces/IURLMatcher';
import { IEdgeModeHandler } from '../interfaces/IEdgeModeHandler';
import { IContentFetcher } from '../interfaces/IContentFetcher';
import { ICacheManager, CacheStrategyOptions } from '../interfaces/ICacheManager';
import { IContentTransformer } from '../interfaces/IContentTransformer';
import { IRequestForwarder, RequestForwardOptions } from '../interfaces/IRequestForwarder';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IMetricsAdapter } from '../../adapters/interfaces/IMetricsAdapter';
import { OptimizelyUserContext, IDecisionService } from '../interfaces/IDecisionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for the EdgeModeIntegration service.
 */
export interface IEdgeModeIntegration {
  /**
   * Processes a request through the Edge Mode pipeline.
   * @param requestAdapter - The adapter for the incoming request.
   * @param userContext - The Optimizely user context for decisions.
   * @param requestId - Optional request ID for tracking.
   * @returns A promise resolving to the Response object.
   */
  processEdgeModeRequest(
    requestAdapter: IRequestAdapter,
    userContext: OptimizelyUserContext,
    requestId?: string
  ): Promise<Response>;
}

/**
 * Service that integrates all Edge Mode components to handle requests.
 * Acts as a composition layer for the Edge Mode pipeline.
 */
export class EdgeModeIntegration implements IEdgeModeIntegration {
  private urlMatcher: IURLMatcher;
  private edgeModeHandler: IEdgeModeHandler;
  private contentFetcher: IContentFetcher;
  private cacheManager: ICacheManager;
  private contentTransformer: IContentTransformer;
  private requestForwarder: IRequestForwarder;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | null;
  private readonly logPrefix = '[v2][EdgeModeIntegration]';
  private decisionService: IDecisionService;

  /**
   * Creates a new EdgeModeIntegration instance.
   * @param urlMatcher - Service for matching URLs against patterns.
   * @param edgeModeHandler - Service for handling Edge Mode logic.
   * @param contentFetcher - Service for fetching content from origins.
   * @param cacheManager - Service for managing cache operations.
   * @param contentTransformer - Service for transforming content.
   * @param requestForwarder - Service for forwarding requests to origins.
   * @param logger - Logger adapter.
   * @param decisionService - Service for making Optimizely decisions.
   * @param metrics - Optional metrics adapter for performance tracking.
   */
  constructor(
    urlMatcher: IURLMatcher,
    edgeModeHandler: IEdgeModeHandler,
    contentFetcher: IContentFetcher,
    cacheManager: ICacheManager,
    contentTransformer: IContentTransformer,
    requestForwarder: IRequestForwarder,
    logger: ILoggerAdapter,
    decisionService: IDecisionService,
    metrics?: IMetricsAdapter
  ) {
    // Validate required dependencies
    if (!urlMatcher || !edgeModeHandler || !contentFetcher || 
        !cacheManager || !contentTransformer || !requestForwarder || !logger || !decisionService) {
      throw new Error("EdgeModeIntegration requires all components to be provided");
    }

    this.urlMatcher = urlMatcher;
    this.edgeModeHandler = edgeModeHandler;
    this.contentFetcher = contentFetcher;
    this.cacheManager = cacheManager;
    this.contentTransformer = contentTransformer;
    this.requestForwarder = requestForwarder;
    this.logger = logger;
    this.decisionService = decisionService;
    this.metrics = metrics || null;

    this.logger.info(`${this.logPrefix} Initialized with all required components`);

    if (this.metrics) {
      this.logger.info(`${this.logPrefix} Metrics tracking enabled`);
    }
  }

  /**
   * Processes a request through the Edge Mode pipeline.
   * @param requestAdapter - The adapter for the incoming request.
   * @param userContext - The Optimizely user context for decisions.
   * @param requestId - Optional request ID for tracking.
   * @returns A promise resolving to the Response object.
   */
  async processEdgeModeRequest(
    requestAdapter: IRequestAdapter,
    userContext: OptimizelyUserContext,
    requestId?: string
  ): Promise<Response> {
    // Generate a request ID if not provided
    const reqId = requestId || uuidv4();
    
    // Start request timer if metrics are available
    const requestTimer = this.metrics?.startTimer('edge_mode_pipeline_duration', {
      method: requestAdapter.getMethod(),
      path: requestAdapter.getUrl().pathname
    });

    try {
      this.logger.info(`${this.logPrefix} Processing Edge Mode request ${reqId} for URL: ${requestAdapter.getUrl().toString()}`);

      // Step 1: Check if this request should be handled by Edge Mode
      const shouldHandleTimer = this.metrics?.startTimer('should_handle_duration');
      const shouldHandle = await this.edgeModeHandler.shouldHandleRequest(requestAdapter, userContext);
      if (shouldHandleTimer) shouldHandleTimer.stop();

      // Ensure variationSettings is not null or undefined
      if (!shouldHandle.handle || !shouldHandle.variationSettings || shouldHandle.variationSettings.length === 0) {
        this.logger.info(`${this.logPrefix} Request ${reqId} not eligible for Edge Mode: ${shouldHandle.reason || 'No variation settings available'}`);
        this.metrics?.incrementCounter('edge_mode_eligibility', 1, { eligible: 'false' });
        
        // Forward to origin as default behavior with minimal options
        const forwardOptions: RequestForwardOptions = {
          targetUrl: requestAdapter.getUrl().toString(), // Use current URL
          followRedirects: true,
          timeout: 30000
        };
        
        this.logger.debug(`${this.logPrefix} Forwarding to origin URL: ${forwardOptions.targetUrl}`);
        
        const forwardResponse = await this.requestForwarder.forwardRequest(requestAdapter, forwardOptions);
        return new Response(forwardResponse.body, {
          status: forwardResponse.status,
          headers: forwardResponse.headers
        });
      }

      this.metrics?.incrementCounter('edge_mode_eligibility', 1, { eligible: 'true' });
      
      // Step 2: Match URL against patterns - use empty array as fallback
      const matchTimer = this.metrics?.startTimer('url_matching_duration');
      const matchResult = await this.urlMatcher.findMatch(
        requestAdapter.getUrl().toString(),
        shouldHandle.variationSettings || []
      );
      if (matchTimer) matchTimer.stop();

      if (!matchResult.matched || !matchResult.settings) {
        this.logger.info(`${this.logPrefix} No URL match found for request ${reqId}`);
        this.metrics?.incrementCounter('url_match_found', 1, { matched: 'false' });
        
        // Forward to origin if no match with default options using current URL
        const forwardOptions: RequestForwardOptions = {
          targetUrl: requestAdapter.getUrl().toString(), // Use current URL
          followRedirects: true,
          timeout: 30000
        };
        
        this.logger.debug(`${this.logPrefix} No match found. Forwarding to origin URL: ${forwardOptions.targetUrl}`);
        
        const forwardResponse = await this.requestForwarder.forwardRequest(requestAdapter, forwardOptions);
        return new Response(forwardResponse.body, {
          status: forwardResponse.status,
          headers: forwardResponse.headers
        });
      }

      this.metrics?.incrementCounter('url_match_found', 1, { matched: 'true' });
      
      // Log with null check for cdnExperimentURL
      const experimentURL = matchResult.settings.cdnExperimentURL || 'undefined';
      this.logger.info(`${this.logPrefix} URL match found for request ${reqId}: ${experimentURL}`);

      // Ensure settings is not null
      const safeSettings = matchResult.settings || {};

      // Step 3: Prepare the content
      const contentPreparationTimer = this.metrics?.startTimer('content_preparation_duration');
      const contentResult = await this.edgeModeHandler.prepareContent(
        safeSettings,
        userContext,
        requestAdapter
      );
      if (contentPreparationTimer) contentPreparationTimer.stop();

      // Step 4: Handle based on content result
      if (contentResult.forwardToOrigin) {
        this.logger.info(`${this.logPrefix} Forwarding request ${reqId} to origin`);
        this.metrics?.incrementCounter('request_handling', 1, { type: 'forward' });
        
        // Check cache first if enabled
        if (contentResult.useCache) {
          const cacheKey = this.cacheManager.generateCacheKey(
            requestAdapter.getUrl().toString(),
            { settings: JSON.stringify(safeSettings) }
          );
          
          const cachedResultOp = await this.cacheManager.get<{
            content: string;
            status: number;
            headers: Record<string, string>;
          }>(cacheKey);
          const cachedResult = cachedResultOp.success ? cachedResultOp.value : null;
          
          if (cachedResult) {
            this.logger.info(`${this.logPrefix} Cache hit for request ${reqId}`);
            this.metrics?.incrementCounter('cache_status', 1, { status: 'hit' });
            
            // Apply any transformations if transformContent exists
            if (safeSettings.transformContent) {
              const transformResult = await this.contentTransformer.transformWithFunction(
                cachedResult.content,
                safeSettings.transformContent,
                { contentType: 'text/html' }  // Assume HTML content type
              );
              
              return new Response(transformResult.content, {
                status: cachedResult.status || 200,
                headers: cachedResult.headers || {}
              });
            }
            
            return new Response(cachedResult.content, {
              status: cachedResult.status || 200,
              headers: cachedResult.headers || {}
            });
          }
          
          this.metrics?.incrementCounter('cache_status', 1, { status: 'miss' });
          this.logger.info(`${this.logPrefix} Cache miss for request ${reqId}`);
        }
        
        // Get the current URL as fallback
        const currentUrl = requestAdapter.getUrl().toString();
        
        // Determine which query parameters to remove (especially Optimizely-specific ones)
        const optimizelyParams = ['optimizely_token', 'optimizely_x', 'optimizely_opt_out', 'optimizely_disable', 'sdkKey'];
        
        // Properly check cdnResponseURL and provide logging for debugging
        if (!safeSettings.cdnResponseURL) {
          this.logger.warn(`${this.logPrefix} Missing cdnResponseURL in variation settings, using current URL as fallback`);
        }
        
        // Forward the request to origin with proper fallback for targetUrl
        const forwardOptions: RequestForwardOptions = {
          targetUrl: safeSettings.cdnResponseURL || currentUrl, // Use currentUrl as fallback
          followRedirects: true,
          timeout: 30000,
          removeQueryParams: optimizelyParams // Remove Optimizely-specific query parameters when forwarding
        };
        
        // Log the target URL for debugging
        this.logger.debug(`${this.logPrefix} Forwarding to target URL: ${forwardOptions.targetUrl}`);
        
        try {
          const forwardResponse = await this.requestForwarder.forwardRequest(
            requestAdapter,
            forwardOptions
          );
          
          // Cache the response if enabled
          if (contentResult.useCache) {
            const cacheKey = this.cacheManager.generateCacheKey(
              requestAdapter.getUrl().toString(),
              { settings: JSON.stringify(safeSettings) }
            );
            
            // Cast to any to bypass the type checking issues
            const cacheOptions: any = {
              ttl: safeSettings.cacheTTL || "3600"
            };
            
            await this.cacheManager.set(
              cacheKey,
              {
                content: forwardResponse.body,
                headers: forwardResponse.headers,
                status: forwardResponse.status
              },
              cacheOptions
            );
            
            this.logger.info(`${this.logPrefix} Cached response for request ${reqId}`);
          }
          
          // Apply any transformations if transformContent exists
          let responseBody = forwardResponse.body;
          if (safeSettings.transformContent) {
            const transformResult = await this.contentTransformer.transformWithFunction(
              responseBody,
              safeSettings.transformContent,
              { contentType: 'text/html' }
            );
            responseBody = transformResult.content;
            this.logger.info(`${this.logPrefix} Transformed content for request ${reqId}`);
          }
          
          return new Response(responseBody, {
            status: forwardResponse.status,
            headers: forwardResponse.headers
          });
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error forwarding request ${reqId}:`, error);
          
          // Return error response with fallback behavior
          // Instead of returning an error, we'll forward to the original URL as a last resort
          this.logger.info(`${this.logPrefix} Falling back to direct forwarding of original request for ${reqId}`);
          
          try {
            // Simple fallback forward request to the original URL
            const fallbackOptions: RequestForwardOptions = {
              targetUrl: currentUrl,
              followRedirects: true,
              timeout: 30000,
              removeQueryParams: optimizelyParams
            };
            
            const fallbackResponse = await this.requestForwarder.forwardRequest(
              requestAdapter,
              fallbackOptions
            );
            
            return new Response(fallbackResponse.body, {
              status: fallbackResponse.status,
              headers: fallbackResponse.headers
            });
          } catch (fallbackError) {
            // If even the fallback fails, return a meaningful error
            this.logger.error(`${this.logPrefix} Fallback forwarding also failed for ${reqId}:`, fallbackError);
            
            return new Response(
              JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to forward request, both primary and fallback mechanisms failed.'
              }),
              {
                status: 502,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Request-ID': reqId
                }
              }
            );
          }
        }
      } else {
        // Serve content directly
        this.logger.info(`${this.logPrefix} Serving direct content for request ${reqId}`);
        this.metrics?.incrementCounter('request_handling', 1, { type: 'direct' });
        
        // Check cache first
        const cacheKey = this.cacheManager.generateCacheKey(
          requestAdapter.getUrl().toString(),
          { settings: JSON.stringify(safeSettings) }
        );
        const cachedResultOp = await this.cacheManager.get<{
          content: string;
          status: number;
          headers: Record<string, string>;
        }>(cacheKey);
        const cachedResult = cachedResultOp.success ? cachedResultOp.value : null;
        
        if (cachedResult) {
          this.logger.info(`${this.logPrefix} Cache hit for direct content ${reqId}`);
          this.metrics?.incrementCounter('cache_status', 1, { status: 'hit' });
          
          // Apply any transformations if transformContent exists
          if (safeSettings.transformContent) {
            const transformResult = await this.contentTransformer.transformWithFunction(
              cachedResult.content,
              safeSettings.transformContent,
              { contentType: 'text/html' }
            );
            
            return new Response(transformResult.content, {
              status: cachedResult.status || 200,
              headers: cachedResult.headers || {}
            });
          }
          
          return new Response(cachedResult.content, {
            status: cachedResult.status || 200,
            headers: cachedResult.headers || {}
          });
        }
        
        this.metrics?.incrementCounter('cache_status', 1, { status: 'miss' });
        this.logger.info(`${this.logPrefix} Cache miss for direct content ${reqId}`);
        
        // Get default URL as fallback
        const currentUrl = requestAdapter.getUrl().toString();
        
        // Make sure cdnResponseURL is not null or empty
        if (!safeSettings.cdnResponseURL) {
          this.logger.warn(`${this.logPrefix} Missing cdnResponseURL in variation settings, using current URL as fallback`);
        }
        
        const responseUrl = safeSettings.cdnResponseURL || currentUrl;
        this.logger.debug(`${this.logPrefix} Fetching content from URL: ${responseUrl}`);
        
        try {
          // Fetch the content with proper URL fallback
          const fetchTimer = this.metrics?.startTimer('content_fetch_duration');
          const contentResponse = await this.contentFetcher.fetchContent(
            responseUrl,
            requestAdapter,
            { timeout: 10000 }
          );
          if (fetchTimer) fetchTimer.stop();
          
          // Cache the content if enabled
          if (contentResult.useCache) {
            const cacheKey = this.cacheManager.generateCacheKey(
              requestAdapter.getUrl().toString(),
              { settings: JSON.stringify(safeSettings) }
            );
            
            // Cast to any to bypass the type checking issues
            const cacheOptions: any = {
              ttl: safeSettings.cacheTTL || "3600"
            };
            
            await this.cacheManager.set(
              cacheKey,
              {
                content: contentResponse.response.getBody(),
                headers: this.convertHeadersToRecord(contentResponse.response.getHeaders()),
                status: contentResponse.response.getStatus()
              },
              cacheOptions
            );
            
            this.logger.info(`${this.logPrefix} Cached direct content for request ${reqId}`);
          }
          
          // Apply any transformations if transformContent exists
          let finalContent = contentResponse.response.getBody();
          if (safeSettings.transformContent) {
            const transformTimer = this.metrics?.startTimer('transform_duration');
            const transformResult = await this.contentTransformer.transformWithFunction(
              finalContent,
              safeSettings.transformContent,
              { contentType: 'text/html' }
            );
            finalContent = transformResult.content;
            if (transformTimer) transformTimer.stop();
            this.logger.info(`${this.logPrefix} Transformed direct content for request ${reqId}`);
          }
          
          return new Response(finalContent, {
            status: contentResponse.response.getStatus(),
            headers: this.convertHeadersToRecord(contentResponse.response.getHeaders())
          });
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error fetching direct content for ${reqId}:`, error);
          
          // Return error response with fallback behavior
          // Instead of returning an error, we'll forward to the original URL as a last resort
          this.logger.info(`${this.logPrefix} Falling back to direct forwarding of original request for ${reqId}`);
          
          try {
            // Define Optimizely-specific params to remove
            const optimizelyParams = ['optimizely_token', 'optimizely_x', 'optimizely_opt_out', 'optimizely_disable', 'sdkKey'];
            
            // Simple fallback forward request to the original URL
            const fallbackOptions: RequestForwardOptions = {
              targetUrl: currentUrl,
              followRedirects: true,
              timeout: 30000,
              removeQueryParams: optimizelyParams
            };
            
            const fallbackResponse = await this.requestForwarder.forwardRequest(
              requestAdapter,
              fallbackOptions
            );
            
            return new Response(fallbackResponse.body, {
              status: fallbackResponse.status,
              headers: fallbackResponse.headers
            });
          } catch (fallbackError) {
            // If even the fallback fails, return a meaningful error
            this.logger.error(`${this.logPrefix} Fallback forwarding also failed for ${reqId}:`, fallbackError);
            
            return new Response(
              JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to fetch content, both primary and fallback mechanisms failed.'
              }),
              {
                status: 502,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Request-ID': reqId
                }
              }
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error processing Edge Mode request ${reqId}:`, error);
      
      // Track error metrics
      this.metrics?.incrementCounter('edge_mode_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      
      // Return error response
      return new Response(
        JSON.stringify({
          error: 'Error processing Edge Mode request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': reqId
          }
        }
      );
    } finally {
      // Stop request timer
      if (requestTimer) {
        requestTimer.stop();
      }
    }
  }

  private convertHeadersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
} 