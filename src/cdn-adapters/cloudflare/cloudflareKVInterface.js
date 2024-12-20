/**
 * @module CloudflareKVInterface
 *
 * The CloudflareKVInterface is a class that provides a unified interface for interacting with the Cloudflare KV store.
 * It is used to abstract the specifics of how the KV store is implemented.
 *
 * The following methods are implemented:
 * - get(key) - Retrieves a value by key from the KV store.
 * - put(key, value) - Puts a value into the KV store.
 * - delete(key) - Deletes a key from the KV store.
 */

/**
 * Class representing the Cloudflare KV store interface.
 * @class
 */
class CloudflareKVInterface {
	/**
	 * @param {Object} env - The environment object containing KV namespace bindings.
	 * @param {string} kvNamespace - The name of the KV namespace.
	 * @throws {Error} If env is not provided or if kvNamespace is not found in env
	 */
	constructor(env, kvNamespace) {
		if (!env) {
			throw new Error('Environment object must be provided');
		}
		if (!kvNamespace) {
			throw new Error('KV namespace name must be provided');
		}
		if (!env[kvNamespace]) {
			throw new Error(`KV namespace '${kvNamespace}' not found in environment`);
		}
		this.namespace = env[kvNamespace];
	}
	/**
	 * Get a value by key from the Cloudflare KV store.
	 * @param {string} key - The key to retrieve.
	 * @returns {Promise<string|null>} - The value associated with the key.
	 */
	async get(key) {
		return await this.namespace.get(key);
	}

	/**
	 * Put a value into the Cloudflare KV store.
	 * @param {string} key - The key to store.
	 * @param {string} value - The value to store.
	 * @returns {Promise<void>}
	 */
	async put(key, value) {
		return await this.namespace.put(key, value);
	}

	/**
	 * Delete a key from the Cloudflare KV store.
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		return await this.namespace.delete(key);
	}
}

export default CloudflareKVInterface;
