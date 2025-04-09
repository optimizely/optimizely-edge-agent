import { IStorageAdapter, StorageListOptions, StorageListResult, StoragePutOptions } from "../../interfaces/IStorageAdapter";

// Define an interface for Fastly's KV-like storage solution
// This will need to be adjusted based on Fastly's actual API
export interface FastlyKVStore {
  get(key: string, options?: { type?: string }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<any>;
}

/**
 * Fastly-specific implementation of IStorageAdapter.
 * Adapts Fastly's Key-Value storage to the common interface.
 */
export class FastlyStorageAdapter implements IStorageAdapter {
  private kvStore: FastlyKVStore;

  /**
   * Creates an instance of the adapter.
   * @param kvStore - The Fastly KV store or equivalent storage mechanism.
   */
  constructor(kvStore: FastlyKVStore) {
    if (!kvStore) {
      throw new Error("Fastly KV store cannot be null or undefined.");
    }
    this.kvStore = kvStore;
  }

  async get(key: string, type: 'text'): Promise<string | null>;
  async get<T>(key: string, type: 'json'): Promise<T | null>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any> {
    try {
      // Call Fastly's KV get method with the appropriate type
      // This implementation may need adjustment based on Fastly's specific API
      const result = await this.kvStore.get(key, { type });
      
      // Handle type conversion if needed
      if (type === 'json' && typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch (e) {
          console.error(`Error parsing JSON for key ${key}:`, e);
          return null;
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error fetching key ${key} from Fastly KV:`, error);
      return null;
    }
  }

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
    try {
      // Convert our interface options to Fastly-specific options if needed
      const fastlyOptions = options ? {
        // Map StoragePutOptions properties to Fastly's expected format
        expirationTtl: options.expirationTtl,
        metadata: options.metadata
      } : undefined;

      // For JSON objects, we might need to stringify them
      const processedValue = 
        typeof value === 'object' && !(value instanceof ArrayBuffer) && !(value instanceof ReadableStream) 
          ? JSON.stringify(value) 
          : value;

      await this.kvStore.put(key, processedValue, fastlyOptions);
    } catch (error) {
      console.error(`Error storing key ${key} in Fastly KV:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kvStore.delete(key);
    } catch (error) {
      console.error(`Error deleting key ${key} from Fastly KV:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async list?(options?: StorageListOptions): Promise<StorageListResult> {
    if (!this.kvStore.list) {
      throw new Error("List operation not supported by the Fastly KV implementation.");
    }

    try {
      // Convert our interface options to Fastly-specific options
      const fastlyOptions = options ? {
        prefix: options.prefix,
        limit: options.limit,
        cursor: options.cursor
      } : undefined;

      const result = await this.kvStore.list(fastlyOptions);

      // Convert Fastly's result format to our standardized format
      // This will need adjustment based on actual Fastly API response
      return {
        keys: Array.isArray(result.keys) 
          ? result.keys.map((key: any) => ({
              name: key.name || key.key || '',
              expiration: key.expiration,
              metadata: key.metadata
            }))
          : [],
        list_complete: result.list_complete || result.complete || false,
        cursor: result.cursor || result.next_cursor
      };
    } catch (error) {
      console.error('Error listing keys from Fastly KV:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }
} 