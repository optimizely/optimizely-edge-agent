// fastlyAdapter.js

import * as optlyHelper from '../../utils/helpers/optimizelyHelper';
import * as cookieDefaultOptions from '../../config/cookieOptions';
import defaultSettings from '../../config/defaultSettings';
import EventListeners from '../../core/providers/events/eventListeners';

/**
 * Adapter class for Fastly Workers environment.
 */
class FastlyAdapter {
	/**
	 * Creates an instance of FastlyAdapter.
	 * @param {Object} coreLogic - The core logic instance.
	 */
	constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, logger) {
		this.sdkKey = sdkKey;
		this.kvStore = kvStore || undefined;
		this.logger = logger;
		this.coreLogic = coreLogic;
		this.abstractionHelper = abstractionHelper;
		this.eventQueue = [];
		this.request = undefined;
		this.env = undefined;
		this.ctx = undefined;
		this.cachedRequestHeaders = undefined;
		this.cachedRequestCookies = undefined;
		this.cookiesToSetRequest = [];
		this.headersToSetRequest = {};
		this.cookiesToSetResponse = [];
		this.headersToSetResponse = {};
		this.optimizelyProvider = optimizelyProvider;
		this.cdnSettingsMessage =
			'Failed to process the request. CDN settings are missing or require forwarding to origin.';
	}

	/**
	 * Processes incoming requests by either serving from cache or fetching from the origin,
	 * based on CDN settings. POST requests are handled directly without caching.
	 * Errors in fetching or caching are handled and logged, ensuring stability.
	 *
	 * @param {Request} request - The incoming request object.
	 * @param {Object} env - The environment object, typically containing environment-specific settings.
	 * @param {Object} ctx - The context object, used here for passing along the waitUntil promise for caching.
	 * @returns {Promise<Response>} - The processed response, either from cache or freshly fetched.
	 */
	async _fetch(request, env, ctx) {
		let fetchResponse;
		this.request = request;
		this.env = env;
		this.ctx = ctx;
		try {
			let originUrl = new URL(request.url);
			// Ensure the URL uses HTTPS
			if (originUrl.protocol !== 'https:') {
				originUrl.protocol = 'https:';
			}
			// Convert URL object back to string
			originUrl = originUrl.toString();
			const httpMethod = request.method;
			const result = await this.coreLogic.processRequest(
				request,
				env,
				ctx,
				sdkKey,
				abstractionHelper,
				kvStore,
				logger,
			);
			const cdnSettings = result.cdnExperimentSettings;
			const validCDNSettings = this.shouldFetchFromOrigin(cdnSettings);

			// Adjust origin URL based on CDN settings
			if (validCDNSettings) {
				originUrl = cdnSettings.cdnResponseURL;
			}

			// Return response for POST requests without caching
			if (httpMethod === 'POST') {
				this.logger.debug('POST request detected. Returning response without caching.');
				return result.reqResponse;
			}

			// Handle specific GET requests immediately without caching
			if (
				httpMethod === 'GET' &&
				(this.coreLogic.datafileOperation || this.coreLogic.configOperation)
			) {
				const fileType = this.coreLogic.datafileOperation ? 'datafile' : 'config file';
				this.logger.debug(
					`GET request detected. Returning current ${fileType} for SDK Key: ${this.coreLogic.sdkKey}`,
				);
				return result.reqResponse;
			}

			// Evaluate if we should fetch from the origin and/or cache
			if (
				originUrl &&
				(!cdnSettings || (validCDNSettings && !cdnSettings.forwardRequestToOrigin))
			) {
				fetchResponse = await this.fetchAndProcessRequest(request, originUrl, cdnSettings);
			} else {
				this.logger.debug(
					'No CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching.',
				);
				fetchResponse = await this.fetchDirectly(request);
			}

			return fetchResponse;
		} catch (error) {
			this.logger.error('Error processing request:', error);
			return new Response(`Internal Server Error: ${error.toString()}`, { status: 500 });
		}
	}

	/**
	 * Fetches from the origin and processes the request based on caching and CDN settings.
	 * @param {Request} originalRequest - The original request.
	 * @param {String} originUrl - The URL to fetch data from.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {Promise<Response>} - The processed response.
	 */
	async fetchAndProcessRequest(originalRequest, originUrl, cdnSettings) {
		let newRequest = this.cloneRequestWithNewUrl(originalRequest, originUrl);

		// Set headers and cookies as necessary before sending the request
		newRequest.headers.set(defaultSettings.workerOperationHeader, 'true');
		if (this.cookiesToSetRequest.length > 0) {
			newRequest = this.setMultipleReqSerializedCookies(newRequest, this.cookiesToSetRequest);
		}
		if (optlyHelper.isValidObject(this.headersToSetRequest)) {
			newRequest = this.setMultipleRequestHeaders(newRequest, this.headersToSetRequest);
		}

		let response = await fetch(newRequest);

		// Apply cache-control if present in the response
		if (response.headers.has('Cache-Control')) {
			response = new Response(response.body, response);
			response.headers.set('Cache-Control', 'public');
		}

		// Set response headers and cookies after receiving the response
		if (this.cookiesToSetResponse.length > 0) {
			response = this.setMultipleRespSerializedCookies(response, this.cookiesToSetResponse);
		}
		if (optlyHelper.isValidObject(this.headersToSetResponse)) {
			response = this.setMultipleResponseHeaders(response, this.headersToSetResponse);
		}

		// Optionally cache the response
		if (cdnSettings && cdnSettings.cacheRequestToOrigin) {
			const cacheKey = this.generateCacheKey(cdnSettings, originUrl);
			const cache = caches.default;
			await cache.put(cacheKey, response.clone());
			this.logger.debug(`Cache hit for: ${originUrl}.`);
		}

		return response;
	}

	/**
	 * Fetches directly from the origin without any caching logic.
	 * @param {Request} request - The original request.
	 * @returns {Promise<Response>} - The response from the origin.
	 */
	async fetchDirectly(request) {
		this.logger.debug('Fetching directly from origin: ' + request.url);
		return await fetch(request);
	}

	/**
	 * Determines the origin URL based on CDN settings.
	 * @param {Request} request - The original request.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {String} - The URL to fetch data from.
	 */
	getOriginUrl(request, cdnSettings) {
		if (cdnSettings && cdnSettings.cdnResponseURL) {
			this.logger.debug('Valid CDN settings detected.');
			return cdnSettings.cdnResponseURL;
		}
		return request.url;
	}

	/**
	 * Determines whether the request should fetch data from the origin based on CDN settings.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {Boolean} - True if the request should be forwarded to the origin, false otherwise.
	 */
	shouldFetchFromOrigin(cdnSettings) {
		return !!(cdnSettings && !cdnSettings.forwardRequestToOrigin && this.request.method === 'GET');
	}

	/**
	 * Handles the fetching from the origin and caching logic for GET requests.
	 * @param {Request} request - The original request.
	 * @param {String} originUrl - The URL to fetch data from.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @param {Object} ctx - The context object for caching.
	 * @returns {Promise<Response>} - The fetched or cached response.
	 */
	async handleFetchFromOrigin(request, originUrl, cdnSettings, ctx) {
		const newRequest = this.cloneRequestWithNewUrl(request, originUrl);
		const cacheKey = this.generateCacheKey(cdnSettings, originUrl);
		this.logger.debug(`Generated cache key: ${cacheKey}`);
		const cache = caches.default;
		let response = await cache.match(cacheKey);

		if (!response) {
			this.logger.debug(`Cache miss for ${originUrl}. Fetching from origin.`);
			response = await this.fetch(new Request(originUrl, newRequest));
			if (response.ok) this.cacheResponse(ctx, cache, cacheKey, response);
		} else {
			this.logger.debug(`Cache hit for: ${originUrl}.`);
		}

		return this.applyResponseSettings(response, cdnSettings);
	}

	/**
	 * Applies settings like headers and cookies to the response based on CDN settings.
	 * @param {Response} response - The response object to modify.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {Response} - The modified response.
	 */
	applyResponseSettings(response, cdnSettings) {
		// Example methods to apply headers and cookies
		response = this.setMultipleRespSerializedCookies(response, this.cookiesToSetResponse);
		response = this.setMultipleResponseHeaders(response, this.headersToSetResponse);
		return response;
	}

	/**
	 * Generates a cache key based on CDN settings, enhancing cache control by appending
	 * A/B test identifiers or using specific CDN URLs.
	 * @param {Object} cdnSettings - The CDN configuration settings.
	 * @param {string} originUrl - The request response used if forwarding to origin is needed.
	 * @returns {string} - A fully qualified URL to use as a cache key.
	 */
	generateCacheKey(cdnSettings, originUrl) {
		try {
			let cacheKeyUrl = new URL(originUrl);

			// Ensure that the pathname ends properly before appending
			let basePath = cacheKeyUrl.pathname.endsWith('/')
				? cacheKeyUrl.pathname.slice(0, -1)
				: cacheKeyUrl.pathname;

			if (cdnSettings.cacheKey === 'VARIATION_KEY') {
				cacheKeyUrl.pathname = `${basePath}/${cdnSettings.flagKey}-${cdnSettings.variationKey}`;
			} else {
				cacheKeyUrl.pathname = `${basePath}/${cdnSettings.cacheKey}`;
			}

			return cacheKeyUrl.href;
		} catch (error) {
			this.logger.error('Error generating cache key:', error);
			throw new Error('Failed to generate cache key.');
		}
	}

	/**
	 * Fetches content from the origin based on CDN settings.
	 * Handles errors in fetching to ensure the function does not break the flow.
	 * @param {Object} cdnSettings - The CDN configuration settings.
	 * @param {string} reqResponse - The request response used if forwarding to origin is needed.
	 * @returns {Promise<Response>} - The fetched response from the origin.
	 */
	async fetchFromOrigin(cdnSettings, reqResponse) {
		try {
			// for (const [key, value] of reqResponse.headers) { // Debugging headers
			// 	this.logger.debug(`${key}: ${value}`);
			// }
			const urlToFetch = cdnSettings.forwardRequestToOrigin
				? reqResponse.url
				: cdnSettings.cdnResponseURL;
			return await fetch(urlToFetch);
		} catch (error) {
			this.logger.error('Error fetching from origin:', error);
			throw new Error('Failed to fetch from origin.');
		}
	}

	/**
	 * Caches the fetched response, handling errors during caching to ensure the function's robustness.
	 * @param {Object} ctx - The context object for passing along waitUntil promise.
	 * @param {Cache} cache - The cache to store the response.
	 * @param {string} cacheKey - The cache key.
	 * @param {Response} response - The response to cache.
	 */
	async cacheResponse(ctx, cache, cacheKey, response) {
		try {
			const responseToCache = response.clone();
			ctx.waitUntil(cache.put(cacheKey, responseToCache));
			this.logger.debug('Response from origin was cached successfully. Cached Key:', cacheKey);
		} catch (error) {
			this.logger.error('Error caching response:', error);
			throw new Error('Failed to cache response.');
		}
	}

	/**
	 * Asynchronously dispatches consolidated events to the Optimizely LOGX events endpoint.
	 * @param {RequestContext} ctx - The context of the Fastly Worker.
	 * @param {Object} defaultSettings - Contains default settings such as the Optimizely events endpoint.
	 * @returns {Promise<void>} - A Promise that resolves when the event dispatch process is complete.
	 */
	async dispatchConsolidatedEvents(ctx, defaultSettings) {
		if (
			optlyHelper.arrayIsValid(this.eventQueue) &&
			this.optimizelyProvider &&
			this.optimizelyProvider.optimizelyClient
		) {
			try {
				const allEvents = await this.consolidateVisitorsInEvents(this.eventQueue);
				ctx.waitUntil(
					this.dispatchAllEventsToOptimizely(
						defaultSettings.optimizelyEventsEndpoint,
						allEvents,
					).catch((err) => {
						this.logger.error('Failed to dispatch event:', err);
					}),
				);
			} catch (error) {
				this.logger.error('Error during event consolidation or dispatch:', error);
			}
		}
	}

	/**
	 * Performs a fetch request to the origin server without any caching logic.
	 * This method replicates the default Fastly fetch behavior for Workers.
	 *
	 * @param {Request} request - The incoming request to be forwarded.
	 * @param {object} env - The environment bindings.
	 * @param {object} ctx - The execution context.
	 * @returns {Promise<Response>} - The response from the origin server, or an error response if fetching fails.
	 */
	async defaultFetch(request, env, ctx) {
		const httpMethod = request.method;
		const isPostMethod = httpMethod === 'POST';
		const isGetMethod = httpMethod === 'GET';

		try {
			this.logger.debug(`Fetching from origin for: ${request.url}`);

			// Perform a standard fetch request using the original request details
			const response = await fetch(request);

			// Check if the response was successful
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Clone the response to modify it if necessary
			let clonedResponse = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: new Headers(response.headers),
			});

			// Here you can add any headers or perform any response transformations if necessary
			// For example, you might want to remove certain headers or add custom headers
			// clonedResponse.headers.set('X-Custom-Header', 'value');

			return clonedResponse;
		} catch (error) {
			this.logger.error(`Failed to fetch: ${error.message}`);

			// Return a standardized error response
			return new Response(`An error occurred: ${error.message}`, {
				status: 500,
				statusText: 'Internal Server Error',
			});
		}
	}

	/**
	 * Performs a fetch request to the origin server using provided options.
	 * This method replicates the default Fastly fetch behavior for Workers but allows custom fetch options.
	 *
	 * @param {string} url - The URL of the request to be forwarded.
	 * @param {object} options - Options object containing fetch parameters such as method, headers, body, etc.
	 * @param {object} ctx - The execution context, if any context-specific actions need to be taken.
	 * @returns {Promise<Response>} - The response from the origin server, or an error response if fetching fails.
	 */
	async fetch(url, options = {}) {
		try {
			// Perform a standard fetch request using the URL and provided options
			const response = await fetch(url, options);

			// Check if the response was successful
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Clone the response to modify it if necessary
			let clonedResponse = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: new Headers(response.headers),
			});

			// Here you can add any headers or perform any response transformations if necessary
			// For example, you might want to remove certain headers or add custom headers
			// clonedResponse.headers.set('X-Custom-Header', 'value');

			return clonedResponse;
		} catch (error) {
			this.logger.error(`Failed to fetch: ${error.message}`);

			// Return a standardized error response
			return new Response(`An error occurred: ${error.message}`, {
				status: 500,
				statusText: 'Internal Server Error',
			});
		}
	}

	/**
	 * Fetches the datafile from the CDN using the provided SDK key. The function includes error handling to manage
	 * unsuccessful fetch operations. The datafile is fetched with a specified cache TTL.
	 *
	 * @param {string} sdkKey - The SDK key used to build the URL for fetching the datafile.
	 * @param {number} [ttl=3600] - The cache TTL in seconds, defaults to 3600 seconds if not specified.
	 * @returns {Promise<string>} The content of the datafile as a string.
	 * @throws {Error} Throws an error if the fetch operation is unsuccessful or the response is not OK.
	 */
	async getDatafile(sdkKey, ttl = 3600) {
		const url = `https://cdn.optimizely.com/datafiles/${sdkKey}.json`;
		try {
			const response = await this.fetch(url, { cf: { cacheTtl: ttl } });
			if (!response.ok) {
				throw new Error(`Failed to fetch datafile: ${response.statusText}`);
			}
			return await response.text();
		} catch (error) {
			this.logger.error(`Error fetching datafile for SDK key ${sdkKey}: ${error}`);
			throw new Error('Error fetching datafile.');
		}
	}

	/**
	 * Creates an error details object to encapsulate information about errors during request processing.
	 * @param {Request} request - The HTTP request object from which the URL will be extracted.
	 * @param {Error} error - The error object caught during request processing.
	 * @param {string} cdnSettingsVariable - A string representing the CDN settings or related configuration.
	 * @returns {Object} - An object containing detailed error information.
	 */
	createErrorDetails(request, url, message, errorMessage = '', cdnSettingsVariable) {
		const _errorMessage =
			errorMessage || 'An error occurred during request processing the request.';
		return {
			requestUrl: url || request.url,
			message: message,
			status: 500,
			errorMessage: _errorMessage,
			cdnSettingsVariable: cdnSettingsVariable,
		};
	}

	/**
	 * Asynchronously dispatches an event to Optimizely and stores the event data in an internal queue.
	 * Designed to be used within Fastly Workers to handle event collection for Optimizely.
	 *
	 * @param {string} url - The URL to which the event should be sent.
	 * @param {Object} eventData - The event data to be sent.
	 * @throws {Error} - Throws an error if the fetch request fails or if parameters are missing.
	 */
	async dispatchEventToOptimizely({ url, params: eventData }) {
		if (!url || !eventData) {
			throw new Error('URL and parameters must be provided.');
		}

		// Simulate dispatching an event and storing the response in the queue
		this.eventQueue.push(eventData);
	}

	/**
	 * Consolidates visitors from all events in the event queue into the first event's visitors array.
	 * Assumes all events are structurally identical except for the "visitors" array content.
	 *
	 * @param {Array} eventQueue - The queue of events stored internally.
	 * @returns {Object} - The consolidated first event with visitors from all other events.
	 * @throws {Error} - Throws an error if the event queue is empty or improperly formatted.
	 */
	async consolidateVisitorsInEvents(eventQueue) {
		if (!Array.isArray(eventQueue) || eventQueue.length === 0) {
			throw new Error('Event queue is empty or not an array.');
		}

		// Take the first event to be the base for consolidation
		const baseEvent = eventQueue[0];

		// Iterate over the rest of the events in the queue, merging their visitors array with the first event
		eventQueue.slice(1).forEach((event) => {
			if (!event.visitors || !Array.isArray(event.visitors)) {
				throw new Error('Event is missing visitors array or it is not an array.');
			}
			baseEvent.visitors = baseEvent.visitors.concat(event.visitors);
		});

		// Return the modified first event with all visitors consolidated
		return baseEvent;
	}

	/**
	 * Dispatches allconsolidated events to Optimizely via HTTP POST.
	 *
	 * @param {string} url - The URL to which the consolidated event should be sent.
	 * @param {Object} events - The consolidated event data to be sent.
	 * @returns {Promise<Response>} - The promise resolving to the fetch response.
	 * @throws {Error} - Throws an error if the fetch request fails, parameters are missing, or the URL is invalid.
	 */
	async dispatchAllEventsToOptimizely(url, events) {
		if (!url) {
			throw new Error('URL must be provided.');
		}

		if (!events || typeof events !== 'object') {
			throw new Error('Valid event data must be provided.');
		}

		// this.logger.debug(JSON.stringify(events));
		const eventRequest = new Request(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(events),
		});

		try {
			const response = await fetch(eventRequest);
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return response;
		} catch (error) {
			this.logger.error('Failed to dispatch consolidated event to Optimizely:', error);
			throw new Error('Failed to dispatch consolidated event to Optimizely.');
		}
	}

	/**
	 * Retrieves the datafile from KV storage.
	 * @param {string} sdkKey - The SDK key.
	 * @returns {Promise<Object|null>} The parsed datafile object or null if not found.
	 */
	async getDatafileFromKV(sdkKey, kvStore) {
		const jsonString = await kvStore.get(sdkKey); // Namespace must be updated manually
		if (jsonString) {
			try {
				return JSON.parse(jsonString);
			} catch {
				throw new Error('Invalid JSON for datafile from KV storage.');
			}
		}
		return null;
	}

	/**
	 * Gets a new Response object with the specified response body and content type.
	 * @param {Object|string} responseBody - The response body.
	 * @param {string} contentType - The content type of the response (e.g., "text/html", "application/json").
	 * @param {boolean} [stringifyResult=true] - Whether to stringify the response body for JSON responses.
	 * @param {number} [status=200] - The HTTP status code of the response.
	 * @returns {Promise<Response|undefined>} - A Promise that resolves to a Response object or undefined if the content type is not supported.
	 */
	async getNewResponseObject(responseBody, contentType, stringifyResult = true, status = 200) {
		let result;

		switch (contentType) {
			case 'application/json':
				let tempResponse;
				if (stringifyResult) {
					tempResponse = JSON.stringify(responseBody);
				} else {
					tempResponse = responseBody;
				}
				result = new Response(tempResponse, { status });
				result.headers.set('Content-Type', 'application/json');
				break;
			case 'text/html':
				result = new Response(responseBody, { status });
				result.headers.set('Content-Type', 'text/html;charset=UTF-8');
				break;
			default:
				result = undefined;
				break;
		}

		return result;
	}

	/**
	 * Retrieves flag keys from KV storage.
	 * @param {string} kvKeyName - The key name in KV storage.
	 * @returns {Promise<string|null>} The flag keys string or null if not found.
	 */
	async getFlagsFromKV(kvStore) {
		const flagsString = await kvStore.get(defaultSettings.kv_key_optly_flagKeys); // Namespace must be updated manually
		return flagsString;
	}
	/**

/**
 * Clones a request object with a new URL, ensuring that GET and HEAD requests do not include a body.
 * @param {Request} request - The original request object to be cloned.
 * @param {string} newUrl - The new URL to be set for the cloned request.
 * @returns {Request} - The cloned request object with the new URL.
 * @throws {TypeError} - If the provided request is not a valid Request object or the new URL is not a valid string.
 */
	cloneRequestWithNewUrl(request, newUrl) {
		try {
			// Validate the request and new URL
			if (!(request instanceof Request)) {
				throw new TypeError('Invalid request object provided.');
			}
			if (typeof newUrl !== 'string' || newUrl.trim() === '') {
				throw new TypeError('Invalid URL provided.');
			}

			// Prepare the properties for the new request
			const requestOptions = {
				method: request.method,
				headers: new Headers(request.headers),
				mode: request.mode,
				credentials: request.credentials,
				cache: request.cache,
				redirect: request.redirect,
				referrer: request.referrer,
				integrity: request.integrity,
			};

			// Ensure body is not assigned for GET or HEAD methods
			if (request.method !== 'GET' && request.method !== 'HEAD' && request.bodyUsed === false) {
				requestOptions.body = request.body;
			}

			// Create the new request with the specified URL and options
			const clonedRequest = new Request(newUrl, requestOptions);

			return clonedRequest;
		} catch (error) {
			this.logger.error('Error cloning request with new URL:', error);
			throw error;
		}
	}

	/**
	 * Clones a request object asynchronously.
	 * @async
	 * @static
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	static cloneRequest(request) {
		try {
			const clonedRequest = request.clone();
			return clonedRequest;
		} catch (error) {
			this.logger.error('Error cloning request:', error);
			throw error;
		}
	}

	/**
	 * Clones a request object asynchronously.
	 * @async
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneRequest(request) {
		try {
			const clonedRequest = request.clone();
			return clonedRequest;
		} catch (error) {
			this.logger.error('Error cloning request:', error);
			throw error;
		}
	}

	/**
	 * Clones a response object asynchronously.
	 * @async
	 * @param {Response} response - The original response object to be cloned.
	 * @returns {Promise<Response>} - A promise that resolves to the cloned response object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneResponse(response) {
		try {
			const clonedResponse = response.clone();
			return clonedResponse;
		} catch (error) {
			this.logger.error('Error cloning response:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the JSON payload from a request, ensuring the request method is POST.
	 * This method clones the request for safe reading and handles errors in JSON parsing,
	 * returning null if the JSON is invalid or the method is not POST.
	 *
	 * @static
	 * @param {Request} _request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	static async getJsonPayload(_request) {
		const request = this.cloneRequest(_request);
		if (request.method !== 'POST') {
			this.logger.error('Request is not an HTTP POST method.');
			return null;
		}

		try {
			const clonedRequest = await this.cloneRequest(request);

			// Check if the body is empty before parsing
			const bodyText = await clonedRequest.text(); // Get the body as text first
			if (!bodyText.trim()) {
				return null; // Empty body, return null gracefully
			}

			const json = JSON.parse(bodyText);
			return json;
		} catch (error) {
			this.logger.error('Error parsing JSON:', error);
			return null;
		}
	}

	/**
	 * Retrieves the JSON payload from a request, ensuring the request method is POST.
	 * This method clones the request for safe reading and handles errors in JSON parsing,
	 * returning null if the JSON is invalid or the method is not POST.
	 *
	 * @param {Request} _request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	async getJsonPayload(_request) {
		const request = this.cloneRequest(_request);
		if (request.method !== 'POST') {
			this.logger.error('Request is not an HTTP POST method.');
			return null;
		}

		try {
			const clonedRequest = await this.cloneRequest(request);

			// Check if the body is empty before parsing
			const bodyText = await clonedRequest.text(); // Get the body as text first
			if (!bodyText.trim()) {
				return null; // Empty body, return null gracefully
			}

			const json = JSON.parse(bodyText);
			return json;
		} catch (error) {
			this.logger.error('Error parsing JSON:', error);
			return null;
		}
	}

	/**
	 * Creates a cache key based on the request and environment.
	 * @param {Request} request - The incoming request.
	 * @param {Object} env - The environment object.
	 * @returns {Request} The modified request object to be used as the cache key.
	 */
	createCacheKey(request, env) {
		// Including a variation logic that determines the cache key based on some attributes
		const url = new URL(request.url);
		const variation = this.coreLogic.determineVariation(request, env);
		url.pathname += `/${variation}`;
		// Modify the URL to include variation
		// Optionally add search params or headers as cache key modifiers
		// url.searchParams.set('variation', variation);
		return new Request(url.toString(), {
			method: request.method,
			headers: request.headers,
		});
	}

	/**
	 * Retrieves the value of a cookie from the request.
	 * @param {Request} request - The incoming request.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} The value of the cookie or null if not found.
	 */
	getCookie(request, name) {
		const cookieHeader = request.headers.get('Cookie');
		if (!cookieHeader) return null;
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const [key, value] = cookie.trim().split('=');
			acc[key] = decodeURIComponent(value);
			return acc;
		}, {});
		return cookies[name];
	}

	/**
	 * Sets a cookie in the response with detailed options.
	 * This function allows for fine-grained control over the cookie attributes, handling defaults and overrides.
	 *
	 * @param {Response} response - The response object to which the cookie will be added.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options=cookieDefaultOptions] - Additional options for setting the cookie:
	 *    @param {string} [options.path="/"] - Path where the cookie is accessible.
	 *    @param {Date} [options.expires=new Date(Date.now() + 86400e3 * 365)] - Expiration date of the cookie.
	 *    @param {number} [options.maxAge=86400 * 365] - Maximum age of the cookie in seconds.
	 *    @param {string} [options.domain="apidev.expedge.com"] - Domain where the cookie is valid.
	 *    @param {boolean} [options.secure=true] - Indicates if the cookie should be sent over secure protocol only.
	 *    @param {boolean} [options.httpOnly=true] - Indicates that the cookie is accessible only through the HTTP protocol.
	 *    @param {string} [options.sameSite="none"] - Same-site policy for the cookie. Can be "Strict", "Lax", or "None".
	 * @throws {TypeError} If the response, name, or value parameters are not provided or are invalid.
	 */
	setResponseCookie(response, name, value, options = cookieDefaultOptions) {
		try {
			if (!(response instanceof Response)) {
				throw new TypeError('Invalid response object');
			}
			if (typeof name !== 'string' || name.trim() === '') {
				throw new TypeError('Invalid cookie name');
			}
			if (typeof value !== 'string') {
				throw new TypeError('Invalid cookie value');
			}

			// Merge default options with provided options, where provided options take precedence
			const finalOptions = { ...cookieDefaultOptions, ...options };

			const optionsString = Object.entries(finalOptions)
				.map(([key, val]) => {
					if (key === 'expires' && val instanceof Date) {
						return `${key}=${val.toUTCString()}`;
					} else if (typeof val === 'boolean') {
						return val ? key : ''; // For boolean options, append only the key if true
					}
					return `${key}=${val}`;
				})
				.filter(Boolean) // Remove any empty strings (from false boolean values)
				.join('; ');

			const cookieValue = `${name}=${encodeURIComponent(value)}; ${optionsString}`;
			response.headers.append('Set-Cookie', cookieValue);
		} catch (error) {
			this.logger.error('An error occurred while setting the cookie:', error);
			throw error;
		}
	}

	/**
	 * Sets a cookie in the request object by modifying its headers.
	 * This method is ideal for adding or modifying cookies in requests sent from Fastly Workers.
	 *
	 * @param {Request} request - The original request object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options=cookieDefaultOptions] - Optional settings for the cookie:
	 *   @param {string} [options.path="/"] - Path where the cookie is accessible.
	 *   @param {Date} [options.expires=new Date(Date.now() + 86400e3 * 365)] - Expiration date of the cookie.
	 *   @param {number} [options.maxAge=86400 * 365] - Maximum age of the cookie in seconds.
	 *   @param {string} [options.domain="apidev.expedge.com"] - Domain where the cookie is valid.
	 *   @param {boolean} [options.secure=true] - Indicates if the cookie should be sent over secure protocol only.
	 *   @param {boolean} [options.httpOnly=true] - Indicates that the cookie is accessible only through the HTTP protocol.
	 *   @param {string} [options.sameSite="none"] - Same-site policy for the cookie. Valid options are "Strict", "Lax", or "None".
	 * @returns {Request} - A new request object with the updated cookie header.
	 * @throws {TypeError} - If the request, name, or value parameter is not provided or has an invalid type.
	 */
	setRequestCookie(request, name, value, options = cookieDefaultOptions) {
		if (!(request instanceof Request)) {
			throw new TypeError('Invalid request object');
		}
		if (typeof name !== 'string' || name.trim() === '') {
			throw new TypeError('Invalid cookie name');
		}
		if (typeof value !== 'string') {
			throw new TypeError('Invalid cookie value');
		}

		// Merge default options with provided options
		const finalOptions = { ...cookieDefaultOptions, ...options };

		// Construct the cookie string
		const optionsString = Object.entries(finalOptions)
			.map(([key, val]) => {
				if (key === 'expires' && val instanceof Date) {
					return `${key}=${val.toUTCString()}`;
				} else if (typeof val === 'boolean') {
					return val ? key : ''; // For boolean options, append only the key if true
				}
				return `${key}=${val}`;
			})
			.join('; ');

		const cookieValue = `${name}=${encodeURIComponent(value)}; ${optionsString}`;

		// Clone the original request and update the 'Cookie' header
		const newRequest = new Request(request, { headers: new Headers(request.headers) });
		const existingCookies = newRequest.headers.get('Cookie') || '';
		const updatedCookies = existingCookies ? `${existingCookies}; ${cookieValue}` : cookieValue;
		newRequest.headers.set('Cookie', updatedCookies);

		return newRequest;
	}

	/**
	 * Sets multiple cookies on a cloned request object in Fastly Workers.
	 * Each cookie's name, value, and options are specified in the cookies object.
	 * This function clones the original request and updates the cookies based on the provided cookies object.
	 *
	 * @param {Request} request - The original HTTP request object.
	 * @param {Object} cookies - An object containing cookie key-value pairs to be set on the request.
	 *                           Each key is a cookie name and each value is an object containing the cookie value and options.
	 * @returns {Request} - A new request object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the request is not a Request object.
	 * @example
	 * const originalRequest = new Request('https://example.com');
	 * const cookiesToSet = {
	 *     session: {value: '12345', options: {path: '/', secure: true}},
	 *     user: {value: 'john_doe', options: {expires: new Date(2025, 0, 1)}}
	 * };
	 * const modifiedRequest = setMultipleRequestCookies(originalRequest, cookiesToSet);
	 */
	setMultipleRequestCookies(request, cookies) {
		if (!(request instanceof Request)) {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = new Request(request);
		let existingCookies = clonedRequest.headers.get('Cookie') || '';

		try {
			const cookieStrings = Object.entries(cookies).map(([name, { value, options }]) => {
				if (typeof name !== 'string' || name.trim() === '') {
					throw new TypeError('Invalid cookie name');
				}
				if (typeof value !== 'string') {
					throw new TypeError('Invalid cookie value');
				}
				const optionsString = Object.entries(options || {})
					.map(([key, val]) => {
						if (key.toLowerCase() === 'expires' && val instanceof Date) {
							return `${key}=${val.toUTCString()}`;
						}
						return `${key}=${encodeURIComponent(val)}`;
					})
					.join('; ');

				return `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${optionsString}`;
			});

			existingCookies = existingCookies
				? `${existingCookies}; ${cookieStrings.join('; ')}`
				: cookieStrings.join('; ');
			clonedRequest.headers.set('Cookie', existingCookies);
		} catch (error) {
			this.logger.error('Error setting cookies:', error);
			throw new Error('Failed to set cookies in the request.');
		}

		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned request object in Fastly Workers.
	 * Each cookie string in the cookies object should be fully serialized and ready to be set in the Cookie header.
	 *
	 * @param {Request} request - The original HTTP request object.
	 * @param {Object} cookies - An object containing cookie names and their pre-serialized string values.
	 * @returns {Request} - A new request object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the request is not a Request object.
	 * @example
	 * const originalRequest = new Request('https://example.com');
	 * const cookiesToSet = {
	 *     session: 'session=12345; Path=/; Secure',
	 *     user: 'user=john_doe; Expires=Wed, 21 Oct 2025 07:28:00 GMT'
	 * };
	 * const modifiedRequest = setMultipleReqSerializedCookies(originalRequest, cookiesToSet);
	 */
	setMultipleReqSerializedCookies(request, cookies) {
		if (!(request instanceof Request)) {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = this.cloneRequest(request);
		const existingCookies = clonedRequest.headers.get('Cookie') || '';

		// Append each serialized cookie to the existing cookie header
		const updatedCookies = existingCookies
			? `${existingCookies}; ${Object.values(cookies).join('; ')}`
			: Object.values(cookies).join('; ');
		clonedRequest.headers.set('Cookie', updatedCookies);

		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned response object in Fastly Workers.
	 * Each cookie string in the cookies object should be fully serialized and ready to be set in the Set-Cookie header.
	 *
	 * @param {Response} response - The original HTTP response object.
	 * @param {Object} cookies - An object containing cookie names and their pre-serialized string values.
	 * @returns {Response} - A new response object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the response is not a Response object.
	 * @example
	 * const originalResponse = new Response('Body content', { status: 200, headers: {'Content-Type': 'text/plain'} });
	 * const cookiesToSet = {
	 *     session: 'session=12345; Path=/; Secure',
	 *     user: 'user=john_doe; Expires=Wed, 21 Oct 2025 07:28:00 GMT'
	 * };
	 * const modifiedResponse = setMultipleRespSerializedCookies(originalResponse, cookiesToSet);
	 */
	setMultipleRespSerializedCookies(response, cookies) {
		if (!(response instanceof Response)) {
			throw new TypeError('Invalid response object');
		}

		// Clone the original response to avoid modifying it directly
		const clonedResponse = new Response(response.body, response);
		// Retrieve existing Set-Cookie headers
		let existingCookies = clonedResponse.headers.get('Set-Cookie') || [];
		// Existing cookies may not necessarily be an array
		if (!Array.isArray(existingCookies)) {
			existingCookies = existingCookies ? [existingCookies] : [];
		}
		// Append each serialized cookie to the existing Set-Cookie header
		Object.values(cookies).forEach((cookie) => {
			existingCookies.push(cookie);
		});
		// Clear the current Set-Cookie header to reset it
		clonedResponse.headers.delete('Set-Cookie');
		// Set all cookies anew
		existingCookies.forEach((cookie) => {
			clonedResponse.headers.append('Set-Cookie', cookie);
		});

		return clonedResponse;
	}

	/**
	 * Sets a header in the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setRequestHeader(request, name, value) {
		// Clone the request and update the headers on the cloned object
		const newRequest = new Request(request, {
			headers: new Headers(request.headders),
		});
		newRequest.headers.set(name, value);
		return newRequest;
	}

	/**
	 * Sets multiple headers on a cloned request object in Fastly Workers.
	 * This function clones the original request and updates the headers based on the provided headers object.
	 *
	 * @param {Request} request - The original HTTP request object.
	 * @param {Object} headers - An object containing header key-value pairs to be set on the request.
	 *                           Each key is a header name and each value is the header value.
	 * @returns {Request} - A new request object with the updated headers.
	 *
	 * @example
	 * const originalRequest = new Request('https://example.com');
	 * const updatedHeaders = {
	 *     'Content-Type': 'application/json',
	 *     'Authorization': 'Bearer your_token_here'
	 * };
	 * const newRequest = setMultipleRequestHeaders(originalRequest, updatedHeaders);
	 */
	setMultipleRequestHeaders(request, headers) {
		const newRequest = new Request(request, {
			headers: new Headers(request.headers),
		});
		for (const [name, value] of Object.entries(headers)) {
			newRequest.headers.set(name, value);
		}
		return newRequest;
	}

	/**
	 * Sets multiple headers on a cloned response object in Fastly Workers.
	 * This function clones the original response and updates the headers based on the provided headers object.
	 *
	 * @param {Response} response - The original HTTP response object.
	 * @param {Object} headers - An object containing header key-value pairs to be set on the response.
	 *                           Each key is a header name and each value is the header value.
	 * @returns {Response} - A new response object with the updated headers.
	 *
	 * @example
	 * const originalResponse = new Response('Body content', { status: 200, headers: {'Content-Type': 'text/plain'} });
	 * const updatedHeaders = {
	 *     'Content-Type': 'application/json',
	 *     'X-Custom-Header': 'Value'
	 * };
	 * const newResponse = setMultipleResponseHeaders(originalResponse, updatedHeaders);
	 */
	setMultipleResponseHeaders(response, headers) {
		// Clone the original response with its body and status
		const newResponse = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: new Headers(response.headers),
		});

		// Update the headers with new values
		Object.entries(headers).forEach(([name, value]) => {
			newResponse.headers.set(name, value);
		});

		return newResponse;
	}

	/**
	 * Retrieves the value of a header from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getRequestHeader(name, request) {
		return request.headers.get(name);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setResponseHeader(response, name, value) {
		response.headers.set(name, value);
	}

	/**
	 * Retrieves the value of a header from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getResponseHeader(response, name) {
		return response.headers.get(name);
	}

	/**
	 * Retrieves the value of a cookie from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} The value of the cookie or null if not found.
	 */
	getRequestCookie(request, name) {
		return this.getCookie(request, name);
	}
}

export default FastlyAdapter;
