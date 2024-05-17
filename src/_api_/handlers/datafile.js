/**
 * Fetches and updates the Optimizely datafile based on the provided datafile key.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to the response object.
 */
const handleDatafile = async (request, env, ctx) => {
	const datafileKey = request.params.key;
	const datafileUrl = `https://cdn.optimizely.com/datafiles/${datafileKey}.json`;

	/**
	 * Processes the response from the datafile API.
	 * @param {Response} response - The response object from the datafile API.
	 * @returns {Promise<string>} - A promise that resolves to the stringified JSON or text content.
	 */
	async function processResponse(response) {
		const { headers } = response;
		const contentType = headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			return JSON.stringify(await response.json());
		}
		return response.text();
	}

	const initJSON = {
		headers: {
			'content-type': 'application/json;charset=UTF-8',
		},
	};

	try {
		const datafileResponse = await fetch(datafileUrl, initJSON);
		const jsonString = await processResponse(datafileResponse);
		await env.OPTLY_HYBRID_AGENT_KV.put('optly_sdk_datafile', jsonString);
		const kvDatafile = await OPTLY_HYBRID_AGENT_KV.get('optly_sdk_datafile');

		const headers = {
			'Access-Control-Allow-Origin': '*',
			'Content-type': 'application/json',
		};

		return new Response(`Datafile updated to Key: ${datafileKey}\n\nDatafile JSON: ${kvDatafile}`, { headers });
	} catch (error) {
		console.error('Error in handleDatafile:', error);
		return new Response('Error updating datafile', { status: 500 });
	}
};

/**
 * Retrieves the current Optimizely SDK datafile from KV storage.
 * This function handles GET requests to fetch the stored datafile and return it to the client.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to the response containing the datafile.
 */
const handleGetDatafile = async (request, env, ctx) => {
	// Define the key under which the datafile is stored in KV storage
	const datafileKey = 'optly_sdk_datafile';

	try {
		// Retrieve the datafile from KV storage
		const datafile = await env.OPTLY_HYBRID_AGENT_KV.get(datafileKey);

		if (!datafile) {
			// Handle the case where the datafile is not found in the storage
			return new Response('Datafile not found', { status: 404 });
		}

		// Set response headers to define content type
		const headers = {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		};

		// Return the datafile as a JSON response
		return new Response(datafile, { headers });
	} catch (error) {
		// Log and handle any errors that occur during the process
		console.error('Error retrieving the datafile:', error);
		return new Response('Error retrieving datafile', { status: 500 });
	}
};

export { handleDatafile, handleGetDatafile };
