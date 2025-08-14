import { IStorageAdapter, StorageListOptions, StorageListResult, StoragePutOptions } from "../../interfaces/IStorageAdapter";

// Type definition for Vercel KV client (import from @vercel/kv)
// For now, we'll define the interface. In production, this would be imported from @vercel/kv
export interface VercelKVClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number; px?: number; nx?: boolean; xx?: boolean }): Promise<string | null>;
  del(key: string): Promise<number>;
  scan(cursor: number, options?: { match?: string; count?: number }): Promise<[number, string[]]>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern?: string): Promise<string[]>;
}

/**
 * Legacy interface for backward compatibility
 * This is what the factory expects but we'll adapt it internally
 */
export interface VercelKVNamespace {
  get(key: string, options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<any>;
}

/**
 * Vercel-specific implementation of IStorageAdapter using real Vercel KV.
 * This adapter integrates with @vercel/kv for production use.
 */
export class VercelStorageAdapter implements IStorageAdapter {
  private kv: VercelKVClient | null;
  private memoryStore: Map<string, { value: string; expiry?: number }>;

  /**
   * Creates an instance of the adapter.
   * @param kv - The Vercel KV client instance from @vercel/kv, or null for memory storage.
   */
  constructor(kv: VercelKVClient | VercelKVNamespace | null) {
    this.memoryStore = new Map();
    
    if (!kv) {
      // Use in-memory storage for development/testing
      this.kv = null;
      return;
    }
    
    // If it's the old interface, adapt it
    if ('put' in kv) {
      this.kv = this.adaptLegacyInterface(kv);
    } else {
      this.kv = kv as VercelKVClient;
    }
  }

  /**
   * Adapts the legacy VercelKVNamespace interface to VercelKVClient
   */
  private adaptLegacyInterface(legacy: VercelKVNamespace): VercelKVClient {
    return {
      get: async (key: string) => {
        const result = await legacy.get(key, { type: 'text' });
        return result;
      },
      set: async (key: string, value: string, options?: any) => {
        await legacy.put(key, value, options);
        return 'OK';
      },
      del: async (key: string) => {
        await legacy.delete(key);
        return 1;
      },
      scan: async (cursor: number, options?: any) => {
        // Legacy interface doesn't support scan, return empty
        return [0, []] as [number, string[]];
      },
      exists: async (key: string) => {
        const value = await legacy.get(key);
        return value !== null ? 1 : 0;
      },
      expire: async (key: string, seconds: number) => {
        // Legacy interface doesn't support expire directly
        return 1;
      },
      ttl: async (key: string) => {
        // Legacy interface doesn't support ttl
        return -1;
      },
      keys: async (pattern?: string) => {
        if (legacy.list) {
          const result = await legacy.list({ prefix: pattern });
          return result.keys?.map((k: any) => k.name || k) || [];
        }
        return [];
      }
    };
  }

  async get(key: string, type: 'text'): Promise<string | null>;
  async get<T>(key: string, type: 'json'): Promise<T | null>;
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any> {
    try {
      let result: string | null;
      
      if (this.kv === null) {
        // Use memory store
        const stored = this.memoryStore.get(key);
        if (!stored) {
          return null;
        }
        
        // Check expiry
        if (stored.expiry && Date.now() > stored.expiry) {
          this.memoryStore.delete(key);
          return null;
        }
        
        result = stored.value;
      } else {
        // Use Vercel KV
        result = await this.kv.get(key);
      }
      
      if (result === null) {
        return null;
      }

      switch (type) {
        case 'text':
          return result;
        
        case 'json':
          try {
            return JSON.parse(result);
          } catch (e) {
            console.error(`Error parsing JSON for key ${key}:`, e);
            return null;
          }
        
        case 'arrayBuffer':
          // Convert string to ArrayBuffer
          const encoder = new TextEncoder();
          return encoder.encode(result).buffer;
        
        case 'stream':
          // Convert string to ReadableStream
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(result));
              controller.close();
            }
          });
          return stream;
        
        default:
          return result;
      }
    } catch (error) {
      console.error(`Error fetching key ${key} from Vercel KV:`, error);
      return null;
    }
  }

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
    try {
      let stringValue: string;

      // Convert value to string if necessary
      if (typeof value === 'string') {
        stringValue = value;
      } else if (value instanceof ArrayBuffer) {
        stringValue = new TextDecoder().decode(value);
      } else if (value instanceof ReadableStream) {
        // Read the stream to string
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        stringValue = new TextDecoder().decode(combined);
      } else {
        // For objects, stringify them
        stringValue = JSON.stringify(value);
      }

      if (this.kv === null) {
        // Use memory store
        const expiry = options?.expirationTtl 
          ? Date.now() + (options.expirationTtl * 1000)
          : undefined;
        
        this.memoryStore.set(key, { value: stringValue, expiry });
      } else {
        // Use Vercel KV
        const kvOptions: any = {};
        
        if (options?.expirationTtl) {
          kvOptions.ex = options.expirationTtl; // Expiration in seconds
        }

        await this.kv.set(key, stringValue, kvOptions);
      }
    } catch (error) {
      console.error(`Error storing key ${key} in Vercel KV:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.kv === null) {
        this.memoryStore.delete(key);
      } else {
        await this.kv.del(key);
      }
    } catch (error) {
      console.error(`Error deleting key ${key} from Vercel KV:`, error);
      throw error;
    }
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    try {
      // Vercel KV uses Redis SCAN command for listing
      let cursor = 0;
      const limit = options?.limit || 1000;
      const prefix = options?.prefix;
      
      if (options?.cursor) {
        cursor = parseInt(options.cursor, 10) || 0;
      }

      const scanOptions: any = {
        count: limit
      };
      
      if (prefix) {
        scanOptions.match = `${prefix}*`;
      }

      let nextCursor: number;
      let keys: string[];
      
      if (this.kv === null) {
        // Use memory store
        const allKeys = Array.from(this.memoryStore.keys());
        const filteredKeys = prefix ? allKeys.filter(key => key.startsWith(prefix)) : allKeys;
        const startIndex = cursor;
        const endIndex = Math.min(startIndex + limit, filteredKeys.length);
        
        keys = filteredKeys.slice(startIndex, endIndex);
        nextCursor = endIndex < filteredKeys.length ? endIndex : 0;
      } else {
        [nextCursor, keys] = await this.kv.scan(cursor, scanOptions);
      }
      
      // Convert keys to the expected format
      const formattedKeys = keys.map(key => ({
        name: key,
        expiration: undefined, // Vercel KV doesn't return expiration in scan
        metadata: undefined
      }));

      return {
        keys: formattedKeys,
        list_complete: nextCursor === 0,
        cursor: nextCursor.toString()
      };
    } catch (error) {
      console.error('Error listing keys from Vercel KV:', error);
      throw error;
    }
  }

  /**
   * Get TTL for a key (Vercel KV specific feature)
   */
  async getTTL(key: string): Promise<number> {
    try {
      if (this.kv === null) {
        const stored = this.memoryStore.get(key);
        if (!stored || !stored.expiry) {
          return -1;
        }
        const remaining = Math.max(0, stored.expiry - Date.now());
        return Math.floor(remaining / 1000);
      } else {
        return await this.kv.ttl(key);
      }
    } catch (error) {
      console.error(`Error getting TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Check if a key exists (Vercel KV specific feature)
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.kv === null) {
        const stored = this.memoryStore.get(key);
        if (!stored) {
          return false;
        }
        // Check if expired
        if (stored.expiry && Date.now() > stored.expiry) {
          this.memoryStore.delete(key);
          return false;
        }
        return true;
      } else {
        const result = await this.kv.exists(key);
        return result === 1;
      }
    } catch (error) {
      console.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for a key (Vercel KV specific feature)
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (this.kv === null) {
        const stored = this.memoryStore.get(key);
        if (!stored) {
          return false;
        }
        stored.expiry = Date.now() + (seconds * 1000);
        return true;
      } else {
        const result = await this.kv.expire(key, seconds);
        return result === 1;
      }
    } catch (error) {
      console.error(`Error setting expiration for key ${key}:`, error);
      return false;
    }
  }
}

/**
 * Factory function to create a VercelStorageAdapter with real Vercel KV client
 * This would be used in production with the actual @vercel/kv package
 */
export function createVercelKVAdapter(): VercelStorageAdapter {
  // Try to use real Vercel KV if available
  try {
    // Check if we have KV environment variables
    const kvUrl = process.env.KV_URL || process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    
    if (kvUrl && kvToken) {
      // Try to import real Vercel KV
      try {
        const { kv } = require('@vercel/kv');
        console.log('[VercelKV] Using real Vercel KV storage');
        return new VercelStorageAdapter(kv);
      } catch (importError) {
        console.warn('[VercelKV] @vercel/kv package not available, falling back to mock');
      }
    } else {
      console.log('[VercelKV] No KV credentials found, using mock for development');
    }
  } catch (error) {
    console.warn('[VercelKV] Error setting up real KV, falling back to mock:', error);
  }
  
  // Fallback to mock implementation that logs
  const mockKV: VercelKVClient = {
    get: async (key: string) => {
      console.log(`[MockKV] GET ${key}`);
      return null;
    },
    set: async (key: string, value: string, options?: any) => {
      console.log(`[MockKV] SET ${key} = ${value.substring(0, 100)}...`, options);
      return 'OK';
    },
    del: async (key: string) => {
      console.log(`[MockKV] DEL ${key}`);
      return 1;
    },
    scan: async (cursor: number, options?: any) => {
      console.log(`[MockKV] SCAN ${cursor}`, options);
      return [0, []];
    },
    exists: async (key: string) => {
      console.log(`[MockKV] EXISTS ${key}`);
      return 0;
    },
    expire: async (key: string, seconds: number) => {
      console.log(`[MockKV] EXPIRE ${key} ${seconds}`);
      return 1;
    },
    ttl: async (key: string) => {
      console.log(`[MockKV] TTL ${key}`);
      return -1;
    },
    keys: async (pattern?: string) => {
      console.log(`[MockKV] KEYS ${pattern || '*'}`);
      return [];
    }
  };
  
  return new VercelStorageAdapter(mockKV);
}