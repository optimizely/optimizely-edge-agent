import { AbstractRequest } from '../../_helpers_/abstractionHelper';

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
	// Check if the incoming request is a POST method, return 405 if not allowed
	if (abstractionHelper.abstractRequest.getHttpMethodFromRequest(request) !== 'POST') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	const datafileKey = params.key;
	const datafileUrl = `https://cdn.optimizely.com/datafiles/${datafileKey}.json`;

	/**
	 * Processes the response from the datafile API.
	 * @param {Response} response - The response object from the datafile API.
	 * @returns {Promise<string>} - A promise that resolves to the stringified JSON or text content.
	 */
	async function processResponse(response) {
		return abstractionHelper.getResponseContent(response);
	}

	if (!datafileKey) return abstractionHelper.createResponse('Datafile SDK key is required but it is missing from the request.', 400);

	try {
		const datafileResponse = await AbstractRequest.fetchRequest(datafileUrl);
		const jsonString = await processResponse(datafileResponse);		
		// await kvStore.put('optly_sdk_datafile', jsonString);
		// const kvDatafile = await kvStore.get(defaultSettings.kv_key_optly_sdk_datafile);
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
	// Check if the incoming request is a GET method, return 405 if not allowed
	if (abstractionHelper.abstractRequest.getHttpMethodFromRequest(request) !== 'GET') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	const datafileKey = params.key;

	try {
		// const datafile = await kvStore.get(defaultSettings.kv_key_optly_sdk_datafile);
		const datafile = await kvStore.get(datafileKey);

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
