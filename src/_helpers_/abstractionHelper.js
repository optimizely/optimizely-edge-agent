/**
 * @module AbstractionHelper
 *
 * The AbstractionHelper class provides a collection of helper functions for working with CDN implementations.
 * It is designed to be used as a base for building more specific implementations of the OptimizelyProvider class.
 */

import { logger } from '../_helpers_/optimizelyHelper.js';
import EventListeners from '../_event_listeners_/eventListeners';
import defaultSettings from '../_config_/defaultSettings';
import { AbstractContext } from './abstraction-classes/abstractContext';
import { AbstractRequest } from './abstraction-classes/abstractRequest';
import { AbstractResponse } from './abstraction-classes/abstractResponse';
import { KVStoreAbstractInterface } from './abstraction-classes/kvStoreAbstractInterface';

/**
 * Class representing an abstraction helper.
 * @class
 * @private
 * It implements the following methods:
 * - constructor(request, ctx, env) - Initializes the AbstractionHelper instance with the request, context, and environment objects.
 * - getNewHeaders(existingHeaders) - Returns new headers based on the provided headers and the CDN provider.
 * - createResponse(body, status, headers) - Creates a new response object.
 * - getHeaderValue(response, headerName) - Retrieves the value of a specific header from the response based on the CDN provider.
 * - getResponseContent(response) - Retrieves the response content as stringified JSON or text based on the CDN provider.
 * - getEnvVariableValue(name, environmentVariables) - Retrieves the value of an environment variable.
 * - initializeKVStore(cdnProvider, kvInterfaceAdapter) - Initializes the KV store based on the CDN provider.
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
		logger().debug('Inside AbstractionHelper constructor [constructor]');

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
		logger().debugExt('AbstractionHelper - Getting new headers [getNewHeaders]', 'Existing headers:', existingHeaders);

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
		logger().debug('AbstractionHelper - Creating response [createResponse]');
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
		logger().debugExt('AbstractionHelper - Getting header value [getHeaderValue]', 'Header name:', headerName);
		
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
			logger().error('Error retrieving header value:', error);
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
		logger().debugExt('AbstractionHelper - Getting response content [getResponseContent]');

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
			logger().error('Error retrieving response content:', error);
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
		logger().debugExt('AbstractionHelper - Getting environment variable value [getEnvVariableValue]', 'Name:', name);
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
export function getAbstractionHelper(request, env, ctx) {
	logger().debug('AbstractionHelper - Getting abstraction helper [getAbstractionHelper]');
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
