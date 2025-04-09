import { IStorageAdapter, StorageListOptions, StorageListResult, StoragePutOptions } from "../../interfaces/IStorageAdapter";

// Define an interface for Vercel's KV-like storage solution
// This will need to be adjusted based on Vercel's actual API
export interface VercelKVNamespace {
  get(key: string, options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<any>;
}

/**
 * Vercel-specific implementation of IStorageAdapter.
 * Adapts Vercel's Edge KV Storage to the common interface.
 */
export class VercelStorageAdapter implements IStorageAdapter {
  private kv: VercelKVNamespace;

  /**
   * Creates an instance of the adapter.
   * @param kv - The Vercel KV namespace or equivalent storage mechanism.
   */
  constructor(kv: VercelKVNamespace) {
    if (!kv) {
      throw new Error("Vercel KV namespace cannot be null or undefined.");
    }
    this.kv = kv;
  }

  async get(key: string, type: 'text'): Promise<string | null>;
  async get<T>(key: string, type: 'json'): Promise<T | null>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any> {
    try {
      // Call Vercel's KV get method with appropriate type
      return await this.kv.get(key, { type });
    } catch (error) {
      console.error(`Error fetching key ${key} from Vercel KV:`, error);
      return null;
    }
  }

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
    try {
      // Convert our interface options to Vercel-specific options if needed
      const vercelOptions = options ? {
        // Map StoragePutOptions properties to Vercel's expected format
        expirationTtl: options.expirationTtl,
        metadata: options.metadata
      } : undefined;

      await this.kv.put(key, value, vercelOptions);
    } catch (error) {
      console.error(`Error storing key ${key} in Vercel KV:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`Error deleting key ${key} from Vercel KV:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async list?(options?: StorageListOptions): Promise<StorageListResult> {
    if (!this.kv.list) {
      throw new Error("List operation not supported by the Vercel KV implementation.");
    }

    try {
      // Convert our interface options to Vercel-specific options
      const vercelOptions = options ? {
        prefix: options.prefix,
        limit: options.limit,
        cursor: options.cursor
      } : undefined;

      const result = await this.kv.list(vercelOptions);

      // Convert Vercel's result format to our standardized format
      // This will need adjustment based on actual Vercel API response
      return {
        keys: result.keys.map((key: any) => ({
          name: key.name,
          expiration: key.expiration,
          metadata: key.metadata
        })),
        list_complete: result.list_complete || false,
        cursor: result.cursor
      };
    } catch (error) {
      console.error('Error listing keys from Vercel KV:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }
} 