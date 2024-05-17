// vercelKVInterface.js

/**
 * Class representing the Vercel Edge Functions KV store interface.
 * @class
 */
class VercelKVInterface {
	/**
	 * @param {Object} config - The configuration object containing KV store details.
	 * @param {string} config.kvNamespace - The name of the KV namespace.
	 */
	constructor(config) {
		this.kvNamespace = config.kvNamespace;
	}

	/**
	 * Get a value by key from the Vercel Edge Functions KV store.
	 * @param {string} key - The key to retrieve.
	 * @returns {Promise<string|null>} - The value associated with the key.
	 */
	async get(key) {
		try {
			const value = await EDGE_KV.get(`${this.kvNamespace}:${key}`);
			return value !== null ? value.toString() : null;
		} catch (error) {
			console.error(`Error getting value for key ${key}:`, error);
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
			await EDGE_KV.put(`${this.kvNamespace}:${key}`, value);
		} catch (error) {
			console.error(`Error putting value for key ${key}:`, error);
		}
	}

	/**
	 * Delete a key from the Vercel Edge Functions KV store.
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 */
	async delete(key) {
		try {
			await EDGE_KV.remove(`${this.kvNamespace}:${key}`);
		} catch (error) {
			console.error(`Error deleting key ${key}:`, error);
		}
	}
}

export default VercelKVInterface;
