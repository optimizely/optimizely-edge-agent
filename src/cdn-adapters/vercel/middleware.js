import { NextResponse } from 'next/server';
import VercelAdapter from './vercelAdapter';
import VercelKVInterface from './vercelKVInterface';
import CoreLogic from '../../coreLogic';
import OptimizelyProvider from '../../_optimizely_/optimizelyProvider';
import defaultSettings from '../../_config_/defaultSettings';
import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import { getAbstractionHelper } from '../../_helpers_/abstractionHelper';
import Logger from '../../_helpers_/logger';

let abstractionHelper, logger, optimizelyProvider, coreLogic, cdnAdapter;

// Initialize core logic with the provided SDK key
async function initializeCoreLogic(sdkKey,request, env, ctx, abstractionHelper) {
  if (!optimizelyProvider) {
    optimizelyProvider = new OptimizelyProvider(sdkKey, request, env, ctx, abstractionHelper);
  }
  if (!coreLogic) {
    coreLogic = new CoreLogic(optimizelyProvider);
  }
  if (!cdnAdapter) {
    cdnAdapter = new VercelAdapter(coreLogic);
  }

  return coreLogic;
}

// Middleware function that handles GET requests (Edge mode)
export default async function middleware(request) {
  // Only handle GET requests in middleware
  if (request.method !== 'GET') {
    return NextResponse.next();
  }

  const env = {}; // Initialize env object based on your environment setup

  // Get the logger instance
  logger = new Logger(env, 'info');

  // Initialize the abstraction helper
  abstractionHelper = getAbstractionHelper(request, env, {}, logger);

  // Initialize KV store if KV support is enabled in headers
  let kvStore = null;
  const kvEnabled = request.headers.get(defaultSettings.kvSupportHeader) === 'true';
  if (kvEnabled) {
    const kvInterfaceAdapter = new VercelKVInterface(env, defaultSettings.kv_namespace);
    kvStore = abstractionHelper.initializeKVStore(defaultSettings.cdnProvider, kvInterfaceAdapter);
    logger.debug('KV store initialized');
  }

  // Get request details
  const pathName = request.nextUrl.pathname;

  // Check if request is for an asset or worker operation
  const workerOperation = request.headers.get(defaultSettings.workerOperationHeader) === 'true';
  const assetsRegex = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i;
  const requestIsForAsset = assetsRegex.test(pathName);

  if (workerOperation || requestIsForAsset) {
    logger.debug(`Request is for an asset or edge worker operation: ${pathName}`);
    const assetResult = await optlyHelper.fetchByRequestObject(request);
    return new NextResponse(assetResult.body, { ...assetResult });
  }

  // Check if the request is for datafile or config operations
  const datafileOperation = pathName === '/v1/datafile';
  const configOperation = pathName === '/v1/config';

  try {
    // Get the SDK key from environment or request
    const sdkKey = process.env.OPTIMIZELY_SDK_KEY || request.headers.get('x-optimizely-sdk-key');
    if (!sdkKey) {
      throw new Error('SDK key is required');
    }

    // ctx is not used in Vercel
    const ctx = {};
    abstractionHelper = getAbstractionHelper(request, env, ctx, logger);

    // Initialize core logic
    await initializeCoreLogic(sdkKey, request, env, abstractionHelper);

    // Handle datafile or config operations
    if (datafileOperation || configOperation) {
      return cdnAdapter.defaultFetch(request, env);
    }

    // Process the request using the CDN adapter
    const response = await cdnAdapter.processRequest(request, env);

    // Convert the response to NextResponse format
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers
    });

  } catch (error) {
    logger.error('Error in middleware:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Configure which paths should use the middleware
export const config = {
  // Match all request paths except for API routes
  matcher: ['/((?!api/).*)']
};
