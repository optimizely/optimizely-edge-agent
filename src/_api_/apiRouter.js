// Define your route handlers as before
import { handleDatafile, handleGetDatafile } from './handlers/datafile';
import { handleFlagKeys, handleGetFlagKeys } from './handlers/flagKeys';
import handleSDK from './handlers/sdk';
import handleVariationChanges from './handlers/variationChanges';

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
			GET: handleGetDatafile,
			POST: handleDatafile,
		},
		'/v1/api/flag_keys': {
			POST: handleFlagKeys,
			GET: handleGetFlagKeys,
		},
		'/v1/api/sdk/:sdk_url': {
			GET: handleSDK,
		},
		'/v1/api/variation_changes/:experiment_id/:api_token': {
			GET: handleVariationChanges,
			POST: handleVariationChanges,
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
export default async function handleRequest(request, env, ctx, abstractionHelper, kvStore, logger, defaultSettings) {
	return await apiRouter(request, env, ctx, abstractionHelper, kvStore, logger, defaultSettings);
}
