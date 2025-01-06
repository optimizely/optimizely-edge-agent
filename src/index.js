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
// import AkamaiAdapter from './cdn-adapters/akamai/akamaiAdapter';
// import AkamaiKVInterface from './cdn-adapters/akamai/akamaiKVInterface';
// import FastlyAdapter from './cdn-adapters/fastly/fastlyAdapter';
// import FastlyKVInterface from './cdn-adapters/fastly/fastlyKVInterface';
// import CloudFrontAdapter from './cdn-adapters/cloudfront/cloudFrontAdapter';
// import CloudFrontKVInterface from './cdn-adapters/cloudfront/cloudFrontKVInterface';
// import VercelAdapter from './cdn-adapters/vercel/vercelAdapter';
// import VercelKVInterface from './cdn-adapters/vercel/vercelKVInterface';

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

// URL of your Pages deployment
// const PAGES_URL = 'https://edge-agent-demo.pages.dev/';
const PAGES_URL = 'https://edge-agent-demo-simone-tutorial.pages.dev';

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
function initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper, kvStore, kvStoreUserProfile) {
	logger.debug('Edgeworker index.js - Initializing core logic [initializeCoreLogic]');
	if (!sdkKey) {
		throw new Error('SDK Key is required for initialization.');
	}
	logger.debug(`Initializing core logic with SDK Key: ${sdkKey}`);
	optimizelyProvider = new OptimizelyProvider(sdkKey, request, env, ctx, abstractionHelper, kvStoreUserProfile);
	coreLogic = new CoreLogic(
		optimizelyProvider,
		env,
		ctx,
		sdkKey,
		abstractionHelper,
		kvStore,
		kvStoreUserProfile,
		logger,
	);
	cdnAdapter = new CloudflareAdapter(
		coreLogic,
		optimizelyProvider,
		sdkKey,
		abstractionHelper,
		kvStore,
		kvStoreUserProfile,
		logger,
		PAGES_URL,
	);
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
	const assetsRegex = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i;
	const result = assetsRegex.test(pathName);
	logger.debug('Edgeworker index.js - Checking if request is for an asset [isAssetRequest]', result);
	return result;
}

/**
 * Initializes the key-value store for user profile.
 * @param {object} env - The environment bindings.
 * @returns {object} The initialized key-value store.
 */
function initializeKVStoreUserProfile(env) {
	if (defaultSettings.kv_user_profile_enabled) {
		logger.debug('Edgeworker index.js - Initializing KV store for user profile [initializeKVStoreUserProfile]');
		const kvInterfaceAdapterUserProfile = new CloudflareKVInterface(env, defaultSettings.kv_namespace_user_profile);
		return abstractionHelper.initializeKVStore(defaultSettings.cdnProvider, kvInterfaceAdapterUserProfile);
	} else {
		logger.debug('Edgeworker index.js - KV store for user profile is disabled [initializeKVStoreUserProfile]');
		return null;
	}
}

/**
 * Initializes the key-value store for datafile and flag keys.
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
		sdkKey = abstractRequest.URL.searchParams.get(defaultSettings.sdkKeyQueryParameter);
	}
	return sdkKey;
}

/**
 * Returns the appropriate CDN adapter based on the CDN provider.
 * @param {object} coreLogic - The core logic instance.
 * @param {object} optimizelyProvider - The Optimizely provider instance.
 * @param {string} sdkKey - The SDK key for Optimizely.
 * @param {object} abstractionHelper - The abstraction helper instance.
 * @param {object} kvStore - The key-value store instance.
 * @param {object} logger - The logger instance.
 * @returns {object} The CDN adapter instance.
 */
function getCdnAdapter(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, logger) {
	const AdapterClass = (() => {
		switch (defaultSettings.cdnProvider) {
			case 'cloudflare':
				return CloudflareAdapter;
			// case 'akamai':
			//     return AkamaiAdapter;
			// case 'fastly':
			//     return FastlyAdapter;
			// case 'cloudfront':
			//     return CloudfrontAdapter;
			// case 'vercel':
			//     return VercelAdapter;
			default:
				throw new Error(`Unsupported CDN provider: ${defaultSettings.cdnProvider}`);
		}
	})();

	if (arguments.length === 0 || coreLogic === undefined) {
		return new AdapterClass(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, logger);
	} else {
		return new AdapterClass(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, logger);
	}
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
			errorMessage: 'Failed to handler API request. Please check configuration and dependencies.',
			error,
		};
		logger.error(errorMessage);
		return await abstractionHelper.createResponse(errorMessage, 500);
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
async function handleOptimizelyRequest(sdkKey, request, env, ctx, abstractionHelper, kvStore, kvStoreUserProfile) {
	logger.debug('Edgeworker index.js - Handling Optimizely request [handleOptimizelyRequest]');
	try {
		initializeCoreLogic(sdkKey, request, env, ctx, abstractionHelper, kvStore, kvStoreUserProfile);
		const response = await cdnAdapter.fetchHandler(incomingRequest, environmentVariables, context);
		return response;
	} catch (error) {
		logger.error('Error during core logic initialization:', error);
		return abstractionHelper.createResponse({ module: 'index.js', error: error.message }, 500);
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
	optimizelyEnabled,
) {
	logger.debug('Edgeworker index.js - Handling default request [handleDefaultRequest]');

	const url = new URL(incomingRequest.url);
	const isLocalhost = url.hostname === '127.0.0.1' && url.port === '8787';

	// const PAGES_URL = 'https://hybrid.russell-loube-optimizely.com';

	if (isAssetRequest(pathName) || !optimizelyEnabled || !sdkKey || isLocalhost) {
		// Check if the request is already being handled by the worker
		if (incomingRequest.headers.get('X-Worker-Processed')) {
			return abstractionHelper.createResponse({ error: 'Endless loop detected' }, 500);
		}

		// Clone the request and add a custom header to mark it as processed
		const modifiedRequest = new Request(incomingRequest, {
			headers: { ...Object.fromEntries(incomingRequest.headers), 'X-Worker-Processed': 'true' },
		});

		logger.debug('Edgeworker index.js - Fetching request [handleDefaultRequest - modifiedRequest]', modifiedRequest);

		let newUrl;
		if (isLocalhost) {
			// Redirect to https://edgeagent.demo.optimizely.com with the same path
			newUrl = new URL(url.pathname + url.search, 'https://edgeagent.demo.optimizely.com');
		} else {
			// For non-localhost requests, proxy to the Pages deployment
			newUrl = new URL(url.pathname + url.search, PAGES_URL);
		}

		// Create a new request with the new URL
		const proxyRequest = new Request(newUrl.toString(), modifiedRequest);

		logger.debug('Edgeworker index.js - Fetching request [handleDefaultRequest - proxyRequest]', proxyRequest);

		const response = await fetch(proxyRequest, environmentVariables, context);

		logger.debug('Edgeworker index.js - Fetching request [handleDefaultRequest - response]', response);

		// Clone the response and add a header to indicate it was proxied
		const newResponse = new Response(response.body, response);
		newResponse.headers.set('X-Proxied-From', isLocalhost ? 'localhost' : PAGES_URL);

		logger.debug('Edgeworker index.js - Fetching request [handleDefaultRequest - newResponse]', newResponse);

		// Log the response body
		// const bodyText = await newResponse.clone().text();
		// logger.debug('Edgeworker index.js - Response body [handleDefaultRequest - newResponse body]', bodyText);

		return newResponse;
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

		// Ensure HTTPS protocol
		const url = new URL(request.url);
		url.protocol = 'https:';
		const httpsRequest = new Request(url.toString(), request);

		// Get the abstraction helper for handling the request with the HTTPS request
		abstractionHelper = getAbstractionHelper(httpsRequest, ctx, env, logger);

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
			matchedRouteForAPI,
		);

		// Check if the request is for a worker operation
		const workerOperation = abstractRequest.getHeader(defaultSettings.workerOperationHeader) === 'true';
		logger.debug('Edgeworker index.js - Checking if request is a worker operation [workerOperation]', workerOperation);

		// Check if the request is for an asset
		const requestIsForAsset = isAssetRequest(pathName);
		if (workerOperation) {
			logger.debug(`Request is for an asset or an edge worker operation: ${pathName}`);

			// Check if the request is already being handled by the worker
			if (incomingRequest.headers.get('X-Worker-Processed')) {
				return abstractionHelper.createResponse({ error: 'Endless loop detected' }, 500);
			}

			// Clone the request and add a custom header to mark it as processed
			const modifiedRequest = new Request(incomingRequest, {
				headers: { ...Object.fromEntries(incomingRequest.headers), 'X-Worker-Processed': 'true' },
			});

			logger.debug('Edgeworker index.js - Fetching request [workerOperation]', optimizelyEnabled);
			return abstractionHelper.abstractRequest.fetchRequest(modifiedRequest);
		}
		// Initialize the KV store
		const kvStore = initializeKVStore(env);
		const kvStoreUserProfile = initializeKVStoreUserProfile(env);

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
			const response = await handleOptimizelyRequest(
				sdkKey,
				abstractRequest,
				environmentVariables,
				context,
				abstractionHelper,
				kvStore,
				kvStoreUserProfile,
			);
			// Log the response headers
			const headers = {};
			for (const [key, value] of response.headers.entries()) {
				headers[key] = value;
			}
			logger.debug('Response headers:', JSON.stringify(headers, null, 2));

			// Log the response body
			const clonedResponse = response.clone();
			// const body = await clonedResponse.text();
			// logger.debug('Response body:', body);
			return response;
		}

		// If none of the above conditions are met, handle the request as a default request
		return handleDefaultRequest(
			incomingRequest,
			environmentVariables,
			context,
			pathName,
			workerOperation,
			sdkKey,
			optimizelyEnabled,
		);
	},
};
