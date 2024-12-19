/**
 * @module VercelKVInterface
 *
 * The VercelKVInterface module is responsible for interacting with the Vercel Edge Functions KV store.
 *
 * The following methods are implemented:
 * - get(key) - Retrieves a value by key from the Vercel Edge Functions KV store.
 * - put(key, value) - Puts a value into the Vercel Edge Functions KV store.
 * - delete(key) - Deletes a key from the Vercel Edge Functions KV store.
 */

import { logger } from '../../_helpers_/optimizelyHelper.js';
import { kv } from '@vercel/kv';

/**
 * Class representing the Vercel Edge Functions KV store interface.
 * @class
 */
class VercelKVInterface {
	/**
	 * @param {Object} env - The environment object containing KV namespace bindings.
	 * @param {string} kvNamespace - The name of the KV namespace.
	 */
	constructor(env, kvNamespace) {
		if (!env[kvNamespace]) {
			throw new Error(`KV namespace ${kvNamespace} is not available in env.`);
		}
		this.kvNamespace = env[kvNamespace];
	}

	/**
	 * Get a value by key from the Vercel Edge Functions KV store.
	 * @param {string} key - The key to retrieve.
	 * @returns {Promise<string|null>} - The value associated with the key.
	 */
	async get(key) {
		try {
			const value = await kv.get(`${this.kvNamespace}:${key}`);
			return value !== null ? value.toString() : null;
		} catch (error) {
			logger().error(`Error getting value for key ${key}:`, error);
			return null;
		}
	}

	/**
	 * Put a value into the Vercel Edge Functions KV store.
	 * @param {string} key - The key to store.
	 * @param {string} value - The value to store.
	 * @returns {Promise<void>}
	 */
	async put(key, value) {
		try {
			await kv.set(`${this.kvNamespace}:${key}`, value);
		} catch (error) {
			logger().error(`Error putting value for key ${key}:`, error);
		}
	}

	/**
	 * Delete a key from the Vercel Edge Functions KV store.
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		try {
			await kv.del(`${this.kvNamespace}:${key}`);
		} catch (error) {
			logger().error(`Error deleting namespace:key ${this.kvNamespace}:${key}:`, error);
		}
	}
}

export default VercelKVInterface;
