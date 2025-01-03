export interface OptimizelyConfig {
	sdkKey: string;
	datafileOptions?: {
		updateInterval?: number;
		autoUpdate?: boolean;
		urlTemplate?: string;
	};
	logLevel?: 'error' | 'warn' | 'info' | 'debug';
	eventOptions?: {
		flushInterval?: number;
		maxQueueSize?: number;
		batchSize?: number;
	};
}

export interface OptimizelyUserContext {
	userId: string;
	attributes?: Record<string, unknown>;
}
