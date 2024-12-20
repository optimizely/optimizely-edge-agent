/**
 * @module VercelAdapter
 */

import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import { kv } from '@vercel/kv';
import cookieDefaultOptions from '../../_config_/cookieOptions';
import defaultSettings from '../../_config_/defaultSettings';
import EventListeners from '../../_event_listeners_/eventListeners';
import { AbstractRequest } from '../../_helpers_/abstraction-classes/abstractRequest';
import { AbstractResponse } from '../../_helpers_/abstraction-classes/abstractResponse';

/**
 * Adapter for handling Optimizely Edge on Vercel Edge Functions
 */
class VercelAdapter {
    /**
     * Constructor for the VercelAdapter
     * @param {Object} coreLogic - Core logic for handling Optimizely Edge
     * @param {Object} optimizelyProvider - Provider for Optimizely services
     * @param {Object} abstractionHelper - Helper for abstracting platform-specific functionality
     * @param {Object} kvStore - Key-value store for caching (Vercel KV)
     * @param {Object} kvStoreUserProfile - Key-value store for user profiles
     * @param {Object} logger - Logger instance
     * @param {string} pagesUrl - URL for Pages
     * @param {string} sdkKey - SDK key for Optimizely
     */
    constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger, pagesUrl) {
        this.pagesUrl = pagesUrl;
        this.sdkKey = sdkKey;
        this.logger = logger;
        this.kvStore = kvStore || kv;
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
     * @param {Request} request - The incoming request
     * @param {Object} env - Environment variables
     * @param {Object} ctx - Context object
     * @returns {Promise<Response>} The processed response
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

            if (originUrl.protocol !== 'https:') {
                originUrl.protocol = 'https:';
            }
            originUrl = originUrl.toString();
            const httpMethod = request.method;
            let preRequest = request;
            
            this.eventListenersResult = await this.eventListeners.trigger(
                'beforeProcessingRequest',
                request,
                this.coreLogic.requestConfig
            );
            if (this.eventListenersResult && this.eventListenersResult.modifiedRequest) {
                preRequest = this.eventListenersResult.modifiedRequest;
            }

            const result = await this.coreLogic.processRequest(preRequest, env, ctx, this.sdkKey);
            const reqResponse = result.reqResponse;
            if (reqResponse === 'NO_MATCH') {
                this.logger.debug('No cdnVariationSettings found. Fetching content from origin [cdnAdapter -> fetchHandler]');
                const response = await this.fetchFromOriginOrCDN(request);
                return response;
            }

            this.eventListenersResult = await this.eventListeners.trigger(
                'afterProcessingRequest',
                request,
                result.reqResponse,
                this.coreLogic.requestConfig,
                result
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
                    result
                );
            }

            const cdnSettings = result.cdnExperimentSettings;
            let validCDNSettings = false;

            if (cdnSettings && typeof cdnSettings === 'object') {
                validCDNSettings = this.shouldFetchFromOrigin(cdnSettings);
                this.logger.debug(
                    `Valid CDN settings found [fetchHandler] - validCDNSettings: ${optlyHelper.safelyStringifyJSON(
                        validCDNSettings
                    )}`
                );
                this.logger.debug(
                    `CDN settings found [fetchHandler] - cdnSettings: ${optlyHelper.safelyStringifyJSON(cdnSettings)}`
                );
            } else {
                this.logger.debug('CDN settings are undefined or invalid');
            }

			if (validCDNSettings) {
				originUrl = cdnSettings.cdnResponseURL || originUrl;
				this.shouldCacheResponse = cdnSettings.cacheRequestToOrigin === true;
				this.logger.debug(`CDN settings found [fetchHandler] - shouldCacheResponse: ${this.shouldCacheResponse}`);
			}

            if (httpMethod === 'POST') {
                this.logger.debug('POST request detected. Returning response without caching [fetchHandler]');
                this.eventListenersResult = await this.eventListeners.trigger(
                    'afterResponse',
                    request,
                    result.reqResponse,
                    result
                );
                fetchResponse = this.eventListenersResult.modifiedResponse || result.reqResponse;
                return fetchResponse;
            }

            if (httpMethod === 'GET' && (this.coreLogic.datafileOperation || this.coreLogic.configOperation)) {
                const fileType = this.coreLogic.datafileOperation ? 'datafile' : 'config file';
                this.logger.debug(
                    `GET request detected. Returning current ${fileType} for SDK Key: ${this.coreLogic.sdkKey} [fetchHandler]`
                );
                return result.reqResponse;
            }

            if (originUrl && (!cdnSettings || validCDNSettings)) {
                this.setFetchAndProcessLogs(validCDNSettings, cdnSettings);
                fetchResponse = await this.fetchAndProcessRequest(request, originUrl, cdnSettings);
            } else {
                this.logger.debug(
                    'No valid CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching.'
                );
                fetchResponse = await this.fetchFromOriginOrCDN(request);
            }

            this.eventListenersResult = await this.eventListeners.trigger('afterResponse', request, fetchResponse, result);
            fetchResponse = this.eventListenersResult.modifiedResponse || fetchResponse;

            return fetchResponse;
        } catch (error) {
            this.logger.error('Error processing request:', error);
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
    }

    setFetchAndProcessLogs(validCDNSettings, cdnSettings) {
		if (!validCDNSettings) {
			this.logger.debug(
				'No valid CDN settings found or CDN Response URL is undefined. Fetching directly from origin without caching [fetchHandler]'
			);
		} else {
			this.logger.debug('Valid CDN settings found [fetchHandler]');
		}

		if (validCDNSettings && cdnSettings) {
			this.logger.debug(
				`Fetching content from origin in CDN Adapter [fetchHandler -> fetchAndProcessRequest] - `,
				`shouldCacheResponse is ${this.shouldCacheResponse} and validCDNSettings is ${validCDNSettings} and `,
				`cdnSettings.forwardRequestToOrigin is ${cdnSettings.forwardRequestToOrigin}`
			);
		}
	}

    /**
     * Handles POST requests
     * @param {Request} request - The request
     * @param {string} originUrl - The origin URL
     * @returns {Promise<Response>} The response
     */
    async handlePostRequest(request, originUrl) {
        const response = await this.fetchFromOriginOrCDN(request);
        this.eventListenersResult = await this.eventListeners.trigger(
            'afterResponse',
            request,
            response,
            this.coreLogic.requestConfig
        );
        return this.eventListenersResult?.modifiedResponse || response;
    }

    /**
     * Fetches and processes the request with Vercel-specific caching
     * @param {Request} request - The request
     * @param {string} originUrl - The origin URL
     * @param {Object} cdnSettings - CDN settings
     * @param {Object} ctx - Context object
     * @returns {Promise<Response>} The processed response
     */
    async fetchAndProcessRequest(request, originUrl, cdnSettings, ctx) {
        const newRequest = this.cloneRequestWithNewUrl(request, originUrl);
        
        if (cdnSettings?.forwardRequestToOrigin) {
            newRequest.headers.set(defaultSettings.workerOperationHeader, 'true');
            this.applyRequestModifications(newRequest, cdnSettings);
        }

        // Event listener for request
        this.eventListenersResult = await this.eventListeners.trigger(
            'beforeRequest',
            newRequest,
            this.reqResponse,
            this.result
        );

        const shouldCache = this.shouldCacheResponse && cdnSettings?.cacheRequestToOrigin;
        let response;

        if (shouldCache) {
            response = await this.handleCachedRequest(newRequest, originUrl, cdnSettings, ctx);
        } else {
            response = await this.fetchFromOriginOrCDN(newRequest);
        }

        // Apply response modifications
        response = this.applyResponseModifications(response);

        return response;
    }

    /**
     * Handles cached requests using Vercel KV
     * @param {Request} request - The request
     * @param {string} originUrl - The origin URL
     * @param {Object} cdnSettings - CDN settings
     * @param {Object} ctx - Context object
     * @returns {Promise<Response>} The response
     */
    async handleCachedRequest(request, originUrl, cdnSettings, ctx) {
        const cacheKey = this.generateCacheKey(cdnSettings, originUrl);
        let response;

        try {
            // Try to get from Vercel KV
            const cachedResponse = await this.kvStore.get(cacheKey);
            if (cachedResponse) {
                this.logger.debug('Cache hit');
                return new Response(cachedResponse.body, cachedResponse);
            }

            // If not in cache, fetch from origin
            response = await this.fetchFromOriginOrCDN(request);
            if (response.ok) {
                const cacheTTL = cdnSettings.cacheTTL || 3600;
                const responseToCache = {
                    body: await response.clone().text(),
                    status: response.status,
                    headers: Object.fromEntries(response.headers)
                };
                
                // Store in Vercel KV
                await this.kvStore.set(cacheKey, responseToCache, { ex: cacheTTL });
            }

            return response;
        } catch (error) {
            this.logger.error('Error handling cached request:', error);
            return await this.fetchFromOriginOrCDN(request);
        }
    }

    /**
     * Applies modifications to the request
     * @param {Request} request - The request to modify
     * @param {Object} cdnSettings - CDN settings
     */
    applyRequestModifications(request, cdnSettings) {
        if (this.cookiesToSetRequest.length > 0) {
            this.setMultipleReqSerializedCookies(request, this.cookiesToSetRequest);
        }

        if (cdnSettings.additionalHeaders) {
            Object.entries(cdnSettings.additionalHeaders).forEach(([name, value]) => {
                request.headers.set(name, value);
            });
        }

        if (optlyHelper.isValidObject(this.headersToSetRequest)) {
            Object.entries(this.headersToSetRequest).forEach(([name, value]) => {
                request.headers.set(name, value);
            });
        }
    }

    /**
     * Applies modifications to the response
     * @param {Response} response - The response to modify
     * @returns {Response} The modified response
     */
    applyResponseModifications(response) {
        let modifiedResponse = response;

        if (this.cookiesToSetResponse.length > 0) {
            modifiedResponse = this.setMultipleRespSerializedCookies(modifiedResponse, this.cookiesToSetResponse);
        }

        if (optlyHelper.isValidObject(this.headersToSetResponse)) {
            modifiedResponse = this.setMultipleResponseHeaders(modifiedResponse, this.headersToSetResponse);
        }

        return AbstractResponse.createNewResponse(modifiedResponse.body, {
            status: modifiedResponse.status,
            headers: modifiedResponse.headers
        });
    }

    /**
     * Generates a cache key for Vercel KV store
     * @param {Object} cdnSettings - CDN settings
     * @param {string} originUrl - The origin URL
     * @returns {string} The generated cache key
     */
    generateCacheKey(cdnSettings, originUrl) {
        let cacheKey = originUrl;
        if (cdnSettings?.abTestIdentifier) {
            const url = new URL(originUrl);
            url.searchParams.append('abTestId', cdnSettings.abTestIdentifier);
            cacheKey = url.toString();
        }
        // Vercel KV requires string keys
        return cacheKey.toString();
    }

    /**
     * Dispatches events to Optimizely
     * @param {Object} params - Event parameters
     * @param {string} params.url - Event URL
     * @param {Object} params.params - Event data
     * @returns {Promise<void>}
     */
    async dispatchEventToOptimizely({ url, params: eventData }) {
        try {
            this.eventQueue.push(eventData);
            this.logger.debug('Event added to queue for batch processing');
            
            // Trigger event listener
            await this.eventListeners.trigger('eventDispatched', eventData);
        } catch (error) {
            this.logger.error('Error dispatching event to Optimizely:', error);
            throw error;
        }
    }

    /**
     * Consolidates visitors in events for batch processing
     * @param {Array} eventQueue - Queue of events
     * @returns {Object|null} Consolidated event
     */
    consolidateVisitorsInEvents(eventQueue) {
        if (!eventQueue?.length) {
            return null;
        }

        const consolidatedEvent = { ...eventQueue[0] };
        const allVisitors = eventQueue.reduce((acc, event) => {
            if (event.visitors?.length) {
                acc.push(...event.visitors);
            }
            return acc;
        }, []);

        consolidatedEvent.visitors = allVisitors;
        return consolidatedEvent;
    }

    /**
     * Dispatches consolidated events to Optimizely
     * @param {Object} ctx - Context object
     * @returns {Promise<void>}
     */
    async dispatchConsolidatedEvents(ctx) {
        try {
            if (!this.eventQueue.length) {
                return;
            }

            const consolidatedEvent = this.consolidateVisitorsInEvents(this.eventQueue);
            if (consolidatedEvent) {
                const response = await fetch(defaultSettings.optimizelyEventsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(consolidatedEvent)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                this.eventQueue = [];
                this.logger.debug('Successfully dispatched consolidated events');
                
                // Trigger event listener
                await this.eventListeners.trigger('eventsDispatched', consolidatedEvent);
            }
        } catch (error) {
            this.logger.error('Error in dispatchConsolidatedEvents:', error);
            throw error;
        }
    }

    /**
     * Sets a response cookie
     * @param {Response} response - The response
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options
     * @returns {Response} The modified response
     * @throws {Error} If response is null or not an instance of Response
     */
    setResponseCookie(response, name, value, options = cookieDefaultOptions) {
        if (!response || !(response instanceof Response)) {
            throw new Error('Invalid response parameter');
        }
        if (!this.responseCookiesSet) {
            const cookieString = this.serializeCookie(name, value, options);
            response = this.abstractionHelper.abstractResponse.appendCookieToResponse(response, cookieString);
            this.responseCookiesSet = true;
        }
        return response;
    }

    /**
     * Sets multiple request cookies
     * @param {Request} request - The request
     * @param {Object} cookies - Cookies to set
     * @returns {Request} The modified request
     */
    setMultipleRequestCookies(request, cookies) {
        if (!request || !cookies) {
            throw new Error('Invalid parameters: request and cookies are required');
        }
        let modifiedRequest = this.abstractionHelper.abstractRequest.cloneRequest(request);
        for (const [name, cookie] of Object.entries(cookies)) {
            const cookieString = this.serializeCookie(name, cookie.value, cookie.options);
            modifiedRequest = this.abstractionHelper.abstractRequest.setHeaderInRequest(modifiedRequest, 'Cookie', cookieString);
        }
        return modifiedRequest;
    }

    /**
     * Sets multiple response headers
     * @param {Response} response - The response
     * @param {Object} headers - Headers to set
     * @returns {Response} The modified response
     */
    setMultipleResponseHeaders(response, headers) {
        let modifiedResponse = response;
        for (const [name, value] of Object.entries(headers)) {
            modifiedResponse = this.abstractionHelper.abstractResponse.setHeaderInResponse(modifiedResponse, name, value);
        }
        return modifiedResponse;
    }

    /**
     * Creates a cache key
     * @param {Request} request - The request
     * @param {Object} env - Environment variables
     * @returns {Request} The cache key request
     */
    createCacheKey(request, env) {
        return this.abstractionHelper.abstractRequest.createNewRequestFromUrl(request.url);
    }

    /**
     * Serializes a cookie
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options
     * @returns {string} Serialized cookie string
     */
    serializeCookie(name, value, options = {}) {
        let str = `${name}=${value}`;
        
        if (options.maxAge) {
            str += `; Max-Age=${options.maxAge}`;
        }
        if (options.domain) {
            str += `; Domain=${options.domain}`;
        }
        if (options.path) {
            str += `; Path=${options.path}`;
        }
        if (options.expires) {
            str += `; Expires=${options.expires}`;
        }
        if (options.httpOnly) {
            str += '; HttpOnly';
        }
        if (options.secure) {
            str += '; Secure';
        }
        if (options.sameSite) {
            str += `; SameSite=${options.sameSite}`;
        }
        
        return str;
    }

    /**
     * Gets a request cookie
     * @param {Request} request - The request
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value
     */
    getRequestCookie(request, name) {
        const cookies = request.headers.get('Cookie');
        if (!cookies) return null;

        const match = cookies.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : null;
    }

    /**
     * Gets a response cookie
     * @param {Response} response - The response
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value
     */
    getResponseCookie(response, name) {
        const cookies = response.headers.getAll('Set-Cookie');
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        if (!cookie) return null;

        const match = cookie.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : null;
    }

    /**
     * Clones a request with a new URL
     * @param {Request} request - The request to clone
     * @param {string} newUrl - The new URL
     * @returns {Request} Cloned request
     */
    cloneRequestWithNewUrl(request, newUrl) {
        return new Request(newUrl, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });
    }

    /**
     * Fetches from origin or CDN
     * @param {Request|string} input - The request or URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} The response
     */
    async fetchFromOriginOrCDN(input, options = {}) {
        try {
            const response = await fetch(input, options);
            this.logger.debug(`Fetch completed with status: ${response.status}`);
            return response;
        } catch (error) {
            this.logger.error('Error fetching from origin/CDN:', error);
            throw error;
        }
    }

    /**
     * Determines if request should fetch from origin
     * @param {Object} cdnSettings - CDN settings
     * @returns {boolean} Whether to fetch from origin
     */
    shouldFetchFromOrigin(cdnSettings) {
        return !!(cdnSettings && this.request.method === 'GET');
    }

    /**
     * Creates a new response object
     * @param {*} responseBody - Response body
     * @param {string} contentType - Content type
     * @param {boolean} stringifyResult - Whether to stringify the result
     * @param {number} status - HTTP status code
     * @returns {Promise<Response>} The new response
     */
    async getNewResponseObject(responseBody, contentType, stringifyResult = true, status = 200) {
        return AbstractResponse.createNewResponse(responseBody, {
            status,
            headers: {
                'Content-Type': contentType
            },
            stringifyResult
        });
    }

    /**
     * Gets JSON payload from request
     * @param {Request} request - The request
     * @returns {Promise<Object|null>} The JSON payload
     */
    async getJsonPayload(request) {
        return AbstractRequest.getJsonPayload(request);
    }

    /**
     * Sets a request header
     * @param {Request} request - The request
     * @param {string} name - Header name
     * @param {string} value - Header value
     * @returns {Request} Modified request
     */
    setRequestHeader(request, name, value) {
        return AbstractRequest.setHeaderInRequest(request, name, value);
    }

    /**
     * Gets a request header
     * @param {Request} request - The request
     * @param {string} name - Header name
     * @returns {string|null} Header value
     */
    getRequestHeader(request, name) {
        return AbstractRequest.getHeaderFromRequest(request, name);
    }

    /**
     * Gets a response header
     * @param {Response} response - The response
     * @param {string} name - Header name
     * @returns {string|null} Header value
     */
    getResponseHeader(response, name) {
        return AbstractResponse.getHeaderFromResponse(response, name);
    }

    /**
     * Sets a response cookie
     * @param {Response} response - The response
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options
     * @returns {Response} The modified response
     */
    setResponseCookie(response, name, value, options = cookieDefaultOptions) {
        if (!response || !(response instanceof Response)) {
            throw new Error('Invalid response parameter');
        }
        const cookieString = this.serializeCookie(name, value, options);
        return this.abstractionHelper.abstractResponse.appendCookieToResponse(response, cookieString);
    }

    /**
     * Sets multiple request cookies
     * @param {Request} request - The request
     * @param {Object} cookies - Cookies to set
     * @returns {Request} The modified request
     */
    setMultipleRequestCookies(request, cookies) {
        let modifiedRequest = this.abstractionHelper.abstractRequest.cloneRequest(request);
        for (const [name, cookie] of Object.entries(cookies)) {
            const cookieString = this.serializeCookie(name, cookie.value, cookie.options);
            modifiedRequest = this.abstractionHelper.abstractRequest.setHeaderInRequest(modifiedRequest, 'Cookie', cookieString);
        }
        return modifiedRequest;
    }

    /**
     * Sets multiple response headers
     * @param {Response} response - The response
     * @param {Object} headers - Headers to set
     * @returns {Response} The modified response
     */
    setMultipleResponseHeaders(response, headers) {
        let modifiedResponse = response;
        for (const [name, value] of Object.entries(headers)) {
            modifiedResponse = this.abstractionHelper.abstractResponse.setHeaderInResponse(modifiedResponse, name, value);
        }
        return modifiedResponse;
    }

    /**
     * Creates a cache key
     * @param {Request} request - The request
     * @param {Object} env - Environment variables
     * @returns {Request} The cache key request
     */
    createCacheKey(request, env) {
        return this.abstractionHelper.abstractRequest.createNewRequestFromUrl(request.url);
    }
}

export default VercelAdapter;