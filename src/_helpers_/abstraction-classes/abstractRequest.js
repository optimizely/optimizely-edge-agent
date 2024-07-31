/**
 * @module AbstractRequest
 *
 */

import defaultSettings from '../../_config_/defaultSettings';
import { logger } from '../../_helpers_/optimizelyHelper';
import { AbstractionHelper } from '../abstractionHelper';

/**
 * The AbstractRequest class is an abstract class that provides a common interface for handling requests.
 * It is designed to be extended by other classes to provide specific implementations for handling requests.
 * Some methods are implemented as static methods and some as instance methods. Some instance methods are also
 * implemented as static methods by reference to the static methods.
 * It implements the following methods:
 * - constructor(request) - Initializes the AbstractRequest instance with the request object.
 * - getNewURL(url) - Returns a new URL object for the given URL.
 * - getUrlHref() - Returns the full URL of the request.
 * - getPathname() - Returns the pathname of the request URL.
 * - getHttpMethod() - Returns the HTTP method of the request.
 * - getHeader(name) - Returns the value of a header from the request.
 * - setHeader(name, value) - Sets a header in the request.
 * - getCookie(name) - Returns the value of a cookie from the request.
 * - setCookie(name, value, options) - Sets a cookie in the request.
 * - getParameterByName(name) - Returns the value of a query parameter from the request URL.
 * - cloneRequest(request) - Clones a request object based on the CDN provider specified in defaultSettings.
 * - createNewRequest(request, newUrl, options) - Creates a new request with the given URL and options.
 * - createNewRequestFromUrl(url, options) - Creates a new request based on the URL passed in.
 * - getJsonPayload(request) - Retrieves the JSON payload from a request, ensuring the request method is POST.
 */
export class AbstractRequest {
	/**
	 * @param {Request} request - The native request object.
	 */
	constructor(request) {
		logger().debug('AbstractRequest constructor called');
		this.request = request;
		this.cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		logger().debug('AbstractRequest - CDN provider:', this.cdnProvider);
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
		logger().debug('AbstractRequest - Search params:', this.searchParams);
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
		logger().debugExt('AbstractRequest - Cloning request [cloneRequest]');
		const cdnProvider = defaultSettings.cdnProvider; // Retrieve CDN provider from defaultSettings

		try {
			switch (cdnProvider.toLowerCase()) {
				case 'cloudflare':
				case 'fastly':
				case 'vercel':
					// For these CDNs, the Fetch API's clone method should work.
					const newRequestInit = {
						method: request.method,
						headers: new Headers(request.headers), // Clone existing headers
						body: request.body,
						mode: request.mode,
						credentials: request.credentials,
						cache: request.cache,
						redirect: request.redirect,
						referrer: request.referrer,
						integrity: request.integrity,
					};
					return new Request(request.url, newRequestInit);

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
			logger().error('Error cloning request:', error);
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
	 * @param {string} [newUrl] - The new URL for the request. If null or empty, the original request URL is used.
	 * @param {Object} [options={}] - Additional options for the request.
	 * @returns {Request} - The new request object.
	 */
	static createNewRequest(request, newUrl, options = {}) {
		logger().debugExt('AbstractRequest - Creating new request [createNewRequest]');

		// Use the original request URL if newUrl is null or empty
		const finalUrl = newUrl || request.url;

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

		return new Request(finalUrl, requestOptions);
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
		logger().debugExt('AbstractRequest - Creating new request from URL [createNewRequestFromUrl]');
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
		logger().debugExt('AbstractRequest - Retrieving JSON payload [getJsonPayload]');
		if (request.method !== 'POST') {
			logger().error('Request is not an HTTP POST method.');
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
			logger().error('Error parsing JSON:', error);
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
			logger().error('Request failed:', error);
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
		try {
		logger().debugExt('AbstractRequest - Making HTTP request [fetchRequest]');
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
			if (
				input.method !== 'GET' &&
				input.method !== 'HEAD' &&
				(!input.bodyUsed || (input.bodyUsed && input.bodyUsed === false))
			) {
				requestOptions.body = input.body;
			}
		} else {
			throw new TypeError('Invalid input: must be a string URL or a Request object.');
		}

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
				const result = await fetch(new Request(url, requestOptions));
				//logger().debugExt('AbstractRequest - Fetch request [fetchRequest] - result:', result);
				return result;
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
		} catch (error) {
			logger().error('Error fetching request:', error.message);
			const _asbstractionHelper = AbstractionHelper.getAbstractionHelper();
			return _asbstractionHelper.createResponse({ error: error.message }, 500);
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
		logger().debugExt('AbstractRequest - Reading request body [readRequestBody]');
		const contentType = this.getHeaderFromRequest(request, 'content-type');
		logger().debugExt('AbstractRequest - Content type:', contentType);

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
				else if (
					contentType.includes('application/x-www-form-urlencoded') ||
					contentType.includes('multipart/form-data')
				) {
					const formData = await request.formData();
					const body = {};
					for (const [key, value] of formData.entries()) {
						body[key] = value;
					}
					logger().debugExt('AbstractRequest - Form data:', body);
					return JSON.stringify(body);
				}
				// For unknown content types, return 'Unknown content type'
				else {
					logger().debugExt('AbstractRequest - Unknown content type');
					return 'Unknown content type';
				}
			} else {
				// If content type is not provided, return undefined
				return undefined;
			}
		} catch (error) {
			// Log and handle errors while reading the request body
			logger().error('Error reading request body:', error.message);
			return undefined;
		}
	}
}
