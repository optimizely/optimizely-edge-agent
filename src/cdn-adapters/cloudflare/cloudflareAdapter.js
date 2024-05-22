/**
 * @module CloudflareAdapter
 */

import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import * as cookieDefaultOptions from '../../_config_/cookieOptions';
import defaultSettings from '../../_config_/defaultSettings';
import EventListeners from '../../_event_listeners_/eventListeners';
import { AbstractRequest } from '../../_helpers_/abstraction-classes/abstractRequest';
import { AbstractResponse } from '../../_helpers_/abstraction-classes/abstractResponse';

/**
 * Adapter class for Cloudflare Workers environment.
 * It implements the following methods:
 * - fetchHandler(request, env, ctx) - Processes incoming requests by either serving from cache or fetching from the origin,
 *   based on CDN settings. POST requests are handled directly without caching. Errors in fetching or caching are handled
 *   and logged, ensuring stability.
 * - fetchAndProcessRequest(originalRequest, originUrl, cdnSettings) - Fetches from the origin and processes the request
 *   based on caching and CDN settings.
 * - getOriginUrl(request, cdnSettings) - Determines the origin URL based on CDN settings.
 * - shouldFetchFromOrigin(cdnSettings) - Determines whether the request should fetch data from the origin based on CDN settings.
 * - handleFetchFromOrigin(request, originUrl, cdnSettings, ctx) - Handles the fetching from the origin and caching logic for GET requests.
 * - applyResponseSettings(response, cdnSettings) - Applies settings like headers and cookies to the response based on CDN settings.
 * - generateCacheKey(cdnSettings, originUrl) - Generates a cache key based on CDN settings, enhancing cache control by appending
 *   A/B test identifiers or using specific CDN URLs.
 * - fetchFromOriginOrCDN(input, options) - Fetches data from the origin or CDN based on the provided URL or Request object.
 * - fetchFromOrigin(cdnSettings, reqResponse) - Fetches content from the origin based on CDN settings.
 * - cacheResponse(ctx, cache, cacheKey, response) - Caches the fetched response, handling errors during caching to ensure the function's
 *   robustness.
 * - dispatchConsolidatedEvents(ctx, defaultSettings) - Asynchronously dispatches consolidated events to the Optimizely LOGX events endpoint.
 * - defaultFetch(request, env, ctx) - Performs a fetch request to the origin server without any caching logic.
 * - This class is designed to be extended by other classes to provide specific implementations for handling requests and responses.
 */
class CloudflareAdapter {
	/**
	 * Creates an instance of CloudflareAdapter.
	 * @param {Object} coreLogic - The core logic instance.
	 */
	constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger) {
		this.sdkKey = sdkKey;
		this.logger = logger;
		this.kvStore = kvStore || undefined;
		this.coreLogic = coreLogic;
		this.abstractionHelper = abstractionHelper;
		this.eventListeners = EventListeners.getInstance();
		this.eventListenersResult = undefined;
		this.eventQueue = [];
		this.request = undefined;
		this.env = undefined;
		this.ctx = undefined;
		this.responseCookiesSet = false;
		this.responseHeadersSet = false;
		this.result = undefined;
		this.cachedRequestHeaders = undefined;
		this.cachedRequestCookies = undefined;
		this.cookiesToSetRequest = [];
		this.headersToSetRequest = {};
		this.cookiesToSetResponse = [];
		this.headersToSetResponse = {};
		this.optimizelyProvider = optimizelyProvider;
		this.kvStoreUserProfile = kvStoreUserProfile;
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
	async fetchHandler(request, env, ctx) {
		let fetchResponse;
		this.request = request;
		this.env = env;
		this.ctx = ctx;
		this.reqResponse = undefined;
		this.shouldCacheResponse = false;
		this.responseCookiesSet = false;
		this.responseHeadersSet = false;
		this.eventListeners = EventListeners.getInstance();
		try {
			let originUrl = this.abstractionHelper.abstractRequest.getNewURL(request.url);
			this.logger.debug(`Origin URL [fetchHandler]: ${originUrl}`);
			// Ensure the URL uses HTTPS
			if (originUrl.protocol !== 'https:') {
				originUrl.protocol = 'https:';
			}
			// Convert URL object back to string
			originUrl = originUrl.toString();
			const httpMethod = request.method;
			let preRequest = request;
			this.eventListenersResult = await this.eventListeners.trigger(
				'beforeProcessingRequest',
				request,
				this.coreLogic.requestConfig,
			);
			if (this.eventListenersResult && this.eventListenersResult.modifiedRequest) {
				preRequest = this.eventListenersResult.modifiedRequest;
			}
			const result = await this.coreLogic.processRequest(preRequest, env, ctx, this.sdkKey);
			const reqResponse = result.reqResponse;
			if (reqResponse === 'NO_MATCH') {
				this.logger.debug('No cdnVariationSettings found. Fetching content from origin [cdnAdapter -> fetchHandler]');
				return await this.fetchFromOriginOrCDN(request);
			}

			this.eventListenersResult = await this.eventListeners.trigger(
				'afterProcessingRequest',
				request,
				result.reqResponse,
				this.coreLogic.requestConfig,
				result,
			);
			let postResponse = result.reqResponse;
			if (this.eventListenersResult && this.eventListenersResult.modifiedResponse) {
				postResponse = this.eventListenersResult.modifiedResponse;
			}

			this.result = result;
			this.reqResponse = postResponse;
			if (result && result.reqResponseObjectType === 'response') {
				this.eventListenersResult = await this.eventListeners.trigger(
					'beforeResponse',
					request,
					result.reqResponse,
					result,
				);
			}

			const cdnSettings = result.cdnExperimentSettings;
			let validCDNSettings = this.shouldFetchFromOrigin(cdnSettings);
			// Adjust origin URL based on CDN settings
			if (validCDNSettings) {
				originUrl = cdnSettings.cdnResponseURL;
				this.shouldCacheResponse = cdnSettings.cacheRequestToOrigin === true;
				this.logger.debug(`CDN settings found [fetchHandler] - shouldCacheResponse: ${this.shouldCacheResponse}`);
			}

			// Return response for POST requests without caching
			if (httpMethod === 'POST') {
				this.logger.debug('POST request detected. Returning response without caching [fetchHandler]');
				this.eventListenersResult = await this.eventListeners.trigger(
					'afterResponse',
					request,
					result.reqResponse,
					result,
				);
				fetchResponse = this.eventListenersResult.modifiedResponse || result.reqResponse;
				return fetchResponse;
			}

			// Handle specific GET requests immediately without caching
			if (httpMethod === 'GET' && (this.coreLogic.datafileOperation || this.coreLogic.configOperation)) {
				const fileType = this.coreLogic.datafileOperation ? 'datafile' : 'config file';
				this.logger.debug(
					`GET request detected. Returning current ${fileType} for SDK Key: ${this.coreLogic.sdkKey} [fetchHandler]`,
				);
				return result.reqResponse;
			}

			// Evaluate if we should fetch from the origin and/or cache
			if (originUrl && (!cdnSettings || validCDNSettings)) {
				this.setFetchAndProcessLogs(validCDNSettings, cdnSettings);
				fetchResponse = await this.fetchAndProcessRequest(request, originUrl, cdnSettings, ctx);
			} else {
				this.logger.debug(
					'No CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching.',
				);
				fetchResponse = await this.fetchFromOriginOrCDN(request);
			}

			this.eventListenersResult = await this.eventListeners.trigger('afterResponse', request, fetchResponse, result);
			fetchResponse = this.eventListenersResult.modifiedResponse || fetchResponse;

			return fetchResponse;
		} catch (error) {
			this.logger.error('Error processing request:', error);
			return AbstractResponse.createNewResponse(`Internal Server Error: ${error.toString()}`, { status: 500 });
		}
	}

	setFetchAndProcessLogs(validCDNSettings, cdnSettings) {
		if (!validCDNSettings) {
			this.logger.debug(
				'No CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching [fetchHandler]',
			);
		} else {
		}

		if (validCDNSettings) {
			this.logger.debug(
				`Fetching content from origin in CDN Adapter [fetchHandler -> fetchAndProcessRequest] - `,
				`shouldCacheResponse is ${this.shouldCacheResponse} and validCDNSettings is ${validCDNSettings} and `,
				`cdnSettings.forwardRequestToOrigin is ${cdnSettings.forwardRequestToOrigin}`,
			);
		}
	}

	/**
	 * Fetches from the origin and processes the request based on caching and CDN settings.
	 * @param {Request} originalRequest - The original request.
	 * @param {String} originUrl - The URL to fetch data from.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {Promise<Response>} - The processed response.
	 */
	async fetchAndProcessRequest(originalRequest, originUrl, cdnSettings, ctx) {
		this.logger.debug(`Fetching and processing request [fetchAndProcessRequest] URL: ${originUrl}`);

		let response;
		let newRequest = this.cloneRequestWithNewUrl(originalRequest, originUrl);

		// Set headers and cookies as necessary before sending the request
		if (cdnSettings.forwardRequestToOrigin) {
			newRequest.headers.set(defaultSettings.workerOperationHeader, 'true');

			if (this.cookiesToSetRequest.length > 0) {
				newRequest = this.setMultipleReqSerializedCookies(newRequest, this.cookiesToSetRequest);
			}
			if (optlyHelper.isValidObject(this.headersToSetRequest)) {
				newRequest = this.setMultipleRequestHeaders(newRequest, this.headersToSetRequest);
			}
		}

		this.eventListenersResult = await this.eventListeners.trigger(
			'beforeRequest',
			newRequest,
			this.reqResponse,
			this.result,
		);
		if (this.eventListenersResult && this.eventListenersResult.modifiedRequest) {
			newRequest = this.eventListenersResult.modifiedRequest;
		}

		if (!this.shouldCacheResponse) {
			response = await this.fetchFromOriginOrCDN(newRequest);
		} else {
			response = await this.handleFetchFromOrigin(newRequest, originUrl, cdnSettings, ctx);
		}

		// Set response headers and cookies after receiving the response
		if (this.cookiesToSetResponse.length > 0) {
			response = this.setMultipleRespSerializedCookies(response, this.cookiesToSetResponse);
		}
		if (optlyHelper.isValidObject(this.headersToSetResponse)) {
			response = this.setMultipleResponseHeaders(response, this.headersToSetResponse);
		}

		this.logger.debug(`Response processed and being returned [fetchAndProcessRequest]`);
		this.eventListenersResult = await this.eventListeners.trigger('afterRequest', newRequest, response, this.result);
		if (this.eventListenersResult && this.eventListenersResult.modifiedResponse) {
			response = this.eventListenersResult.modifiedResponse;
		}
		return response;
	}

	/**
	 * Determines the origin URL based on CDN settings.
	 * @param {Request} request - The original request.
	 * @param {Object} cdnSettings - CDN related settings.
	 * @returns {String} - The URL to fetch data from.
	 */
	getOriginUrl(request, cdnSettings) {
		if (cdnSettings && cdnSettings.cdnResponseURL) {
			this.logger.debug(`CDN Origin URL [getOriginUrl]: ${cdnSettings.cdnResponseURL}`);
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
		const result = !!(cdnSettings && this.request.method === 'GET');
		this.logger.debug(`Should fetch from origin [shouldFetchFromOrigin]: ${result}`);
		return result;
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
		this.logger.debug(`Handling fetch from origin [handleFetchFromOrigin]: ${originUrl}`);
		let response = undefined;
		let cacheKey = undefined;
		const clonedRequest = this.cloneRequestWithNewUrl(request, originUrl);
		this.eventListenersResult = await this.eventListeners.trigger('beforeCreateCacheKey', request, this.result);
		if (this.eventListenersResult && this.eventListenersResult.cacheKey) {
			cacheKey = this.eventListenersResult.cacheKey;
		} else {
			cacheKey = this.generateCacheKey(cdnSettings, originUrl);
			this.eventListenersResult = await this.eventListeners.trigger('afterCreateCacheKey', cacheKey, this.result);
		}
		this.logger.debug(`Generated cache key: ${cacheKey}`);
		const cache = caches.default;
		this.eventListenersResult = await this.eventListeners.trigger(
			'beforeReadingCache',
			request,
			this.requestConfig,
			this.result,
		);
		if (!this.coreLogic.requestConfig.overrideCache) {
			response = await cache.match(cacheKey);
		}
		this.eventListenersResult = await this.eventListeners.trigger(
			'afterReadingCache',
			request,
			response,
			this.requestConfig,
			this.result,
		);
		if (this.eventListenersResult && this.eventListenersResult.modifiedResponse) {
			response = this.eventListenersResult.modifiedResponse;
		}

		if (!response) {
			this.logger.debug(`Cache miss for ${originUrl}. Fetching from origin.`);
			const newRequest = this.abstractionHelper.abstractRequest.createNewRequestFromUrl(originUrl, clonedRequest);
			response = await this.fetchFromOriginOrCDN(newRequest);
			if (response.headers.has('Cache-Control')) {
				response = this.abstractionHelper.abstractResponse.createNewResponse(response.body, response);
				response.headers.set('Cache-Control', 'public');
			}
			if (response.ok) {
				this.cacheResponse(ctx, cache, cacheKey, response);
				this.eventListenersResult = await this.eventListeners.trigger(
					'afterCacheResponse',
					request,
					response,
					this.result,
				);
				if (this.eventListenersResult && this.eventListenersResult.modifiedResponse) {
					response = this.eventListenersResult.modifiedResponse;
				}
			}
		} else {
			this.logger.debug(`Cache hit for: ${originUrl} with cacheKey: ${cacheKey}`);
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
		if (!this.responseHeadersSet) {
			response = this.setMultipleResponseHeaders(response, this.headersToSetResponse);
		}
		if (!this.responseCookiesSet) {
			response = this.setMultipleRespSerializedCookies(response, this.cookiesToSetResponse);
		}
		return response;
	}

	/**

	 * Generates a cache key based on CDN settings, enhancing cache control by adding
	 * A/B test identifiers or using specific CDN URLs as query parameters.
	 * @param {Object} cdnSettings - The CDN configuration settings.
	 * @param {string} originUrl - The request response used if forwarding to origin is needed.
	 * @returns {string} - A fully qualified URL to use as a cache key.
	 */
	generateCacheKey(cdnSettings, originUrl) {
		this.logger.debug(`Generating cache key [generateCacheKey]: ${cdnSettings}, ${originUrl}`);

		try {
			let cacheKeyUrl = this.abstractionHelper.abstractRequest.getNewURL(originUrl);
			// Add flagKey and variationKey as query parameters
			if (cdnSettings.cacheKey === 'VARIATION_KEY') {
				cacheKeyUrl.searchParams.set('flagKey', cdnSettings.flagKey);
				cacheKeyUrl.searchParams.set('variationKey', cdnSettings.variationKey);
			} else {
				cacheKeyUrl.searchParams.set('cacheKey', cdnSettings.cacheKey);
			}

			this.logger.debug(`Cache key generated [generateCacheKey]: ${cacheKeyUrl.href}`);
			return cacheKeyUrl.href;
		} catch (error) {
			this.logger.error('Error generating cache key:', error);
			throw new Error('Failed to generate cache key.');
		}
	}

	/**
	 * Fetches data from the origin or CDN based on the provided URL or Request object.
	 * @param {string|Request} input - The URL string or Request object.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Promise<Response>} - The response from the fetch operation.
	 */
	async fetchFromOriginOrCDN(input, options = {}) {
		try {
			const urlToFetch = typeof input === 'string' ? input : input.url;
			this.logger.debug(`Fetching from origin or CDN [fetchFromOriginOrCDN]: ${urlToFetch}`, options);
			return await AbstractRequest.fetchRequest(urlToFetch, options);
		} catch (error) {
			this.logger.error('Error fetching from origin or CDN:', error);
			throw error;
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
			this.logger.debug(`Fetching from origin [fetchFromOrigin]: ${cdnSettings}, ${reqResponse}`);
			const urlToFetch = cdnSettings.forwardRequestToOrigin ? reqResponse.url : cdnSettings.cdnResponseURL;
			const result = await this.fetchFromOriginOrCDN(urlToFetch);
			this.logger.debug(`Fetch from origin completed [fetchFromOrigin]: ${urlToFetch}`);
			return result;
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
	async cacheResponse(ctx, cache, cacheKey, responseToCache) {
		let response;
		this.eventListenersResult = await this.eventListeners.trigger(
			'beforeCacheResponse',
			this.request,
			responseToCache,
			this.result,
		);
		if (this.eventListenersResult && this.eventListenersResult.modifiedResponse) {
			response = this.eventListenersResult.modifiedResponse;
		}
		response = response || responseToCache;
		this.logger.debug(`Caching response [cacheResponse]: ${cacheKey}`);
		try {
			const responseToCache = this.cloneResponse(response);
			this.abstractionHelper.ctx.waitUntil(cache.put(cacheKey, responseToCache));
			this.logger.debug('Response from origin was cached successfully. Cached Key:', cacheKey);
		} catch (error) {
			this.logger.error('Error caching response:', error);
			throw new Error('Failed to cache response.');
		}
	}

	/**
	 * Asynchronously dispatches consolidated events to the Optimizely LOGX events endpoint.
	 * @param {RequestContext} ctx - The context of the Cloudflare Worker.
	 * @param {Object} defaultSettings - Contains default settings such as the Optimizely events endpoint.
	 * @returns {Promise<void>} - A Promise that resolves when the event dispatch process is complete.
	 */
	async dispatchConsolidatedEvents(ctx, defaultSettings) {
		this.logger.debug(`Dispatching consolidated events [dispatchConsolidatedEvents]: ${ctx}, ${defaultSettings}`);
		if (
			optlyHelper.arrayIsValid(this.eventQueue) &&
			this.optimizelyProvider &&
			this.optimizelyProvider.optimizelyClient
		) {
			try {
				const allEvents = await this.consolidateVisitorsInEvents(this.eventQueue);
				ctx.waitUntil(
					this.dispatchAllEventsToOptimizely(defaultSettings.optimizelyEventsEndpoint, allEvents).catch((err) => {
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
	 * This method replicates the default Cloudflare fetch behavior for Workers.
	 *
	 * @param {Request} request - The incoming request to be forwarded.
	 * @param {object} env - The environment bindings.
	 * @param {object} ctx - The execution context.
	 * @returns {Promise<Response>} - The response from the origin server, or an error response if fetching fails.
	 */
	async defaultFetch(request, env, ctx) {
		try {
			this.logger.debug(`Fetching from origin [defaultFetch]`);
			// check if the request is a string, then use the request as the url, otherwise use the request object url property
			const _url = typeof request === 'string' ? request : request.url;
			this.logger.debug(`Fetching from origin for: ${_url}`);

			// Perform a standard fetch request using the original request details
			const response = await this.fetchFromOriginOrCDN(_url);

			// Check if the response was successful
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			this.logger.debug(`Fetch fromn origin completed [defaultFetch]`);

			// Clone the response to modify it if necessary
			let clonedResponse = AbstractResponse.createNewResponse(response.body, {
				status: response.status,
				statusText: response.statusText,
				//headers: new Headers(response.headers),
				headers: this.abstractionHelper.getNewHeaders(response),
			});

			// Here you can add any headers or perform any response transformations if necessary
			// For example, you might want to remove certain headers or add custom headers
			// clonedResponse.headers.set('X-Custom-Header', 'value');

			return clonedResponse;
		} catch (error) {
			this.logger.error(`Failed to fetch: ${error.message}`);

			// Return a standardized error response
			return AbstractResponse.createNewResponse(
				`An internal error occurred during the request [defaultFetch]: ${error.message}`,
				{
					status: 500,
					statusText: 'Internal Server Error',
				},
			);
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
		this.logger.debugExt(`Getting datafile [getDatafile]: ${sdkKey}`);
		const url = `https://cdn.optimizely.com/datafiles/${sdkKey}.json`;
		// TODO - This cacheTtl needs to be verified across CDN providers and abstracted...
		try {
			const response = await this.defaultFetch(url, { cf: { cacheTtl: ttl } });
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
		const _errorMessage = errorMessage || 'An error occurred during request processing the request.';
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
	 * Designed to be used within Cloudflare Workers to handle event collection for Optimizely.
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
		this.logger.debug(`Consolidating events into single visitor [consolidateVisitorsInEvents]: ${eventQueue}`);
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
		let modifiedEvents = events,
			modifiedUrl = url;
		this.logger.debug(`Dispatching all events to Optimizely [dispatchAllEventsToOptimizely]: ${url}, ${events}`);
		if (!url) {
			throw new Error('URL must be provided.');
		}

		if (!events || typeof events !== 'object') {
			throw new Error('Valid event data must be provided.');
		}

		this.eventListenersResult = this.eventListeners.trigger('beforeDispatchingEvents', url, events);
		if (this.eventListenersResult) {
			if (this.eventListenersResult.modifiedUrl) {
				modifiedUrl = this.eventListenersResult.modifiedUrl;
			}
			if (this.eventListenersResult.modifiedEvents) {
				modifiedEvents = this.eventListenersResult.modifiedEvents;
			}
		}

		const eventRequest = this.abstractionHelper.abstractRequest.createNewRequestFromUrl(modifiedUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(modifiedEvents),
		});

		try {
			const response = await this.fetchFromOriginOrCDN(eventRequest);
			const operationResult = !!response.ok;
			this.logger.debug(
				`Events were dispatched to Optimizely [dispatchAllEventsToOptimizely] - Operation Result: ${operationResult}`,
			);

			this.eventListenersResult = this.eventListeners.trigger(
				'afterDispatchingEvents',
				eventRequest,
				response,
				modifiedEvents,
				operationResult,
			);

			if (!operationResult) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			this.logger.debug(`Events were successfully dispatched to Optimizely [dispatchAllEventsToOptimizely]`);
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
		this.logger.debug(`Getting datafile from KV [getDatafileFromKV]`);
		const jsonString = await kvStore.get(sdkKey); // Namespace must be updated manually
		if (jsonString) {
			try {
				this.logger.debug(`Datafile retrieved from KV [getDatafileFromKV]`);
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
				result = AbstractResponse.createNewResponse(tempResponse, { status });
				result.headers.set('Content-Type', 'application/json');
				break;
			case 'text/html':
				result = AbstractResponse.createNewResponse(responseBody, { status });
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
		this.logger.debug(`Getting flags from KV [getFlagsFromKV]`);
		const flagsString = await kvStore.get(defaultSettings.kv_key_optly_flagKeys); // Namespace must be updated manually
		this.logger.debugExt(`Flags retrieved from KV [getFlagsFromKV]: ${flagsString}`);
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

			// Use the abstraction helper to create a new request with the new URL
			return this.abstractionHelper.abstractRequest.createNewRequest(request, newUrl);
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
		return this.abstractionHelper.abstractRequest.cloneRequest(request);
	}

	/**
	 * Clones a request object asynchronously.
	 * @async
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneRequest(request) {
		return this.abstractionHelper.abstractRequest.cloneRequest(request);
	}

	/**
	 * Clones a response object asynchronously.
	 * @async
	 * @param {Response} response - The original response object to be cloned.
	 * @returns {Promise<Response>} - A promise that resolves to the cloned response object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneResponse(response) {
		return this.abstractionHelper.abstractResponse.cloneResponse(response);
	}

	/**
	 * Static method to retrieve JSON payload using AbstractRequest.
	 *
	 * @static
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	static async getJsonPayload(request) {
		return await this.abstractionHelper.abstractRequest.getJsonPayload(request);
	}

	/**
	 * Instance method to retrieve JSON payload using AbstractRequest.
	 *
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	async getJsonPayload(request) {
		return await this.abstractionHelper.abstractRequest.getJsonPayload(request);
	}

	/**
	 * Creates a cache key based on the request and environment.
	 * @param {Request} request - The incoming request.
	 * @param {Object} env - The environment object.
	 * @returns {Request} The modified request object to be used as the cache key.
	 */
	createCacheKey(request, env) {
		this.logger.debugExt(`Creating cache key [createCacheKey]`);
		// Including a variation logic that determines the cache key based on some attributes
		const url = this.abstractionHelper.abstractRequest.getNewURL(request.url);
		const variation = this.coreLogic.determineVariation(request, env);
		url.pathname += `/${variation}`;
		// Modify the URL to include variation
		// Optionally add search params or headers as cache key modifiers
		const result = this.abstractionHelper.abstractRequest.createNewRequestFromUrl(url.toString(), {
			method: request.method,
			headers: request.headers,
		});
		this.logger.debug(`Cache key created [createCacheKey]: ${result}`);
		return result;
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
			this.logger.debugExt(`Setting cookie [setResponseCookie]: ${name}, ${value}, ${options}`);
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
			this.abstractionHelper.abstractResponse.appendCookieToResponse(response, cookieValue);
			this.logger.debug(`Cookie set to value [setResponseCookie]: ${cookieValue}`);
		} catch (error) {
			this.logger.error('An error occurred while setting the cookie:', error);
			throw error;
		}
	}

	/**
	 * Sets a cookie in the request object by modifying its headers.
	 * This method is ideal for adding or modifying cookies in requests sent from Cloudflare Workers.
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
	 * @throws {TypeError} If the request, name, or value parameter is not provided or has an invalid type.
	 */
	setRequestCookie(request, name, value, options = cookieDefaultOptions) {
		this.logger.debugExt(`Setting cookie [setRequestCookie]: ${name}, ${value}, ${options}`);
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

		// Use the abstraction helper to set the cookie in the request
		this.abstractionHelper.abstractRequest.setCookieRequest(request, name, value, finalOptions);
		this.logger.debug(`Cookie set to value [setRequestCookie]: ${name}, ${value}, ${finalOptions}`);
		return request;
	}

	/**
	 * Sets multiple cookies on a cloned request object in Cloudflare Workers.
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
		this.logger.debugExt(`Setting multiple cookies [setMultipleRequestCookies]: ${cookies}`);
		if (!(request instanceof Request)) {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = this.abstractionHelper.abstractRequest.cloneRequest(request);
		let existingCookies = this.abstractionHelper.abstractRequest.getHeaderFromRequest(clonedRequest, 'Cookie') || '';

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
			this.abstractionHelper.abstractRequest.setHeaderFromRequest(clonedRequest, 'Cookie', existingCookies);
			this.logger.debug(`Cookies set in request [setMultipleRequestCookies]: ${existingCookies}`);
		} catch (error) {
			this.logger.error('Error setting cookies:', error);
			throw new Error('Failed to set cookies in the request.');
		}

		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned request object in Cloudflare Workers.
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
		this.logger.debugExt('Setting multiple serialized cookies [setMultipleReqSerializedCookies]: ', cookies);
		if (!(request instanceof Request)) {
			throw new TypeError('Invalid request object');
		}

		// Clone the original request
		const clonedRequest = this.abstractionHelper.abstractRequest.cloneRequest(request);
		const existingCookies = this.abstractionHelper.abstractRequest.getHeaderFromRequest(clonedRequest, 'Cookie') || '';

		// Append each serialized cookie to the existing cookie header
		const updatedCookies = existingCookies
			? `${existingCookies}; ${Object.values(cookies).join('; ')}`
			: Object.values(cookies).join('; ');
		this.abstractionHelper.abstractRequest.setHeaderInRequest(clonedRequest, 'Cookie', updatedCookies);
		this.logger.debug(`Cookies set in request [setMultipleReqSerializedCookies]: ${updatedCookies}`);
		return clonedRequest;
	}

	/**
	 * Sets multiple pre-serialized cookies on a cloned response object in Cloudflare Workers.
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
		this.logger.debugExt('Setting multiple serialized cookies [setMultipleRespSerializedCookies]: ', cookies);
		if (!(response instanceof Response)) {
			throw new TypeError('Invalid response object');
		}

		// Clone the original response to avoid modifying it directly
		const clonedResponse = AbstractResponse.createNewResponse(response.body, response);
		// Retrieve existing Set-Cookie headers
		let existingCookies = this.getResponseHeader(clonedResponse, 'Set-Cookie') || [];
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
			this.abstractionHelper.abstractResponse.appendCookieToResponse(clonedResponse, cookie);
		});
		this.logger.debug(`Cookies set in response [setMultipleRespSerializedCookies]`);
		this.logger.debugExt(`Cookies set in response [setMultipleRespSerializedCookies] - Values: ${existingCookies}`);

		return clonedResponse;
	}

	/**
	 * Sets a header in the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setRequestHeader(request, name, value) {
		// Use the abstraction helper to set the header in the request
		this.logger.debugExt(`Setting header [setRequestHeader]: ${name}, ${value}`);
		this.abstractionHelper.abstractRequest.setHeaderInRequest(request, name, value);
	}

	/**
	 * Sets multiple headers on a cloned request object in Cloudflare Workers.
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
		this.logger.debugExt(`Setting multiple headers [setMultipleRequestHeaders]: ${headers}`);
		const newRequest = this.cloneRequest(request);
		for (const [name, value] of Object.entries(headers)) {
			this.abstractionHelper.abstractRequest.setHeaderInRequest(newRequest, name, value);
		}
		this.logger.debug(`Headers set in request [setMultipleRequestHeaders]`);
		return newRequest;
	}

	/**
	 * Sets multiple headers on a cloned response object in Cloudflare Workers.
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
		this.logger.debugExt(`Setting multiple headers [setMultipleResponseHeaders]:`, headers);
		// Clone the original response
		const newResponse = this.cloneResponse(response);
		// const newResponse = response;

		// Update the headers with new values
		Object.entries(headers).forEach(([name, value]) => {
			this.abstractionHelper.abstractResponse.setHeaderInResponse(newResponse, name, value);
		});
		this.logger.debug(`Headers set in response [setMultipleResponseHeaders]`);
		return newResponse;
	}

	/**
	 * Retrieves the value of a header from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getRequestHeader(name, request) {
		this.logger.debugExt(`Getting header [getRequestHeader]: ${name}`);
		return this.abstractionHelper.abstractRequest.getHeaderFromRequest(request, name);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setResponseHeader(response, name, value) {
		this.logger.debugExt(`Setting header [setResponseHeader]: ${name}, ${value}`);
		this.abstractionHelper.abstractResponse.setHeaderInResponse(response, name, value);
	}

	/**
	 * Retrieves the value of a header from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getResponseHeader(response, name) {
		this.logger.debugExt(`Getting header [getResponseHeader]: ${name}`);
		return this.abstractionHelper.abstractResponse.getHeaderFromResponse(response, name);
	}

	/**
	 * Retrieves the value of a cookie from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} The value of the cookie or null if not found.
	 */
	getRequestCookie(request, name) {
		this.logger.debugExt(`Getting cookie [getRequestCookie]: ${name}`);
		// Assuming there's a method in AbstractRequest to get cookies
		return this.abstractionHelper.abstractRequest.getCookieFromRequest(name);
	}
}

export default CloudflareAdapter;
