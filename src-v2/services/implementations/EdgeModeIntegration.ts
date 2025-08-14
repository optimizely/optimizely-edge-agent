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
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { createFormattedResponse, fixContentTypeForHtml } from '../../utils/responseUtils';

/**
 * Interface for the EdgeModeIntegration service.
 */
export interface IEdgeModeIntegration {
  /**
   * Processes a request through the Edge Mode pipeline.
   * @param requestAdapter - The adapter for the incoming request.
   * @param userContext - The Optimizely user context for decisions.
   * @param decisions - Pre-fetched decisions to use instead of making a new call.
   * @param requestId - Optional request ID for tracking.
   * @returns A promise resolving to an EdgeModeResult containing the output from processing.
   */
  processEdgeModeRequest(
    requestAdapter: IRequestAdapter,
    userContext: OptimizelyUserContext,
    decisions: Record<string, any>,
    requestId?: string
  ): Promise<EdgeModeResult>;
}

/**
 * Represents the result of Edge Mode processing.
 * This provides a clear indication of what happened during processing.
 */
export type EdgeModeResult =
  | { type: 'PROXIED_FALLBACK'; body: string; status: number }
  | { type: 'STANDARD_RESPONSE'; response: Response }
  | { type: 'ERROR'; body: string; status: number };

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
  private configService: IConfigurationService;
  // DEV ENVIRONMENT CONSTANTS - For local development support
  private readonly localHostnames = ['127.0.0.1', 'localhost'];
  private readonly localPorts = ['8787', '9797', '']; // '' when default port is implied, 9797 for Vercel dev
  private devProxyBaseUrl = 'https://edgeagent.demo.optimizely.com';
  private readonly debugHeaders = ['x-optimizely-debug-local', 'x-optimizely-test-local', 'x-edge-debug'];

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
   * @param configService - Service for configuration settings.
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
    configService: IConfigurationService,
    metrics?: IMetricsAdapter,
    devProxyBaseUrl?: string
  ) {
    // Validate required dependencies
    if (!urlMatcher || !edgeModeHandler || !contentFetcher || 
        !cacheManager || !contentTransformer || !requestForwarder || !logger || !decisionService || !configService) {
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
    this.configService = configService;

    // Override dev proxy URL if provided
    if (devProxyBaseUrl) {
      this.devProxyBaseUrl = devProxyBaseUrl;
    }

    this.logger.info(`${this.logPrefix} Initialized with all required components, dev proxy URL: ${this.devProxyBaseUrl}`);

    if (this.metrics) {
      this.logger.info(`${this.logPrefix} Metrics tracking enabled`);
    }
  }

  /**
   * Processes a request through the Edge Mode pipeline.
   * @param requestAdapter - The adapter for the incoming request.
   * @param userContext - The Optimizely user context for decisions.
   * @param decisions - Pre-fetched decisions to use instead of making a new call.
   * @param requestId - Optional request ID for tracking.
   * @returns A promise resolving to an EdgeModeResult containing the output from processing.
   */
  async processEdgeModeRequest(
    requestAdapter: IRequestAdapter,
    userContext: OptimizelyUserContext,
    decisions: Record<string, any>,
    requestId?: string
  ): Promise<EdgeModeResult> {
    // Generate a request ID if not provided
    const reqId = requestId || uuidv4();
    
    // Start request timer if metrics are available
    const requestTimer = this.metrics?.startTimer('edge_mode_pipeline_duration', {
      method: requestAdapter.getMethod(),
      path: requestAdapter.getUrl().pathname
    });

    try {
      this.logger.info(`${this.logPrefix} Processing Edge Mode request ${reqId} for URL: ${requestAdapter.getUrl().toString()}`);

      // LOOP DETECTION: Check if this request already has a loop detection header
      // or has been forwarded by the edge agent previously
      const hasLoopHeader = requestAdapter.getHeader('x-loop-detected') === 'true';
      const forwardedBy = requestAdapter.getHeader('x-forwarded-by');
      const isLoopDetected = hasLoopHeader || (forwardedBy && forwardedBy.toLowerCase() === 'edgeagent');
      
      if (isLoopDetected) {
        this.logger.error(`${this.logPrefix} Loop detected for request ${reqId} - aborting to prevent infinite loop`);
        this.metrics?.incrementCounter('edge_mode_errors', 1, { error_type: 'loop_detected' });
        
        return {
          type: 'PROXIED_FALLBACK',
          body: JSON.stringify({
            error: 'Request loop detected',
            message: 'This request has already been processed by the Edge Agent and cannot be forwarded to prevent an infinite loop.'
          }),
          status: 508
        };
      }

      // Step 1: Check if this request should be handled by Edge Mode
      // Use the pre-fetched decisions instead of making a new call to DecisionService
      this.logger.debug(`${this.logPrefix} Checking if request should be handled with decisions:`, {
        decisionsKeys: Object.keys(decisions),
        userContext: userContext,
        url: requestAdapter.getUrl().toString()
      });
      
      const shouldHandleTimer = this.metrics?.startTimer('should_handle_duration');
      const shouldHandle = await this.edgeModeHandler.shouldHandleRequestWithDecisions(requestAdapter, userContext, decisions);
      if (shouldHandleTimer) shouldHandleTimer.stop();
      
      this.logger.debug(`${this.logPrefix} Should handle result:`, {
        handle: shouldHandle.handle,
        reason: shouldHandle.reason,
        variationSettingsCount: shouldHandle.variationSettings?.length || 0
      });

      // Ensure variationSettings is not null or undefined
      if (!shouldHandle.handle || !shouldHandle.variationSettings || shouldHandle.variationSettings.length === 0) {
        this.logger.info(`${this.logPrefix} Request ${reqId} not eligible for Edge Mode: ${shouldHandle.reason || 'No variation settings available'}`);
        this.metrics?.incrementCounter('edge_mode_eligibility', 1, { eligible: 'false' });
        
        // Check for debug headers that force local Edge Mode processing
        const hasDebugHeader = this.debugHeaders.some(header => 
          requestAdapter.getHeader(header) === 'true' || requestAdapter.getHeader(header) === '1'
        );
        
        // Debug logging for hostname/port detection
        const requestUrl = requestAdapter.getUrl();
        this.logger.debug(`${this.logPrefix} Local host detection:`, {
          hostname: requestUrl.hostname,
          port: requestUrl.port,
          isLocalHostname: this.localHostnames.includes(requestUrl.hostname),
          isLocalPort: this.localPorts.includes(requestUrl.port),
          hasDebugHeader: hasDebugHeader,
          debugHeaders: this.debugHeaders.map(h => ({ header: h, value: requestAdapter.getHeader(h) }))
        });
        
        if (hasDebugHeader) {
          this.logger.info(`${this.logPrefix} Debug mode activated - skipping local dev proxy for local Edge Mode testing`);
        }
        
        // LOCAL-DEV PROXY: If running on localhost/127.* forward the request to 
        // the demo environment UNLESS debug headers are present
        if (!hasDebugHeader && 
            this.localHostnames.includes(requestAdapter.getUrl().hostname) && 
            this.localPorts.includes(requestAdapter.getUrl().port)) {
          
          this.logger.info(`${this.logPrefix} Local-dev proxy activated - forwarding to demo environment`);
          
          // Preserve the path and query parameters from the local request
          // but replace the origin with the demo environment URL
          const proxyUrl = new URL(requestAdapter.getUrl().pathname, this.devProxyBaseUrl);
          
          // Copy all query parameters
          requestAdapter.getUrl().searchParams.forEach((value, key) => {
            proxyUrl.searchParams.set(key, value);
          });
          
          this.logger.info(`${this.logPrefix} Proxying local request to: ${proxyUrl.toString()}`);
          
          try {
            // Fetch directly to get body and status
            const proxyResponse = await fetch(proxyUrl.toString(), {
              method: requestAdapter.getMethod(),
              headers: this.headersToRecord(requestAdapter.getHeaders())
            });
            
            // Return signal object with body/status for RequestHandler
            return {
              type: 'PROXIED_FALLBACK',
              body: await proxyResponse.text(),
              status: proxyResponse.status,
              // Headers from proxyResponse are discarded here - RequestHandler will add correct ones
            } as EdgeModeResult;
          } catch (proxyError) {
            this.logger.error(`${this.logPrefix} Error proxying to demo environment: ${String(proxyError)}`);
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Demo environment proxy error',
                message: `Failed to fetch from ${proxyUrl.toString()}: ${String(proxyError)}`
              }),
              status: 502
            };
          }
        }

        // Forward to origin WITHOUT the X-Forwarded-By header to prevent loops
        const forwardOptions: RequestForwardOptions = {
          targetUrl: requestAdapter.getUrl().toString(),
          followRedirects: true,
          timeout: 30000
          // No X-Forwarded-By header here - prevents loop detection on next pass
        };

        this.logger.debug(`${this.logPrefix} Forwarding to origin URL without loop detection header: ${forwardOptions.targetUrl}`);

        const forwardResponse = await this.requestForwarder.forwardRequest(requestAdapter, forwardOptions);
        
        // CRITICAL DEBUG: Let's directly access cookie headers from the source
        this.logger.debug(`${this.logPrefix} DEBUG: Directly examining response from ${requestAdapter.getUrl().toString()}`);
        
        // Create a direct fetch to bypass any potential header filtering
        try {
          const directResponse = await fetch(requestAdapter.getUrl().toString(), {
            method: requestAdapter.getMethod(),
            headers: this.headersToRecord(requestAdapter.getHeaders()),
            credentials: 'include'
          });
          
          // Log all response headers directly from fetch
          this.logger.debug(`${this.logPrefix} DIRECT RESPONSE HEADERS:`);
          const allHeaders: Record<string, string> = {};
          directResponse.headers.forEach((value, key) => {
            allHeaders[key] = value;
            if (key.toLowerCase() === 'set-cookie') {
              this.logger.debug(`${this.logPrefix} FOUND RAW COOKIE: ${value}`);
            }
          });
          this.logger.debug(JSON.stringify(allHeaders, null, 2));
          
          // Check if there are CORS issues
          const corsHeaders = {
            'Access-Control-Allow-Origin': directResponse.headers.get('access-control-allow-origin'),
            'Access-Control-Allow-Credentials': directResponse.headers.get('access-control-allow-credentials'),
            'Access-Control-Allow-Headers': directResponse.headers.get('access-control-allow-headers')
          };
          this.logger.debug(`${this.logPrefix} CORS HEADERS: ${JSON.stringify(corsHeaders)}`);
        } catch (directError) {
          this.logger.error(`${this.logPrefix} Error in direct fetch debugging: ${String(directError)}`);
        }
        
        // Convert headers to record for the utility function
        const finalHeaders = fixContentTypeForHtml(forwardResponse.body, forwardResponse.headers);
        
        return {
          type: 'STANDARD_RESPONSE',
          response: createFormattedResponse(
            forwardResponse.body,
            forwardResponse.status,
            finalHeaders,
            'application/json'
          )
        };
      }

      this.metrics?.incrementCounter('edge_mode_eligibility', 1, { eligible: 'true' });
      
      // Step 2: Match URL against patterns - we have cdnVariationSettings from flag variable decisions
      const matchTimer = this.metrics?.startTimer('url_matching_duration');
      const matchResult = await this.urlMatcher.findMatch(
        requestAdapter.getUrl().toString(),
        shouldHandle.variationSettings || []
      );
      if (matchTimer) matchTimer.stop();

      if (!matchResult.matched || !matchResult.settings) {
        this.logger.info(`${this.logPrefix} No URL match found for request ${reqId}`);
        this.metrics?.incrementCounter('url_match_found', 1, { matched: 'false' });
        
        // Check for debug headers that force local Edge Mode processing
        const hasDebugHeaderForURLMatch = this.debugHeaders.some(header => 
          requestAdapter.getHeader(header) === 'true' || requestAdapter.getHeader(header) === '1'
        );
        
        // Debug logging for hostname/port detection (URL match fallback)
        const requestUrlForMatch = requestAdapter.getUrl();
        this.logger.debug(`${this.logPrefix} Local host detection (URL match fallback):`, {
          hostname: requestUrlForMatch.hostname,
          port: requestUrlForMatch.port,
          isLocalHostname: this.localHostnames.includes(requestUrlForMatch.hostname),
          isLocalPort: this.localPorts.includes(requestUrlForMatch.port),
          hasDebugHeader: hasDebugHeaderForURLMatch
        });
        
        if (hasDebugHeaderForURLMatch) {
          this.logger.info(`${this.logPrefix} Debug mode activated - skipping local dev proxy for URL match fallback`);
        }
        
        // LOCAL-DEV PROXY: If in local development, proxy to demo environment instead of loop
        // UNLESS debug headers are present
        if (!hasDebugHeaderForURLMatch && 
            this.localHostnames.includes(requestAdapter.getUrl().hostname) && 
            this.localPorts.includes(requestAdapter.getUrl().port)) {
          
          // Create proxy URL with the same path + query parameters
          const reqUrl = requestAdapter.getUrl();
          const proxyUrl = new URL(reqUrl.pathname, this.devProxyBaseUrl);
          
          // Copy all query parameters
          reqUrl.searchParams.forEach((value, key) => {
            proxyUrl.searchParams.set(key, value);
          });
          
          this.logger.info(`${this.logPrefix} Proxying local request (no URL match) to: ${proxyUrl.toString()}`);
          
          try {
            // Fetch directly to get body and status
            const proxyResponse = await fetch(proxyUrl.toString(), {
              method: requestAdapter.getMethod(),
              headers: this.headersToRecord(requestAdapter.getHeaders())
            });
            
            // Return signal object with body/status for RequestHandler
            return {
              type: 'PROXIED_FALLBACK',
              body: await proxyResponse.text(),
              status: proxyResponse.status,
              // Headers from proxyResponse are discarded here - RequestHandler will add correct ones
            } as EdgeModeResult;
          } catch (proxyError) {
            this.logger.error(`${this.logPrefix} Error proxying to demo environment: ${String(proxyError)}`);
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Demo environment proxy error',
                message: `Failed to fetch from ${proxyUrl.toString()}: ${String(proxyError)}`
              }),
              status: 502
            };
          }
        }

        // Forward to origin WITHOUT the X-Forwarded-By header to prevent loops
        const forwardOptions: RequestForwardOptions = {
          targetUrl: requestAdapter.getUrl().toString(),
          followRedirects: true,
          timeout: 30000
          // No X-Forwarded-By header here - prevents loop detection on next pass
        };

        this.logger.debug(`${this.logPrefix} Forwarding to origin URL without loop detection header: ${forwardOptions.targetUrl}`);

        const forwardResponse = await this.requestForwarder.forwardRequest(requestAdapter, forwardOptions);
        
        // CRITICAL DEBUG: Let's directly access cookie headers from the source
        this.logger.debug(`${this.logPrefix} DEBUG: Directly examining response from ${requestAdapter.getUrl().toString()}`);
        
        // Create a direct fetch to bypass any potential header filtering
        try {
          const directResponse = await fetch(requestAdapter.getUrl().toString(), {
            method: requestAdapter.getMethod(),
            headers: this.headersToRecord(requestAdapter.getHeaders()),
            credentials: 'include'
          });
          
          // Log all response headers directly from fetch
          this.logger.debug(`${this.logPrefix} DIRECT RESPONSE HEADERS:`);
          const allHeaders: Record<string, string> = {};
          directResponse.headers.forEach((value, key) => {
            allHeaders[key] = value;
            if (key.toLowerCase() === 'set-cookie') {
              this.logger.debug(`${this.logPrefix} FOUND RAW COOKIE: ${value}`);
            }
          });
          this.logger.debug(JSON.stringify(allHeaders, null, 2));
          
          // Check if there are CORS issues
          const corsHeaders = {
            'Access-Control-Allow-Origin': directResponse.headers.get('access-control-allow-origin'),
            'Access-Control-Allow-Credentials': directResponse.headers.get('access-control-allow-credentials'),
            'Access-Control-Allow-Headers': directResponse.headers.get('access-control-allow-headers')
          };
          this.logger.debug(`${this.logPrefix} CORS HEADERS: ${JSON.stringify(corsHeaders)}`);
        } catch (directError) {
          this.logger.error(`${this.logPrefix} Error in direct fetch debugging: ${String(directError)}`);
        }
        
        // Convert headers to record for the utility function
        const finalHeaders = fixContentTypeForHtml(forwardResponse.body, forwardResponse.headers);
        
        return {
          type: 'STANDARD_RESPONSE',
          response: createFormattedResponse(
            forwardResponse.body,
            forwardResponse.status,
            finalHeaders,
            'application/json'
          )
        };
      }

      this.metrics?.incrementCounter('url_match_found', 1, { matched: 'true' });
      
      // Log match information including flag and variation for traceability
      this.logger.info(`${this.logPrefix} URL match found for request ${reqId}:`, JSON.stringify({
        url: requestAdapter.getUrl().toString(),
        experimentURL: matchResult.settings.cdnExperimentURL || '(none)',
        responseURL: matchResult.settings.cdnResponseURL || '(none)',
        flagKey: matchResult.settings._flagKey || '(unknown)',
        variationKey: matchResult.settings._variationKey || '(unknown)'
      }));

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
      
      // Debug log the content preparation result
      this.logger.debug(`${this.logPrefix} Content preparation result:`, {
        useCache: contentResult.useCache,
        forwardToOrigin: contentResult.forwardToOrigin,
        cacheRequestToOrigin: safeSettings.cacheRequestToOrigin,
        forwardRequestToOrigin: safeSettings.forwardRequestToOrigin
      });

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
              
              // Fix Content-Type for HTML content using the utility
              const finalHeaders = fixContentTypeForHtml(transformResult.content, cachedResult.headers || {});
              
              return {
                type: 'STANDARD_RESPONSE',
                response: createFormattedResponse(
                  transformResult.content,
                  cachedResult.status || 200,
                  finalHeaders,
                  'application/json'
                )
              };
            }
            
            // Fix Content-Type for HTML content using the utility
            const finalHeaders = fixContentTypeForHtml(cachedResult.content, cachedResult.headers || {});
            
            return {
              type: 'STANDARD_RESPONSE',
              response: createFormattedResponse(
                cachedResult.content,
                cachedResult.status || 200,
                finalHeaders,
                'application/json'
              )
            };
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
        const targetUrl = safeSettings.cdnResponseURL || currentUrl;
        
        // Parse URLs to compare hosts for loop prevention
        const currentUrlObj = new URL(currentUrl);
        const targetUrlObj = new URL(targetUrl);
        
        // Only add X-Forwarded-By header when forwarding to a different host
        // This prevents loops when forwarding to the same host
        const forwardOptions: RequestForwardOptions = {
          targetUrl: targetUrl,
          followRedirects: true,
          timeout: 30000,
          removeQueryParams: optimizelyParams, // Remove Optimizely-specific query parameters when forwarding
          headers: { 'X-Forwarded-By': 'EdgeAgent' }
        };
        
        // Add the header ONLY if targeting a different host to prevent loops
        if (targetUrlObj.hostname !== currentUrlObj.hostname) {
          this.logger.info(`${this.logPrefix} Adding X-Forwarded-By header for cross-origin forwarding to ${targetUrlObj.hostname}`);
        } else {
          this.logger.info(`${this.logPrefix} Same-host forwarding detected - skipping X-Forwarded-By header to prevent loops`);
        }
        
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
          
          // Fix Content-Type for HTML content using the utility
          const finalHeaders = fixContentTypeForHtml(responseBody, forwardResponse.headers);
          
          return {
            type: 'STANDARD_RESPONSE',
            response: createFormattedResponse(
              responseBody,
              forwardResponse.status,
              finalHeaders,
              'application/json'
            )
          };
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error forwarding request ${reqId}:`, error);
          
          // Return error response with fallback behavior
          // Instead of returning an error, we'll forward to the original URL as a last resort
          this.logger.info(`${this.logPrefix} Falling back to direct forwarding of original request for ${reqId}`);
          
          try {
            // Define Optimizely-specific params to remove
            const optimizelyParams = ['optimizely_token', 'optimizely_x', 'optimizely_opt_out', 'optimizely_disable', 'sdkKey'];
            
            // Error fallback forwarding options
            const fallbackOptions: RequestForwardOptions = {
              targetUrl: currentUrl,
              followRedirects: true,
              timeout: 30000,
              removeQueryParams: optimizelyParams,
              headers: { 'X-Forwarded-By': 'EdgeAgent' }
            };
            
            // Since this is a fallback to the original URL, we're intentionally not adding
            // the X-Forwarded-By header to prevent loops
            
            const fallbackResponse = await this.requestForwarder.forwardRequest(
              requestAdapter,
              fallbackOptions
            );
            
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to forward request, both primary and fallback mechanisms failed.'
              }),
              status: 502
            };
          } catch (fallbackError) {
            // If even the fallback fails, return a meaningful error
            this.logger.error(`${this.logPrefix} Fallback forwarding also failed for ${reqId}:`, fallbackError);
            
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to forward request, both primary and fallback mechanisms failed.'
              }),
              status: 502
            };
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
            
            // Fix Content-Type for HTML content using the utility
            const finalHeaders = fixContentTypeForHtml(transformResult.content, cachedResult.headers || {});
            
            return {
              type: 'STANDARD_RESPONSE',
              response: createFormattedResponse(
                transformResult.content,
                cachedResult.status || 200,
                finalHeaders,
                'application/json'
              )
            };
          }
          
          // Fix Content-Type for HTML content using the utility
          const finalHeaders = fixContentTypeForHtml(cachedResult.content, cachedResult.headers || {});
          
          return {
            type: 'STANDARD_RESPONSE',
            response: createFormattedResponse(
              cachedResult.content,
              cachedResult.status || 200,
              finalHeaders,
              'application/json'
            )
          };
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
          
          // Get the body content from the response adapter
          const bodyContent = contentResponse.response.getBody();
          
          this.logger.info(`${this.logPrefix} ContentFetcher returned body`, {
            bodyLength: bodyContent.length,
            first100: bodyContent.substring(0, 100),
            hasContent: bodyContent.length > 0
          });
          
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
                content: bodyContent,
                headers: this.convertHeadersToRecord(contentResponse.response.getHeaders()),
                status: contentResponse.response.getStatus()
              },
              cacheOptions
            );
            
            this.logger.info(`${this.logPrefix} Cached direct content for request ${reqId}`);
          }
          
          // Apply any transformations if transformContent exists
          let finalContent = bodyContent;
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
          
          // Convert headers and fix Content-Type for HTML content using the utility
          const responseHeaders = this.convertHeadersToRecord(contentResponse.response.getHeaders());
          const finalHeaders = fixContentTypeForHtml(finalContent, responseHeaders);
          
          this.logger.debug(`${this.logPrefix} Final headers for direct content:`, JSON.stringify(finalHeaders, null, 2));
          
          return {
            type: 'STANDARD_RESPONSE',
            response: createFormattedResponse(
              finalContent,
              contentResponse.response.getStatus(),
              finalHeaders,
              'application/json'
            )
          };
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error fetching direct content for ${reqId}:`, error);
          
          // Return error response with fallback behavior
          // Instead of returning an error, we'll forward to the original URL as a last resort
          this.logger.info(`${this.logPrefix} Falling back to direct forwarding of original request for ${reqId}`);
          
          try {
            // Define Optimizely-specific params to remove
            const optimizelyParams = ['optimizely_token', 'optimizely_x', 'optimizely_opt_out', 'optimizely_disable', 'sdkKey'];
            
            // Error fallback forwarding options
            const fallbackOptions: RequestForwardOptions = {
              targetUrl: currentUrl,
              followRedirects: true,
              timeout: 30000,
              removeQueryParams: optimizelyParams,
              headers: { 'X-Forwarded-By': 'EdgeAgent' }
            };
            
            // Since this is a fallback to the original URL, we're intentionally not adding
            // the X-Forwarded-By header to prevent loops
            
            const fallbackResponse = await this.requestForwarder.forwardRequest(
              requestAdapter,
              fallbackOptions
            );
            
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to fetch content, both primary and fallback mechanisms failed.'
              }),
              status: 502
            };
          } catch (fallbackError) {
            // If even the fallback fails, return a meaningful error
            this.logger.error(`${this.logPrefix} Fallback forwarding also failed for ${reqId}:`, fallbackError);
            
            return {
              type: 'ERROR',
              body: JSON.stringify({
                error: 'Error processing Edge Mode request',
                message: 'Failed to fetch content, both primary and fallback mechanisms failed.'
              }),
              status: 502
            };
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
      return {
        type: 'ERROR',
        body: JSON.stringify({
          error: 'Error processing Edge Mode request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        status: 500
      };
    } finally {
      // Stop request timer
      if (requestTimer) {
        requestTimer.stop();
      }
    }
  }

  /**
   * Helper method to convert Headers to a record object
   */
  private headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private convertHeadersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
} 