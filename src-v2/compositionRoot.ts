import {
  CloudflareAdapterFactory,
  CloudflareAdapterFactoryInputs,
} from "./adapters/factories/CloudflareAdapterFactory";

import {
  VercelAdapterFactory,
  VercelAdapterFactoryInputs,
} from "./adapters/factories/VercelAdapterFactory";

import {
  FastlyAdapterFactory,
  FastlyAdapterFactoryInputs,
} from "./adapters/factories/FastlyAdapterFactory";

import {
  CloudflareEnv,
  CloudflareExecutionContext
} from "./adapters/implementations/cloudflare/CloudflareEnvironmentAdapter";

import {
  VercelEnv,
  VercelExecutionContext
} from "./adapters/implementations/vercel/VercelEnvironmentAdapter";

import {
  FastlyEnv,
  FastlyExecutionContext
} from "./adapters/implementations/fastly/FastlyEnvironmentAdapter";

import { DecisionService } from "./services/implementations/DecisionService";
import { EventDispatcher } from "./services/implementations/EventDispatcher";
import { RequestHandler } from "./services/implementations/RequestHandler";
import { IRequestHandler, ResponseResult } from "./services/interfaces/IRequestHandler";
import { IEnvironmentAdapter } from "./adapters/interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "./adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter } from "./adapters/interfaces/IMetricsAdapter";
import { IStorageAdapter } from "./adapters/interfaces/IStorageAdapter";
import { IRequestAdapter } from "./adapters/interfaces/IRequestAdapter";
import { CacheService } from "./services/implementations/CacheService";
import { ICacheService } from "./services/interfaces/ICacheService";
import { DatafileService } from "./services/implementations/DatafileService";
import { IDatafileService } from "./services/interfaces/IDatafileService";
import { CloudflareEventService } from "./services/implementations/CloudflareEventService";
import { IEventService } from "./services/interfaces/IEventService";
import { ApiRouter } from "./services/implementations/ApiRouter";
import { CookieService } from "./services/implementations/CookieService";
import { ICookieService } from "./services/interfaces/ICookieService";
import { FlagStorageService } from "./services/implementations/FlagStorageService";
import { IFlagStorageService } from "./services/interfaces/IFlagStorageService";
import { ConfigurationService } from "./services/implementations/ConfigurationService";
import { IConfigurationService } from "./services/interfaces/IConfigurationService";
import { KVUserProfileService } from "./services/storage/KVUserProfileService";
import { OptimizelyUserProfileServiceAdapter } from "./services/storage/OptimizelyUserProfileServiceAdapter";

// Define the binding name for the primary KV namespace used by ConfigService
const CONFIG_KV_BINDING_NAME = 'OPTLY_HYBRID_AGENT_KV';

/**
 * Represents the fully configured application object graph.
 */
interface Application {
  requestHandler: IRequestHandler;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  eventService: IEventService;
  apiRouter: ApiRouter;
  cookieService: ICookieService;
  flagStorageService: IFlagStorageService;
  configurationService: IConfigurationService;
  // Potentially expose other services or adapters if needed externally
}

// Define a type to represent any CDN adapter factory inputs
type AnyCDNAdapterFactoryInputs = 
  CloudflareAdapterFactoryInputs | 
  VercelAdapterFactoryInputs | 
  FastlyAdapterFactoryInputs;

/**
 * Composition Root for the application.
 * Responsible for creating and wiring up all services and adapters.
 * @param factoryInputs - Inputs required by the specific CDN adapter factory (request, env, ctx).
 * @param cdnType - The type of CDN environment ('cloudflare', 'vercel', or 'fastly').
 * @returns The configured Application object graph.
 */
function composeApplication(factoryInputs: AnyCDNAdapterFactoryInputs, cdnType: 'cloudflare' | 'vercel' | 'fastly'): Application {
  let logger: ILoggerAdapter;
  let environmentAdapter: IEnvironmentAdapter;
  let storageAdapter: IStorageAdapter;
  let requestAdapter: IRequestAdapter;
  let eventService: IEventService;
  let metricsAdapter: IMetricsAdapter | null = null;

  // 1. Create Adapter Factory based on CDN type
  switch (cdnType) {
    case 'cloudflare':
      const cloudflareFactory = new CloudflareAdapterFactory(factoryInputs as CloudflareAdapterFactoryInputs);
      logger = cloudflareFactory.createLoggerAdapter();
      environmentAdapter = cloudflareFactory.createEnvironmentAdapter();
      storageAdapter = cloudflareFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
      requestAdapter = cloudflareFactory.createRequestAdapter();
      // Create Cloudflare-specific metrics adapter
      try {
        metricsAdapter = cloudflareFactory.createMetricsAdapter();
        logger.info("[Composition Root] Metrics adapter created successfully.");
      } catch (error) {
        logger.warn("[Composition Root] Failed to create metrics adapter, continuing without metrics tracking.", error);
      }
      // Create Cloudflare-specific event service
      eventService = new CloudflareEventService(storageAdapter, environmentAdapter, logger);
      break;
    
    case 'vercel':
      const vercelFactory = new VercelAdapterFactory(factoryInputs as VercelAdapterFactoryInputs);
      logger = vercelFactory.createLoggerAdapter();
      environmentAdapter = vercelFactory.createEnvironmentAdapter();
      storageAdapter = vercelFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
      requestAdapter = vercelFactory.createRequestAdapter();
      // For now, use EventDispatcher with IEventService for Vercel
      eventService = new EventDispatcher(logger, environmentAdapter);
      break;
    
    case 'fastly':
      const fastlyFactory = new FastlyAdapterFactory(factoryInputs as FastlyAdapterFactoryInputs);
      logger = fastlyFactory.createLoggerAdapter();
      environmentAdapter = fastlyFactory.createEnvironmentAdapter();
      storageAdapter = fastlyFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
      requestAdapter = fastlyFactory.createRequestAdapter();
      // For now, use EventDispatcher with IEventService for Fastly
      eventService = new EventDispatcher(logger, environmentAdapter);
      break;
    
    default:
      throw new Error(`Unsupported CDN type: ${cdnType}`);
  }

  logger.debug(`Composition Root: ${cdnType.toUpperCase()} adapters created/retrieved.`);

  // 3. Create Services (inject dependencies)
  const cacheService = new CacheService(storageAdapter, logger);
  const flagStorageServiceConfig = {
    cacheEnabled: true,
    // Enable automatic cleanup by default (can be disabled via env variables)
    autoCleanup: process.env.OPTIMIZELY_DISABLE_AUTO_CLEANUP !== 'true',
    // Default cleanup interval is 5 minutes (300,000 ms), but can be configured via env variables
    cleanupIntervalMs: process.env.OPTIMIZELY_CLEANUP_INTERVAL_MS ? 
      parseInt(process.env.OPTIMIZELY_CLEANUP_INTERVAL_MS, 10) : 300000
  };

  // Log cleanup configuration
  logger.info(`[Composition Root] FlagStorage cleanup configuration: autoCleanup=${flagStorageServiceConfig.autoCleanup}, interval=${flagStorageServiceConfig.cleanupIntervalMs}ms`);

  const flagStorageService = new FlagStorageService(storageAdapter, logger, flagStorageServiceConfig);
  const datafileService = new DatafileService(
    storageAdapter, 
    environmentAdapter, 
    logger, 
    metricsAdapter || undefined,
    flagStorageService
  );
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  
  // Get default SDK key from environment if available
  const defaultSdkKey = (environmentAdapter.getVariable('OPTIMIZELY_SDK_KEY') || undefined);
  
  // Initialize User Profile Service for sticky bucketing
  const userProfileServiceEnabled = process.env.OPTIMIZELY_ENABLE_USER_PROFILE_SERVICE === 'true';
  let userProfileServiceAdapter: OptimizelyUserProfileServiceAdapter | undefined = undefined;
  
  if (userProfileServiceEnabled && defaultSdkKey) {
    logger.info("[Composition Root] User Profile Service is enabled for sticky bucketing");
    try {
      // Create the KV User Profile Service with the storage adapter
      const kvUserProfileService = new KVUserProfileService(
        storageAdapter,
        logger,
        {
          sdkKey: defaultSdkKey,
          keyPrefix: 'optly-ups',
          ttl: process.env.OPTIMIZELY_UPS_TTL ? parseInt(process.env.OPTIMIZELY_UPS_TTL, 10) : undefined,
          maxCacheSize: process.env.OPTIMIZELY_UPS_CACHE_SIZE ? parseInt(process.env.OPTIMIZELY_UPS_CACHE_SIZE, 10) : 100
        }
      );
      
      // Create the adapter that bridges our User Profile Service with the Optimizely SDK
      userProfileServiceAdapter = new OptimizelyUserProfileServiceAdapter(kvUserProfileService, logger);
      logger.info("[Composition Root] User Profile Service successfully initialized");
    } catch (error) {
      logger.error("[Composition Root] Failed to initialize User Profile Service", error);
    }
  } else {
    if (!userProfileServiceEnabled) {
      logger.info("[Composition Root] User Profile Service is disabled (set OPTIMIZELY_ENABLE_USER_PROFILE_SERVICE=true to enable)");
    } else if (!defaultSdkKey) {
      logger.warn("[Composition Root] User Profile Service requires a default SDK key (OPTIMIZELY_SDK_KEY) to be set");
    }
  }
  
  // Create Decision Service with optional User Profile Service
  const decisionService = new DecisionService(
    configService, 
    logger, 
    defaultSdkKey,
    userProfileServiceAdapter
  );
  
  const cookieService = new CookieService(logger);
  const configurationService = configService;
  
  // Create API Router for handling API endpoints
  const apiRouter = new ApiRouter(
    datafileService,
    cacheService,
    configService,
    logger,
    metricsAdapter || undefined
  );
  
  // Add this configuration block before creating RequestHandler
  const cleanupConfig = {
    triggerIntervalMs: process.env.OPTIMIZELY_CLEANUP_TRIGGER_INTERVAL_MS 
      ? parseInt(process.env.OPTIMIZELY_CLEANUP_TRIGGER_INTERVAL_MS, 10) 
      : 3600000, // Default: 1 hour
    triggerProbability: process.env.OPTIMIZELY_CLEANUP_TRIGGER_PROBABILITY 
      ? parseFloat(process.env.OPTIMIZELY_CLEANUP_TRIGGER_PROBABILITY) 
      : 0.1, // Default: 10%
    requestTriggeringEnabled: process.env.OPTIMIZELY_DISABLE_REQUEST_CLEANUP_TRIGGER !== 'true'
  };
  
  // Log cleanup configuration
  logger.info(`[Composition Root] Request handler cleanup configuration: interval=${cleanupConfig.triggerIntervalMs}ms, probability=${cleanupConfig.triggerProbability*100}%, enabled=${cleanupConfig.requestTriggeringEnabled}`);
  
  // Create RequestHandler with cleanup configuration
  const requestHandler = new RequestHandler(
    decisionService, 
    eventService, 
    logger, 
    cacheService, 
    undefined, // edgeModeIntegration
    metricsAdapter || undefined,
    cookieService,
    flagStorageService,
    configurationService,
    cleanupConfig,
    apiRouter
  );

  logger.debug("Composition Root: Services instantiated.");

  // 4. Return the composed application graph
  return {
    requestHandler,
    cacheService,
    datafileService,
    eventService,
    apiRouter,
    cookieService,
    flagStorageService,
    configurationService
  };
}

/**
 * Main entry point function to handle a Cloudflare Worker request.
 * It sets up the application via the composition root and calls the request handler.
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
  const factoryInputs: CloudflareAdapterFactoryInputs = { request, env, ctx };
  return handleRequest(factoryInputs, 'cloudflare');
}

/**
 * Main entry point function to handle a Vercel Edge request.
 * It sets up the application via the composition root and calls the request handler.
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
  const factoryInputs: VercelAdapterFactoryInputs = { request, env, ctx };
  return handleRequest(factoryInputs, 'vercel');
}

/**
 * Main entry point function to handle a Fastly Compute@Edge request.
 * It sets up the application via the composition root and calls the request handler.
 * @param request - The incoming Request object.
 * @param env - The environment bindings and variables.
 * @param ctx - The execution context.
 * @returns A Promise resolving to the Response object.
 */
export async function handleFastlyComputeRequest(
  request: Request,
  env: FastlyEnv,
  ctx: FastlyExecutionContext
): Promise<Response> {
  const factoryInputs: FastlyAdapterFactoryInputs = { request, env, ctx };
  return handleRequest(factoryInputs, 'fastly');
}

/**
 * For backward compatibility
 */
export async function handleWorkerRequest(
  request: Request,
  env: CloudflareEnv,
  ctx: CloudflareExecutionContext
): Promise<Response> {
  return handleCloudflareWorkerRequest(request, env, ctx);
}

/**
 * Common request handling logic for all CDN types.
 * @param factoryInputs - The adapter factory inputs.
 * @param cdnType - The type of CDN ('cloudflare', 'vercel', or 'fastly').
 * @returns A Promise resolving to the Response object.
 */
async function handleRequest(
  factoryInputs: AnyCDNAdapterFactoryInputs, 
  cdnType: 'cloudflare' | 'vercel' | 'fastly'
): Promise<Response> {
  try {
    // 1. Compose the application
    const app = composeApplication(factoryInputs, cdnType);

    // 2. Create the specific RequestAdapter for this request
    let requestAdapter: IRequestAdapter;
    switch (cdnType) {
      case 'cloudflare':
        requestAdapter = new CloudflareAdapterFactory(factoryInputs as CloudflareAdapterFactoryInputs).createRequestAdapter();
        break;
      case 'vercel':
        requestAdapter = new VercelAdapterFactory(factoryInputs as VercelAdapterFactoryInputs).createRequestAdapter();
        break;
      case 'fastly':
        requestAdapter = new FastlyAdapterFactory(factoryInputs as FastlyAdapterFactoryInputs).createRequestAdapter();
        break;
      default:
        throw new Error(`Unsupported CDN type: ${cdnType}`);
    }

    // 3. Handle the request with RequestHandler (which will delegate to ApiRouter for API requests)
    const result = await app.requestHandler.handleRequest(requestAdapter);

    // 4. Convert ResponseResult to standard Response object
    // Ensure headers are correctly formatted
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(result.headers || {})) {
      responseHeaders.append(key, value);
    }

    return new Response(result.body, {
      status: result.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`!!! Critical Error during Composition or Request Handling (${cdnType}) !!!`, error);
    // Attempt to log using a failsafe logger if possible, otherwise just console
    try {
      let logger: ILoggerAdapter;
      switch (cdnType) {
        case 'cloudflare':
          logger = new CloudflareAdapterFactory(factoryInputs as CloudflareAdapterFactoryInputs).createLoggerAdapter();
          break;
        case 'vercel':
          logger = new VercelAdapterFactory(factoryInputs as VercelAdapterFactoryInputs).createLoggerAdapter();
          break;
        case 'fastly':
          logger = new FastlyAdapterFactory(factoryInputs as FastlyAdapterFactoryInputs).createLoggerAdapter();
          break;
        default:
          throw new Error(`Unsupported CDN type: ${cdnType}`);
      }
      logger.error(`Critical error in request handling: ${error instanceof Error ? error.message : String(error)}`, error);
    } catch (loggerError) {
      console.error('Failed to create failsafe logger', loggerError);
    }

    // Return a generic error response
    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
} 