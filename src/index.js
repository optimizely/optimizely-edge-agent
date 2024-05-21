/**
 * @file index.js
 * @description Main entry point for the Edge Worker
 * The index.js file is the entry point for the Edge Worker. It is responsible for handling requests and routing them to
 * the appropriate handler.
 * The following methods are implemented:
 * - initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper, kvStore) - Initializes the core logic for the application.
 * - normalizePathname(pathName) - Normalizes the pathname by removing any leading double slashes.
 * - isAssetRequest(pathName) - Checks if the request is for an asset based on the pathname.
 * - handleApiRequest(incomingRequest, abstractionHelper, kvStore, logger, defaultSettings) - Handles API requests.
 * - handleOptimizelyRequest(sdkKey, request, env, ctx, abstractionHelper, kvStore) - Handles requests for Optimizely.
 * - handleDefaultRequest(incomingRequest, environmentVariables, context, pathName, workerOperation, sdkKey, optimizelyEnabled)
 * 	 Handles default requests.
 */

// CDN specific imports
import CloudflareAdapter from './cdn-adapters/cloudflare/cloudflareAdapter';
import CloudflareKVInterface from './cdn-adapters/cloudflare/cloudflareKVInterface';
// Import the registered listeners
import './_event_listeners_/registered-listeners/registeredListeners';
// Application specific imports
import CoreLogic from './coreLogic';
import OptimizelyProvider from './_optimizely_/optimizelyProvider';
import defaultSettings from './_config_/defaultSettings';
import * as optlyHelper from './_helpers_/optimizelyHelper';
import { getAbstractionHelper } from './_helpers_/abstractionHelper';
import Logger from './_helpers_/logger';
import handleRequest from './_api_/apiRouter';

let abstractionHelper, logger, abstractRequest, incomingRequest, environmentVariables, context;
let optimizelyProvider, coreLogic, cdnAdapter;

/**
 * Initializes the core logic of the application.
 * @param {string} sdkKey - The SDK key for Optimizely.
 * @param {Request} request - The incoming request.
 * @param {object} env - The environment bindings.
 * @param {object} ctx - The execution context.
 * @param {object} abstractionHelper - The abstraction helper instance.
 * @param {object} kvStore - The key-value store instance.
 * @throws Will throw an error if the SDK key is not provided.
 */
function initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper, kvStore) {
	logger.debug('Edgeworker index.js - Initializing core logic [initializeCoreLogic]');
	if (!sdkKey) {
		throw new Error('SDK Key is required for initialization.');
	}
	logger.debug(`Initializing core logic with SDK Key: ${sdkKey}`);
	optimizelyProvider = new OptimizelyProvider(sdkKey, request, env, ctx, abstractionHelper);
	coreLogic = new CoreLogic(optimizelyProvider, env, ctx, sdkKey, abstractionHelper, kvStore, logger);
	cdnAdapter = new CloudflareAdapter(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, logger);
	optimizelyProvider.setCdnAdapter(cdnAdapter);
	coreLogic.setCdnAdapter(cdnAdapter);
}

/**
 * Normalizes the pathname by removing any leading double slashes.
 * @param {string} pathName - The pathname to normalize.
 * @returns {string} The normalized pathname.
 */
function normalizePathname(pathName) {
	return pathName.startsWith('//') ? pathName.substring(1) : pathName;
}

/**
 * Checks if the request is for an asset based on the pathname.
 * @param {string} pathName - The pathname of the request.
 * @returns {boolean} True if the request is for an asset, false otherwise.
 */
function isAssetRequest(pathName) {
	logger.debug('Edgeworker index.js - Checking if request is for an asset [isAssetRequest]');
	const assetsRegex = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i;
	return assetsRegex.test(pathName);
}

/**
 * Initializes the key-value store.
 * @param {object} env - The environment bindings.
 * @returns {object} The initialized key-value store.
 */
function initializeKVStore(env) {
	logger.debug('Edgeworker index.js - Initializing KV store [initializeKVStore]');
	const kvInterfaceAdapter = new CloudflareKVInterface(env, defaultSettings.kv_namespace);
	return abstractionHelper.initializeKVStore(defaultSettings.cdnProvider, kvInterfaceAdapter);
}

/**
 * Retrieves the SDK key from the request headers or query parameters.
 * @param {object} abstractRequest - The abstracted request object.
 * @returns {string|null} The SDK key if found, otherwise null.
 */
function getSdkKey(abstractRequest) {
	logger.debug('Edgeworker index.js - Getting SDK key [getSdkKey]');
	let sdkKey = abstractRequest.getHeader(defaultSettings.sdkKeyHeader);
	if (!sdkKey) {
		sdkKey = abstractRequest.URL.searchParams.get('sdkKey');
	}
	return sdkKey;
}

/**
 * Handles API requests.
 * @param {Request} incomingRequest - The incoming request.
 * @param {object} abstractionHelper - The abstraction helper instance.
 * @param {object} kvStore - The key-value store instance.
 * @param {object} logger - The logger instance.
 * @param {object} defaultSettings - The default settings.
 * @returns {Promise<Response>} The response to the API request.
 */
async function handleApiRequest(incomingRequest, abstractionHelper, kvStore, logger, defaultSettings) {
	logger.debug('Edgeworker index.js - Handling API request [handleApiRequest]');
	try {
		if (handleRequest) {
			return await handleRequest(incomingRequest, abstractionHelper, kvStore, logger, defaultSettings);
		} else {
			const errorMessage = { error: 'Failed to initialize API router. Please check configuration and dependencies.' };
			return abstractionHelper.createResponse(errorMessage, 500);
		}
	} catch (error) {
		const errorMessage = {
			errorMessage: 'Failed to load API functionality. Please check configuration and dependencies.',
			error,
		};
		logger.error(errorMessage);
		cdnAdapter = new CloudflareAdapter();
		return await cdnAdapter.defaultFetch(incomingRequest, environmentVariables, context);
	}
}

/**
 * Handles requests for Optimizely.
 * @param {string} sdkKey - The SDK key for Optimizely.
 * @param {Request} request - The incoming request.
 * @param {object} env - The environment bindings.
 * @param {object} ctx - The execution context.
 * @param {object} abstractionHelper - The abstraction helper instance.
 * @param {object} kvStore - The key-value store instance.
 * @returns {Promise<Response>} The response to the Optimizely request.
 */
async function handleOptimizelyRequest(sdkKey, request, env, ctx, abstractionHelper, kvStore) {
	logger.debug('Edgeworker index.js - Handling Optimizely request [handleOptimizelyRequest]');
	try {
		initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper, kvStore);
		return cdnAdapter.fetchHandler(incomingRequest, environmentVariables, context);
	} catch (error) {
		logger.error('Error during core logic initialization:', error);
		return new Response(JSON.stringify({ module: 'index.js', error: error.message }), { status: 500 });
	}
}

/**
 * Handles default requests.
 * @param {Request} incomingRequest - The incoming request.
 * @param {object} environmentVariables - The environment bindings.
 * @param {object} context - The execution context.
 * @param {string} pathName - The pathname of the request.
 * @param {boolean} workerOperation - Indicates if the request is a worker operation.
 * @param {string} sdkKey - The SDK key for Optimizely.
 * @param {boolean} optimizelyEnabled - Indicates if Optimizely is enabled.
 * @returns {Promise<Response>} The response to the default request.
 */
async function handleDefaultRequest(
	incomingRequest,
	environmentVariables,
	context,
	pathName,
	workerOperation,
	sdkKey,
	optimizelyEnabled
) {
	logger.debug('Edgeworker index.js - Handling default request [handleDefaultRequest]');
	if (isAssetRequest(pathName) || !optimizelyEnabled || !sdkKey) {
		return fetch(incomingRequest, environmentVariables, context);
	}

	if (
		(['GET', 'POST'].includes(abstractRequest.getHttpMethod()) && ['/v1/datafile', '/v1/config'].includes(pathName)) ||
		workerOperation
	) {
		cdnAdapter = new CloudflareAdapter();
		logger.debug('Edgeworker index.js - Fetching request [handleDefaultRequest - cdnAdapter.defaultFetch]');
		return cdnAdapter.defaultFetch(incomingRequest, environmentVariables, context);
	} else {
		const errorMessage = JSON.stringify({
			module: 'index.js',
			message: 'Operation not supported',
			http_method: abstractRequest.getHttpMethod(),
			sdkKey,
			optimizelyEnabled,
		});
		return abstractionHelper.createResponse(errorMessage, 500);
	}
}

/**
 * Main handler for incoming requests.
 * @param {Request} request - The incoming request.
 * @param {object} env - The environment bindings.
 * @param {object} ctx - The execution context.
 * @returns {Promise<Response>} The response to the incoming request.
 */
export default {
	async fetch(request, env, ctx) {
		// Get the logger instance
		logger = Logger.getInstance(env);
		logger.debug('Edgeworker index.js - Edgeworker default handler [fetch]');

		// Get the abstraction helper for handling the request
		abstractionHelper = getAbstractionHelper(request, ctx, env, logger);

		// Destructure the abstraction helper to get the necessary objects
		({ abstractRequest, request: incomingRequest, env: environmentVariables, ctx: context } = abstractionHelper);

		// Get the pathname from the abstract request
		const pathName = abstractRequest.getPathname();
		logger.debug('Edgeworker index.js - Getting pathname [pathName]', pathName);

		// Normalize the pathname
		const normalizedPathname = normalizePathname(pathName);

		// Check if the route matches any API route
		const matchedRouteForAPI = optlyHelper.routeMatches(normalizedPathname);
		logger.debug(
			'Edgeworker index.js - Checking if route matches any API route [matchedRouteForAPI]',
			matchedRouteForAPI
		);

		// Check if the request is for a worker operation
		const workerOperation = abstractRequest.getHeader(defaultSettings.workerOperationHeader) === 'true';
		logger.debug('Edgeworker index.js - Checking if request is a worker operation [workerOperation]', workerOperation);

		// Check if the request is for an asset
		const requestIsForAsset = isAssetRequest(pathName);

		// If the request is for an asset or a worker operation, fetch the request directly. If a single edge worker is used for many
		// web pages and if this check is not done then every web page asset request will trigger the edge worker to attempt to determine
		// if the request is for an Optimizely operation. This will result in a large number of edge worker invocations for non-Optimizely
		// operations and will drastically reduce the edge worker's performance. If it is for an asset then simply fetch the asset.
		// If workerOperation is true then we know for a fact that it is not an Optimizely operation.
		if (workerOperation || requestIsForAsset) {
			logger.debug(`Request is for an asset or an edge worker operation: ${pathName}`);
			return abstractionHelper.abstractRequest.fetchRequest(incomingRequest);
		}

		// Initialize the KV store
		const kvStore = initializeKVStore(env);

		// Get the SDK key from the abstract request
		const sdkKey = getSdkKey(abstractRequest);

		// Check if Optimizely is enabled
		const optimizelyEnabled = abstractRequest.getHeader(defaultSettings.enableOptimizelyHeader) === 'true';
		logger.debug('Edgeworker index.js - Checking if Optimizely is enabled [optimizelyEnabled]', optimizelyEnabled);

		// If Optimizely is enabled but no SDK key is found, log an error
		if (optimizelyEnabled && !sdkKey) {
			logger.error(`Optimizely is enabled but an SDK Key was not found in the request headers or query parameters.`);
		}

		// If the request is not for an asset and matches an API route, handle the API request
		if (!requestIsForAsset && matchedRouteForAPI) {
			return handleApiRequest(incomingRequest, abstractionHelper, kvStore, logger, defaultSettings);
		}

		// If the request is not for an asset, Optimizely is enabled, not a worker operation, and has an SDK key,
		// handle the Optimizely request
		if (!requestIsForAsset && optimizelyEnabled && !workerOperation && sdkKey) {
			return handleOptimizelyRequest(
				sdkKey,
				abstractRequest,
				environmentVariables,
				context,
				abstractionHelper,
				kvStore
			);
		}

		// If none of the above conditions are met, handle the request as a default request
		return handleDefaultRequest(
			incomingRequest,
			environmentVariables,
			context,
			pathName,
			workerOperation,
			sdkKey,
			optimizelyEnabled
		);
	},
};
