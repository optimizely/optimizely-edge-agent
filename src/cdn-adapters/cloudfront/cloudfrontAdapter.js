// cloudFrontAdapter.js

import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import * as cookieDefaultOptions from '../../_config_/cookieOptions';
import defaultSettings from '../../_config_/defaultSettings';
import Logger from '../../_helpers_/logger';
import EventListeners from '../../_event_listeners_/eventListeners';

/**
 * Adapter class for AWS CloudFront Lambda@Edge environment.
 */
class CloudfrontAdapter {
	/**
	 * Creates an instance of CloudFrontAdapter.
	 * @param {Object} coreLogic - The core logic instance.
	 */
	constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper) {
		this.sdkKey = sdkKey;
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
	 * @param {Object} event - The incoming Lambda@Edge event object.
	 * @param {Object} env - The environment object, typically containing environment-specific settings.
	 * @param {Object} ctx - The context object, used here for passing along the waitUntil promise for caching.
	 * @returns {Promise<Object>} - The processed response, either from cache or freshly fetched.
	 */
	async handler(event, env, ctx) {
		let fetchResponse;
		this.request = event.Records[0].cf.request;
		this.env = env;
		this.ctx = ctx;
		try {
			let originUrl = new URL(this.request.uri);
			// Ensure the URL uses HTTPS
			if (originUrl.protocol !== 'https:') {
				originUrl.protocol = 'https:';
			}
			// Convert URL object back to string
			originUrl = originUrl.toString();
			const httpMethod = this.request.method;
			const result = await this.coreLogic.processRequest(this.request, env, ctx);
			const cdnSettings = result.cdnExperimentSettings;
			const validCDNSettings = this.shouldFetchFromOrigin(cdnSettings);

			// Adjust origin URL based on CDN settings
			if (validCDNSettings) {
				originUrl = cdnSettings.cdnResponseURL;
			}

			// Return response for POST requests without caching
			if (httpMethod === 'POST') {
				this.logger.debug('POST request detected. Returning response without caching.');
				return this.buildResponse(result.reqResponse);
			}

			// Handle specific GET requests immediately without caching
			if (httpMethod === 'GET' && (this.coreLogic.datafileOperation || this.coreLogic.configOperation)) {
				const fileType = this.coreLogic.datafileOperation ? 'datafile' : 'config file';
				this.logger.debug(`GET request detected. Returning current ${fileType} for SDK Key: ${this.coreLogic.sdkKey}`);
				return this.buildResponse(result.reqResponse);
			}

			// Evaluate if we should fetch from the origin and/or cache
			if (originUrl && (!cdnSettings || (validCDNSettings && !cdnSettings.forwardRequestToOrigin))) {
				fetchResponse = await this.fetchAndProcessRequest(this.request, originUrl, cdnSettings);
			} else {
				this.logger.debug(
					'No CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching.',
				);
				fetchResponse = await this.fetchDirectly(this.request);
			}

			return this.buildResponse(fetchResponse);
		} catch (error) {
			this.logger.error('Error processing request:', error);
			return this.buildResponse({ status: '500', body: `Internal Server Error: ${error.toString()}` });
		}
	}

	/**
	 * Fetches from the origin and processes the request based on caching and CDN settings.
	 * @param {Object} originalRequest - The original request.
	 * @param {String} originUrl - The URL to fetch data from.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {Promise<Object>} - The processed response.
	 */
	async fetchAndProcessRequest(originalRequest, originUrl, cdnSettings) {
		let newRequest = this.cloneRequestWithNewUrl(originalRequest, originUrl);

		// Set headers and cookies as necessary before sending the request
		newRequest.headers[defaultSettings.workerOperationHeader] = {
			key: defaultSettings.workerOperationHeader,
			value: 'true',
		};
		if (this.cookiesToSetRequest.length > 0) {
			newRequest = this.setMultipleReqSerializedCookies(newRequest, this.cookiesToSetRequest);
		}
		if (optlyHelper.isValidObject(this.headersToSetRequest)) {
			newRequest = this.setMultipleRequestHeaders(newRequest, this.headersToSetRequest);
		}

		let response = await this.fetch(newRequest);

		// Apply cache-control if present in the response
		if (response.headers['Cache-Control']) {
			response.headers['Cache-Control'] = [
				{
					key: 'Cache-Control',
					value: 'public',
				},
			];
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
			// Note: Caching in Lambda@Edge requires using the CloudFront API
			// You would need to make a separate request to the CloudFront API to cache the response
			this.logger.debug(`Cache hit for: ${originUrl}.`);
		}

		return response;
	}

	/**
	 * Fetches directly from the origin without any caching logic.
	 * @param {Object} request - The original request.
	 * @returns {Promise<Object>} - The response from the origin.
	 */
	async fetchDirectly(request) {
		this.logger.debug('Fetching directly from origin: ' + request.uri);
		return await this.fetch(request);
	}

	/**
	 * Determines the origin URL based on CDN settings.
	 * @param {Object} request - The original request.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {String} - The URL to fetch data from.
	 */
	getOriginUrl(request, cdnSettings) {
		if (cdnSettings && cdnSettings.cdnResponseURL) {
			this.logger.debug('Valid CDN settings detected.');
			return cdnSettings.cdnResponseURL;
		}
		return request.uri;
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
			let basePath = cacheKeyUrl.pathname.endsWith('/') ? cacheKeyUrl.pathname.slice(0, -1) : cacheKeyUrl.pathname;

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
	 * @returns {Promise<Object>} - The fetched response from the origin.
	 */
	async fetchFromOrigin(cdnSettings, reqResponse) {
		try {
			const urlToFetch = cdnSettings.forwardRequestToOrigin ? reqResponse.uri : cdnSettings.cdnResponseURL;
			return await this.fetch({ uri: urlToFetch });
		} catch (error) {
			this.logger.error('Error fetching from origin:', error);
			throw new Error('Failed to fetch from origin.');
		}
	}

	/**
	 * Asynchronously dispatches consolidated events to the Optimizely LOGX events endpoint.
	 * @param {Object} ctx - The context of the Lambda@Edge function.
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
				await this.dispatchAllEventsToOptimizely(defaultSettings.optimizelyEventsEndpoint, allEvents).catch((err) => {
					this.logger.error('Failed to dispatch event:', err);
				});
			} catch (error) {
				this.logger.error('Error during event consolidation or dispatch:', error);
			}
		}
	}

	/**
	 * Performs a fetch request to the origin server without any caching logic.
	 * This method replicates the default Lambda@Edge fetch behavior.
	 *
	 * @param {Object} event - The incoming Lambda@Edge event object.
	 * @param {object} context - The Lambda@Edge context object.
	 * @returns {Promise<Object>} - The response from the origin server, or an error response if fetching fails.
	 */
	async defaultFetch(event, context) {
		const request = event.Records[0].cf.request;
		const httpMethod = request.method;
		const isPostMethod = httpMethod === 'POST';
		const isGetMethod = httpMethod === 'GET';

		try {
			this.logger.debug(`Fetching from origin for: ${request.uri}`);

			// Create a new request object for the origin fetch
			const originRequest = {
				method: request.method,
				uri: request.uri,
				headers: request.headers,
				body: request.body,
			};

			// Perform a fetch request to the origin
			const response = await fetch(originRequest.uri, {
				method: originRequest.method,
				headers: originRequest.headers,
				body: originRequest.body,
			});

			// Check if the response was successful
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Create a new response object
			const originResponse = {
				status: response.status,
				statusDescription: response.statusText,
				headers: response.headers,
				body: await response.text(),
			};

			// Here you can add any headers or perform any response transformations if necessary
			// For example, you might want to remove certain headers or add custom headers
			// originResponse.headers['x-custom-header'] = [{ key: 'X-Custom-Header', value: 'value' }];

			return originResponse;
		} catch (error) {
			this.logger.error(`Failed to fetch: ${error.message}`);

			// Return a standardized error response
			return {
				status: '500',
				statusDescription: 'Internal Server Error',
				body: `An error occurred: ${error.message}`,
			};
		}
	}

	/**
	 * Performs a fetch request to the origin server using provided options.
	 * This method replicates the default Lambda@Edge fetch behavior but allows custom fetch options.
	 *
	 * @param {Object} request - The request object containing fetch parameters such as uri, method, headers, body, etc.
	 * @param {object} ctx - The execution context, if any context-specific actions need to be taken.
	 * @returns {Promise<Object>} - The response from the origin server, or an error response if fetching fails.
	 */
	async fetch(request, ctx) {
		try {
			// Perform a standard fetch request using the request object
			const response = await fetch(request);

			// Check if the response was successful
			if (response.status !== 200) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Return the response object
			return response;
		} catch (error) {
			this.logger.error(`Failed to fetch: ${error.message}`);

			// Return a standardized error response
			return {
				status: '500',
				statusDescription: 'Internal Server Error',
				body: `An error occurred: ${error.message}`,
			};
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
			const response = await this.fetch({ uri: url });
			if (response.status !== '200') {
				throw new Error(`Failed to fetch datafile: ${response.statusDescription}`);
			}
			return response.body;
		} catch (error) {
			this.logger.error(`Error fetching datafile for SDK key ${sdkKey}: ${error}`);
			throw new Error('Error fetching datafile.');
		}
	}

	/**
	 * Creates an error details object to encapsulate information about errors during request processing.
	 * @param {Object} request - The HTTP request object from which the URI will be extracted.
	 * @param {string} url - The URL where the error occurred.
	 * @param {string} message - A brief message describing the error.
	 * @param {string} [errorMessage=''] - A detailed error message, defaults to a generic message if not provided.
	 * @param {string} cdnSettingsVariable - A string representing the CDN settings or related configuration.
	 * @returns {Object} - An object containing detailed error information.
	 */
	createErrorDetails(request, url, message, errorMessage = '', cdnSettingsVariable) {
		const _errorMessage = errorMessage || 'An error occurred during request processing the request.';
		return {
			requestUrl: url || request.uri,
			message: message,
			status: '500',
			errorMessage: _errorMessage,
			cdnSettingsVariable: cdnSettingsVariable,
		};
	}

	/**
	 * Asynchronously dispatches an event to Optimizely and stores the event data in an internal queue.
	 * Designed to be used within Lambda@Edge functions to handle event collection for Optimizely.
	 *
	 * @param {string} url - The URL to which the event should be sent.
	 * @param {Object} eventData - The event data to be sent.
	 * @throws {Error} - Throws an error if parameters are missing.
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
	 * Dispatches all consolidated events to Optimizely via HTTP POST.
	 *
	 * @param {string} url - The URL to which the consolidated event should be sent.
	 * @param {Object} events - The consolidated event data to be sent.
	 * @returns {Promise<Object>} - The promise resolving to the fetch response.
	 * @throws {Error} - Throws an error if the fetch request fails, parameters are missing, or the URL is invalid.
	 */
	async dispatchAllEventsToOptimizely(url, events) {
		if (!url) {
			throw new Error('URL must be provided.');
		}

		if (!events || typeof events !== 'object') {
			throw new Error('Valid event data must be provided.');
		}

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(events),
			});

			if (response.status !== 200) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return response;
		} catch (error) {
			this.logger.error('Failed to dispatch consolidated event to Optimizely:', error);
			throw new Error('Failed to dispatch consolidated event to Optimizely.');
		}
	}

	/**
	 * Retrieves the datafile from DynamoDB storage.
	 * @param {string} sdkKey - The SDK key.
	 * @returns {Promise<Object|null>} The parsed datafile object or null if not found.
	 */
	async getDatafileFromDynamoDB(sdkKey, env) {
		const dynamoDB = new AWS.DynamoDB.DocumentClient();
		const params = {
			TableName: env.DATAFILE_TABLE_NAME,
			Key: { sdkKey: sdkKey },
		};

		try {
			const result = await dynamoDB.get(params).promise();
			if (result.Item && result.Item.datafile) {
				return JSON.parse(result.Item.datafile);
			}
		} catch (error) {
			this.logger.error(`Error retrieving datafile from DynamoDB for SDK key ${sdkKey}:`, error);
		}
		return null;
	}

	/**
	 * Gets a new Response object with the specified response body and content type.
	 * @param {Object|string} responseBody - The response body.
	 * @param {string} contentType - The content type of the response (e.g., "text/html", "application/json").
	 * @param {boolean} [stringifyResult=true] - Whether to stringify the response body for JSON responses.
	 * @param {number} [status=200] - The HTTP status code of the response.
	 * @returns {Promise<Object|undefined>} - A Promise that resolves to a response object or undefined if the content type is not supported.
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
				result = {
					status: status.toString(),
					body: tempResponse,
					headers: {
						'Content-Type': [
							{
								key: 'Content-Type',
								value: 'application/json',
							},
						],
					},
				};
				break;
			case 'text/html':
				result = {
					status: status.toString(),
					body: responseBody,
					headers: {
						'Content-Type': [
							{
								key: 'Content-Type',
								value: 'text/html;charset=UTF-8',
							},
						],
					},
				};
				break;
			default:
				result = undefined;
				break;
		}

		return result;
	}

	/**
	 * Retrieves flag keys from DynamoDB storage.
	 * @param {string} sdkKey - The SDK key.
	 * @param {Object} env - The environment variables.
	 * @returns {Promise<string|null>} The flag keys string or null if not found.
	 */
	async getFlagsFromDynamoDB(sdkKey, env) {
		const dynamoDB = new AWS.DynamoDB.DocumentClient();
		const params = {
			TableName: env.FLAG_TABLE_NAME,
			Key: { sdkKey: sdkKey },
		};

		try {
			const result = await dynamoDB.get(params).promise();
			if (result.Item && result.Item.flags) {
				return result.Item.flags;
			}
		} catch (error) {
			this.logger.error(`Error retrieving flags from DynamoDB for SDK key ${sdkKey}:`, error);
		}
		return null;
	}

	/**
	 * Clones a request object with a new URI, ensuring that GET and HEAD requests do not include a body.
	 * @param {Object} request - The original request object to be cloned.
	 * @param {string} newUri - The new URI to be set for the cloned request.
	 * @returns {Object} - The cloned request object with the new URI.
	 * @throws {TypeError} - If the provided request is not a valid request object or the new URI is not a valid string.
	 */
	cloneRequestWithNewUri(request, newUri) {
		try {
			// Validate the request and new URI
			if (!request || typeof request !== 'object') {
				throw new TypeError('Invalid request object provided.');
			}
			if (typeof newUri !== 'string' || newUri.trim() === '') {
				throw new TypeError('Invalid URI provided.');
			}

			// Prepare the properties for the new request
			const requestOptions = {
				method: request.method,
				headers: request.headers,
			};

			// Ensure body is not assigned for GET or HEAD methods
			if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
				requestOptions.body = request.body;
			}

			// Create the new request with the specified URI and options
			const clonedRequest = {
				...requestOptions,
				uri: newUri,
			};

			return clonedRequest;
		} catch (error) {
			this.logger.error('Error cloning request with new URI:', error);
			throw error;
		}
	}

	/**
	 * Clones a request object.
	 * @param {Object} request - The original request object to be cloned.
	 * @returns {Object} - The cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneRequest(request) {
		try {
			return { ...request };
		} catch (error) {
			this.logger.error('Error cloning request:', error);
			throw error;
		}
	}

	/**
	 * Clones a response object.
	 * @param {Object} response - The original response object to be cloned.
	 * @returns {Object} - The cloned response object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneResponse(response) {
		try {
			return { ...response };
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
	 * @param {Object} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	async getJsonPayload(request) {
		if (request.method !== 'POST') {
			this.logger.error('Request is not an HTTP POST method.');
			return null;
		}

		try {
			const clonedRequest = this.cloneRequest(request);

			// Check if the body is empty before parsing
			if (!clonedRequest.body) {
				return null; // Empty body, return null gracefully
			}

			const json = JSON.parse(clonedRequest.body);
			return json;
		} catch (error) {
			this.logger.error('Error parsing JSON:', error);
			return null;
		}
	}

	/**
	 * Creates a cache key based on the request and environment.
	 * @param {Object} request - The incoming request.
	 * @param {Object} env - The environment object.
	 * @returns {string} The cache key string.
	 */
	createCacheKey(request, env) {
		// Including a variation logic that determines the cache key based on some attributes
		const variation = this.coreLogic.determineVariation(request, env);
		const cacheKey = `${request.uri}/${variation}`;
		// Optionally add search params or headers as cache key modifiers
		return cacheKey;
	}

	/**
	 * Retrieves the value of a cookie from the request.
	 * @param {Object} request - The incoming request.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} The value of the cookie or null if not found.
	 */
	getCookie(request, name) {
		const cookieHeader = request.headers.cookie || '';
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const [key, value] = cookie.trim().split('=');
			acc[key] = decodeURIComponent(value);
			return acc;
		}, {});
		return cookies[name] || null;
	}

	/**
	 * Sets a cookie in the response with detailed options.
	 * This function allows for fine-grained control over the cookie attributes, handling defaults and overrides.
	 *
	 * @param {Object} response - The response object to which the cookie will be added.
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
			if (!response || typeof response !== 'object') {
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
			response.headers['Set-Cookie'] = [
				...(response.headers['Set-Cookie'] || []),
				{
					key: 'Set-Cookie',
					value: cookieValue,
				},
			];
		} catch (error) {
			this.logger.error('An error occurred while setting the cookie:', error);
			throw error;
		}
	}

	/**
	 * Sets a cookie in the request object by modifying its headers.
	 * This method is ideal for adding or modifying cookies in requests sent from Lambda@Edge.
	 *
	 * @param {Object} request - The original request object.
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
	 * @returns {Object} - A new request object with the updated cookie header.
	 * @throws {TypeError} If the request, name, or value parameter is not provided or has an invalid type.
	 */
	setRequestCookie(request, name, value, options = cookieDefaultOptions) {
		if (!request || typeof request !== 'object') {
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
			.filter(Boolean) // Remove any empty strings (from false boolean values)
			.join('; ');

		const cookieValue = `${name}=${encodeURIComponent(value)}; ${optionsString}`;

		// Clone the original request and update the 'Cookie' header
		const newRequest = { ...request };
		const existingCookies = newRequest.headers.cookie || '';
		const updatedCookies = existingCookies ? `${existingCookies}; ${cookieValue}` : cookieValue;
		newRequest.headers.cookie = updatedCookies;

		return newRequest;
	}

	/**
	 * Sets multiple cookies on a cloned request object in Lambda@Edge.
	 * Each cookie's name, value, and options are specified in the cookies object.
	 * This function clones the original request and updates the cookies based on the provided cookies object.
	 *
	 * @param {Object} request - The original HTTP request object.
	 * @param {Object} cookies - An object containing cookie key-value pairs to be set on the request.
	 *                           Each key is a cookie name and each value is an object containing the cookie value and options.
	 * @returns {Object} - A new request object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the request is not a valid request object.
	 * @example
	 * const originalRequest = { uri: 'https://example.com', headers: { cookie: '' } };
	 * const cookiesToSet = {
	 *     session: {value: '12345', options: {path: '/', secure: true}},
	 *     user: {value: 'john_doe', options: {expires: new Date(2025, 0, 1)}}
	 * };
	 * const modifiedRequest = setMultipleRequestCookies(originalRequest, cookiesToSet);
	 */
	setMultipleRequestCookies(request, cookies) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = { ...request };
		let existingCookies = clonedRequest.headers.cookie || '';

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

			existingCookies = existingCookies ? `${existingCookies}; ${cookieStrings.join('; ')}` : cookieStrings.join('; ');
			clonedRequest.headers.cookie = existingCookies;
		} catch (error) {
			this.logger.error('Error setting cookies:', error);
			throw new Error('Failed to set cookies in the request.');
		}

		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned request object in Lambda@Edge.
	 * Each cookie string in the cookies object should be fully serialized and ready to be set in the Cookie header.
	 *
	 * @param {Object} request - The original HTTP request object.
	 * @param {Object} cookies - An object containing cookie names and their pre-serialized string values.
	 * @returns {Object} - A new request object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the request is not a valid request object.
	 * @example
	 * const originalRequest = { uri: 'https://example.com', headers: { cookie: '' } };
	 * const cookiesToSet = {
	 *     session: 'session=12345; Path=/; Secure',
	 *     user: 'user=john_doe; Expires=Wed, 21 Oct 2025 07:28:00 GMT'
	 * };
	 * const modifiedRequest = setMultipleReqSerializedCookies(originalRequest, cookiesToSet);
	 */
	setMultipleReqSerializedCookies(request, cookies) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = this.cloneRequest(request);
		const existingCookies = clonedRequest.headers.cookie || '';

		// Append each serialized cookie to the existing cookie header
		const updatedCookies = existingCookies
			? `${existingCookies}; ${Object.values(cookies).join('; ')}`
			: Object.values(cookies).join('; ');
		clonedRequest.headers.cookie = updatedCookies;

		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned response object in Lambda@Edge.
	 * Each cookie string in the cookies object should be fully serialized and ready to be set in the Set-Cookie header.
	 *
	 * @param {Object} response - The original HTTP response object.
	 * @param {Object} cookies - An object containing cookie names and their pre-serialized string values.
	 * @returns {Object} - A new response object with the updated cookies.
	 * @throws {TypeError} - Throws if any parameters are not valid or the response is not a valid response object.
	 * @example
	 * const originalResponse = { status: '200', body: 'Body content', headers: {'content-type': [{ key: 'Content-Type', value: 'text/plain' }]} };
	 * const cookiesToSet = {
	 *     session: 'session=12345; Path=/; Secure',
	 *     user: 'user=john_doe; Expires=Wed, 21 Oct 2025 07:28:00 GMT'
	 * };
	 * const modifiedResponse = setMultipleRespSerializedCookies(originalResponse, cookiesToSet);
	 */
	setMultipleRespSerializedCookies(response, cookies) {
		if (!response || typeof response !== 'object') {
			throw new TypeError('Invalid response object');
		}

		// Clone the original response to avoid modifying it directly
		const clonedResponse = { ...response };
		// Retrieve existing Set-Cookie headers
		let existingCookies = clonedResponse.headers['set-cookie'] || [];
		// Existing cookies may not necessarily be an array
		if (!Array.isArray(existingCookies)) {
			existingCookies = existingCookies ? [existingCookies] : [];
		}
		// Append each serialized cookie to the existing Set-Cookie header
		Object.values(cookies).forEach((cookie) => {
			existingCookies.push({
				key: 'Set-Cookie',
				value: cookie,
			});
		});
		// Update the Set-Cookie header with the new cookies
		clonedResponse.headers['set-cookie'] = existingCookies;

		return clonedResponse;
	}

	/**
	 * Sets a header in the request.
	 * @param {Object} request - The request object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 * @returns {Object} - The updated request object.
	 */
	setRequestHeader(request, name, value) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Invalid request object');
		}

		// Clone the request and update the headers on the cloned object
		const newRequest = { ...request };
		newRequest.headers[name.toLowerCase()] = [{ key: name, value: value }];
		return newRequest;
	}

	/**
	 * Sets multiple headers on a cloned request object in Lambda@Edge.
	 * This function clones the original request and updates the headers based on the provided headers object.
	 *
	 * @param {Object} request - The original HTTP request object.
	 * @param {Object} headers - An object containing header key-value pairs to be set on the request.
	 *                           Each key is a header name and each value is the header value.
	 * @returns {Object} - A new request object with the updated headers.
	 *
	 * @example
	 * const originalRequest = { uri: 'https://example.com', headers: {} };
	 * const updatedHeaders = {
	 *     'Content-Type': 'application/json',
	 *     'Authorization': 'Bearer your_token_here'
	 * };
	 * const newRequest = setMultipleRequestHeaders(originalRequest, updatedHeaders);
	 */
	setMultipleRequestHeaders(request, headers) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Invalid request object');
		}

		const newRequest = { ...request };
		for (const [name, value] of Object.entries(headers)) {
			newRequest.headers[name.toLowerCase()] = [{ key: name, value: value }];
		}
		return newRequest;
	}

	/**
	 * Sets multiple headers on a cloned response object in Lambda@Edge.
	 * This function clones the original response and updates the headers based on the provided headers object.
	 *
	 * @param {Object} response - The original HTTP response object.
	 * @param {Object} headers - An object containing header key-value pairs to be set on the response.
	 *                           Each key is a header name and each value is the header value.
	 * @returns {Object} - A new response object with the updated headers.
	 *
	 * @example
	 * const originalResponse = { status: '200', body: 'Body content', headers: {'content-type': [{ key: 'Content-Type', value: 'text/plain' }]} };
	 * const updatedHeaders = {
	 *     'Content-Type': 'application/json',
	 *     'X-Custom-Header': 'Value'
	 * };
	 * const newResponse = setMultipleResponseHeaders(originalResponse, updatedHeaders);
	 */
	setMultipleResponseHeaders(response, headers) {
		if (!response || typeof response !== 'object') {
			throw new TypeError('Invalid response object');
		}

		// Clone the original response with its body and status
		const newResponse = { ...response };

		// Update the headers with new values
		Object.entries(headers).forEach(([name, value]) => {
			newResponse.headers[name.toLowerCase()] = [{ key: name, value: value }];
		});

		return newResponse;
	}

	/**
	 * Retrieves the value of a header from the request.
	 * @param {Object} request - The request object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getRequestHeader(request, name) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Invalid request object');
		}

		const headerValue = request.headers[name.toLowerCase()];
		return headerValue ? headerValue[0].value : null;
	}

	/**
	 * Sets a header in the response.
	 * @param {Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 * @returns {Object} - The updated response object.
	 */
	setResponseHeader(response, name, value) {
		if (!response || typeof response !== 'object') {
			throw new TypeError('Invalid response object');
		}

		response.headers[name.toLowerCase()] = [{ key: name, value: value }];
		return response;
	}

	/**
	 * Retrieves the value of a header from the response.
	 * @param {Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getResponseHeader(response, name) {
		if (!response || typeof response !== 'object') {
			throw new TypeError('Invalid response object');
		}

		const headerValue = response.headers[name.toLowerCase()];
		return headerValue ? headerValue[0].value : null;
	}

	/**
	 * Retrieves the value of a cookie from the request.
	 * @param {Object} request - The request object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} The value of the cookie or null if not found.
	 */
	getRequestCookie(request, name) {
		return this.getCookie(request, name);
	}
}

export default CloudfrontAdapter;
