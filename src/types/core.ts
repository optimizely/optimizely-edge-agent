import { ICDNAdapter, IKVStore } from './cdn';

export interface RequestMetadata {
	visitorId?: {
		value: string;
		source: string;
	};
	flagKeys?: string[];
	decisions?: {
		valid?: number;
		invalid?: number;
		forced?: number;
	};
	datafile?: {
		revision?: string;
		origin?: string;
	};
}

export interface RequestConfig {
	metadata: RequestMetadata;
	settings: {
		enableEdgeDB?: boolean;
		sendFlagDecisions?: boolean;
		forceVisitorId?: boolean;
		sendMetadata?: boolean;
		enableCookies?: boolean;
		enableKvStorage?: boolean;
		[key: string]: unknown;
	};
}

export interface CDNVariationSettings {
	cdnExperimentURL?: string;
	cdnResponseURL?: string;
	cacheKey?: string;
	forwardRequestToOrigin?: boolean;
	cacheRequestToOrigin?: boolean;
	isControlVariation?: boolean;
	[key: string]: unknown;
}

export interface Decision {
	flagKey: string;
	variationKey: string;
	ruleKey?: string;
	enabled: boolean;
	variables: {
		cdnVariationSettings?: CDNVariationSettings;
		[key: string]: unknown;
	};
	userContext?: {
		userId: string;
		attributes?: Record<string, unknown>;
	};
}

export interface CoreLogicDependencies {
	optimizelyProvider: any; // TODO: Add proper type when OptimizelyProvider is converted
	env: Record<string, unknown>;
	ctx: {
		waitUntil: (promise: Promise<unknown>) => void;
		passThroughOnException: () => void;
	};
	sdkKey: string;
	abstractionHelper: any; // TODO: Add proper type when AbstractionHelper is converted
	kvStore?: IKVStore;
	kvStoreUserProfile?: IKVStore;
	logger: {
		info: (message: string) => void;
		warn: (message: string) => void;
		error: (message: string) => void;
		debug: (message: string) => void;
	};
}

export interface CoreLogicState {
	cdnAdapter?: ICDNAdapter;
	reqResponseObjectType: string;
	allDecisions?: Decision[];
	serializedDecisions?: string;
	cdnExperimentSettings?: CDNVariationSettings;
	cdnExperimentURL?: string;
	cdnResponseURL?: string;
	forwardRequestToOrigin?: boolean;
	cacheKey?: string;
	isDecideOperation?: boolean;
	isPostMethod?: boolean;
	isGetMethod?: boolean;
	forwardToOrigin?: boolean;
	activeFlags?: string[];
	savedCookieDecisions?: Decision[];
	validCookiedDecisions?: Decision[];
	invalidCookieDecisions?: Decision[];
	datafileOperation: boolean;
	configOperation: boolean;
	request?: Request;
}
