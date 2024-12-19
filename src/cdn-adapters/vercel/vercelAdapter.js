import * as optlyHelper from '../../_helpers_/optimizelyHelper';
import { EventListeners } from '../../_helpers_/eventListeners';
import { AbstractResponse } from '../../_helpers_/abstractResponse';
import { defaultSettings } from '../../_helpers_/defaultSettings';

/**
 * Adapter for handling Optimizely Edge on Vercel
 */
class VercelAdapter {
    /**
     * Constructor for the VercelAdapter
     * @param {Object} coreLogic - Core logic for handling Optimizely Edge
     * @param {Object} optimizelyProvider - Provider for Optimizely services
     * @param {string} sdkKey - SDK key for Optimizely
     * @param {Object} abstractionHelper - Helper for abstracting platform-specific functionality
     * @param {Object} kvStore - Key-value store for caching
     * @param {Object} kvStoreUserProfile - Key-value store for user profiles
     * @param {Object} logger - Logger instance
     * @param {string} pagesUrl - URL for Pages
     */
    constructor(coreLogic, optimizelyProvider, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger, pagesUrl) {
        this.pagesUrl = pagesUrl;
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

            // Adjust origin URL based on CDN settings
            if (validCDNSettings) {
                originUrl = cdnSettings.cdnResponseURL || originUrl;
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
                    result
                );
                fetchResponse = this.eventListenersResult.modifiedResponse || result.reqResponse;
                return fetchResponse;
            }

            // Handle specific GET requests immediately without caching
            if (httpMethod === 'GET' && (this.coreLogic.datafileOperation || this.coreLogic.configOperation)) {
                const fileType = this.coreLogic.datafileOperation ? 'datafile' : 'config file';
                this.logger.debug(
                    `GET request detected. Returning current ${fileType} for SDK Key: ${this.coreLogic.sdkKey} [fetchHandler]`
                );
                return result.reqResponse;
            }

            // Evaluate if we should fetch from the origin and/or cache
            if (originUrl && (!cdnSettings || validCDNSettings)) {
                this.setFetchAndProcessLogs(validCDNSettings, cdnSettings);
                fetchResponse = await this.fetchAndProcessRequest(request, originUrl, cdnSettings, ctx);
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
            return AbstractResponse.createNewResponse(`Internal Server Error: ${error.toString()}`, { status: 500 });
        }
    }

    /**
     * Sets fetch and process logs based on CDN settings
     * @param {Object} validCDNSettings - Validated CDN settings
     * @param {Object} cdnSettings - CDN settings
     */
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
     * Fetches and processes the request
     * @param {Request} originalRequest - The original request
     * @param {string} originUrl - The origin URL
     * @param {Object} cdnSettings - CDN settings
     * @param {Object} ctx - Context object
     * @returns {Promise<Response>} The processed response
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

            if (cdnSettings.additionalHeaders && typeof cdnSettings.additionalHeaders === 'object') {
                this.logger.debug('Adding additional headers from cdnSettings');
                for (const [headerName, headerValue] of Object.entries(cdnSettings.additionalHeaders)) {
                    newRequest.headers.set(headerName, headerValue);
                    this.logger.debugExt(`Added header: ${headerName}: ${headerValue}`);
                }
            }

            if (optlyHelper.isValidObject(this.headersToSetRequest)) {
                newRequest = this.setMultipleRequestHeaders(newRequest, this.headersToSetRequest);
            }
        }

        this.eventListenersResult = await this.eventListeners.trigger(
            'beforeRequest',
            newRequest,
            this.reqResponse,
            this.result
        );
        if (this.eventListenersResult && this.eventListenersResult.modifiedRequest) {
            newRequest = this.eventListenersResult.modifiedRequest;
        }

        if (!this.shouldCacheResponse) {
            response = await this.fetchFromOriginOrCDN(newRequest);
        } else {
            response = await this.handleFetchFromOrigin(newRequest, originUrl, cdnSettings, ctx);
        }

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
     * Determines if the request should fetch from origin
     * @param {Object} cdnSettings - CDN settings
     * @returns {boolean} Whether to fetch from origin
     */
    shouldFetchFromOrigin(cdnSettings) {
        const result = !!(cdnSettings && this.request.method === 'GET');
        this.logger.debug(`Should fetch from origin [shouldFetchFromOrigin]: ${result}`);
        return result;
    }

    /**
     * Handles fetching from origin
     * @param {Request} request - The request
     * @param {string} originUrl - The origin URL
     * @param {Object} cdnSettings - CDN settings
     * @param {Object} ctx - Context object
     * @returns {Promise<Response>} The response from origin
     */
    async handleFetchFromOrigin(request, originUrl, cdnSettings, ctx) {
        this.logger.debug(`Handling fetch from origin [handleFetchFromOrigin]: ${originUrl}`);
        let response;
        let cacheKey;
        const clonedRequest = this.cloneRequestWithNewUrl(request, originUrl);
        const shouldUseCache =
            this.coreLogic.requestConfig?.overrideCache !== true && cdnSettings?.cacheRequestToOrigin === true;

        this.eventListenersResult = await this.eventListeners.trigger('beforeCreateCacheKey', request, this.result);
        if (this.eventListenersResult && this.eventListenersResult.cacheKey) {
            cacheKey = this.eventListenersResult.cacheKey;
        } else {
            cacheKey = this.generateCacheKey(cdnSettings, originUrl);
            this.eventListenersResult = await this.eventListeners.trigger('afterCreateCacheKey', cacheKey, this.result);
        }
        this.logger.debug(`Generated cache key: ${cacheKey}`);

        // Use Vercel's caching mechanism
        if (shouldUseCache) {
            try {
                response = await caches.default.match(cacheKey);
                this.logger.debug(`Cache ${response ? 'hit' : 'miss'} for key: ${cacheKey}`);
            } catch (error) {
                this.logger.error('Error accessing cache:', error);
            }
        }

        if (!response) {
            response = await this.fetchFromOriginOrCDN(clonedRequest);
            if (shouldUseCache && response.ok) {
                const cacheTTL = cdnSettings.cacheTTL || 3600;
                ctx.waitUntil(this.cacheResponse(ctx, caches.default, cacheKey, response.clone(), cacheTTL));
            }
        }

        return response;
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
            this.logger.debug(`Fetch from origin/CDN completed [fetchFromOriginOrCDN] Status: ${response.status}`);
            return response;
        } catch (error) {
            this.logger.error('Error fetching from origin/CDN:', error);
            throw error;
        }
    }

    /**
     * Generates a cache key
     * @param {Object} cdnSettings - CDN settings
     * @param {string} originUrl - The origin URL
     * @returns {string} The generated cache key
     */
    generateCacheKey(cdnSettings, originUrl) {
        let cacheKey = originUrl;
        if (cdnSettings && cdnSettings.abTestIdentifier) {
            const url = new URL(originUrl);
            url.searchParams.append('abTestId', cdnSettings.abTestIdentifier);
            cacheKey = url.toString();
        }
        return new Request(cacheKey);
    }

    /**
     * Caches a response
     * @param {Object} ctx - Context object
     * @param {Object} cache - Cache object
     * @param {string} cacheKey - Cache key
     * @param {Response} response - Response to cache
     * @param {number|null} cacheTTL - Cache TTL in seconds
     * @returns {Promise<void>}
     */
    async cacheResponse(ctx, cache, cacheKey, response, cacheTTL = null) {
        try {
            const cacheOptions = {};
            if (cacheTTL) {
                cacheOptions.expirationTtl = cacheTTL;
            }
            await cache.put(cacheKey, response, cacheOptions);
            this.logger.debug(`Response cached successfully [cacheResponse] Key: ${cacheKey}`);
        } catch (error) {
            this.logger.error('Error caching response:', error);
        }
    }

    /**
     * Clones a request with a new URL
     * @param {Request} request - The request to clone
     * @param {string} newUrl - The new URL
     * @returns {Request} The cloned request
     */
    cloneRequestWithNewUrl(request, newUrl) {
        const newRequest = new Request(newUrl, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });
        return newRequest;
    }

    /**
     * Sets multiple request headers
     * @param {Request} request - The request
     * @param {Object} headers - Headers to set
     * @returns {Request} The modified request
     */
    setMultipleRequestHeaders(request, headers) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });

        for (const [name, value] of Object.entries(headers)) {
            newRequest.headers.set(name, value);
        }

        return newRequest;
    }

    /**
     * Sets multiple response headers
     * @param {Response} response - The response
     * @param {Object} headers - Headers to set
     * @returns {Response} The modified response
     */
    setMultipleResponseHeaders(response, headers) {
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
        });

        for (const [name, value] of Object.entries(headers)) {
            newResponse.headers.set(name, value);
        }

        return newResponse;
    }

    /**
     * Sets multiple serialized cookies in the request
     * @param {Request} request - The request
     * @param {Object} cookies - Cookies to set
     * @returns {Request} The modified request
     */
    setMultipleReqSerializedCookies(request, cookies) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });

        const existingCookies = newRequest.headers.get('Cookie') || '';
        const cookieArray = existingCookies.split('; ').filter(Boolean);

        for (const cookie of cookies) {
            cookieArray.push(cookie);
        }

        if (cookieArray.length > 0) {
            newRequest.headers.set('Cookie', cookieArray.join('; '));
        }

        return newRequest;
    }

    /**
     * Sets multiple serialized cookies in the response
     * @param {Response} response - The response
     * @param {Object} cookies - Cookies to set
     * @returns {Response} The modified response
     */
    setMultipleRespSerializedCookies(response, cookies) {
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
        });

        for (const cookie of cookies) {
            newResponse.headers.append('Set-Cookie', cookie);
        }

        return newResponse;
    }

    /**
     * Dispatches an event to Optimizely
     * @param {Object} params - Event parameters
     * @param {string} params.url - Event URL
     * @param {Object} params.params - Event data
     * @returns {Promise<void>}
     */
    async dispatchEventToOptimizely({ url, params: eventData }) {
        try {
            this.eventQueue.push(eventData);
            this.logger.debug('Event added to queue for batch processing');
        } catch (error) {
            this.logger.error('Error dispatching event to Optimizely:', error);
            throw error;
        }
    }

    /**
     * Consolidates visitors in events
     * @param {Array} eventQueue - Queue of events
     * @returns {Array} Consolidated events
     */
    consolidateVisitorsInEvents(eventQueue) {
        if (!eventQueue || eventQueue.length === 0) {
            return null;
        }

        const consolidatedEvent = { ...eventQueue[0] };
        const allVisitors = eventQueue.reduce((acc, event) => {
            if (event.visitors && Array.isArray(event.visitors)) {
                acc.push(...event.visitors);
            }
            return acc;
        }, []);

        consolidatedEvent.visitors = allVisitors;
        return consolidatedEvent;
    }

    /**
     * Dispatches all events to Optimizely
     * @param {string} url - Event URL
     * @param {Array} events - Events to dispatch
     * @returns {Promise<void>}
     */
    async dispatchAllEventsToOptimizely(url, events) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(events)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            this.logger.error('Error dispatching consolidated events:', error);
            throw error;
        }
    }

    /**
     * Dispatches consolidated events
     * @param {Object} ctx - Context object
     * @param {Object} defaultSettings - Default settings
     * @returns {Promise<void>}
     */
    async dispatchConsolidatedEvents(ctx, defaultSettings) {
        try {
            if (this.eventQueue.length === 0) {
                return;
            }

            const consolidatedEvent = this.consolidateVisitorsInEvents(this.eventQueue);
            if (consolidatedEvent) {
                await this.dispatchAllEventsToOptimizely(defaultSettings.optimizelyEventsUrl, consolidatedEvent);
                this.eventQueue = [];
                this.logger.debug('Successfully dispatched consolidated events');
            }
        } catch (error) {
            this.logger.error('Error in dispatchConsolidatedEvents:', error);
        }
    }

    /**
     * Gets the datafile
     * @param {string} sdkKey - SDK key
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<Object>} The datafile
     */
    async getDatafile(sdkKey, ttl = 3600) {
        try {
            const url = `${defaultSettings.optimizelyDatafileUrl}/${sdkKey}.json`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            this.logger.error('Error fetching datafile:', error);
            throw error;
        }
    }

    /**
     * Gets the datafile from KV store
     * @param {string} sdkKey - SDK key
     * @param {Object} kvStore - KV store
     * @returns {Promise<Object>} The datafile
     */
    async getDatafileFromKV(sdkKey, kvStore) {
        try {
            if (!kvStore) {
                return null;
            }
            return await kvStore.get(sdkKey);
        } catch (error) {
            this.logger.error('Error getting datafile from KV:', error);
            return null;
        }
    }

    /**
     * Gets flags from KV store
     * @param {Object} kvStore - KV store
     * @returns {Promise<Object>} The flags
     */
    async getFlagsFromKV(kvStore) {
        try {
            if (!kvStore) {
                return null;
            }
            return await kvStore.get(defaultSettings.kv_key_optly_flagKeys);
        } catch (error) {
            this.logger.error('Error getting flags from KV:', error);
            return null;
        }
    }

    /**
     * Creates error details
     * @param {Request} request - The request
     * @param {string} url - The URL
     * @param {string} message - Error message
     * @param {string} errorMessage - Additional error message
     * @param {Object} cdnSettingsVariable - CDN settings
     * @returns {Object} Error details
     */
    createErrorDetails(request, url, message, errorMessage = '', cdnSettingsVariable) {
        return {
            url: url || request.url,
            message,
            error: errorMessage,
            cdnSettings: cdnSettingsVariable
        };
    }

    /**
     * Default fetch implementation
     * @param {Request} request - The request
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} The response
     */
    async defaultFetch(request, options = {}) {
        try {
            const response = await fetch(request, options);
            this.logger.debug(`Default fetch completed with status: ${response.status}`);
            return response;
        } catch (error) {
            this.logger.error('Error in default fetch:', error);
            throw error;
        }
    }

    /**
     * Gets a request header
     * @param {string} name - Header name
     * @param {Request} request - The request
     * @returns {string|null} Header value
     */
    getRequestHeader(name, request) {
        return request.headers.get(name);
    }

    /**
     * Gets a response header
     * @param {Response} response - The response
     * @param {string} name - Header name
     * @returns {string|null} Header value
     */
    getResponseHeader(response, name) {
        return response.headers.get(name);
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
     * Sets a request cookie
     * @param {Request} request - The request
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options
     * @returns {Request} The modified request
     */
    setRequestCookie(request, name, value, options = cookieDefaultOptions) {
        const cookieString = this.serializeCookie(name, value, options);
        return this.setMultipleReqSerializedCookies(request, [cookieString]);
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
        const cookieString = this.serializeCookie(name, value, options);
        return this.setMultipleRespSerializedCookies(response, [cookieString]);
    }

    /**
     * Sets a response header
     * @param {Response} response - The response
     * @param {string} name - Header name
     * @param {string} value - Header value
     * @returns {Response} The modified response
     */
    setResponseHeader(response, name, value) {
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
        });
        newResponse.headers.set(name, value);
        return newResponse;
    }

    /**
     * Serializes a cookie
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options
     * @returns {string} Serialized cookie
     */
    serializeCookie(name, value, options = {}) {
        let cookie = `${name}=${value}`;
        
        if (options.path) cookie += `; Path=${options.path}`;
        if (options.domain) cookie += `; Domain=${options.domain}`;
        if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
        if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
        if (options.secure) cookie += '; Secure';
        if (options.httpOnly) cookie += '; HttpOnly';
        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
        
        return cookie;
    }

    /**
     * Gets the origin URL
     * @param {Request} request - The request
     * @param {Object} cdnSettings - CDN settings
     * @returns {string} The origin URL
     */
    getOriginUrl(request, cdnSettings) {
        if (cdnSettings && cdnSettings.cdnResponseURL) {
            this.logger.debug(`CDN Origin URL [getOriginUrl]: ${cdnSettings.cdnResponseURL}`);
            return cdnSettings.cdnResponseURL;
        }
        return request.url;
    }

    /**
     * Applies response settings
     * @param {Response} response - The response
     * @param {Object} cdnSettings - CDN settings
     * @returns {Response} The modified response
     */
    applyResponseSettings(response, cdnSettings) {
        let modifiedResponse = response;
        if (cdnSettings && cdnSettings.responseHeaders) {
            for (const [headerName, headerValue] of Object.entries(cdnSettings.responseHeaders)) {
                modifiedResponse = this.setResponseHeader(modifiedResponse, headerName, headerValue);
            }
        }
        return modifiedResponse;
    }

    /**
     * Clones a request
     * @param {Request} request - The request to clone
     * @returns {Promise<Request>} The cloned request
     */
    async cloneRequest(request) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
            redirect: request.redirect
        });
        return newRequest;
    }

    /**
     * Clones a response
     * @param {Response} response - The response to clone
     * @returns {Promise<Response>} The cloned response
     */
    async cloneResponse(response) {
        const newResponse = new Response(await response.clone().arrayBuffer(), {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
        });
        return newResponse;
    }

    /**
     * Creates a cache key
     * @param {Request} request - The request
     * @param {Object} env - Environment variables
     * @returns {Request} The cache key request
     */
    createCacheKey(request, env) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers)
        });
        return newRequest;
    }

    /**
     * Sets a request header
     * @param {Request} request - The request
     * @param {string} name - Header name
     * @param {string} value - Header value
     * @returns {Request} The modified request
     */
    setRequestHeader(request, name, value) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });
        newRequest.headers.set(name, value);
        return newRequest;
    }

    /**
     * Sets multiple request cookies
     * @param {Request} request - The request
     * @param {Object} cookies - Cookies to set
     * @returns {Request} The modified request
     */
    setMultipleRequestCookies(request, cookies) {
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers(request.headers),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: request.redirect
        });

        for (const [name, cookie] of Object.entries(cookies)) {
            const cookieString = this.serializeCookie(name, cookie.value, cookie.options);
            const existingCookie = newRequest.headers.get('Cookie');
            newRequest.headers.set('Cookie', existingCookie ? `${existingCookie}; ${cookieString}` : cookieString);
        }

        return newRequest;
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
        let body = responseBody;
        const headers = new Headers();

        if (contentType === 'application/json' && stringifyResult) {
            body = JSON.stringify(responseBody);
            headers.set('Content-Type', 'application/json');
        } else if (contentType) {
            headers.set('Content-Type', contentType);
        }

        return new Response(body, {
            status,
            headers
        });
    }

    /**
     * Gets JSON payload from request
     * @param {Request} request - The request
     * @returns {Promise<Object|null>} The JSON payload
     */
    async getJsonPayload(request) {
        if (request.method === 'POST') {
            try {
                return await request.json();
            } catch (error) {
                this.logger.error('Error parsing JSON payload:', error);
                return null;
            }
        }
        return null;
    }

    /**
     * Fetches from origin
     * @param {Object} cdnSettings - CDN settings
     * @param {Object} reqResponse - Request/response object
     * @returns {Promise<Response>} The response from origin
     */
    async fetchFromOrigin(cdnSettings, reqResponse) {
        const { request } = reqResponse;
        try {
            const response = await fetch(request);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            this.logger.error('Error fetching from origin:', error);
            throw error;
        }
    }
}

export default VercelAdapter;