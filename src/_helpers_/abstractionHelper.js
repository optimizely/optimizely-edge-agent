// abstractionHelper.js
// import Logger from './logger';
import EventListeners from '../_event_listeners_/eventListeners';
import defaultSettings from '../_config_/defaultSettings';
//
let logger;

/**
 * @module AbstractionHelper
 */

export class AbstractContext {
	/**
	 * Constructor for AbstractContext.
	 * @param {Object} ctx - The context object.
	 * @constructor
	 * @private
	 */
	constructor(ctx) {
		this.ctx = ctx || {};
		this.cdnProvider = defaultSettings.cdnProvider.toLowerCase();
	}

	/**
	 * Waits for a promise to resolve or reject.
	 * @param {Promise} promise - The promise to wait for.
	 * @returns {Promise} The original promise or a custom handling promise.
	 */
	waitUntil(promise) {
		switch (this.cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				if (this.ctx && this.ctx.waitUntil) {
					return this.ctx.waitUntil(promise);
				}
				break;
			case 'cloudfront':
				// Custom handling for CloudFront (Lambda@Edge)
				if (this.ctx && this.ctx.callbackWaitsForEmptyEventLoop !== undefined) {
					this.ctx.callbackWaitsForEmptyEventLoop = false;
					return promise;
				}
				break;
			case 'akamai':
				// Custom handling for Akamai EdgeWorkers
				if (this.ctx && this.ctx.wait) {
					return this.ctx.wait(promise);
				}
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}

		// Default handling if waitUntil or equivalent is not available
		return promise.catch(console.error);
	}
}

/**
 * Abstract class representing a unified KV store interface.
 * @class
 * @abstract
 */
export class KVStoreAbstractInterface {
	/**
	 * @param {Object} provider - The provider-specific KV store implementation.
	 */
	constructor(provider) {
		this.provider = provider;
	}

	/**
	 * Get a value by key from the KV store.
	 * @param {string} key - The key to retrieve.
	 * @returns {Promise<string|null>} - The value associated with the key.
	 */
	async get(key) {
		return this.provider.get(key);
	}

	/**
	 * Put a value into the KV store.
	 * @param {string} key - The key to store.
	 * @param {string} value - The value to store.
	 * @returns {Promise<void>}
	 */
	async put(key, value) {
		return this.provider.put(key, value);
	}

	/**
	 * Delete a key from the KV store.
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		return this.provider.delete(key);
	}
}

export class AbstractRequest {
	/**
	 * @param {Request} request - The native request object.
	 */
    constructor(request) {
        this.request = request;
        this.cdnProvider = defaultSettings.cdnProvider.toLowerCase();
        this.URL = new URL(request.url);
        this.url = request.url;

        switch (this.cdnProvider) {
            case 'cloudflare':
            case 'fastly':
            case 'vercel':
                this.method = request.method;
                this.headers = request.headers;
                break;
            case 'cloudfront':
                this.method = request.method;
                this.headers = AbstractRequest._normalizeCloudFrontHeaders(request.headers);
                break;
            case 'akamai':
                this.method = request.method;
                this.headers = AbstractRequest._normalizeAkamaiHeaders(request);
                break;
            default:
                throw new Error('Unsupported CDN provider.');
        }

        // Extract search parameters and assign them to variables
        this.searchParams = {};
        for (const [key, value] of this.URL.searchParams.entries()) {
            this.searchParams[key] = value;
        }
	}


	/**
	 * Get the pathname of the request URL.
	 * @returns {string} - The request URL pathname.
	 */
	getNewURL(url) {
		return new URL(url);
	}

	/**
	 * Get the full URL of the request.
	 * @returns {string} - The request URL.
	 */
	getUrlHref() {
		return this.URL.href;
	}

	/**
	 * Get the pathname of the request URL.
	 * @returns {string} - The request URL pathname.
	 */
	getPathname() {
		return this.URL.pathname;
	}

	/**
	 * Get the HTTP method of the request.
	 * @returns {string} - The request method.
	 */
	getHttpMethod() {
		return this.method;
	}

	/**
	 * Get the full URL of the request.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request URL.
	 */
	static getUrlHrefFromRequest(request) {
		return new URL(request.url).href;
	}

	/**
	 * Get the pathname of the request URL.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request URL pathname.
	 */
	static getPathnameFromRequest(request) {
		return new URL(request.url).pathname;
	}

	/**
	 * Get the HTTP method of the request.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request method.
	 */
	static getHttpMethodFromRequest(request) {
		return request.method;
	}

	/**
	 * Get the full URL of the request.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request URL.
	 */
	getUrlHrefFromRequest(request) {
		return AbstractRequest.getUrlHrefFromRequest(request);
	}

	/**
	 * Get the pathname of the request URL.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request URL pathname.
	 */
	getPathnameFromRequest(request) {
		return AbstractRequest.getPathnameFromRequest(request);
	}

	/**
	 * Get the HTTP method of the request.
	 * @param {Request} request - The request object.
	 * @returns {string} - The request method.
	 */
	getHttpMethodFromRequest(request) {
		return AbstractRequest.getHttpMethodFromRequest(request);
	}

	/**
	 * Get a header from the request.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeader(name) {
		switch (this.cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return this.headers.get(name);
			case 'cloudfront':
				return this.request.headers[name.toLowerCase()]?.[0]?.value || null;
			case 'akamai':
				return this.request.getHeader(name);
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Set a header in the request.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setHeader(name, value) {
		switch (this.cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				this.headers.set(name, value);
				break;
			case 'cloudfront':
				this.request.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Get a cookie from the request.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookie(name) {
		let cookies;

		switch (this.cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = this.headers.get('Cookie');
				break;
			case 'cloudfront':
				cookies = this.request.headers.cookie;
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	/**
	 * Set a cookie in the request.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	setCookie(name, value, options = {}) {
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (this.cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				this.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!this.request.headers['set-cookie']) {
					this.request.headers['set-cookie'] = [];
				}
				this.request.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

    static getHeaderFromRequest(request, name) {
        const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
        let headers;

        switch (cdnProvider) {
            case 'cloudflare':
            case 'fastly':
            case 'vercel':
                headers = request.headers;
                break;
            case 'cloudfront':
                headers = AbstractRequest._normalizeCloudFrontHeaders(request.headers);
                break;
            case 'akamai':
                headers = AbstractRequest._normalizeAkamaiHeaders(request);
                break;
            default:
                throw new Error('Unsupported CDN provider.');
        }

        return headers.get(name);
    }

	/**
	 * Normalize the headers for CloudFront.
	 * @param {Object} headers - The headers to normalize.
	 * @returns {Headers} - The normalized headers.
	 */
    static _normalizeCloudFrontHeaders(headers) {
        const normalizedHeaders = new Headers();
        for (const [key, values] of Object.entries(headers)) {
            for (const { value } of values) {
                normalizedHeaders.append(key, value);
            }
        }
        return normalizedHeaders;
    }

	/**
	 * Normalize the headers for Akamai.
	 * @param {Request} request - The request object.
	 * @returns {Headers} - The normalized headers.
	 */
    static _normalizeAkamaiHeaders(request) {
        const normalizedHeaders = new Headers();
        for (const [key, value] of Object.entries(request.getHeaders())) {
            normalizedHeaders.append(key, value);
        }
        return normalizedHeaders;
    }

	/**
	 * Get a header from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeaderFromRequest(request, name) {
        return AbstractRequest.getHeaderFromRequest(request, name);
    }
	/**
	 * Set a header in the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	static setHeaderInRequest(request, name, value) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				request.headers.set(name, value);
				break;
			case 'cloudfront':
				request.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setHeaderInRequest(request, name, value) {
		AbstractRequest.setHeaderInRequest(request, name, value);
	}

	/**
	 * Get a cookie from the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	static getCookieFromRequest(request, name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = request.headers.get('Cookie');
				break;
			case 'cloudfront':
				cookies = request.headers.cookie;
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	getCookieFromRequest(request, name) {
		return AbstractRequest.getCookieFromRequest(request, name);
	}

	/**
	 * Set a cookie in the request.
	 * @param {Request} request - The request object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	static setCookieInRequest(request, name, value, options = {}) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				request.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!request.headers['set-cookie']) {
					request.headers['set-cookie'] = [];
				}
				reqest.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setCookieInRequest(request, name, value, options = {}) {
		AbstractRequest.setCookieInRequest(request, name, value, options);
	}

	/**
	 * Get the value of a query parameter from the request URL.
	 * @param {string} name - The name of the query parameter.
	 * @returns {string|null} - The value of the query parameter, or null if not found.
	 */
	getParameterByName(name) {
		return this.searchParams[name] || null;
	}

	/**
	 * Clones a request object based on the CDN provider specified in defaultSettings.
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an unsupported CDN provider is provided or if an error occurs during the cloning process.
	 */
	static cloneRequest(request) {
		const cdnProvider = defaultSettings.cdnProvider; // Retrieve CDN provider from defaultSettings

		try {
			switch (cdnProvider.toLowerCase()) {
				case 'cloudflare':
				case 'fastly':
				case 'vercel':
					// For these CDNs, the Fetch API's clone method should work.
					return request.clone();

				case 'cloudfront':
					// CloudFront Lambda@Edge specific cloning logic
					return new Request(request.url, {
						method: request.method,
						headers: request.headers,
						body: request.body,
						redirect: request.redirect,
						credentials: request.credentials,
						cache: request.cache,
						mode: request.mode,
						referrer: request.referrer,
						referrerPolicy: request.referrerPolicy,
						integrity: request.integrity,
					});

				case 'akamai':
					// Akamai EdgeWorkers specific cloning logic
					const clonedRequest = new Request(request.url, {
						method: request.method,
						headers: request.headers,
						body: request.body,
					});
					return clonedRequest;

				default:
					throw new Error('Unsupported CDN provider.');
			}
		} catch (error) {
			console.error('Error cloning request:', error);
			throw error;
		}
	}

	/**
	 * Clones a request object based on the CDN provider specified in defaultSettings.
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an unsupported CDN provider is provided or if an error occurs during the cloning process.
	 */
	cloneRequest(request) {
		return AbstractRequest.cloneRequest(request);
	}

	/**
	 * Creates a new request with the given URL and options.
	 * @param {Request} request - The original request object.
	 * @param {string} newUrl - The new URL for the request.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Request} - The new request object.
	 */
	static createNewRequest(request, newUrl, options = {}) {
		const requestOptions = {
			method: request.method,
			headers: new Headers(request.headers),
			mode: request.mode,
			credentials: request.credentials,
			cache: request.cache,
			redirect: request.redirect,
			referrer: request.referrer,
			integrity: request.integrity,
			...options,
		};

		// Ensure body is not assigned for GET or HEAD methods
		if (request.method !== 'GET' && request.method !== 'HEAD' && request.bodyUsed === false) {
			requestOptions.body = request.body;
		}

		return new Request(newUrl, requestOptions);
	}

	/**
	 * Creates a new request with the given URL and options.
	 * @param {Request} request - The original request object.
	 * @param {string} newUrl - The new URL for the request.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Request} - The new request object.
	 */
	createNewRequest(request, newUrl, options = {}) {
		return AbstractRequest.createNewRequest(request, newUrl, options);
	}

	/**
	 * Creates a new request based on the URL passed in.
	 * @param {string} url - The URL for the new request.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Request} - The new request object.
	 */
	static createNewRequestFromUrl(url, options = {}) {
		const requestOptions = {
			method: options.method || 'GET',
			headers: new Headers(options.headers || {}),
			...options,
		};

		return new Request(url, requestOptions);
	}

	/**
	 * Creates a new request based on the URL passed in.
	 * @param {string} url - The URL for the new request.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Request} - The new request object.
	 */
	createNewRequestFromUrl(url, options = {}) {
		return AbstractRequest.createNewRequestFromUrl(url, options);
	}

	/**
	 * Retrieves the JSON payload from a request, ensuring the request method is POST.
	 * This method clones the request for safe reading and handles errors in JSON parsing,
	 * returning null if the JSON is invalid or the method is not POST.
	 *
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	static async getJsonPayload(request) {
		if (request.method !== 'POST') {
			console.error('Request is not an HTTP POST method.');
			return null;
		}

		try {
			const clonedRequest = await this.cloneRequest(request);

			const bodyText = await clonedRequest.text();
			if (!bodyText.trim()) {
				return null; // Empty body, return null gracefully
			}

			return JSON.parse(bodyText);
		} catch (error) {
			console.error('Error parsing JSON:', error);
			return null;
		}
	}

	/**
	 * Instance method wrapper for getJsonPayload static method.
	 *
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	getJsonPayload(request) {
		return AbstractRequest.getJsonPayload(request);
	}

	/**
	 * Simulate a fetch operation using a hypothetical httpRequest function for Akamai.
	 * @param {string} url - The URL to fetch.
	 * @param {Object} options - The options object for the HTTP request.
	 * @returns {Promise<any>} - A promise that resolves with the response from the httpRequest.
	 */
	static async akamaiFetch(url, options) {
		try {
			const response = await httpRequest(url, options);
			if (options.method === 'GET') {
				return JSON.parse(response);
			}
			return response;
		} catch (error) {
			console.error('Request failed:', error);
			throw error;
		}
	}

	/**
	 * Fetch data from a specified URL using the HTTPS module tailored for AWS CloudFront.
	 * @param {string} url - The URL to fetch.
	 * @param {Object} options - The options object for HTTPS request.
	 * @returns {Promise<any>} - A promise that resolves with the JSON response or the raw response depending on the method.
	 */
	static cloudfrontFetch(url, options) {
		return new Promise((resolve, reject) => {
			const req = https.request(url, options, (res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					if (res.headers['content-type']?.includes('application/json') && options.method === 'GET') {
						resolve(JSON.parse(data));
					} else {
						resolve(data);
					}
				});
			});

			req.on('error', (error) => reject(error));
			if (options.method === 'POST' && options.body) {
				req.write(options.body);
			}
			req.end();
		});
	}

	/**
	 * Makes an HTTP request based on a string URL or a Request object.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {string|Request} input - The URL string or Request object.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Promise<Response>} - The response from the fetch operation.
	 */
	static async fetchRequest(input, options = {}) {
		let url;
		let requestOptions = options;

		if (typeof input === 'string') {
			url = input;
		} else if (input instanceof Request) {
			url = input.url;
			requestOptions = {
				method: input.method,
				headers: AbstractionHelper.getNewHeaders(input),
				mode: input.mode,
				credentials: input.credentials,
				cache: input.cache,
				redirect: input.redirect,
				referrer: input.referrer,
				integrity: input.integrity,
				...options,
			};

			// Ensure body is not assigned for GET or HEAD methods
			if (input.method !== 'GET' && input.method !== 'HEAD' && (!input.bodyUsed || (input.bodyUsed && input.bodyUsed === false))) {
				requestOptions.body = input.body;
			}
		} else {
			throw new TypeError('Invalid input: must be a string URL or a Request object.');
		}

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
				return await fetch(new Request(url, requestOptions));
			case 'akamai':
				return await AbstractRequest.akamaiFetch(url, requestOptions);
			case 'fastly':
				return await fetch(new Request(url, requestOptions));
			case 'cloudfront':
				return await AbstractRequest.cloudfrontFetch(url, requestOptions);
			case 'vercel':
				return await fetch(new Request(url, requestOptions));
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Makes an HTTP request based on a string URL or a Request object.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {string|Request} input - The URL string or Request object.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Promise<Response>} - The response from the fetch operation.
	 */
	async fetchRequest(input, options = {}) {
		return AbstractRequest.fetchRequest(input, options);
	}

	/**
	 * Asynchronously reads and parses the body of a request based on its content type.
	 *
	 * @param {Request} request - The request object whose body needs to be read.
	 * @returns {Promise<any>} A promise resolving to the parsed body content.
	 */
	async readRequestBody(request) {
		return AbstractionHelper.readRequestBody(request);
	}

	/**
	 * Asynchronously reads and parses the body of a request based on its content type. (Static version)
	 *
	 * @static
	 * @param {Request} request - The request object whose body needs to be read.
	 * @returns {Promise<any>} A promise resolving to the parsed body content.
	 */
	static async readRequestBody(request) {
		const contentType = this.getHeaderFromRequest(request, 'content-type');

		try {
			if (contentType) {
				// If content type is JSON, parse the body as JSON
				if (contentType.includes('application/json')) {
					return await request.json();
				}
				// If content type is plain text or HTML, read the body as text
				else if (contentType.includes('application/text') || contentType.includes('text/html')) {
					return await request.text();
				}
				// If content type is URL encoded or multipart form data, parse it and construct a JSON object
				else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
					const formData = await request.formData();
					const body = {};
					for (const [key, value] of formData.entries()) {
						body[key] = value;
					}
					return JSON.stringify(body);
				}
				// For unknown content types, return 'Unknown content type'
				else {
					return 'Unknown content type';
				}
			} else {
				// If content type is not provided, return undefined
				return undefined;
			}
		} catch (error) {
			// Log and handle errors while reading the request body
			console.error('Error reading request body:', error.message);
			return undefined;
		}
	}
}

export class AbstractResponse {
	/**
	 * Creates a new response object.
	 * @static
	 * @param {Object|string} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @param {string} contentType - The content type of the response body.
	 * @returns {Response|Object} - The constructed response.
	 */
	static createResponse(body, status = 200, headers = {}, contentType = 'application/json') {
		// Ensure headers is a valid object
		if (!headers || typeof headers !== 'object') {
			headers = {};
		}

		// Set the content type in headers if not already set
		if (!headers['Content-Type']) {
			headers['Content-Type'] = contentType;
		}

		let responseBody;
		if (headers['Content-Type'].includes('application/json')) {
			responseBody = JSON.stringify(body);
		} else if (headers['Content-Type'].includes('text/plain') || headers['Content-Type'].includes('text/html')) {
			responseBody = body.toString();
		} else {
			responseBody = body; // For other content types, use the body as is
		}

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(responseBody, {
					status: status,
					headers: headers,
				});
			case 'akamai':
				// Assume Akamai EdgeWorkers
				return createResponse(responseBody, {
					status: status,
					headers: headers,
				});
			case 'cloudfront':
				// Assume AWS CloudFront (Lambda@Edge)
				return {
					status: status.toString(),
					statusDescription: 'OK',
					headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [{ key: k, value: v }]])),
					body: responseBody,
				};
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Creates a new response object.
	 * @param {Object|string} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @param {string} contentType - The content type of the response body.
	 * @returns {Response|Object} - The constructed response.
	 */
	createResponse(body, status = 200, headers = {}, contentType = 'application/json') {
		return AbstractResponse.createResponse(body, status, headers, contentType);
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	static createNewResponse(body, options) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(body, options);
			case 'akamai':
				return createResponse(responseBody, options);
			case 'cloudfront':
				// For Akamai and CloudFront, we assume the standard Response constructor works
				return new Response(body, options);
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	createNewResponse(body, options) {
		return AbstractResponse.createNewResponse(body, options);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	static setHeader(response, name, value) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.set(name, value);
				break;
			case 'cloudfront':
				response.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Gets a header from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	static getHeader(response, name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.headers.get(name);
			case 'cloudfront':
				return response.headers[name.toLowerCase()]?.[0]?.value || null;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Sets a cookie in the response.
	 * @param
	 * Sets a cookie in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	static setCookie(response, name, value, options = {}) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Gets a cookie from the response.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookie(name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = this.response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = this.response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	/**
	 * Gets a cookie from the request.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookie(name) {
		return AbstractResponse.getCookie(name);
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	static getCookieFromResponse(response, name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookieFromResponse(response, name) {
		return AbstractResponse.getCookieFromResponse(response, name);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setHeader(response, name, value) {
		AbstractResponse.setHeader(response, name, value);
	}

	/**
	 * Gets a header from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeader(response, name) {
		return AbstractResponse.getHeader(response, name);
	}

	/**
	 * Sets a cookie in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	setCookie(response, name, value, options = {}) {
		AbstractResponse.setCookie(response, name, value, options);
	}

	/**
	 * Get a header from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	static getHeaderFromResponse(response, name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.headers.get(name);
			case 'cloudfront':
				return response.headers[name.toLowerCase()]?.[0]?.value || null;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	getHeaderFromResponse(response, name) {
		return AbstractResponse.getHeaderFromResponse(response, name);
	}

	/**
	 * Set a header in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	static setHeaderInResponse(response, name, value) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.set(name, value);
				break;
			case 'cloudfront':
				response.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setHeaderInResponse(response, name, value) {
		AbstractResponse.setHeaderInResponse(response, name, value);
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	static getCookieFromResponse(response, name) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	getCookieFromResponse(response, name) {
		return AbstractResponse.getCookieFromResponse(response, name);
	}

	/**
	 * Set a cookie in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	static setCookieInResponse(response, name, value, options = {}) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setCookieInResponse(response, name, value, options = {}) {
		AbstractResponse.setCookieInResponse(response, name, value, options);
	}

	/**
	 * Appends a cookie to the response headers.
	 * @param {Response} response - The response object.
	 * @param {string} cookieValue - The serialized cookie string.
	 */
	static appendCookieToResponse(response, cookieValue) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieValue);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieValue });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Appends a cookie to the response headers.
	 * @param {Response} response - The response object.
	 * @param {string} cookieValue - The serialized cookie string.
	 */
	appendCookieToResponse(response, cookieValue) {
		AbstractResponse.appendCookieToResponse(response, cookieValue);
	}

	/**
	 * Parses the response body as JSON.
	 * @param {Response|Object} response - The response object.
	 * @returns {Promise<Object>} - The parsed JSON object.
	 */
	static async parseJson(response) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.json();
			case 'cloudfront':
				return JSON.parse(response.body);
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Parses the response body as JSON.
	 * @param {Response|Object} response - The response object.
	 * @returns {Promise<Object>} - The parsed JSON object.
	 */
	async parseJson(response) {
		return AbstractResponse.parseJson(response);
	}

	/**
	 * Clones the response object.
	 * @param {Response|Object} response - The response object.
	 * @returns {Response|Object} - The cloned response object.
	 */
	static cloneResponse(response) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.clone();
			case 'cloudfront':
				return { ...response };
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Clones the response object.
	 * @param {Response|Object} response - The response object.
	 * @returns {Response|Object} - The cloned response object.
	 */
	cloneResponse(response) {
		return AbstractResponse.cloneResponse(response);
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	static createNewResponse(body, options) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(body, options);
			case 'akamai':
			case 'cloudfront':
				// For Akamai and CloudFront, we assume the standard Response constructor works
				return new Response(body, options);
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	createNewResponse(body, options) {
		return AbstractResponse.createNewResponse(body, options);
	}
}

/**
 * Class representing an abstraction helper.
 * @class
 * @private
 */
export class AbstractionHelper {
	/**
	 * Constructor for AbstractionHelper.
	 * @param {Request} request - The request object.
	 * @param {Object} ctx - The context object.
	 * @param {Object} env - The environment object.
	 * @constructor
	 * @private
	 */
	constructor(request, ctx, env) {
		/**
		 * The request object.
		 * @type {AbstractRequest}
		 */
		this.abstractRequest = new AbstractRequest(request);

		/**
		 * The request object.
		 * @type {Request}
		 */
		this.request = this.abstractRequest.request;

		/**
		 * The response object.
		 * @type {AbstractResponse}
		 */
		this.abstractResponse = new AbstractResponse();

		/**
		 * The context object.
		 * @type {AbstractContext}
		 */
		this.ctx = new AbstractContext(ctx);

		/**
		 * The environment object.
		 * @type {Object}
		 */
		this.env = env;
	}

	/**
	 * Returns new headers based on the provided headers and the CDN provider.
	 * This method handles different CDN providers based on the value of defaultSettings.cdnProvider.
	 *
	 * @param {Object|Headers} existingHeaders - The existing headers to clone.
	 * @returns {Object|Headers} - A new headers object with the same headers as the existing one.
	 */
	static getNewHeaders(existingHeaders) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Headers(existingHeaders);

			case 'akamai':
				const newHeadersAkamai = {};
				for (const [key, value] of Object.entries(existingHeaders)) {
					newHeadersAkamai[key] = value;
				}
				return newHeadersAkamai;

			case 'cloudfront':
				const newHeadersCloudfront = {};
				for (const [key, value] of Object.entries(existingHeaders)) {
					newHeadersCloudfront[key.toLowerCase()] = [{ key, value }];
				}
				return newHeadersCloudfront;

			default:
				throw new Error(`Unsupported CDN provider: ${cdnProvider}`);
		}
	}

	/**
	 * Returns new headers based on the provided headers and the CDN provider.
	 * This method handles different CDN providers based on the value of defaultSettings.cdnProvider.
	 *
	 * @param {Object|Headers} existingHeaders - The existing headers to clone.
	 * @returns {Object|Headers} - A new headers object with the same headers as the existing one.
	 */
	getNewHeaders(existingHeaders) {
		return AbstractionHelper.getNewHeaders(existingHeaders);
	}

	/*
	 * Creates a new response object.
	 *
	 * @param {Object} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @returns {Response} - The constructed response.
	 */
	createResponse(body, status = 200, headers = { 'Content-Type': 'application/json' }) {
		return this.abstractResponse.createResponse(body, status, headers);
	}

	/**
	 * Retrieves the value of a specific header from the response based on the CDN provider.
	 * @param {Object} response - The response object from the CDN provider.
	 * @param {string} headerName - The name of the header to retrieve.
	 * @returns {string|null} - The value of the header, or null if the header is not found.
	 * @throws {Error} - If an unsupported CDN provider is provided or if the response object is invalid.
	 */
	static getHeaderValue(response, headerName) {
		const cdnProvider = defaultSettings.cdnProvider;
		try {
			if (!response || typeof response !== 'object') {
				throw new Error('Invalid response object provided.');
			}

			switch (cdnProvider) {
				case 'cloudflare':
				case 'akamai':
				case 'vercel':
				case 'fastly':
					return response.headers.get(headerName) || null;

				case 'cloudfront':
					const headerValue = response.headers[headerName.toLowerCase()];
					return headerValue ? headerValue[0].value : null;

				default:
					throw new Error('Unsupported CDN provider.');
			}
		} catch (error) {
			console.error('Error retrieving header value:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the value of a specific header from the response based on the CDN provider.
	 * @param {Object} response - The response object from the CDN provider.
	 * @param {string} headerName - The name of the header to retrieve.
	 * @returns {string|null} - The value of the header, or null if the header is not found.
	 * @throws {Error} - If an unsupported CDN provider is provided or if the response object is invalid.
	 */
	getHeaderValue(response, headerName) {
		return AbstractionHelper.getHeaderValue(response, headerName);
	}

	/**
	 * Retrieves the response content as stringified JSON or text based on the CDN provider.
	 * @param {string} cdnProvider - The CDN provider ("cloudflare", "cloudfront", "akamai", "vercel", or "fastly").
	 * @param {Object} response - The response object from the CDN provider.
	 * @returns {Promise<string>} - A promise that resolves to the response content as stringified JSON or text.
	 * @throws {Error} - If an unsupported CDN provider is provided or if an error occurs during content retrieval.
	 */
	async getResponseContent(response) {
		try {
			if (!response || typeof response !== 'object') {
				throw new Error('Invalid response object provided.');
			}
			const cdnProvider = defaultSettings.cdnProvider;
			const contentType = this.getHeaderValue(response, 'Content-Type');
			const isJson = contentType && contentType.includes('application/json');

			switch (cdnProvider) {
				case 'cloudflare':
				case 'vercel':
				case 'fastly':
					if (isJson) {
						const json = await response.json();
						return JSON.stringify(json);
					} else {
						return await response.text();
					}

				case 'cloudfront':
					if (isJson) {
						const json = JSON.parse(response.body);
						return JSON.stringify(json);
					} else {
						return response.body;
					}

				case 'akamai':
					if (isJson) {
						const body = await response.getBody();
						const json = await new Response(body).json();
						return JSON.stringify(json);
					} else {
						const body = await response.getBody();
						return await new Response(body).text();
					}

				default:
					throw new Error('Unsupported CDN provider.');
			}
		} catch (error) {
			console.error('Error retrieving response content:', error);
			throw error;
		}
	}

	/**
	 * Retrieves the value of an environment variable.
	 *
	 * @param {string} name - The name of the environment variable.
	 * @param {Object} [environmentVariables] - An object containing environment variables.
	 * @returns {string} The value of the environment variable.
	 * @throws {Error} If the environment variable is not found.
	 */
	getEnvVariableValue(name, environmentVariables) {
		const env = environmentVariables || this.env;
		if (env && env[name] !== undefined) {
			return env[name];
		} else if (typeof process !== 'undefined' && process.env[name] !== undefined) {
			return process.env[name];
		} else {
			// Custom logic for Akamai or other CDNs
			if (typeof EdgeKV !== 'undefined') {
				// Assume we're in Akamai
				const edgeKv = new EdgeKV({ namespace: 'default' });
				return edgeKv.getText({ item: name });
			}
			throw new Error(`Environment variable ${name} not found`);
		}
	}

	/**
	 * Initialize the KV store based on the CDN provider (singleton).
	 * @param {string} cdnProvider - The CDN provider.
	 * @param {Object} kvInterfaceAdapter - The KV store interface adapter.
	 * @returns {KVStoreAbstractInterface} - The initialized KV store.
	 */
	initializeKVStore(cdnProvider, kvInterfaceAdapter) {
		if (!this.kvStore) {
			let provider;

			switch (cdnProvider) {
				case 'cloudflare':
					provider = kvInterfaceAdapter;
					break;
				case 'fastly':
					// Initialize Fastly KV provider
					// provider = new FastlyKVInterface(env, kvNamespace);
					throw new Error('Fastly KV provider not implemented');
				case 'akamai':
					// Initialize Akamai KV provider
					// provider = new AkamaiKVInterface(env, kvNamespace);
					throw new Error('Akamai KV provider not implemented');
				case 'clodufront':
					// Initialize CloudFront KV provider
					// provider = new CloudFrontKVInterface(env, kvNamespace);
					throw new Error('CloudFront KV provider not implemented');
				default:
					throw new Error('Unsupported CDN provider');
			}

			this.kvStore = new KVStoreAbstractInterface(provider);
		}

		return this.kvStore;
	}
}

/**
 * Retrieves an instance of AbstractionHelper.
 * This cannot be a singleton, and must be created for each request.
 * @param {Request} request - The request object.
 * @param {Object} env - The environment object.
 * @param {Object} ctx - The context object.
 * @returns {AbstractionHelper} The new instance of AbstractionHelper.
 */
export function getAbstractionHelper(request, env, ctx, loggerInstance) {
	logger = loggerInstance;
	const instance = new AbstractionHelper(request, env, ctx);
	return instance;
}

// /**
//  * @file extractParameters.js
//  * @description Utility to extract parameters from various CDN provider edge functions.
//  */

// /**
//  * Extracts request, context, and environment from various CDN provider edge function signatures.
//  * @param {object} args - Arguments passed to the edge function.
//  * @returns {object} Extracted parameters.
//  */
// export function extractParameters(...args) {
//     let request, context, env;

//     args.forEach(arg => {
//         if (arg && typeof arg === 'object') {
//             if (arg.cf) {
//                 // CloudFront Lambda@Edge
//                 request = arg.Records ? arg.Records[0].cf.request : request;
//                 context = arg.Records ? arg.Records[0].cf : context;
//             } else if (arg.url && arg.method) {
//                 // Fastly, Cloudflare, Vercel
//                 request = arg;
//             } else if (arg.requestContext) {
//                 // Akamai
//                 request = arg;
//             } else if (arg.functionName || arg.memoryLimitInMB) {
//                 // AWS Lambda Context
//                 context = arg;
//             } else if (typeof arg === 'object' && Object.keys(arg).length > 0) {
//                 // Environment object
//                 env = arg;
//             }
//         }
//     });

//     return { request, context, env };
// }

// // Usage examples for different CDNs:

// // Cloudflare
// export default {
//     async fetch(request, env, ctx) {
//         const { request: req, context, env: environment } = extractParameters(request, env, ctx);
//         // Your logic here
//     }
// };

// // Akamai
// export async function onClientRequest(request) {
//     const { request: req } = extractParameters(request);
//     // Your logic here
// }

// // Vercel
// export default async function handler(request, response) {
//     const { request: req } = extractParameters(request);
//     // Your logic here
// }

// // CloudFront Lambda@Edge
// export async function handler(event, context) {
//     const { request: req, context: ctx } = extractParameters(event, context);
//     // Your logic here
// }

// Alternative logic
// /**
//  * Extracts the request, context/ctx, and environment variables in an agnostic manner based on the provided parameters.
//  * @param {...any} args - The parameters passed to the method, which can include request, ctx, event, and context.
//  * @returns {Object} An object containing the extracted request, context/ctx, and environment variables.
//  */
// function extractCDNParams(...args) {
// 	let request, ctx, event, context, env;

// 	// Iterate through the arguments and assign them based on their type
// 	for (const arg of args) {
// 	  if (arg instanceof Request) {
// 		request = arg;
// 	  } else if (arg && typeof arg === 'object') {
// 		if (arg.hasOwnProperty('request')) {
// 		  // Cloudfront Lambda@Edge event object
// 		  event = arg;
// 		  request = event.Records[0].cf.request;
// 		} else if (arg.hasOwnProperty('env')) {
// 		  // Cloudflare Worker environment object
// 		  env = arg.env;
// 		  ctx = arg;
// 		} else if (arg.hasOwnProperty('waitUntil')) {
// 		  // Cloudflare Worker context object
// 		  ctx = arg;
// 		} else {
// 		  // Assume it's the context object for other CDN providers
// 		  context = arg;
// 		}
// 	  }
// 	}

// 	// Extract the environment variables based on the CDN provider
// 	if (!env) {
// 	  if (event) {
// 		// Cloudfront Lambda@Edge
// 		env = process.env;
// 	  } else if (context) {
// 		// Vercel Edge Functions
// 		env = context.env;
// 	  } else {
// 		// Akamai EdgeWorkers
// 		env = {};
// 	  }
// 	}

// 	return { request, ctx, event, context, env };
//   }

//   // Cloudflare Worker
// export default {
// 	async fetch(request, env, ctx) {
// 	  const { request: extractedRequest, ctx: extractedCtx, env: extractedEnv } = extractCDNParams(request, env, ctx);
// 	  // Use the extracted parameters in your code
// 	  // ...
// 	}
//   }

//   // Cloudfront Lambda@Edge
//   export async function handler(event, context) {
// 	const { request: extractedRequest, event: extractedEvent, context: extractedContext, env: extractedEnv } = extractCDNParams(event, context);
// 	// Use the extracted parameters in your code
// 	// ...
//   }

//   // Vercel Edge Functions
//   export default async function handler(request, response) {
// 	const { request: extractedRequest, context: extractedContext, env: extractedEnv } = extractCDNParams(request, response);
// 	// Use the extracted parameters in your code
// 	// ...
//   }

//   // Akamai EdgeWorkers
//   export async function onClientRequest(request) {
// 	const { request: extractedRequest, env: extractedEnv } = extractCDNParams(request);
// 	// Use the extracted parameters in your code
// 	// ...
//   }
