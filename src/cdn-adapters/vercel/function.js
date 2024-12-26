import VercelAdapter from './vercelAdapter';
import VercelKVInterface from './vercelKVInterface';
import CoreLogic from '../../coreLogic';
import OptimizelyProvider from '../../_optimizely_/optimizelyProvider';
import defaultSettings from '../../_config_/defaultSettings';
import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import { getAbstractionHelper } from '../../_helpers_/abstractionHelper';
import Logger from '../../_helpers_/logger';
import handleRequest from '../../_api_/apiRouter';

let abstractionHelper, logger, optimizelyProvider, coreLogic, cdnAdapter;

// Initialize core logic with the provided SDK key
async function initializeCoreLogic(sdkKey, request, env, abstractionHelper) {
  if (!sdkKey) {
    throw new Error('SDK Key is required for initialization.');
  }
  logger.debug(`Initializing core logic with SDK Key: ${sdkKey}`);
  
  // Initialize the OptimizelyProvider, CoreLogic, and CDN instances
  optimizelyProvider = new OptimizelyProvider(sdkKey, request, env, abstractionHelper);
  coreLogic = new CoreLogic(optimizelyProvider, env, sdkKey, abstractionHelper);
  cdnAdapter = new VercelAdapter(coreLogic, optimizelyProvider, abstractionHelper);
  optimizelyProvider.setCdnAdapter(cdnAdapter);
  coreLogic.setCdnAdapter(cdnAdapter);
}

// Vercel Function handler for POST requests (Agent mode)
export default async function handler(request) {
  // Only handle POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
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
  
  // Set the request and environment objects
  const _abstractRequest = abstractionHelper.abstractRequest;
  const _request = abstractionHelper.request;
  const _env = abstractionHelper.env;
  
  // Get the normalized pathname
  let normalizedPathname = _abstractRequest.getPathname();
  if (normalizedPathname.startsWith('//')) {
    normalizedPathname = normalizedPathname.substring(1);
  }
  
  // Check if the request matches any of the API routes
  const matchedRouteForAPI = optlyHelper.routeMatches(normalizedPathname);
  logger.debug(`Matched route for API: ${normalizedPathname}`);
  
  if (matchedRouteForAPI) {
    try {
      if (handleRequest) {
        const handlerResponse = await handleRequest(_request, _env, abstractionHelper, kvStore, logger, defaultSettings);
        return new Response(handlerResponse.body, { 
          ...handlerResponse,
          headers: { 'Content-Type': 'application/json', ...handlerResponse.headers }
        });
      } else {
        throw new Error('Failed to initialize API router');
      }
    } catch (error) {
      logger.error('Error in API route:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process API request',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // If not an API route, check for Optimizely configuration
  const sdkKey = _abstractRequest.getHeader(defaultSettings.sdkKeyHeader) || 
                _abstractRequest.URL.searchParams.get('sdkKey');
  const optimizelyEnabled = _abstractRequest.getHeader(defaultSettings.enableOptimizelyHeader) === 'true';
  
  if (!optimizelyEnabled || !sdkKey) {
    return new Response(JSON.stringify({ 
      error: 'Optimizely not enabled or SDK key missing',
      optimizelyEnabled,
      sdkKeyPresent: !!sdkKey
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Initialize core logic
    await initializeCoreLogic(sdkKey, _request, _env, abstractionHelper);
    
    // Process the request using the CDN adapter
    return cdnAdapter.handler(_request, _env, abstractionHelper);
    
  } catch (error) {
    logger.error('Error processing request:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
