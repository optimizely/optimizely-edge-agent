/**
 * @module SDK
 */

import { logger } from '../../../utils/optimizelyHelper.js';
import defaultSettings from '../../../utils/config/defaultSettings.js';

/**
 * Fetches and updates the Optimizely JavaScript SDK based on the provided URL.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to the response object.
 */
const handleSDK = async (request) => {
	let sdkUrl = request.params.sdk_url;
	sdkUrl = decodeURIComponent(sdkUrl);

	/**
	 * Processes the response from the SDK URL.
	 * @param {Response} response - The response object from the SDK URL.
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

	const initSDK = {
		headers: {
			'content-type': 'text/javascript;charset=UTF-8',
		},
	};

	try {
		const sdkResponse = await fetch(sdkUrl, initSDK);
		const sdkString = await processResponse(sdkResponse);
		await OPTLY_HYBRID_AGENT_KV.put('optly_js_sdk', sdkString);

		const headers = {
			'Access-Control-Allow-Origin': '*',
			'Content-type': 'text/javascript',
		};

		return new Response(`SDK updated to: ${sdkUrl}\n`, { headers });
	} catch (error) {
		logger().error('Error in handleSDK:', error);
		return new Response('Error updating SDK', { status: 500 });
	}
};

export default handleSDK;
