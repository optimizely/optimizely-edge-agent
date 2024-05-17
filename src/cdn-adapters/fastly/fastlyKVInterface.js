// fastlyKVInterface.js

/**
 * Class representing the Fastly EdgeWorkers KV store interface.
 * @class
 */
class FastlyKVInterface {
    /**
     * @param {Object} config - The configuration object containing KV store details.
     * @param {string} config.kvNamespace - The name of the KV namespace.
     */
    constructor(config) {
      this.kvNamespace = config.kvNamespace;
    }
  
    /**
     * Get a value by key from the Fastly EdgeWorkers KV store.
     * @param {string} key - The key to retrieve.
     * @returns {Promise<string|null>} - The value associated with the key.
     */
    async get(key) {
      try {
        const value = await fastly.getKVAsString(this.kvNamespace, key);
        return value !== null ? value : null;
      } catch (error) {
        console.error(`Error getting value for key ${key}:`, error);
        return null;
      }
    }
  
    /**
     * Put a value into the Fastly EdgeWorkers KV store.
     * @param {string} key - The key to store.
     * @param {string} value - The value to store.
     * @returns {Promise<void>}
     */
    async put(key, value) {
      try {
        await fastly.writeKV(this.kvNamespace, key, value);
      } catch (error) {
        console.error(`Error putting value for key ${key}:`, error);
      }
    }
  
    /**
     * Delete a key from the Fastly EdgeWorkers KV store.
     * @param {string} key - The key to delete.
     * @returns {Promise<void>}
     */
    async delete(key) {
      try {
        await fastly.deleteKV(this.kvNamespace, key);
      } catch (error) {
        console.error(`Error deleting key ${key}:`, error);
      }
    }
  }
  
  export default FastlyKVInterface;