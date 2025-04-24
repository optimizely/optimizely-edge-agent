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
import { CacheService } from "../services/implementations/CacheService";
import { ICacheService } from "../services/interfaces/ICacheService";
import { DatafileService } from "../services/implementations/DatafileService";
import { IDatafileService } from "../services/interfaces/IDatafileService";
import { IEventService } from "../services/interfaces/IEventService";

// Define the binding name for the primary KV namespace used by ConfigService
const CONFIG_KV_BINDING_NAME = 'OPTLY_HYBRID_AGENT_KV';

/**
 * Represents the fully configured Vercel application object graph.
 */
interface VercelApplication {
  requestHandler: IRequestHandler;
  cacheService: ICacheService;
  datafileService: IDatafileService;
  eventService: IEventService;
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
  let eventService: IEventService;

  // Create Vercel adapter factory
  const vercelFactory = new VercelAdapterFactory(factoryInputs);
  logger = vercelFactory.createLoggerAdapter();
  environmentAdapter = vercelFactory.createEnvironmentAdapter();
  storageAdapter = vercelFactory.createStorageAdapter(CONFIG_KV_BINDING_NAME);
  requestAdapter = vercelFactory.createRequestAdapter();
  
  // Create EventDispatcher for Vercel
  eventService = new EventDispatcher(logger, environmentAdapter);

  logger.debug("Vercel Composition: VERCEL adapters created/retrieved.");

  // Create Services (inject dependencies)
  const cacheService = new CacheService(storageAdapter, logger);
  const datafileService = new DatafileService(storageAdapter, environmentAdapter, logger);
  const configService: IConfigurationService = new ConfigurationService(datafileService, logger);
  const decisionService = new DecisionService(configService, logger);
  
  // Create RequestHandler
  const requestHandler = new RequestHandler(
    decisionService, 
    eventService, 
    logger, 
    cacheService
  );

  logger.debug("Vercel Composition: Services instantiated.");

  // Return the composed application graph
  return {
    requestHandler,
    cacheService,
    datafileService,
    eventService
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
    // 1. Compose the application
    const factoryInputs: VercelAdapterFactoryInputs = { request, env, ctx };
    const app = composeVercelApplication(factoryInputs);

    // 2. Create the Request Adapter for this request
    const requestAdapter = new VercelAdapterFactory(factoryInputs).createRequestAdapter();

    // 3. Handle the request using the composed RequestHandler
    const result: ResponseResult = await app.requestHandler.handleRequest(requestAdapter);

    // 4. Return the response
    return new Response(result.body, {
      status: result.status,
      headers: result.headers
    });
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