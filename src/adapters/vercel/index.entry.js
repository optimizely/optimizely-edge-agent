/**
 * @file index.js
 * @author Simone Coelho - Optimizely
 * @description Main entry point for the Vercel Edge Function
 */
import { NextResponse } from 'next/server';
// CDN specific imports
import VercelAdapter from './cdn-adapters/vercel/vercelAdapter';
import VercelKVInterface from './cdn-adapters/vercel/vercelKVInterface';

// Application specific imports
import CoreLogic from './coreLogic'; // Assume this is your application logic module
import OptimizelyProvider from './_optimizely_/optimizelyProvider';
import defaultSettings from './_config_/defaultSettings';
import * as optlyHelper from './_helpers_/optimizelyHelper';
import { getAbstractionHelper } from './_helpers_/abstractionHelper';
import Logger from './_helpers_/logger';
import EventListeners from './_event_listeners_/eventListeners';
import handleRequest from './_api_/apiRouter';
//
let abstractionHelper, logger;
// Define the request, environment, and context objects after initializing the AbstractionHelper
let _abstractRequest, _request, _env;

/**
 * Instance of OptimizelyProvider
 * @type {OptimizelyProvider}
 */
// const optimizelyProvider = new OptimizelyProvider('<YOUR_SDK_KEY>');
let optimizelyProvider;

/**
 * Instance of CoreLogic
 * @type {CoreLogic}
 */
// let coreLogic = new CoreLogic(optimizelyProvider);
let coreLogic;

/**
 * Instance of VercelAdapter
 * @type {VercelAdapter}
 */
// let adapter = new VercelAdapter(coreLogic);
let cdnAdapter;

/**
 * Main handler for incoming requests.
 * @param {Request} request - The incoming request.
 * @returns {Promise<Response>} The response to the incoming request.
 */
export default async function handler(request) {
	const env = {}; // Initialize env object based on your environment setup

	// Get the logger instance
	logger = new Logger(env, 'info'); // Creates or retrieves the singleton logger instance

	// Get the AbstractionHelper instance
	abstractionHelper = getAbstractionHelper(request, env, {}, logger);

	// Set the request, environment, and context objects after initializing the AbstractionHelper
	_abstractRequest = abstractionHelper.abstractRequest;
	_request = abstractionHelper.request;
	_env = abstractionHelper.env;
	const pathName = _abstractRequest.getPathname();

	// Check if the request matches any of the API routes, HTTP Method must be "POST"
	let normalizedPathname = _abstractRequest.getPathname();
	if (normalizedPathname.startsWith('//')) {
		normalizedPathname = normalizedPathname.substring(1);
	}
	const matchedRouteForAPI = optlyHelper.routeMatches(normalizedPathname);
	logger.debug(`Matched route for API: ${normalizedPathname}`);

	// Check if the request is for the worker operation, similar to request for asset
	let workerOperation = _abstractRequest.getHeader(defaultSettings.workerOperationHeader) === 'true';

	// Regular expression to match common asset extensions
	const assetsRegex = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i;
	// Check if the request is for an asset
	const requestIsForAsset = assetsRegex.test(pathName);
	if (workerOperation || requestIsForAsset) {
		logger.debug(`Request is for an asset or a edge worker operation: ${pathName}`);
		const assetResult = await optlyHelper.fetchByRequestObject(_request);
		return new NextResponse(assetResult.body, { ...assetResult });
	}

	// Initialize the KV store based on the CDN provider
	// ToDo - Check if KV support is enabled in headers and conditionally instantiate the KV store
	// const kvInterfaceAdapter = new VercelKVInterface(env, defaultSettings.kv_namespace);
	// const kvStore = abstractionHelper.initializeKVStore(defaultSettings.cdnProvider, kvInterfaceAdapter);

	// Use the KV store methods
	// const value = await kvStore.get(defaultSettings.kv_key_optly_flagKeys);
	// logger.debug(`Value from KV store: ${value}`);

	const url = _abstractRequest.URL;
	const httpMethod = _abstractRequest.getHttpMethod();
	const isPostMethod = httpMethod === 'POST';
	const isGetMethod = httpMethod === 'GET';

	// Check if the request is for the datafile operation
	const datafileOperation = pathName === '/v1/datafile';

	// Check if the request is for the config operation
	const configOperation = pathName === '/v1/config';

	// Check if the sdkKey is provided in the request headers
	let sdkKey = _abstractRequest.getHeader(defaultSettings.sdkKeyHeader);

	// Check if the "X-Optimizely-Enable-FEX" header is set to "true"
	let optimizelyEnabled = _abstractRequest.getHeader(defaultSettings.enableOptimizelyHeader) === 'true';

	// Verify if the "X-Optimizely-Enable-FEX" header is set to "true" and the sdkKey is not provided in the request headers,
	// if enabled and no sdkKey, attempt to get sdkKey from query parameter
	if (optimizelyEnabled && !sdkKey) {
		sdkKey = _abstractRequest.URL.searchParams.get('sdkKey');
		if (!sdkKey) {
			logger.error(`Optimizely is enabled but an SDK Key was not found in the request headers or query parameters.`);
		}
	}

	if (!requestIsForAsset && matchedRouteForAPI) {
		try {
			if (handleRequest) {
				const handlerResponse = handleRequest(_request, _env, abstractionHelper, kvStore, logger, defaultSettings);
				return new NextResponse(handlerResponse.body, { ...handlerResponse });
			} else {
				// Handle any issues during the API request handling that were not captured by the custom router
				const errorMessage = {
					error: 'Failed to initialize API router. Please check configuration and dependencies.',
				};
				return abstractionHelper.createResponse(errorMessage, 500); // Return a 500 error response
			}
		} catch (error) {
			const errorMessage = {
				errorMessage: 'Failed to load API functionality. Please check configuration and dependencies.',
				error: error,
			};
			logger.error(errorMessage);

			// Fallback to the original CDN adapter if an error occurs
			cdnAdapter = new VercelAdapter();
			return await cdnAdapter.defaultFetch(_request, _env);
		}
	} else {
		// Initialize core logic with sdkKey if the "X-Optimizely-Enable-FEX" header value is "true"
		if (!requestIsForAsset && optimizelyEnabled && !workerOperation && sdkKey) {
			try {
				// Initialize core logic with the provided SDK key
				initializeCoreLogic(sdkKey, _abstractRequest, _env, abstractionHelper);
				return cdnAdapter.handler(_request, _env, abstractionHelper);
			} catch (error) {
				logger.error('Error during core logic initialization:', error);
				return new NextResponse(JSON.stringify({ module: 'index.js', error: error.message }), { status: 500 });
			}
		} else {
			if (requestIsForAsset || !optimizelyEnabled || !sdkKey) {
				// Forward the request to the origin without any modifications
				return fetch(_request);
			}

			if ((isGetMethod && datafileOperation && configOperation) || workerOperation) {
				cdnAdapter = new VercelAdapter();
				return cdnAdapter.defaultFetch(_request, _env);
			} else {
				const errorMessage = JSON.stringify({
					module: 'index.js',
					message: 'Operation not supported',
					http_method: httpMethod,
					sdkKey: sdkKey,
					optimizelyEnabled: optimizelyEnabled,
				});
				return abstractionHelper.createResponse(errorMessage, 500); // Return a 500 error response
			}
		}
	}
}

/**
 * Initializes core logic with the provided SDK key.
 * @param {string} sdkKey - The SDK key used for initialization.
 * @param {Object} request - The incoming request object.
 * @param {Object} env - The environment object.
 * @param {Object} abstractionHelper - The abstraction helper instance.
 */
function initializeCoreLogic(sdkKey, request, env, abstractionHelper) {
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
