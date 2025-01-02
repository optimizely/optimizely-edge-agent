/**
 * @module ApiRouter
 *
 * The ApiRouter module is responsible for routing the incoming requests to the appropriate handlers. The APIRouter only handles requests
 * that are related to the API. Specifically for updating and retrieving datafiles and flag keys in the KV store of the CDN provider.
 *
 * The following methods are implemented:
 * - apiRouter(request, abstractionHelper, kvStore, logger, defaultSettings) - Manually handle routing based on URL and method.
 * - handleRequest(request, abstractionHelper, kvStore, logger, defaultSettings) - Handle incoming requests using the manual routing function.
 */

// Define your route handlers as before
import defaultSettings from '../../utils/config/defaultSettings';
import { logger } from '../../utils/optimizelyHelper';
import * as handlers from './handlers';

/**
 * Manually handle routing based on URL and method.
 * @param {Request} request - The incoming request.
 * @returns {Promise<Response>} - The response from the appropriate handler.
 */
async function apiRouter(request, abstractionHelper, kvStore, logger, defaultSettings) {
	const url = abstractionHelper.abstractRequest.getNewURL(request.url);
	const path = abstractionHelper.abstractRequest.getPathnameFromRequest(request);
	const method = abstractionHelper.abstractRequest.getHttpMethodFromRequest(request);

	// Define route patterns and corresponding handlers
	const routes = {
		'/v1/api/datafiles/:key': {
			GET: handlers.handleGetDatafile,
			POST: handlers.handleDatafile,
		},
		'/v1/api/flag_keys': {
			POST: handlers.handleFlagKeys,
			GET: handlers.handleGetFlagKeys,
		},
		'/v1/api/sdk/:sdk_url': {
			GET: handlers.handleSDK,
		},
		'/v1/api/variation_changes/:experiment_id/:api_token': {
			GET: handlers.handleVariationChanges,
			POST: handlers.handleVariationChanges,
		},
	};

	// Find a matching route and method
	for (let route in routes) {
		const routePattern = new RegExp('^' + route.replace(/:\w+/g, '([^/]+)') + '$');
		const match = routePattern.exec(path);
		if (match && routes[route][method]) {
			const params = {};
			const paramNames = route.match(/:\w+/g);

			if (paramNames) {
				paramNames.forEach((paramName, index) => {
					params[paramName.slice(1)] = match[index + 1];
				});
			}

			const result = routes[route][method](request, abstractionHelper, kvStore, logger, defaultSettings, params);
			logger.debug('ApiRouter: Handled request for URL ', url.href, '- Method:', method);
			return result;
		}
	}

	// No route found, return 404 Not Found
	return new Response('Not found', { status: 404 });
}

/**
 * Handle incoming requests using the manual routing function.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to the response.
 */
export default async function handleRequest(request, abstractionHelper, kvStore, logger, defaultSettings) {
	logger.debug('Api Router: Handling API request.');
	return await apiRouter(request, abstractionHelper, kvStore, logger, defaultSettings);
}
