/**
 * Reads the incoming request body using abstractionHelper.
 * Use await abstractionHelper.readRequestBody(request) in an async function to get the string.
 * @param {Request} request - The incoming request to read from.
 * @returns {Promise<Object|string|undefined>} - The parsed request body.
 */
async function readRequestBody(request) {
	const contentType = request.headers.get('content-type');

	try {
		if (contentType) {
			if (contentType.includes('application/json')) {
				return await request.json();
			} else if (contentType.includes('application/text') || contentType.includes('text/html')) {
				return await request.text();
			} else if (contentType.includes('form')) {
				const formData = await request.formData();
				const body = {};
				for (const [key, value] of formData.entries()) {
					body[key] = value;
				}
				return JSON.stringify(body);
			} else {
				return 'a file';
			}
		} else {
			return undefined;
		}
	} catch (error) {
		logger.error('Unable to determine Content-Type:', error.message);
		return undefined;
	}
}

/**
 * Checks if the given object is a valid array.
 * @param {any} arrayObject - The object to validate.
 * @returns {boolean} - True if the object is a non-empty array, false otherwise.
 */
function isValidArray(arrayObject) {
	return Array.isArray(arrayObject) && arrayObject.length !== 0;
}

/**
 * Trims each string in the given array.
 * @param {string[]} stringArray - The array of strings to trim.
 * @returns {Promise<string[]>} - A promise that resolves to the trimmed array.
 */
async function trimStringArray(stringArray) {
	if (!isValidArray(stringArray)) {
		return [];
	}
	return stringArray.map((str) => str.trim());
}

/**
 * Handles converting a comma-separated string of flag keys into a JSON response.
 * @param {string} combinedString - A string with flag keys separated by commas.
 * @param {object} abstractionHelper - The abstraction helper to create responses.
 * @returns {Response} - A Response object with JSON content.
 */
function handleFlagKeysResponse(combinedString, abstractionHelper) {
	// Split the string into an array of flag keys
	const flagKeys = combinedString.split(',');

	// Create a JSON object with a message and the array of flag keys
	const responseObject = {
		message: "Flag keys were updated successfully in the KV store.",
		flagKeys: flagKeys
	};

	// Step 3: Return a response with JSON type and stringified JSON object
	return abstractionHelper.createResponse(responseObject, 200, { 'Content-Type': 'application/json' });
}

/**
 * Handles the Flag Keys API request.
 * @param {Request} request - The incoming request.
 * @param {object} env - The environment object.
 * @param {object} ctx - The context object.
 * @param {object} abstractionHelper - The abstraction helper to create responses and read request body.
 * @param {object} kvStore - The key-value store object.
 * @param {object} logger - The logger object for logging errors.
 * @param {object} defaultSettings - The default settings object containing configuration details.
 * @returns {Promise<Response>} - A promise that resolves to the API response.
 */
const handleFlagKeys = async (request, abstractionHelper, kvStore, logger, defaultSettings) => {
	// Check if the incoming request is a POST method, return 405 if not allowed
	if (abstractionHelper.abstractRequest.getHttpMethod(request) !== 'POST') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	try {
		// Read and parse the incoming request body
		const requestBody = await abstractionHelper.readRequestBody(request);

		// Attempt to retrieve flag keys from the request body
		let flagKeys = requestBody.flagKeys;

		// Trim each string in the array of flag keys to remove extraneous whitespace
		flagKeys = await trimStringArray(flagKeys);

		// Validate the array to ensure it contains valid, non-empty data
		if (!isValidArray(flagKeys)) {
			// Return a 400 error if the flag keys do not form a valid array
			return abstractionHelper.createResponse('Expected an array of Flag Keys', 400);
		}

		// Join the flag keys into a single string separated by commas
		const combinedString = flagKeys.join(',');

		// Store the combined string of flag keys in the KV store under the specified namespace
		await kvStore.put(defaultSettings.kv_key_optly_flagKeys, combinedString);

		// Return a success response indicating the flag keys were stored correctly
		return handleFlagKeysResponse(combinedString, abstractionHelper);
	} catch (error) {
		// Log and handle any errors that occur during the process
		logger.error('Error in handleFlagKeys:', error.message);

		// Return a 500 Internal Server Error response if an exception is caught
		return abstractionHelper.createResponse(`Error: ${error.message}`, 500);
	}
};

/**
 * Retrieves flag keys stored in the KV store under the namespace 'optly_flagKeys'.
 * This method fetches the flag keys as a single string, splits them into an array, and returns them.
 * @param {Request} request - The incoming request, used if needed to validate request method or parameters.
 * @param {object} env - The environment object.
 * @param {object} ctx - The context object.
 * @param {object} abstractionHelper - The abstraction helper to create responses.
 * @param {object} kvStore - The key-value store object.
 * @param {object} logger - The logger object for logging errors.
 * @param {object} defaultSettings - The default settings object containing configuration details.
 * @returns {Promise<Response>} - A promise that resolves to the API response with the flag keys.
 */
const handleGetFlagKeys = async (request, abstractionHelper, kvStore, logger, defaultSettings) => {
	// Optionally, you can add method checks if necessary
	if (abstractionHelper.abstractRequest.getHttpMethod(request) !== 'GET') {
		return abstractionHelper.createResponse('Method Not Allowed', 405);
	}

	try {
		// Fetch the flag keys from the KV store
		const storedFlagKeys = await kvStore.get(defaultSettings.kv_key_optly_flagKeys);
		if (!storedFlagKeys) {
			return abstractionHelper.createResponse('No flag keys found', 404);
		}

		// Split the stored string by commas into an array
		const flagKeysArray = storedFlagKeys.split(',');

		// Optionally, trim each flag key and filter out any empty strings if there are unintended commas
		const trimmedFlagKeys = flagKeysArray.map((key) => key.trim()).filter((key) => key !== '');

		// Return the flag keys as a JSON response
		return abstractionHelper.createResponse(trimmedFlagKeys, 200, { 'Content-Type': 'application/json' });
	} catch (error) {
		logger.error('Error retrieving flag keys:', error.message);
		return abstractionHelper.createResponse(`Error: ${error.message}`, 500);
	}
};

// Export both functions using named exports
export { handleFlagKeys, handleGetFlagKeys };
