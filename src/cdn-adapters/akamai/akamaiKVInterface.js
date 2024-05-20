// akamaiKVInterface.js

/**
 * The AkamaiKVInterface module is responsible for interacting with the Akamai EdgeWorkers KV store.
 * 
 * The following methods are implemented:
 * - get(key) - Retrieves a value by key from the Akamai EdgeWorkers KV store.
 * - put(key, value) - Puts a value into the Akamai EdgeWorkers KV store.
 * - delete(key) - Deletes a key from the Akamai EdgeWorkers KV store.
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
        logger().error(`Error getting value for key ${key}:`, error);
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
        logger().error(`Error putting value for key ${key}:`, error);
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
        logger().error(`Error deleting key ${key}:`, error);
      }
    }
  }
  
  export default AkamaiKVInterface;