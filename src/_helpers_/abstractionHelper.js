// abstractionHelper.js
// import Logger from './logger';
import EventListeners from '../_event_listeners_/eventListeners';
import CloudflareAdapter from '../cdn-adapters/cloudflare/cloudflareAdapter';
let logger;

/**
 * @module AbstractionHelper
 */

/**
 * Class representing an abstract context.
 * @class
 * @private
 */
class AbstractContext {
	/**
	 * Constructor for AbstractContext.
	 * @param {Object} ctx - The context object.
	 * @constructor
	 * @private
	 */
	constructor(ctx) {
		this.ctx = ctx || {};
	}

	/**
	 * Waits for a promise to resolve or reject.
	 * @param {Promise} promise - The promise to wait for.
	 * @returns {Promise} The original promise or a custom handling promise.
	 */
	waitUntil(promise) {
		if (this.ctx && this.ctx.waitUntil) {
			return this.ctx.waitUntil(promise);
		} else {
			// Custom handling if waitUntil is not available
			return promise.catch(console.error);
		}
	}
}

/**
 * Abstract class representing a unified KV store interface.
 * @class
 * @abstract
 */
class KVStoreAbstractInterface {
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

/**
 * Class representing an abstract request.
 * @class
 * @private
 */
class AbstractRequest {
	/**
	 * @param {Request} request - The native request object.
	 */
	constructor(request) {
		this.request = request;
		this.URL = new URL(request.url);
		this.url = request.url;
		this.method = request.method;
		this.headers = request.headers;
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
	 * Get a header from the request.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeader(name) {
		return this.headers.get(name);
	}
}

/**
 * Class representing an abstract response.
 * @class
 * @private
 */
class AbstractResponse {
	/**
	 * Creates a new response object.
	 * @static
	 * @param {Object} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @returns {Response} - The constructed response.
	 */
	static createResponse(body, status = 200, headers = { 'Content-Type': 'application/json' }) {
		// Check if the environment is Cloudflare Workers, Fastly, Akamai, or AWS
		// Assume Cloudflare or Fastly Workers
		if (typeof Response !== 'undefined') {
			return new Response(JSON.stringify(body), {
				status: status,
				headers: headers,
			});
		} else if (typeof EdgeKV !== 'undefined') {
			// Assume Akamai EdgeWorkers
			return new Response(JSON.stringify(body), {
				status: status,
				headers: headers,
			});
		} else if (typeof AWS !== 'undefined') {
			// Assume AWS CloudFront (Lambda@Edge)
			return {
				status: status.toString(),
				statusDescription: 'OK',
				headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [{ key: k, value: v }]])),
				body: JSON.stringify(body),
			};
		} else {
			throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Creates a new response object.
	 * @param {Object} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @returns {Response} - The constructed response.
	 */
	createResponse(body, status = 200, headers = { 'Content-Type': 'application/json' }) {
		// Check if the environment is Cloudflare Workers, Fastly, Akamai, or AWS
		// Assume Cloudflare or Fastly Workers
		if (typeof Response !== 'undefined') {
			return new Response(JSON.stringify(body), {
				status: status,
				headers: headers,
			});
		} else if (typeof EdgeKV !== 'undefined') {
			// Assume Akamai EdgeWorkers
			return new Response(JSON.stringify(body), {
				status: status,
				headers: headers,
			});
		} else if (typeof AWS !== 'undefined') {
			// Assume AWS CloudFront (Lambda@Edge)
			return {
				status: status.toString(),
				statusDescription: 'OK',
				headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [{ key: k, value: v }]])),
				body: JSON.stringify(body),
			};
		} else {
			throw new Error('Unsupported CDN provider');
		}
	}
}

/**
 * Singleton class representing an abstraction helper.
 * @class
 * @private
 */
class AbstractionHelper {
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

	async readRequestBody(request) {
		const contentType = request.headers.get('content-type');

		try {
			if (contentType) {
				if (contentType.includes('application/json')) {
					return await request.json();
				} else if (contentType.includes('application/text') || contentType.includes('text/html')) {
					return await request.text();
				} else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
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
			console.error('Error reading request body:', error.message);
			return undefined;
		}
	}

	static async readRequestBody(request) {
		const contentType = request.headers.get('content-type');

		try {
			if (contentType) {
				if (contentType.includes('application/json')) {
					return await request.json();
				} else if (contentType.includes('application/text') || contentType.includes('text/html')) {
					return await request.text();
				} else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
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
			console.error('Error reading request body:', error.message);
			return undefined;
		}
	}
	/**
	 * Clones a request object asynchronously.
	 * @static
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	static cloneRequest(request) {
		try {
			// For most CDNs, the Fetch API's clone method should work.
			const clonedRequest = request.clone();
			return clonedRequest;
		} catch (error) {
			console.error('Error cloning request:', error);
			throw error;
		}
	}

	/**
	 * Clones a request object asynchronously.
	 * @param {Request} request - The original request object to be cloned.
	 * @returns {Promise<Request>} - A promise that resolves to the cloned request object.
	 * @throws {Error} - If an error occurs during the cloning process.
	 */
	cloneRequest(request) {
		try {
			// For most CDNs, the Fetch API's clone method should work.
			const clonedRequest = request.clone();
			return clonedRequest;
		} catch (error) {
			console.error('Error cloning request:', error);
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
 * Retrieves the singleton instance of AbstractionHelper.
 * If the instance doesn't exist, a new one is created.
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
