import { KVStore } from '../../../types/cdn';
import { Logger } from '../../../utils/logging/Logger';

/**
 * Interface for Cloudflare's KV namespace
 */
interface CloudflareKVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Interface for environment object containing KV namespace bindings
 */
interface CloudflareEnv {
	[key: string]: CloudflareKVNamespace;
}

/**
 * CloudflareKVStore provides a concrete implementation for interacting with Cloudflare's KV store.
 * It implements the KVStore interface to ensure consistent KV store operations across different platforms.
 */
export class CloudflareKVStore implements KVStore {
	private namespace: CloudflareKVNamespace;
	private logger?: Logger;

	/**
	 * Creates an instance of CloudflareKVStore.
	 * @param env - The environment object containing KV namespace bindings
	 * @param kvNamespace - The name of the KV namespace
	 * @param logger - Optional logger instance
	 */
	constructor(env: CloudflareEnv, kvNamespace: string, logger?: Logger) {
		this.namespace = env[kvNamespace];
		this.logger = logger;

		if (!this.namespace) {
			const error = `KV namespace '${kvNamespace}' not found in environment`;
			this.logger?.error(error);
			throw new Error(error);
		}
	}

	/**
	 * Get a value by key from the Cloudflare KV store.
	 * @param key - The key to retrieve
	 * @returns The value associated with the key, or null if not found
	 */
	async get(key: string): Promise<string | null> {
		try {
			return await this.namespace.get(key);
		} catch (error) {
			this.logger?.error('Error getting value from KV store:', error);
			throw error;
		}
	}

	/**
	 * Put a value into the Cloudflare KV store.
	 * @param key - The key to store
	 * @param value - The value to store
	 */
	async put(key: string, value: string): Promise<void> {
		try {
			await this.namespace.put(key, value);
		} catch (error) {
			this.logger?.error('Error putting value into KV store:', error);
			throw error;
		}
	}

	/**
	 * Delete a key from the Cloudflare KV store.
	 * @param key - The key to delete
	 */
	async delete(key: string): Promise<void> {
		try {
			await this.namespace.delete(key);
		} catch (error) {
			this.logger?.error('Error deleting key from KV store:', error);
			throw error;
		}
	}
}
