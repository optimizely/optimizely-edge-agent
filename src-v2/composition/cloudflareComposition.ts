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

function getConfigKvBindingName(env: any): string {
  return env?.ENVIRONMENT === 'test' ? 'TEST_OPTIMIZELY_DATAFILES' : 'OPTLY_HYBRID_AGENT_KV';
}

function getUserProfileKvBindingName(env: any): string {
  return env?.ENVIRONMENT === 'test' ? 'TEST_OPTLY_HYBRID_AGENT_UPS_KV' : 'OPTLY_HYBRID_AGENT_UPS_KV';
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
  const datafileService = new DatafileService(storageAdapter, environmentAdapter, logger, metricsAdapter);
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  
  // Get SDK key from config or environment
  const sdkKey = configService.getValue('sdkKey') || environmentAdapter.getVariable('DEFAULT_SDK_KEY') || '8mR1pGh8u2ztUP8GqjmQq';
  
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
      sdkKey: String(sdkKey)  // Ensure it's a string
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
  
  // Create FlagStorageService for managing feature flags
  const flagStorageService = new FlagStorageService(
    storageAdapter,
    logger,
    {
      autoCleanup: true,
      cleanupIntervalMs: 3600000 // 1 hour
    }
  );
  
  // Create Edge Mode Components
  // Create URL Matcher with required logger parameter
  const urlMatcher = new URLMatcher(logger);
  
  // Create a response adapter factory function
  const createResponseAdapter = (request: IRequestAdapter): IResponseAdapter => {
    return cloudflareFactory.createResponseAdapter(request);
  };
  
  // Create Edge Mode Handler with full implementation
  const edgeModeHandler = new EdgeModeHandler(
    logger,
    cacheService,
    createResponseAdapter,
    decisionService,
    configService
  );
  
  // Create Content Fetcher
  const contentFetcher = new ContentFetcher(
    logger,
    cacheService,
    createResponseAdapter,
    { timeout: 10000 } // Default options
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
    metricsAdapter
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
    // Global FEX (Feature Experimentation) bypass check
    // If X-Optimizely-Enable-FEX header is NOT present or not set to true, bypass all Optimizely logic
    const fexHeaderValue = request.headers.get('X-Optimizely-Enable-FEX');
    const fexEnabled = fexHeaderValue === 'true' || fexHeaderValue === '1';
    
    // If FEX is NOT enabled (header missing or not true), bypass Optimizely
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
      
      // For GET requests: Check for loop detection using existing header
      const forwardedBy = request.headers.get('x-forwarded-by');
      const isLoopDetected = forwardedBy && forwardedBy.toLowerCase() === 'edgeagent';
      
      // If we detect a loop, return a static response instead of continuing the loop
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
      
      // No loop detected - continue with pass-through but add EdgeAgent header
      
      // Clone the request and modify headers
      const newHeaders = new Headers(request.headers);
      
      // 1. Add X-Forwarded-By header to utilize existing loop detection
      newHeaders.set('X-Forwarded-By', 'EdgeAgent');
      
      // 2. Remove the FEX header to prevent the origin from also doing a bypass
      newHeaders.delete('X-Optimizely-Enable-FEX');
      
      // Create a new request with the modified headers
      const cleanRequest = new Request(request, {
        headers: newHeaders
      });
      
      return fetch(cleanRequest);
    }

    // FEX is enabled - proceed with normal Optimizely processing

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
    
    if (result.headers) {
      // Skip logging original headers as they may be large
      
      // Special handling for Set-Cookie headers
      let setCookieValues: string[] = [];
      
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

    // 6. Return the response with validated headers
    return new Response(result.body, {
      status: result.status,
      headers: validatedHeaders
    });
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