import {
  FastlyAdapterFactory,
  FastlyAdapterFactoryInputs,
} from "../adapters/factories/FastlyAdapterFactory";

import {
  FastlyEnv,
  FastlyExecutionContext
} from "../adapters/implementations/fastly/FastlyEnvironmentAdapter";

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
import { createFormattedResponse, fixContentTypeForHtml } from "../utils/responseUtils";
import { CacheService } from "../services/implementations/CacheService";
import { ICacheService } from "../services/interfaces/ICacheService";
import { DatafileService } from "../services/implementations/DatafileService";
import { IDatafileService } from "../services/interfaces/IDatafileService";
import { IEventService } from "../services/interfaces/IEventService";
import { FlagStorageService } from "../services/implementations/FlagStorageService";

// Define the binding name for the primary KV namespace used by ConfigService
const CONFIG_KV_BINDING_NAME = 'OPTLY_HYBRID_AGENT_KV';

/**
 * Represents the fully configured Fastly application object graph.
 */
interface FastlyApplication {
  requestHandler: IRequestHandler;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  eventService: IEventService;
}

/**
 * Composes the application with Fastly-specific adapters.
 * @param factoryInputs - Inputs required by the Fastly adapter factory.
 * @returns The configured FastlyApplication object graph.
 */
function composeFastlyApplication(factoryInputs: FastlyAdapterFactoryInputs): FastlyApplication {
  let logger: ILoggerAdapter;
  let environmentAdapter: IEnvironmentAdapter;
  let storageAdapter: IStorageAdapter;
  let requestAdapter: IRequestAdapter;
  let eventService: IEventService;

  // Create Fastly adapter factory
  const fastlyFactory = new FastlyAdapterFactory(factoryInputs);
  logger = fastlyFactory.createLoggerAdapter();
  environmentAdapter = fastlyFactory.createEnvironmentAdapter();
  storageAdapter = fastlyFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
  requestAdapter = fastlyFactory.createRequestAdapter();
  
  // Create EventDispatcher for Fastly
  eventService = new EventDispatcher(logger, environmentAdapter);

  logger.debug("Fastly Composition: FASTLY adapters created/retrieved.");

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
    undefined, // metricsAdapter - Fastly doesn't have metrics yet
    flagStorageService,  // Pass FlagStorageService as 5th parameter
    undefined  // ConfigurationService will be injected later to avoid circular dependency
  );
  
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  
  // Inject ConfigurationService back into DatafileService to resolve circular dependency
  datafileService.setConfigService(configService);
  
  const decisionService = new DecisionService(configService, logger);
  
  // Create RequestHandler
  const requestHandler = new RequestHandler(
    decisionService, 
    eventService, 
    logger, 
    cacheService
  );

  logger.debug("Fastly Composition: Services instantiated.");

  // Return the composed application graph
  return {
    requestHandler,
    cacheService,
    datafileService,
    eventService
  };
}

/**
 * Main entry point function to handle a Fastly Compute@Edge request.
 * It sets up the application via the Fastly-specific composition and calls the request handler.
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
  try {
    // 1. Compose the application
    const factoryInputs: FastlyAdapterFactoryInputs = { request, env, ctx };
    const app = composeFastlyApplication(factoryInputs);

    // 2. Create the Request Adapter for this request
    const requestAdapter = new FastlyAdapterFactory(factoryInputs).createRequestAdapter();

    // 3. Handle the request using the composed RequestHandler
    const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);

    // 4. Ensure body is a string and fix Content-Type for HTML content
    const bodyString = typeof result.body === 'string' ? result.body : String(result.body || '');
    const finalHeaders = fixContentTypeForHtml(bodyString, result.headers || {});
    
    console.log('[Fastly Composition] Creating response with headers:', JSON.stringify(finalHeaders, null, 2));

    // 5. Return the response using the utility function for proper content type handling
    return createFormattedResponse(
      bodyString,
      result.status,
      finalHeaders,
      'application/json' // Default content type
    );
  } catch (error) {
    // Handle any errors that occurred during processing
    console.error("[Fastly Composition] Error handling request:", error);
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