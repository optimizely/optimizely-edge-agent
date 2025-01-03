import { IKVStore } from '../../../types/cdn';
import { Logger } from '../../../utils/logging/Logger';

/**
 * Interface for Akamai's KV namespace
 */
interface AkamaiKVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Interface for environment object containing KV namespace bindings
 */
interface AkamaiEnv {
	[key: string]: AkamaiKVNamespace;
}

/**
 * AkamaiKVStore provides a concrete implementation for interacting with Akamai's KV store.
 * It implements the IKVStore interface to ensure consistent KV store operations across different platforms.
 */
export class AkamaiKVStore implements IKVStore {
	private readonly NOT_IMPLEMENTED = 'AkamaiKVStore is not implemented yet';
	private logger?: Logger;

	constructor(env: AkamaiEnv, kvNamespace: string, logger?: Logger) {
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
