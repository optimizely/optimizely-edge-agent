import {
  FastlyAdapterFactory,
  FastlyAdapterFactoryInputs,
} from "../adapters/factories/FastlyAdapterFactory";

import {
  FastlyEnv,
  FastlyExecutionContext
} from "../adapters/implementations/fastly/FastlyEnvironmentAdapter";

import { ConfigService } from "../services/implementations/ConfigService";
import { DecisionService } from "../services/implementations/DecisionService";
import { EventDispatcher } from "../services/implementations/EventDispatcher";
import { RequestHandler } from "../services/implementations/RequestHandler";
import { IRequestHandler, ResponseResult } from "../services/interfaces/IRequestHandler";
import { IEnvironmentAdapter } from "../adapters/interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../adapters/interfaces/ILoggerAdapter";
import { IStorageAdapter } from "../adapters/interfaces/IStorageAdapter";
import { IRequestAdapter } from "../adapters/interfaces/IRequestAdapter";
import { CacheService } from "../services/implementations/CacheService";
import { ICacheService } from "../services/interfaces/ICacheService";
import { DatafileService } from "../services/implementations/DatafileService";
import { IDatafileService } from "../services/interfaces/IDatafileService";
import { IEventService } from "../services/interfaces/IEventService";

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
  const datafileService = new DatafileService(storageAdapter, environmentAdapter, logger);
  const configService = new ConfigService(datafileService, logger);
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

    // 4. Return the response
    return new Response(result.body, {
      status: result.status,
      headers: result.headers
    });
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