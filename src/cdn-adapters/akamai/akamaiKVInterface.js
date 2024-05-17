// akamaiKVInterface.js

/**
 * Class representing the Akamai EdgeWorkers KV store interface.
 * @class
 */
class AkamaiKVInterface {
    /**
     * @param {Object} edgeKV - The EdgeKV object provided by Akamai EdgeWorkers.
     * @param {string} kvNamespace - The name of the KV namespace.
     */
    constructor(edgeKV, kvNamespace) {
      this.namespace = edgeKV.getNamespace(kvNamespace);
    }
  
    /**
     * Get a value by key from the Akamai EdgeWorkers KV store.
     * @param {string} key - The key to retrieve.
     * @returns {Promise<string|null>} - The value associated with the key.
     */
    async get(key) {
      try {
        const value = await this.namespace.get(key, { decode: false });
        return value !== null ? value.toString() : null;
      } catch (error) {
        console.error(`Error getting value for key ${key}:`, error);
        return null;
      }
    }
  
    /**
     * Put a value into the Akamai EdgeWorkers KV store.
     * @param {string} key - The key to store.
     * @param {string} value - The value to store.
     * @returns {Promise<void>}
     */
    async put(key, value) {
      try {
        await this.namespace.put(key, value);
      } catch (error) {
        console.error(`Error putting value for key ${key}:`, error);
      }
    }
  
    /**
     * Delete a key from the Akamai EdgeWorkers KV store.
     * @param {string} key - The key to delete.
     * @returns {Promise<void>}
     */
    async delete(key) {
      try {
        await this.namespace.delete(key);
      } catch (error) {
        console.error(`Error deleting key ${key}:`, error);
      }
    }
  }
  
  export default AkamaiKVInterface;