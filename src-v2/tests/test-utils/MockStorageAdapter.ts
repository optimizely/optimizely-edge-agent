import { IStorageAdapter, StoragePutOptions, StorageListOptions, StorageListResult } from '../../adapters/interfaces/IStorageAdapter';

/**
 * Mock implementation of the IStorageAdapter for testing
 */
export class MockStorageAdapter implements IStorageAdapter {
  public storage: Map<string, any> = new Map();

  async get<T>(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<T | null> {
    const value = this.storage.get(key);
    if (value === undefined) return null;

    if (type === 'json' && typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch (e) {
        return value as unknown as T;
      }
    }

    return value as T;
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    this.storage.set(key, value);
    return true;
  }

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
    // Store the value
    this.storage.set(key, value);
    
    // If there's a mock implementation for TTL or metadata handling,
    // it could be added here
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list?(options?: StorageListOptions): Promise<StorageListResult> {
    const prefix = options?.prefix || '';
    const limit = options?.limit || 1000;
    
    const keys = Array.from(this.storage.keys())
      .filter(key => key.startsWith(prefix))
      .slice(0, limit)
      .map(name => ({ name }));
      
    return {
      keys,
      list_complete: keys.length < limit
    };
  }
} 