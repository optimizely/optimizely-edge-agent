/**
 * Type for key-value store operations
 */
type KVStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export type { KVStore };
