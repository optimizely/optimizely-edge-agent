// abstractionHelper.js
// import Logger from './logger';
import EventListeners from '../_event_listeners_/eventListeners';
import defaultSettings from '../_config_/defaultSettings';
//
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
	 * Get a header from the request.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeader(name) {
		return this.headers.get(name);
	}

	/**
	 * Get the value of a query parameter from the request URL.
	 * @param {string} name - The name of the query parameter.
	 * @returns {string|null} - The value of the query parameter, or null if not found.
	 */
	getParameterByName(name) {
		return this.searchParams[name] || null;
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

	/**
	 * Asynchronously reads and parses the body of a request based on its content type.
	 *
	 * @param {Request} request - The request object whose body needs to be read.
	 * @returns {Promise<any>} A promise resolving to the parsed body content.
	 */
	async readRequestBody(request) {
		// Get the content type of the request
		const contentType = request.headers.get('content-type');

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
				// For unknown content types, return 'a file'
				else {
					return 'Uknown content type';
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

	/**
	 * Asynchronously reads and parses the body of a request based on its content type. (Static version)
	 *
	 * @static
	 * @param {Request} request - The request object whose body needs to be read.
	 * @returns {Promise<any>} A promise resolving to the parsed body content.
	 */
	static async readRequestBody(request) {
		// Get the content type of the request
		const contentType = request.headers.get('content-type');

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
				// For unknown content types, return 'a file'
				else {
					return 'Uknown content type';
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
	/**
	 * Retrieves the value of a specific header from the response based on the CDN provider.
	 * @param {Object} response - The response object from the CDN provider.
	 * @param {string} headerName - The name of the header to retrieve.
	 * @returns {string|null} - The value of the header, or null if the header is not found.
	 * @throws {Error} - If an unsupported CDN provider is provided or if the response object is invalid.
	 */
	getHeaderValue(response, headerName) {
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
