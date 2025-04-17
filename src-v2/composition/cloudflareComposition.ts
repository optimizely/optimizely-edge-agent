import {
  CloudflareAdapterFactory,
  CloudflareAdapterFactoryInputs,
} from "../adapters/factories/CloudflareAdapterFactory";

import {
  CloudflareEnv,
  CloudflareExecutionContext
} from "../adapters/implementations/cloudflare/CloudflareEnvironmentAdapter";

import { ConfigService } from "../services/implementations/ConfigService";
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
import { IConfigService } from "../services/interfaces/IConfigService";
import { IDecisionService } from "../services/interfaces/IDecisionService";
import { CacheStrategyOptions } from "../services/interfaces/ICacheManager";
import { CloudflareMetricsAdapter } from "../adapters/implementations/cloudflare/CloudflareMetricsAdapter";
import { CookieService } from "../services/implementations/CookieService";
import { FlagStorageService } from "../services/implementations/FlagStorageService";
import { ConfigurationService } from "../services/implementations/ConfigurationService";

function getConfigKvBindingName(env: any): string {
  return env?.ENVIRONMENT === 'test' ? 'TEST_OPTIMIZELY_DATAFILES' : 'OPTLY_HYBRID_AGENT_KV';
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
      logger.info("[Cloudflare Composition] Metrics adapter created with Analytics Engine.");
    } else {
      // Create metrics adapter without analytics engine - will log but not record
      metricsAdapter = new CloudflareMetricsAdapter(logger);
      logger.info("[Cloudflare Composition] Metrics adapter created in logging-only mode.");
    }
  } catch (error) {
    logger.warn("[Cloudflare Composition] Failed to create metrics adapter:", error);
    // Create fallback metrics adapter that just logs
    metricsAdapter = new CloudflareMetricsAdapter(logger);
    logger.info("[Cloudflare Composition] Fallback metrics adapter created in logging-only mode.");
  }
  
  // Create Cloudflare-specific event service
  eventService = new CloudflareEventService(storageAdapter, environmentAdapter, logger);

  logger.debug("Cloudflare Composition: CLOUDFLARE adapters created/retrieved.");

  // Create Services (inject dependencies)
  const cacheService = new CacheService(storageAdapter, logger);
  const datafileService = new DatafileService(storageAdapter, environmentAdapter, logger, metricsAdapter);
  const configService = new ConfigService(datafileService, logger);
  const decisionService = new DecisionService(configService, logger);
  
  // Create FlagStorageService for managing feature flags
  const flagStorageService = new FlagStorageService(
    storageAdapter,
    logger,
    {
      autoCleanup: true,
      cleanupIntervalMs: 3600000 // 1 hour
    }
  );
  
  // Create ConfigurationService
  const configurationService = new ConfigurationService(logger);
  
  // Create Edge Mode Components
  logger.debug("Cloudflare Composition: Creating Edge Mode components.");
  
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
    createResponseAdapter
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
    metricsAdapter
  );
  
  logger.debug("Cloudflare Composition: Edge Mode components created and integrated.");
  
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
    configurationService,
    {
      triggerIntervalMs: 3600000, // 1 hour
      triggerProbability: 0.1,    // 10%
      requestTriggeringEnabled: true
    },
    apiRouter
  );

  logger.debug("Cloudflare Composition: Services instantiated.");

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
 * Main entry point function to handle a Cloudflare Worker request.
 * It sets up the application via the Cloudflare-specific composition root and calls the request handler.
 * @param request - The incoming Request object.
 * @param env - The environment bindings and variables.
 * @param ctx - The execution context.
 * @returns A Promise resolving to the Response object.
 */
export async function handleCloudflareWorkerRequest(
  request: Request,
  env: CloudflareEnv,
  ctx: CloudflareExecutionContext
): Promise<Response> {
  try {
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

    // 5. Return the response
    return new Response(result.body, {
      status: result.status,
      headers: result.headers
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
  configService: IConfigService,
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
  configService: IConfigService;
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
  
  return {
    environmentAdapter,
    configService: new ConfigService(app.datafileService, logger),
    cacheService: app.cacheService,
    datafileService: app.datafileService,
    decisionService: new DecisionService(
      new ConfigService(app.datafileService, logger), 
      logger
    ),
    eventService: app.eventService,
    apiRouter: createApiRouter(
      app.datafileService,
      app.cacheService,
      new ConfigService(app.datafileService, logger),
      logger,
      app.metrics
    ),
    requestHandler: app.requestHandler,
    metricsAdapter: app.metrics
  };
} 