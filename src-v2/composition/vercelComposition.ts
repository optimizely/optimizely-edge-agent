import {
  VercelAdapterFactory,
  VercelAdapterFactoryInputs,
} from "../adapters/factories/VercelAdapterFactory";

import {
  VercelEnv,
  VercelExecutionContext
} from "../adapters/implementations/vercel/VercelEnvironmentAdapter";

import { ConfigurationService } from "../services/implementations/ConfigurationService";
import { IConfigurationService } from "../services/interfaces/IConfigurationService";
import { DecisionService } from "../services/implementations/DecisionService";
import { EventDispatcher } from "../services/implementations/EventDispatcher";
import { RequestHandler } from "../services/implementations/RequestHandler";
import { IRequestHandler, ResponseResult } from "../services/interfaces/IRequestHandler";
import { IEnvironmentAdapter } from "../adapters/interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../adapters/interfaces/ILoggerAdapter";
import { IStorageAdapter } from "../adapters/interfaces/IStorageAdapter";
import { IRequestAdapter } from "../adapters/interfaces/IRequestAdapter";
import { IMetricsAdapter } from "../adapters/interfaces/IMetricsAdapter";
import { CacheService } from "../services/implementations/CacheService";
import { ICacheService } from "../services/interfaces/ICacheService";
import { DatafileService } from "../services/implementations/DatafileService";
import { IDatafileService } from "../services/interfaces/IDatafileService";
import { IEventService } from "../services/interfaces/IEventService";
import { FlagStorageService } from "../services/implementations/FlagStorageService";
import { URLMatcher } from "../services/implementations/URLMatcher";
import { EdgeModeHandler } from "../services/implementations/EdgeModeHandler";
import { ContentFetcher } from "../services/implementations/ContentFetcher";
import { ApiRouter } from "../services/implementations/ApiRouter";
import { CacheManager } from "../services/implementations/CacheManager";
import { ContentTransformer } from "../services/implementations/ContentTransformer";
import { RequestForwarder } from "../services/implementations/RequestForwarder";
import { EdgeModeIntegration } from "../services/implementations/EdgeModeIntegration";
import { IResponseAdapter } from "../adapters/interfaces/IResponseAdapter";
import { CacheStrategyOptions } from "../services/interfaces/ICacheManager";
import { CookieService } from "../services/implementations/CookieService";
import { KVUserProfileService } from "../services/storage/KVUserProfileService";
import { OptimizelyUserProfileServiceAdapter } from "../services/storage/OptimizelyUserProfileServiceAdapter";
import { createFormattedResponse, fixContentTypeForHtml } from "../utils/responseUtils";

function getConfigKvBindingName(env: any): string {
  return env?.ENVIRONMENT === 'test' ? 'TEST_OPTIMIZELY_DATAFILES' : 'OPTLY_HYBRID_AGENT_KV';
}

function getUserProfileKvBindingName(env: any): string {
  // Use consistent binding name for user profile service KV storage
  return 'OPTLY_HYBRID_AGENT_UPS_KV';
}

/**
 * Represents the fully configured Vercel application object graph.
 */
interface VercelApplication {
  requestHandler: IRequestHandler;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  eventService: IEventService;
  metrics?: IMetricsAdapter; // Add metrics to the application interface
}

/**
 * Composes the application with Vercel-specific adapters.
 * @param factoryInputs - Inputs required by the Vercel adapter factory.
 * @returns The configured VercelApplication object graph.
 */
function composeVercelApplication(factoryInputs: VercelAdapterFactoryInputs): VercelApplication {
  
  let logger: ILoggerAdapter;
  let environmentAdapter: IEnvironmentAdapter;
  let storageAdapter: IStorageAdapter;
  let requestAdapter: IRequestAdapter;
  let metricsAdapter: IMetricsAdapter | undefined;
  let eventService: IEventService;

  // Get the appropriate KV binding name
  const configKvBindingName = getConfigKvBindingName(factoryInputs.env);

  // Create Vercel adapter factory
  const vercelFactory = new VercelAdapterFactory(factoryInputs);
  logger = vercelFactory.createLoggerAdapter();
  environmentAdapter = vercelFactory.createEnvironmentAdapter();
  storageAdapter = vercelFactory.createStorageAdapter(configKvBindingName);
  requestAdapter = vercelFactory.createRequestAdapter();
  metricsAdapter = vercelFactory.createMetricsAdapter();
  
  // Create EventDispatcher for Vercel
  eventService = new EventDispatcher(logger, environmentAdapter);

  logger.debug("Vercel Composition: Vercel adapters created/retrieved.");
  if (metricsAdapter) {
    logger.debug("Metrics adapter successfully created and configured");
  } else {
    logger.debug("No metrics adapter configured - metrics collection disabled");
  }

  // Create Services (inject dependencies)
  const cacheService = new CacheService(storageAdapter, logger);
  
  // Create FlagStorageService first (needed by DatafileService)
  const flagStorageService = new FlagStorageService(
    storageAdapter,
    logger,
    {
      autoCleanup: true,
      cleanupIntervalMs: 3600000 // 1 hour
    }
  );
  
  // Create DatafileService with FlagStorageService (ConfigurationService will be set later)
  const datafileService = new DatafileService(
    storageAdapter, 
    environmentAdapter, 
    logger, 
    metricsAdapter, // Now using the configured metrics adapter
    flagStorageService,  // Pass FlagStorageService as 5th parameter
    undefined  // ConfigurationService will be injected later to avoid circular dependency
  );
  
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  
  // Inject ConfigurationService back into DatafileService to resolve circular dependency
  datafileService.setConfigService(configService);
  
  // Get default SDK key from environment (with fallback chain)
  const defaultSdkKey = environmentAdapter.getVariable('DEFAULT_SDK_KEY') || 
                        environmentAdapter.getVariable('OPTIMIZELY_SDK_KEY') || 
                        '8mR1pGh8u2ztUP8GqjmQq';
  logger.debug(`[Vercel Composition] Default SDK key from environment: ${defaultSdkKey ? defaultSdkKey.substring(0, 4) + '...' : 'NOT SET'}`);
  
  // Get user profile KV storage adapter
  const userProfileStorageAdapter = vercelFactory.createStorageAdapter(getUserProfileKvBindingName(factoryInputs.env));
  
  // Create KV User Profile Service
  const kvUserProfileService = new KVUserProfileService(
    userProfileStorageAdapter,
    logger,
    {
      keyPrefix: 'optly_ups_',
      ttl: 2592000, // 30 days in seconds
      maxCacheSize: 100,
      sdkKey: String(defaultSdkKey)  // Use default SDK key for service composition
    }
  );
  
  // Create adapter for Optimizely SDK
  const userProfileServiceAdapter = new OptimizelyUserProfileServiceAdapter(
    kvUserProfileService,
    logger
  );
  
  // Create DecisionService with User Profile Service
  const decisionService = new DecisionService(
    configService, 
    logger, 
    metricsAdapter, 
    defaultSdkKey,
    userProfileServiceAdapter // Pass the adapter itself, not its return value
  );
  
  // Create Edge Mode Components
  // Create URL Matcher with required logger parameter
  const urlMatcher = new URLMatcher(logger);
  
  // Create a response adapter factory function
  const createResponseAdapter = (request: IRequestAdapter): IResponseAdapter => {
    return vercelFactory.createResponseAdapter();
  };
  
  // Get development URL rewriting configuration
  const devContentBaseUrl = environmentAdapter.getVariable('DEV_CONTENT_BASE_URL') || 
                           environmentAdapter.getVariable('CONTENT_BASE_URL');
  
  // Create Edge Mode Handler with Vercel-specific configuration
  const edgeModeHandler = new EdgeModeHandler(
    logger,
    cacheService,
    createResponseAdapter,
    decisionService,
    configService,
    defaultSdkKey, // defaultSdkKey
    devContentBaseUrl || undefined, // devContentBaseUrl for URL rewriting
    'vercel' // cdnProvider for Vercel-specific URL rewriting
  );
  
  // Create Content Fetcher with development URL rewriting support
  const contentFetcher = new ContentFetcher(
    logger,
    cacheService,
    createResponseAdapter,
    { timeout: 10000 }, // Default options
    devContentBaseUrl || undefined // Pass undefined if no URL is configured
  );
  
  // Create Cache Manager
  const cacheOptions: CacheStrategyOptions = {
    ttl: 3600 // Default 1 hour cache TTL
  };
  const cacheManager = new CacheManager(
    cacheService,
    logger,
    cacheOptions
  );
  
  // Create Content Transformer
  const contentTransformer = new ContentTransformer(logger);
  
  // Create Request Forwarder
  const requestForwarder = new RequestForwarder(
    logger,
    globalThis.fetch // Use the global fetch function
  );
  
  // Create Edge Mode Integration
  const edgeModeIntegration = new EdgeModeIntegration(
    urlMatcher,
    edgeModeHandler,
    contentFetcher,
    cacheManager,
    contentTransformer,
    requestForwarder,
    logger,
    decisionService,
    configService,
    metricsAdapter,
    devContentBaseUrl || undefined
  );
  
  // Create ApiRouter
  const apiRouter = new ApiRouter(
    datafileService,
    cacheService,
    configService,
    logger,
    metricsAdapter,
    decisionService
  );
  
  // Create RequestHandler with EdgeModeIntegration and ApiRouter
  const requestHandler = new RequestHandler(
    decisionService, 
    eventService, 
    logger, 
    cacheService,
    edgeModeIntegration, // Add EdgeModeIntegration
    metricsAdapter, // Add metrics adapter
    new CookieService(logger), // Add CookieService as 7th parameter
    flagStorageService, // flagStorage
    configService, // configurationService
    undefined, // cleanupConfig (use defaults)
    apiRouter // Add ApiRouter
  );

  logger.debug("Vercel Composition: Services instantiated.");

  // Return the composed application graph
  return {
    requestHandler,
    cacheService,
    datafileService,
    eventService,
    metrics: metricsAdapter
  };
}

/**
 * Main entry point function to handle a Vercel Edge request.
 * It sets up the application via the Vercel-specific composition and calls the request handler.
 * @param request - The incoming Request object.
 * @param env - The environment bindings and variables.
 * @param ctx - The execution context.
 * @returns A Promise resolving to the Response object.
 */
export async function handleVercelEdgeRequest(
  request: Request,
  env: VercelEnv,
  ctx: VercelExecutionContext
): Promise<Response> {
  try {
    const url = new URL(request.url);
    
    // Health check endpoint - always returns 200 OK, bypasses all FEX gating
    if (url.pathname === '/api/test' || url.pathname === '/test') {
      return new Response(
        JSON.stringify({ 
          status: 'ok',
          message: 'Test endpoint is working!',
          environment: 'development',
          routingTarget: 'v2',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // API endpoints bypass FEX gating entirely (datafile, decide, flagkeys, etc.)
    const apiPathPrefix = '/api/';
    if (url.pathname.startsWith(apiPathPrefix)) {
      // API requests should always work regardless of FEX headers
      console.log(`[Vercel Composition] API endpoint detected: ${url.pathname} - bypassing FEX gating`);
      
      // CRITICAL: Validate SDK Key availability before proceeding with API requests
      const requestSdkKey = request.headers.get('X-Optimizely-SDK-Key') || 
                           request.headers.get('x-optimizely-sdk-key') ||
                           url.searchParams.get('sdkKey') ||
                           url.searchParams.get('sdk_key');
      
      const defaultSdkKey = env?.DEFAULT_SDK_KEY || env?.OPTIMIZELY_SDK_KEY;
      const finalSdkKey = requestSdkKey || defaultSdkKey;
      
      // For API endpoints, if no SDK key is available, return 400 error
      if (!finalSdkKey || finalSdkKey.trim() === '') {
        console.warn('[Vercel Composition] API request: No SDK key available.');
        return new Response(
          JSON.stringify({ error: "SDK key is required for API endpoints." }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log(`[Vercel Composition] API request SDK key resolved: ${finalSdkKey.substring(0, 4)}... (source: ${requestSdkKey ? 'request' : 'default'})`);
      
      // Compose app and handle API request (no FEX gating)
      const factoryInputs: VercelAdapterFactoryInputs = { request, env, ctx };
      const app = composeVercelApplication(factoryInputs);
      const requestAdapter = new VercelAdapterFactory(factoryInputs).createRequestAdapter();
      const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);
      
      // Flush metrics if available
      if (app.metrics && app.metrics.flush) {
        try {
          await app.metrics.flush();
        } catch (error) {
          console.error("[Vercel Composition] Error flushing metrics:", error);
        }
      }
      
      // Handle response headers properly
      const responseHeaders = new Headers();
      
      for (const [name, value] of Object.entries(result.headers)) {
        if (name.toLowerCase() === 'set-cookie') {
          if (Array.isArray(value)) {
            value.forEach(cookie => {
              if (cookie && cookie.trim()) {
                responseHeaders.append('Set-Cookie', cookie.trim());
              }
            });
          } else if (typeof value === 'string' && value.includes('\n')) {
            const cookieValues = value.split('\n');
            for (const cookieValue of cookieValues) {
              if (cookieValue.trim()) {
                responseHeaders.append('Set-Cookie', cookieValue.trim());
              }
            }
          } else if (typeof value === 'string') {
            responseHeaders.append('Set-Cookie', value);
          }
        } else {
          const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
          responseHeaders.set(name, stringValue);
        }
      }
      
      // Convert headers to record for the utility function
      const headersRecord: Record<string, string> = {};
      responseHeaders.forEach((value, key) => {
        headersRecord[key] = value;
      });
      
      // Handle both plain objects and ResponseAdapter objects
      const bodyContent = (result as any).getBody ? (result as any).getBody() : (result.body || '');
      const bodyForHtmlCheck = typeof bodyContent === 'string' ? bodyContent : '';
      const finalHeaders = fixContentTypeForHtml(bodyForHtmlCheck, headersRecord);
      
      return createFormattedResponse(
        bodyContent,
        result.status,
        finalHeaders,
        'application/json'
      );
    }
    
    // Global FEX (Feature Experimentation) bypass check for non-API requests (Edge Mode)
    // Check both header and query parameters for enabling FEX
    const fexHeaderValue = request.headers.get('X-Optimizely-Enable-FEX');
    
    // Check query parameters for enable_fex, enable_optimizely, or optimizely_enabled
    const fexQueryParam = url.searchParams.get('enable_fex') || 
                          url.searchParams.get('enable_optimizely') ||
                          url.searchParams.get('optimizely_enabled');
    
    // FEX is enabled if header is true/1 OR query param is true/1
    const fexEnabled = (fexHeaderValue === 'true' || fexHeaderValue === '1') ||
                       (fexQueryParam === 'true' || fexQueryParam === '1');
    
    // If FEX is NOT enabled (neither header nor query param), bypass Optimizely
    if (!fexEnabled) {
      // For POST requests: Return disabled message
      if (request.method === 'POST') {
        return new Response(
          JSON.stringify({ error: "The Optimizely Edge Agent is disabled." }),
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // For GET requests: Fetch from default origin (control variation)
      const defaultOriginUrl = env?.DEFAULT_ORIGIN_URL;
      
      if (!defaultOriginUrl) {
        // No default origin configured, return a simple message
        return new Response(
          "Optimizely Edge Agent is disabled. No default origin configured.",
          { 
            status: 503,
            headers: { 
              'Content-Type': 'text/plain',
              'X-Optimizely-Bypass': 'true',
              'X-Optimizely-Reason': 'no-default-origin'
            }
          }
        );
      }
      
      // Construct the target URL using the default origin
      const requestUrl = new URL(request.url);
      const targetUrl = new URL(requestUrl.pathname + requestUrl.search, defaultOriginUrl);
      
      // Check for loop detection
      const forwardedBy = request.headers.get('x-forwarded-by');
      const isLoopDetected = forwardedBy && forwardedBy.toLowerCase() === 'edgeagent';
      
      if (isLoopDetected) {
        return new Response(
          "Optimizely Edge Agent bypassed. Loop detected and broken.",
          { 
            status: 200,
            headers: { 
              'Content-Type': 'text/plain',
              'X-Optimizely-Bypass': 'true'
            }
          }
        );
      }
      
      // Clone headers and add loop detection
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Forwarded-By', 'EdgeAgent');
      newHeaders.delete('X-Optimizely-Enable-FEX');
      
      // Fetch from the default origin
      const originRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });
      
      const originResponse = await fetch(originRequest);
      
      // Return the origin response with an additional header to indicate bypass
      const responseHeaders = new Headers(originResponse.headers);
      responseHeaders.set('X-Optimizely-Bypass', 'true');
      responseHeaders.set('X-Optimizely-Origin', defaultOriginUrl);
      
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders
      });
    }

    // FEX is enabled - proceed with normal Optimizely processing

    // CRITICAL: Validate SDK Key availability before proceeding
    // Check request headers/params for SDK key first, then fall back to environment
    const requestSdkKey = request.headers.get('X-Optimizely-SDK-Key') || 
                         request.headers.get('x-optimizely-sdk-key') ||
                         new URL(request.url).searchParams.get('sdkKey') ||
                         new URL(request.url).searchParams.get('sdk_key');
    
    const defaultSdkKey = env?.DEFAULT_SDK_KEY || env?.OPTIMIZELY_SDK_KEY;
    const finalSdkKey = requestSdkKey || defaultSdkKey;
    
    // CRITICAL PROTECTION: If no SDK key is available, behave as if FEX is disabled
    if (!finalSdkKey || finalSdkKey.trim() === '') {
      console.warn('[Vercel Composition] CRITICAL: No SDK key available (request or default). Disabling FEX processing.');
      
      // For POST requests: Return error message
      if (request.method === 'POST') {
        return new Response(
          JSON.stringify({ error: "No SDK key available." }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // For GET requests: Fetch from default origin (control variation)
      const defaultOriginUrl = env?.DEFAULT_ORIGIN_URL;
      
      if (!defaultOriginUrl) {
        return new Response(
          "Optimizely Edge Agent: No SDK key and no default origin configured.",
          { 
            status: 503,
            headers: { 
              'Content-Type': 'text/plain',
              'X-Optimizely-Bypass': 'true',
              'X-Optimizely-Reason': 'no-sdk-key-no-origin'
            }
          }
        );
      }
      
      // Check for loop detection
      const forwardedBy = request.headers.get('x-forwarded-by');
      const isLoopDetected = forwardedBy && forwardedBy.toLowerCase() === 'edgeagent';
      
      if (isLoopDetected) {
        return new Response(
          "Optimizely Edge Agent bypassed. No SDK key available.",
          { 
            status: 200,
            headers: { 
              'Content-Type': 'text/plain',
              'X-Optimizely-Bypass': 'true',
              'X-Optimizely-Reason': 'no-sdk-key'
            }
          }
        );
      }
      
      // Construct target URL and fetch from default origin
      const requestUrl = new URL(request.url);
      const targetUrl = new URL(requestUrl.pathname + requestUrl.search, defaultOriginUrl);
      
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Forwarded-By', 'EdgeAgent');
      newHeaders.delete('X-Optimizely-Enable-FEX');
      
      const originRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });
      
      const originResponse = await fetch(originRequest);
      
      const responseHeaders = new Headers(originResponse.headers);
      responseHeaders.set('X-Optimizely-Bypass', 'true');
      responseHeaders.set('X-Optimizely-Reason', 'no-sdk-key');
      responseHeaders.set('X-Optimizely-Origin', defaultOriginUrl);
      
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders
      });
    }

    console.log(`[Vercel Composition] SDK key resolved: ${finalSdkKey.substring(0, 4)}... (source: ${requestSdkKey ? 'request' : 'default'})`);

    // 1. Compose the application
    const factoryInputs: VercelAdapterFactoryInputs = { request, env, ctx };
    const app = composeVercelApplication(factoryInputs);

    // 2. Create the Request Adapter for this request
    const requestAdapter = new VercelAdapterFactory(factoryInputs).createRequestAdapter();

    // 3. Handle the request using the composed RequestHandler
    const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);

    // 4. Flush metrics if available
    if (app.metrics && app.metrics.flush) {
      try {
        await app.metrics.flush();
      } catch (error) {
        console.error("[Vercel Composition] Error flushing metrics:", error);
      }
    }

    // 5. Return the response with proper header handling
    const responseHeaders = new Headers();
    
    // Handle headers properly, especially Set-Cookie which may contain newlines
    for (const [name, value] of Object.entries(result.headers)) {
      if (name.toLowerCase() === 'set-cookie') {
        // Handle Set-Cookie specially - value could be string or string array
        if (Array.isArray(value)) {
          // Handle array of cookies
          value.forEach(cookie => {
            if (cookie && cookie.trim()) {
              responseHeaders.append('Set-Cookie', cookie.trim());
            }
          });
        } else if (typeof value === 'string' && value.includes('\n')) {
          // Split Set-Cookie header by newlines and append each cookie separately
          const cookieValues = value.split('\n');
          for (const cookieValue of cookieValues) {
            if (cookieValue.trim()) {
              responseHeaders.append('Set-Cookie', cookieValue.trim());
            }
          }
        } else if (typeof value === 'string') {
          // Single cookie string
          responseHeaders.append('Set-Cookie', value);
        }
      } else {
        // Handle regular headers - convert to string
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        responseHeaders.set(name, stringValue);
      }
    }
    
    // Convert headers to record for the utility function
    const headersRecord: Record<string, string> = {};
    responseHeaders.forEach((value, key) => {
      headersRecord[key] = value;
    });
    
    // Pass body directly to createFormattedResponse - it will handle stringification
    // Don't pre-stringify objects here to avoid double-encoding
    // Handle both plain objects and ResponseAdapter objects
    const bodyContent = (result as any).getBody ? (result as any).getBody() : (result.body || '');
    
    // Only check for HTML content if body is already a string
    const bodyForHtmlCheck = typeof bodyContent === 'string' ? bodyContent : '';
    const finalHeaders = fixContentTypeForHtml(bodyForHtmlCheck, headersRecord);
    
    console.log('[Vercel Composition] Creating response with headers:', JSON.stringify(finalHeaders, null, 2));
    
    // Return the response using the utility function for proper content type handling
    // createFormattedResponse will handle JSON.stringify based on content type
    return createFormattedResponse(
      bodyContent,  // Pass raw body - createFormattedResponse will stringify if needed
      result.status,
      finalHeaders,
      'application/json' // Default content type
    );
  } catch (error) {
    // Handle any errors that occurred during processing
    console.error("[Vercel Composition] Error handling request:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
} 