/**
 * @interface IStorageAdapter
 * @description Defines the contract for interacting with a key-value storage mechanism,
 * abstracting environment-specific implementations (e.g., Cloudflare KV, Redis).
 */
export interface IStorageAdapter {
  /**
   * Retrieves a value from storage.
   * @param key - The key of the item to retrieve.
   * @param type - The expected type ('text', 'json', 'arrayBuffer', 'stream').
   * @returns A promise resolving to the value or null if not found.
   */
  get(key: string, type: 'text'): Promise<string | null>;
  get<T>(key: string, type: 'json'): Promise<T | null>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  get(key: string, type: 'stream'): Promise<ReadableStream | null>;

  /**
   * Stores a value.
   * @param key - The key to store the value under.
   * @param value - The value to store (string, ArrayBuffer, ReadableStream).
   * @param options - Optional metadata or expiration settings.
   * @returns A promise resolving when the operation is complete.
   */
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void>;

  /**
   * Deletes a key-value pair.
   * @param key - The key to delete.
   * @returns A promise resolving when the operation is complete.
   */
  delete(key: string): Promise<void>;

  /**
   * Lists keys in the storage.
   * @param options - Optional listing parameters (prefix, limit, cursor).
   * @returns A promise resolving to the list results.
   */
  list?(options?: StorageListOptions): Promise<StorageListResult>;
}

/**
 * Options for the put operation.
 */
export interface StoragePutOptions {
  /** Time-to-live in seconds. */
  expirationTtl?: number;
  /** Arbitrary metadata. */
  metadata?: unknown;
}

/**
 * Options for the list operation.
 */
export interface StorageListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Result of a list operation.
 */
export interface StorageListResult {
  keys: { name: string; expiration?: number; metadata?: unknown }[];
  list_complete: boolean;
  cursor?: string;
} 