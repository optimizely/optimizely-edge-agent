/**
 * @module AbstractContext
 */

import defaultSettings from '../config/defaultSettings';
import { logger } from '../optimizelyHelper';

/**
 *
 * The AbstractContext class is an abstract class that provides a unified interface for interacting with the context object.
 * It is used to abstract the specifics of how the context is implemented.
 *
 * The following methods are implemented:
 * - waitUntil(promise) - Waits for a promise to resolve or reject.
 */

/**
 * Abstract class for the context object.
 * @class
 */
export class AbstractContext {
	/**
	 * Constructor for AbstractContext.
	 * @param {Object} ctx - The context object.
	 * @constructor
	 * @private
	 */
	constructor(ctx) {
		logger().debugExt('AbstractContext - Creating new context [constructor]');
		this.ctx = ctx || {};
		this.cdnProvider = defaultSettings.cdnProvider.toLowerCase();
	}

	/**
	 * Waits for a promise to resolve or reject.
	 * @param {Promise} promise - The promise to wait for.
	 * @returns {Promise} The original promise or a custom handling promise.
	 */
	waitUntil(promise) {
		logger().debugExt('AbstractContext - Waiting for promise [waitUntil]', `CDN provider: ${this.cdnProvider}`);

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
		return promise.catch(logger().error);
	}
}
