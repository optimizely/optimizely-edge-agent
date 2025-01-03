import { KVStore } from '../../../types/cdn';
import { Logger } from '../../../utils/logging/Logger';

/**
 * Interface for Vercel's KV namespace
 */
interface VercelKVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Interface for environment object containing KV namespace bindings
 */
interface VercelEnv {
	[key: string]: VercelKVNamespace;
}

/**
 * VercelKVStore provides a concrete implementation for interacting with Vercel's KV store.
 * It implements the KVStore interface to ensure consistent KV store operations across different platforms.
 */
export class VercelKVStore implements KVStore {
	private readonly NOT_IMPLEMENTED = 'VercelKVStore is not implemented yet';
	private logger?: Logger;

	constructor(env: VercelEnv, kvNamespace: string, logger?: Logger) {
		this.logger = logger;
		throw new Error(this.NOT_IMPLEMENTED);
	}

	async get(key: string): Promise<string | null> {
		throw new Error(this.NOT_IMPLEMENTED);
	}

	async put(key: string, value: string): Promise<void> {
		throw new Error(this.NOT_IMPLEMENTED);
	}

	async delete(key: string): Promise<void> {
		throw new Error(this.NOT_IMPLEMENTED);
	}
}
