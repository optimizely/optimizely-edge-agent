export interface CacheSettings {
	enabled: boolean;
	ttl?: number;
	bypassCache?: boolean;
	cacheKey?: string;
	keyPrefix?: string;
}

export interface CDNSettings extends CacheSettings {
	originUrl?: string;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	fetchTimeout?: number;
	retryAttempts?: number;
	retryDelay?: number;
}

export interface EventBatchSettings {
	maxSize: number;
	flushInterval: number;
	endpoint: string;
}
