import { IStorageAdapter } from '../../adapters/interfaces/IStorageAdapter';

/**
 * Mock implementation of the IStorageAdapter for testing
 */
export class MockStorageAdapter implements IStorageAdapter {
  private storage: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key) || null;
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    this.storage.set(key, value);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
} 