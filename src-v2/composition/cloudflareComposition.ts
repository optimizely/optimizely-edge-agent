import {
  CloudflareAdapterFactory,
  CloudflareAdapterFactoryInputs,
} from "../adapters/factories/CloudflareAdapterFactory";

import {
  CloudflareEnv,
  CloudflareExecutionContext
} from "../adapters/implementations/cloudflare/CloudflareEnvironmentAdapter";

import { DecisionService } from "../services/implementations/DecisionService";
import { RequestHandler } from "../services/implementations/RequestHandler";
import { IRequestHandler, ResponseResult } from "../services/interfaces/IRequestHandler";
import { IEnvironmentAdapter } from "../adapters/interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter } from "../adapters/interfaces/IMetricsAdapter";
import { IStorageAdapter } from "../adapters/interfaces/IStorageAdapter";
import { IRequestAdapter } from "../adapters/interfaces/IRequestAdapter";
import { CacheService } from "../services/implementations/CacheService";
import { ICacheService } from "../services/interfaces/ICacheService";
import { DatafileService } from "../services/implementations/DatafileService";
import { IDatafileService } from "../services/interfaces/IDatafileService";
import { CloudflareEventService } from "../services/implementations/CloudflareEventService";
import { IEventService } from "../services/interfaces/IEventService";

// Import Edge Mode components
import { URLMatcher } from "../services/implementations/URLMatcher";
import { EdgeModeHandler } from "../services/implementations/EdgeModeHandler";
import { ContentFetcher } from "../services/implementations/ContentFetcher";
import { CacheManager } from "../services/implementations/CacheManager";
import { ContentTransformer } from "../services/implementations/ContentTransformer";
import { RequestForwarder } from "../services/implementations/RequestForwarder";
import { EdgeModeIntegration, IEdgeModeIntegration } from "../services/implementations/EdgeModeIntegration";
import { IURLMatcher } from "../services/interfaces/IURLMatcher";
import { IEdgeModeHandler } from "../services/interfaces/IEdgeModeHandler";
import { IContentFetcher } from "../services/interfaces/IContentFetcher";
import { ICacheManager } from "../services/interfaces/ICacheManager";
import { IContentTransformer } from "../services/interfaces/IContentTransformer";
import { IRequestForwarder } from "../services/interfaces/IRequestForwarder";
import { IResponseAdapter } from "../adapters/interfaces/IResponseAdapter";
import { ApiRouter } from "../services/implementations/ApiRouter";
import { IDecisionService } from "../services/interfaces/IDecisionService";
import { CacheStrategyOptions } from "../services/interfaces/ICacheManager";
import { CloudflareMetricsAdapter } from "../adapters/implementations/cloudflare/CloudflareMetricsAdapter";
import { CookieService } from "../services/implementations/CookieService";
import { FlagStorageService } from "../services/implementations/FlagStorageService";
import { ConfigurationService } from "../services/implementations/ConfigurationService";
import { IConfigurationService } from "../services/interfaces/IConfigurationService";
import { KVUserProfileService } from "../services/storage/KVUserProfileService";
import { OptimizelyUserProfileServiceAdapter } from "../services/storage/OptimizelyUserProfileServiceAdapter";
import { createFormattedResponse, fixContentTypeForHtml } from "../utils/responseUtils";

function getConfigKvBindingName(env: any): string {
  return env?.ENVIRONMENT === 'test' ? 'TEST_OPTIMIZELY_DATAFILES' : 'OPTLY_HYBRID_AGENT_KV';
}

function getUserProfileKvBindingName(env: any): string {
  // Use the same binding name for both test and production since wrangler.toml uses the same name
  return 'OPTLY_HYBRID_AGENT_UPS_KV';
}

/**
 * Represents the fully configured Cloudflare application object graph.
 */
interface CloudflareApplication {
  requestHandler: IRequestHandler;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  eventService: IEventService;
  edgeModeIntegration: IEdgeModeIntegration;
  metrics?: IMetricsAdapter; // Add metrics to the application interface
}

/**
 * Composes the application with Cloudflare-specific adapters.
 * @param factoryInputs - Inputs required by the Cloudflare adapter factory.
 * @returns The configured CloudflareApplication object graph.
 */
function composeCloudflareApplication(factoryInputs: CloudflareAdapterFactoryInputs): CloudflareApplication {
  let logger: ILoggerAdapter;
  let environmentAdapter: IEnvironmentAdapter;
  let storageAdapter: IStorageAdapter;
  let requestAdapter: IRequestAdapter;
  let eventService: IEventService;
  let metricsAdapter: IMetricsAdapter | undefined = undefined;

  // Get the appropriate KV binding name
  const configKvBindingName = getConfigKvBindingName(factoryInputs.env);

  // Create Cloudflare adapter factory
  const cloudflareFactory = new CloudflareAdapterFactory(factoryInputs);
  logger = cloudflareFactory.createLoggerAdapter();
  environmentAdapter = cloudflareFactory.createEnvironmentAdapter();
  storageAdapter = cloudflareFactory.createStorageAdapter(configKvBindingName);
  requestAdapter = cloudflareFactory.createRequestAdapter();
  
  // Create Cloudflare-specific metrics adapter
  try {
    // Check if analytics engine is available
    if (factoryInputs.env && 'ANALYTICS_ENGINE' in factoryInputs.env && factoryInputs.env.ANALYTICS_ENGINE) {
      metricsAdapter = cloudflareFactory.createMetricsAdapter();
      logger.debug("[Cloudflare Composition] Metrics adapter created with Analytics Engine.");
    } else {
      // Create metrics adapter without analytics engine - will log but not record
      metricsAdapter = new CloudflareMetricsAdapter(logger);
      logger.debug("[Cloudflare Composition] Metrics adapter created in logging-only mode.");
    }
  } catch (error) {
    logger.warn("[Cloudflare Composition] Failed to create metrics adapter:", error);
    // Create fallback metrics adapter that just logs
    metricsAdapter = new CloudflareMetricsAdapter(logger);
    logger.debug("[Cloudflare Composition] Fallback metrics adapter created in logging-only mode.");
  }
  
  // Create Cloudflare-specific event service
  eventService = new CloudflareEventService(storageAdapter, environmentAdapter, logger);

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
    metricsAdapter,
    flagStorageService,  // Pass FlagStorageService as 5th parameter
    undefined  // ConfigurationService will be injected later to avoid circular dependency
  );
  
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  
  // Inject ConfigurationService back into DatafileService to resolve circular dependency
  datafileService.setConfigService(configService);
  
  // Get SDK key from environment (config service hasn't been initialized yet)
  // The actual SDK key precedence will be handled during request processing
  const defaultSdkKey = environmentAdapter.getVariable('DEFAULT_SDK_KEY') || '8mR1pGh8u2ztUP8GqjmQq';
  
  // Get user profile KV storage adapter
  const userProfileStorageAdapter = cloudflareFactory.createStorageAdapter(getUserProfileKvBindingName(factoryInputs.env));
  
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
  
  // Get the SDK-compatible user profile service
  const sdkUserProfileService = userProfileServiceAdapter.getSDKUserProfileService();
  
  // Inject User Profile Service into DecisionService
  const decisionService = new DecisionService(
    configService, 
    logger, 
    metricsAdapter,
    undefined, // defaultSdkKey (optional)
    userProfileServiceAdapter // Pass the adapter itself, not its return value
  );
  
  // Create Edge Mode Components
  // Create URL Matcher with required logger parameter
  const urlMatcher = new URLMatcher(logger);
  
  // Create a response adapter factory function
  const createResponseAdapter = (request: IRequestAdapter): IResponseAdapter => {
    return cloudflareFactory.createResponseAdapter(request);
  };
  
  // Get development URL rewriting configuration
  const devContentBaseUrl = environmentAdapter.getVariable('DEV_CONTENT_BASE_URL') || 
                           environmentAdapter.getVariable('CONTENT_BASE_URL');
  
  // Create Edge Mode Handler with Cloudflare-specific configuration
  const edgeModeHandler = new EdgeModeHandler(
    logger,
    cacheService,
    createResponseAdapter,
    decisionService,
    configService,
    undefined, // defaultSdkKey
    devContentBaseUrl || undefined, // devContentBaseUrl for URL rewriting
    'cloudflare' // cdnProvider for Cloudflare-specific URL rewriting
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
    fetch // Use the global fetch function
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
  
  // Create API Router
  const apiRouter = createApiRouter(
    datafileService,
    cacheService,
    configService,
    logger,
    metricsAdapter,
    decisionService
  );
  
  // Create RequestHandler with all required services
  const requestHandler = new RequestHandler(
    decisionService, 
    eventService, 
    logger, 
    cacheService,
    edgeModeIntegration,
    metricsAdapter,
    new CookieService(logger),
    flagStorageService,
    configService,
    {
      triggerIntervalMs: 3600000, // 1 hour
      triggerProbability: 0.1,    // 10%
      requestTriggeringEnabled: true
    },
    apiRouter
  );

  // Return the composed application graph
  return {
    requestHandler,
    cacheService,
    datafileService,
    eventService,
    edgeModeIntegration,
    metrics: metricsAdapter
  };
}

/**
 * Handles a request in the Cloudflare worker environment.
 * @param request - The incoming request.
 * @param env - The Cloudflare environment.
 * @param ctx - The execution context.
 * @returns A Promise resolving to the Response object.
 */
export async function handleCloudflareWorkerRequest(
  request: Request,
  env: CloudflareEnv,
  ctx: CloudflareExecutionContext
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
      console.log(`[Cloudflare Composition] API endpoint detected: ${url.pathname} - bypassing FEX gating`);
      
      // CRITICAL: Validate SDK Key availability before proceeding with API requests
      const requestSdkKey = request.headers.get('X-Optimizely-SDK-Key') || 
                           request.headers.get('x-optimizely-sdk-key') ||
                           url.searchParams.get('sdkKey') ||
                           url.searchParams.get('sdk_key');
      
      const defaultSdkKey = env?.DEFAULT_SDK_KEY;
      const finalSdkKey = requestSdkKey || defaultSdkKey;
      
      // For API endpoints, if no SDK key is available, return 400 error
      if (!finalSdkKey || finalSdkKey.trim() === '') {
        console.warn('[Cloudflare Composition] API request: No SDK key available.');
        return new Response(
          JSON.stringify({ error: "SDK key is required for API endpoints." }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log(`[Cloudflare Composition] API request SDK key resolved: ${finalSdkKey.substring(0, 4)}... (source: ${requestSdkKey ? 'request' : 'default'})`);
      
      // Compose app and handle API request (no FEX gating)
      const factoryInputs: CloudflareAdapterFactoryInputs = { request, env, ctx };
      const app = composeCloudflareApplication(factoryInputs);
      const requestAdapter = new CloudflareAdapterFactory(factoryInputs).createRequestAdapter();
      const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);
      
      // Flush metrics if available
      if (app.metrics && app.metrics.flush) {
        try {
          await app.metrics.flush();
        } catch (error) {
          console.error("[Cloudflare Composition] Error flushing metrics:", error);
        }
      }
      
      // Handle response formatting (same as existing logic)
      const validatedHeaders = new Headers();
      let setCookieValues: string[] = [];
      
      if (result.headers) {
        Object.entries(result.headers).forEach(([name, value]) => {
          if (!name || value === undefined || value === null) {
            return;
          }
          
          try {
            if (name.toLowerCase() === 'set-cookie') {
              if (typeof value === 'string') {
                const cookies = value.split('\n');
                cookies.forEach(cookie => {
                  if (cookie && cookie.trim()) {
                    setCookieValues.push(cookie.trim());
                  }
                });
              } else if (Array.isArray(value)) {
                value.forEach(cookie => {
                  if (cookie && cookie.trim()) {
                    setCookieValues.push(cookie.trim());
                  }
                });
              }
            } else {
              const stringValue = String(value).trim();
              if (stringValue) {
                validatedHeaders.set(name, stringValue);
              }
            }
          } catch (headerError) {
            // Silently handle header setting errors
          }
        });
        
        if (setCookieValues.length > 0) {
          setCookieValues.forEach(cookie => {
            try {
              validatedHeaders.append('Set-Cookie', cookie);
            } catch (cookieError) {
              // Silently handle cookie appending errors
            }
          });
        }
      }
      
      const headersRecord: Record<string, string | string[]> = {};
      validatedHeaders.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') {
          headersRecord[key] = value;
        }
      });
      
      if (setCookieValues.length > 0) {
        headersRecord['Set-Cookie'] = setCookieValues.length === 1 ? setCookieValues[0] : setCookieValues;
      }
      
      const bodyContent = result.body || '';
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
    
    const defaultSdkKey = env?.DEFAULT_SDK_KEY;
    const finalSdkKey = requestSdkKey || defaultSdkKey;
    
    // CRITICAL PROTECTION: If no SDK key is available, behave as if FEX is disabled
    if (!finalSdkKey || finalSdkKey.trim() === '') {
      console.warn('[Cloudflare Composition] CRITICAL: No SDK key available (request or default). Disabling FEX processing.');
      
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

    console.log(`[Cloudflare Composition] SDK key resolved: ${finalSdkKey.substring(0, 4)}... (source: ${requestSdkKey ? 'request' : 'default'})`);

    // 1. Compose the application
    const factoryInputs: CloudflareAdapterFactoryInputs = { request, env, ctx };
    const app = composeCloudflareApplication(factoryInputs);

    // 2. Create the Request Adapter for this request
    const requestAdapter = new CloudflareAdapterFactory(factoryInputs).createRequestAdapter();

    // 3. Handle the request using the composed RequestHandler
    const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);

    // 4. Flush metrics if available
    if (app.metrics && app.metrics.flush) {
      try {
        await app.metrics.flush();
      } catch (error) {
        console.error("[Cloudflare Composition] Error flushing metrics:", error);
      }
    }

    // 5. Validate headers to prevent TypeError
    const validatedHeaders = new Headers();
    // Move setCookieValues declaration outside the if block so it's accessible later
    let setCookieValues: string[] = [];
    
    if (result.headers) {
      // Skip logging original headers as they may be large
      
      // Validate each header
      Object.entries(result.headers).forEach(([name, value]) => {
        // Skip if name or value is undefined/null
        if (!name || value === undefined || value === null) {
          return;
        }
        
        try {
          // Special handling for Set-Cookie which needs to be added via append(), not set()
          if (name.toLowerCase() === 'set-cookie') {
            // For Set-Cookie, we need to handle multiple values and append each separately
            if (typeof value === 'string') {
              // Split multiple cookies if they're combined with \n
              const cookies = value.split('\n');
              cookies.forEach(cookie => {
                if (cookie && cookie.trim()) {
                  // Just add the cookie to the array
                  setCookieValues.push(cookie.trim());
                }
              });
            } else if (Array.isArray(value)) {
              // Handle array of cookies (which is the proper way to send multiple cookies)
              value.forEach(cookie => {
                if (cookie && cookie.trim()) {
                  setCookieValues.push(cookie.trim());
                }
              });
            }
          } else {
            // Convert value to string and validate it's not empty
            const stringValue = String(value).trim();
            if (stringValue) {
              validatedHeaders.set(name, stringValue);
            } // Skip empty headers silently
          }
        } catch (headerError) {
          // Silently handle header setting errors
        }
      });
      
      // Add Set-Cookie headers after processing all other headers
      if (setCookieValues.length > 0) {
        setCookieValues.forEach(cookie => {
          try {
            validatedHeaders.append('Set-Cookie', cookie);
          } catch (cookieError) {
            // Silently handle cookie appending errors
          }
        });
      }
    }

    // 6. Convert validatedHeaders to record for the utility function
    // Set-Cookie headers were already collected in setCookieValues array
    const headersRecord: Record<string, string | string[]> = {};
    
    validatedHeaders.forEach((value, key) => {
      // Skip Set-Cookie as we'll handle it separately
      if (key.toLowerCase() !== 'set-cookie') {
        headersRecord[key] = value;
      }
    });
    
    // Add Set-Cookie headers from our collected array
    if (setCookieValues.length > 0) {
      headersRecord['Set-Cookie'] = setCookieValues.length === 1 ? setCookieValues[0] : setCookieValues;
    }

    // 7. Pass body directly to createFormattedResponse - it will handle stringification
    // Don't pre-stringify objects here to avoid double-encoding
    const bodyContent = result.body || '';
    
    // Only check for HTML content if body is already a string
    const bodyForHtmlCheck = typeof bodyContent === 'string' ? bodyContent : '';
    const finalHeaders = fixContentTypeForHtml(bodyForHtmlCheck, headersRecord);
    
    console.log('[Cloudflare Composition] Creating response with headers:', JSON.stringify(finalHeaders, null, 2));

    // 8. Return the response using the original AbstractResponse.js pattern
    // createFormattedResponse will handle JSON.stringify based on content type
    return createFormattedResponse(
      bodyContent,  // Pass raw body - createFormattedResponse will stringify if needed
      result.status,
      finalHeaders,
      'application/json' // Default content type
    );
  } catch (error) {
    // Handle any errors that occurred during processing
    console.error("[Cloudflare Composition] Error handling request:", error);
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

/**
 * For backward compatibility - make this export explicit
 */
export async function handleWorkerRequest(
  request: Request,
  env: CloudflareEnv,
  ctx: CloudflareExecutionContext
): Promise<Response> {
  return handleCloudflareWorkerRequest(request, env, ctx);
}

/**
 * Creates an ApiRouter instance.
 * @param datafileService - The datafile service.
 * @param cacheService - The cache service.
 * @param configService - The config service.
 * @param logger - The logger adapter.
 * @param metricsAdapter - The metrics adapter (optional).
 * @param decisionService - The decision service (optional).
 * @returns An initialized ApiRouter.
 */
function createApiRouter(
  datafileService: IDatafileService,
  cacheService: ICacheService,
  configService: IConfigurationService,
  logger: ILoggerAdapter,
  metricsAdapter?: IMetricsAdapter,
  decisionService?: IDecisionService
): ApiRouter {
  return new ApiRouter(
    datafileService,
    cacheService,
    configService,
    logger,
    metricsAdapter,
    decisionService
  );
}

/**
 * Creates all services for the Cloudflare worker.
 * @param env - The Cloudflare environment.
 * @param context - The Cloudflare execution context.
 * @param request - The incoming request.
 * @returns An object containing all services.
 */
export async function createServices(
  env: CloudflareEnv,
  context: CloudflareExecutionContext,
  request: Request
): Promise<{
  environmentAdapter: IEnvironmentAdapter;
  configService: IConfigurationService;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  decisionService: IDecisionService;
  eventService: IEventService;
  apiRouter: ApiRouter;
  requestHandler: IRequestHandler;
  metricsAdapter?: IMetricsAdapter;
}> {
  const factoryInputs: CloudflareAdapterFactoryInputs = { request, env, ctx: context };
  const app = composeCloudflareApplication(factoryInputs);
  
  // Create necessary components
  const cloudflareFactory = new CloudflareAdapterFactory(factoryInputs);
  const logger = cloudflareFactory.createLoggerAdapter();
  const environmentAdapter = cloudflareFactory.createEnvironmentAdapter();
  
  // Create the config service
  const configService: IConfigurationService = new ConfigurationService(app.datafileService, logger);
  
  // Create an ApiRouter with the correct services
  const apiRouter = createApiRouter(
    app.datafileService,
    app.cacheService,
    configService,
    logger,
    app.metrics,
    new DecisionService(configService, logger)
  );
  
  return {
    environmentAdapter,
    configService,
    cacheService: app.cacheService,
    datafileService: app.datafileService,
    decisionService: new DecisionService(
      configService, 
      logger,
      app.metrics,
      undefined, // No default SDK key
      // Re-create the user profile service adapter for consistency
      (() => {
        const sdkKey = configService.getValue('sdkKey') || environmentAdapter.getVariable('DEFAULT_SDK_KEY') || '8mR1pGh8u2ztUP8GqjmQq';
        const userProfileStorageAdapter = cloudflareFactory.createStorageAdapter(getUserProfileKvBindingName(env));
        const kvUserProfileService = new KVUserProfileService(
          userProfileStorageAdapter,
          logger,
          {
            keyPrefix: 'optly_ups_',
            ttl: 2592000, // 30 days in seconds
            maxCacheSize: 100,
            sdkKey: String(sdkKey) // Ensure it's a string
          }
        );
        // Return the adapter itself, not its return value
        return new OptimizelyUserProfileServiceAdapter(
          kvUserProfileService,
          logger
        );
      })()
    ),
    eventService: app.eventService,
    apiRouter,
    requestHandler: app.requestHandler,
    metricsAdapter: app.metrics
  };
} 