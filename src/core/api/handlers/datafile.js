/**
 * @module Datafile
 *
 * The Datafile module is responsible for handling the datafile API.
 * It will get or put the datafile in the KV store of the CDN provider.
 *
 * The following methods are implemented:
 * - handleDatafile(request, abstractionHelper, kvStore, logger, defaultSettings, params) - Fetches and updates the Optimizely datafile based on the provided datafile key.
 * - handleGetDatafile(request, abstractionHelper, kvStore, logger, defaultSettings, params) - Retrieves the current Optimizely SDK datafile from KV storage.
 */

import { AbstractRequest } from '../../../core/interfaces/abstractRequest';
import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../config/defaultSettings';

/**
 * Fetches and updates the Optimizely datafile based on the provided datafile key.
 * @param {Request} request - The incoming request object.
 * @param {object} env - The environment object.
 * @param {object} ctx - The context object.
 * @param {object} abstractionHelper - The abstraction helper to create responses and read request body.
 * @param {object} kvStore - The key-value store object.
 * @param {object} logger - The logger object for logging errors.
 * @returns {Promise<Response>} - A promise that resolves to the response object.
 */
const handleDatafile = async (request, abstractionHelper, kvStore, logger, defaultSettings, params = {}) => {
	logger.debug('API Router - Handling Datafile via POST [handleDatafile]');

	// Check if the incoming request is a POST method, return 405 if not allowed
	if (abstractionHelper.abstractRequest.getHttpMethodFromRequest(request) !== 'POST') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	const datafileKey = params.key;
	const datafileUrl = `https://cdn.optimizely.com/datafiles/${datafileKey}.json`;
	logger.debug('API Router - Datafile URL:', datafileUrl);

	/**
	 * Processes the response from the datafile API.
	 * @param {Response} response - The response object from the datafile API.
	 * @returns {Promise<string>} - A promise that resolves to the stringified JSON or text content.
	 */
	async function processResponse(response) {
		logger.debug('API Router - Processing response [processResponse]');
		return abstractionHelper.getResponseContent(response);
	}

	if (!datafileKey)
		return abstractionHelper.createResponse('Datafile SDK key is required but it is missing from the request.', 400);

	try {
		logger.debug('API Router - Fetching datafile [fetchRequest]');
		const datafileResponse = await AbstractRequest.fetchRequest(datafileUrl);
		logger.debugExt('API Router - Datafile response:', datafileResponse);
		const jsonString = await processResponse(datafileResponse);
		await kvStore.put(datafileKey, jsonString);
		const kvDatafile = await kvStore.get(datafileKey);

		const responseObject = {
			message: `Datafile updated to Key: ${datafileKey}`,
			datafile: kvDatafile,
		};

		return abstractionHelper.createResponse(responseObject, 200, { 'Content-Type': 'application/json' });
	} catch (error) {
		logger.error('Error in handleDatafile:', error.message);
		return abstractionHelper.createResponse(`Error updating datafile: ${JSON.stringify(error)}`, 500);
	}
};

/**
 * Retrieves the current Optimizely SDK datafile from KV storage.
 * This function handles GET requests to fetch the stored datafile and return it to the client.
 * @param {Request} request - The incoming request object.
 * @param {object} env - The environment object.
 * @param {object} ctx - The context object.
 * @param {object} abstractionHelper - The abstraction helper to create responses.
 * @param {object} kvStore - The key-value store object.
 * @param {object} logger - The logger object for logging errors.
 * @returns {Promise<Response>} - A promise that resolves to the response containing the datafile.
 */
const handleGetDatafile = async (request, abstractionHelper, kvStore, logger, defaultSettings, params) => {
	logger.debug('API Router - Handling Datafile via GET [handleGetDatafile]');
	// Check if the incoming request is a GET method, return 405 if not allowed
	if (abstractionHelper.abstractRequest.getHttpMethodFromRequest(request) !== 'GET') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	const datafileKey = params.key;
	logger.debug('API Router - Datafile key:', datafileKey);

	try {
		// const datafile = await kvStore.get(defaultSettings.kv_key_optly_sdk_datafile);
		const datafile = await kvStore.get(datafileKey);
		logger.debugExt('API Router - Datafile:', datafile);

		if (!datafile) {
			return abstractionHelper.createResponse('Datafile not found', 404);
		}

		return abstractionHelper.createResponse(datafile, 200, { 'Content-Type': 'application/json' });
	} catch (error) {
		logger.error('Error retrieving the datafile:', error.message);
		return abstractionHelper.createResponse('Error retrieving datafile', 500);
	}
};

// Export both functions using named exports
export { handleDatafile, handleGetDatafile };
