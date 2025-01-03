import { IKVStore } from '../../../types/cdn';
import { Logger } from '../../../utils/logging/Logger';

/**
 * Interface for Fastly's KV namespace
 */
interface FastlyKVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Interface for environment object containing KV namespace bindings
 */
interface FastlyEnv {
	[key: string]: FastlyKVNamespace;
}

/**
 * FastlyKVStore provides a concrete implementation for interacting with Fastly's KV store.
 * It implements the IKVStore interface to ensure consistent KV store operations across different platforms.
 */
export class FastlyKVStore implements IKVStore {
	private readonly NOT_IMPLEMENTED = 'FastlyKVStore is not implemented yet';
	private logger?: Logger;

	constructor(env: FastlyEnv, kvNamespace: string, logger?: Logger) {
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
