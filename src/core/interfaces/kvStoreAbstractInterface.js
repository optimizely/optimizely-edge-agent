/**
 * @module KVStoreAbstractInterface
 *
 * The KVStoreAbstractInterface is an abstract class that provides a unified interface for interacting with a key-value store.
 * It is used to abstract the specifics of how the KV store is implemented.
 *
 * The following methods are implemented:
 * - get(key) - Retrieves a value by key from the KV store.
 * - put(key, value) - Puts a value into the KV store.
 * - delete(key) - Deletes a key from the KV store.
 */

import { logger } from '../optimizelyHelper';

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
		logger().debugExt('Inside abstract KV store constructor [KVStoreAbstractInterface]');
		this.provider = provider;
	}

	/**
	 * Get a value by key from the KV store.
	 * @param {string} key - The key to retrieve.
	 * @returns {Promise<string|null>} - The value associated with the key.
	 */
	async get(key) {
		logger().debugExt('KVStoreAbstractInterface - Getting value from KV store [get]', `Key: ${key}`);
		return this.provider.get(key);
	}

	/**
	 * Put a value into the KV store.
	 * @param {string} key - The key to store.
	 * @param {string} value - The value to store.
	 * @returns {Promise<void>}
	 */
	async put(key, value) {
		logger().debugExt('KVStoreAbstractInterface - Putting value into KV store [put]', `Key: ${key}, Value: ${value}`);
		return this.provider.put(key, value);
	}

	/**
	 * Delete a key from the KV store.
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		logger().debugExt('KVStoreAbstractInterface - Deleting key from KV store [delete]', `Key: ${key}`);
		return this.provider.delete(key);
	}
}
