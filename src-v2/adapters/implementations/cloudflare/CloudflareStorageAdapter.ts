import {
  IStorageAdapter,
  StorageListOptions,
  StorageListResult,
  StoragePutOptions
} from "../../interfaces/IStorageAdapter";

// Import Cloudflare Worker Types
import type * as CF from '@cloudflare/workers-types';

/**
 * Type alias to make it clear we're using Cloudflare's KV namespace
 */
type CloudflareKV = CF.KVNamespace;

/**
 * Cloudflare-specific implementation of IStorageAdapter.
 * Wraps a Cloudflare KV Namespace.
 */
export class CloudflareStorageAdapter implements IStorageAdapter {
  private kv: CloudflareKV;

  /**
   * Creates an instance of the adapter.
   * @param kvBinding - The KV Namespace binding obtained from the environment.
   */
  constructor(kvBinding: CloudflareKV) {
    if (!kvBinding) {
      throw new Error("Cloudflare KVNamespace binding cannot be null or undefined.");
    }
    this.kv = kvBinding;
  }

  // Implementation for the get method with overloads
  async get(key: string, type: 'text'): Promise<string | null>;
  async get<T>(key: string, type: 'json'): Promise<T | null>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any | null> {
    try {
      switch (type) {
        case 'text':
          return await this.kv.get(key, { type: 'text' });
        case 'json':
          return await this.kv.get(key, { type: 'json' });
        case 'arrayBuffer':
          return await this.kv.get(key, { type: 'arrayBuffer' });
        case 'stream':
          return await this.kv.get(key, { type: 'stream' });
        default:
          // Should not happen with defined types, but handles invalid type argument
          console.warn(`CloudflareStorageAdapter: Invalid type specified for get: ${type}`);
          return null;
      }
    } catch (error) {
      console.error(`CloudflareStorageAdapter: Error getting key ${key}:`, error);
      return null;
    }
  }

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
    try {
      const kvOptions: { expiration?: number; expirationTtl?: number; metadata?: any } = {};
      
      if (options?.expirationTtl) {
        kvOptions.expirationTtl = options.expirationTtl;
      }
      if (options?.metadata) {
        kvOptions.metadata = options.metadata;
      }
      
      // Type assertion to handle the slight difference in Cloudflare's expected types
      await this.kv.put(key, value as any, kvOptions);
    } catch (error) {
      console.error(`CloudflareStorageAdapter: Error putting key ${key}:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    const kvOptions: CF.KVNamespaceListOptions = {};
    if (options?.prefix) {
      kvOptions.prefix = options.prefix;
    }
    if (options?.limit) {
      kvOptions.limit = options.limit;
    }
    if (options?.cursor) {
      kvOptions.cursor = options.cursor;
    }

    const result = await this.kv.list(kvOptions);

    // Map the KVNamespaceListResult to StorageListResult
    return {
      keys: result.keys.map(k => ({ // Explicitly map each key object
        name: k.name,
        expiration: k.expiration,
        metadata: k.metadata,
      })),
      list_complete: result.list_complete,
      cursor: result.list_complete ? undefined : result.cursor,
    };
  }
} 