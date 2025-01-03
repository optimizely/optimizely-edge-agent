import * as optlyHelper from '../../utils/helpers/optimizelyHelper';
import RequestConfig from '../../config/requestConfig';
import defaultSettings from '../../config/defaultSettings';
import { logger } from '../../utils/helpers/optimizelyHelper';
import { AbstractionHelper } from '../../utils/helpers/abstractionHelper';
import EventListeners from './events/eventListeners';
import { ICDNAdapter, IKVStore } from '../../types/cdn';
import { 
	CoreLogicDependencies, 
	CoreLogicState, 
	Decision, 
	CDNVariationSettings,
	RequestConfig as RequestConfigType
} from '../../types/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * The CoreLogic class is the core logic class for processing requests and managing Optimizely decisions.
 * CoreLogic is shared across all CDN Adapters. CoreLogic utilizes the AbstractionHelper to abstract the request and response objects.
 */
export class CoreLogic {
	private logger: CoreLogicDependencies['logger'];
	private env: CoreLogicDependencies['env'];
	private ctx: CoreLogicDependencies['ctx'];
	private kvStore?: IKVStore;
	private sdkKey: string;
	private abstractionHelper: any; // TODO: Add proper type when converted
	private optimizelyProvider: any; // TODO: Add proper type when converted
	private kvStoreUserProfile?: IKVStore;
	private eventListeners: typeof EventListeners;
	private state: CoreLogicState;

	constructor(dependencies: CoreLogicDependencies) {
		const { 
			optimizelyProvider,
			env,
			ctx,
			sdkKey,
			abstractionHelper,
			kvStore,
			kvStoreUserProfile,
			logger 
		} = dependencies;

		this.logger = logger;
		this.logger.info(`CoreLogic instance created for SDK Key: ${sdkKey}`);
		this.env = env;
		this.ctx = ctx;
		this.kvStore = kvStore;
		this.sdkKey = sdkKey;
		this.abstractionHelper = abstractionHelper;
		this.optimizelyProvider = optimizelyProvider;
		this.kvStoreUserProfile = kvStoreUserProfile;
		this.eventListeners = EventListeners.getInstance();

		// Initialize state
		this.state = {
			reqResponseObjectType: 'response',
			datafileOperation: false,
			configOperation: false
		};
	}

	/**
	 * Sets the CDN adapter for the instance.
	 */
	setCdnAdapter(cdnAdapter: ICDNAdapter): void {
		this.state.cdnAdapter = cdnAdapter;
	}

	/**
	 * Retrieves the current CDN adapter.
	 */
	getCdnAdapter(): ICDNAdapter | undefined {
		return this.state.cdnAdapter;
	}

	/**
	 * Deletes the userContext key from each decision object in the given array.
	 */
	private deleteAllUserContexts(decisions: Decision[]): void {
		decisions.forEach(decision => {
			delete decision.userContext;
		});
	}

	/**
	 * Maps an array of decisions to a new array of objects containing specific CDN settings.
	 * Each object includes the flagKey, variationKey, and nested CDN variables.
	 */
	private extractCdnSettings(decisions: Decision[]): Array<{
		flagKey: string;
		variationKey: string;
		cdnVariationSettings?: CDNVariationSettings;
	}> {
		return decisions
			.filter(decision => decision.variables?.cdnVariationSettings)
			.map(({ flagKey, variationKey, variables }) => ({
				flagKey,
				variationKey,
				cdnVariationSettings: variables.cdnVariationSettings
			}));
	}

	/**
	 * Filters a provided array of decision settings to find a specific CDN configuration
	 * based on flagKey and variationKey.
	 */
	private getConfigForDecision(
		decisions: Array<{
			flagKey: string;
			variationKey: string;
			cdnVariationSettings?: CDNVariationSettings;
		}>,
		flagKey: string,
		variationKey: string
	): CDNVariationSettings | undefined {
		const decision = decisions.find(
			d => d.flagKey === flagKey && d.variationKey === variationKey
		);
		return decision?.cdnVariationSettings;
	}

	/**
	 * Processes an array of decision objects by removing the userContext and extracting CDN settings.
	 */
	private processDecisions(decisions: Decision[]): Array<{
		flagKey: string;
		variationKey: string;
		cdnVariationSettings?: CDNVariationSettings;
	}> {
		this.deleteAllUserContexts(decisions);
		return this.extractCdnSettings(decisions);
	}

	/**
	 * Sets the class properties based on the CDN configuration found.
	 */
	private setCdnConfigProperties(
		cdnConfig: CDNVariationSettings,
		flagKey: string,
		variationKey: string
	): void {
		this.state.cdnExperimentSettings = cdnConfig;
		this.state.cdnExperimentURL = cdnConfig.cdnExperimentURL;
		this.state.cdnResponseURL = cdnConfig.cdnResponseURL;
		this.state.forwardRequestToOrigin = cdnConfig.forwardRequestToOrigin;
		this.state.cacheKey = cdnConfig.cacheKey === 'VARIATION_KEY' 
			? `${flagKey}_${variationKey}` 
			: cdnConfig.cacheKey;
	}

	/**
	 * Removes extra slashes from the URL.
	 */
	private removeExtraSlashes(url: string): string {
		return url.replace(/([^:]\/)\/+/g, '$1');
	}

	/**
	 * Processes the incoming request, initializes configurations, and determines response based on operation type.
	 */
	async processRequest(request: Request, env: Record<string, unknown>, ctx: CoreLogicDependencies['ctx']): Promise<Response> {
		this.state.request = request;
		this.env = env;
		this.ctx = ctx;

		const url = new URL(request.url);
		const requestConfig = new RequestConfig();
		const isPostMethod = request.method === 'POST';

		this.state.isPostMethod = isPostMethod;
		this.state.isGetMethod = request.method === 'GET';
		this.state.isDecideOperation = this.getIsDecideOperation(url.pathname);

		// Get or generate visitor ID
		const visitorId = await this.getVisitorId(request, requestConfig);

		// Handle datafile operations
		if (url.pathname.includes('/datafile')) {
			this.state.datafileOperation = true;
			const datafile = await this.retrieveDatafile(requestConfig, env);
			return new Response(datafile, { status: 200 });
		}

		// Handle config operations
		if (url.pathname.includes('/config')) {
			this.state.configOperation = true;
			return new Response(JSON.stringify(defaultSettings), { status: 200 });
		}

		// Initialize Optimizely
		const datafile = await this.retrieveDatafile(requestConfig, env);
		const userAgent = request.headers.get('user-agent') || '';
		await this.initializeOptimizely(datafile, visitorId, requestConfig, userAgent);

		// Determine flags and handle decisions
		const { flagsToDecide, flagsToForce, validStoredDecisions } = await this.determineFlagsToDecide(requestConfig);

		// Execute decisions
		const decisions = await this.optimizelyExecute(flagsToDecide, flagsToForce, requestConfig);

		// Prepare and serialize decisions
		const serializedDecisions = await this.prepareDecisions(decisions, flagsToForce, validStoredDecisions, requestConfig);

		// Prepare final response
		return this.prepareFinalResponse(decisions, visitorId, requestConfig, serializedDecisions);
	}

	/**
	 * Determines if the request should be forwarded to the origin.
	 */
	private shouldForwardToOrigin(): boolean {
		return Boolean(
			this.state.forwardRequestToOrigin && 
			this.state.cdnResponseURL && 
			this.state.isGetMethod
		);
	}

	/**
	 * Executes decisions for the flags.
	 */
	private async optimizelyExecute(
		flagsToDecide: string[],
		flagsToForce: Record<string, Decision>,
		requestConfig: RequestConfigType
	): Promise<Decision[]> {
		const decisions: Decision[] = [];

		// Add forced decisions first
		if (flagsToForce) {
			Object.values(flagsToForce).forEach(decision => {
				decisions.push(decision);
			});
		}

		// Execute decisions for remaining flags
		for (const flagKey of flagsToDecide) {
			try {
				const decision = await this.optimizelyProvider.decide(flagKey, requestConfig);
				if (decision) {
					decisions.push(decision);
				}
			} catch (error) {
				this.logger.error(`Error deciding flag ${flagKey}: ${error}`);
			}
		}

		return decisions;
	}

	/**
	 * Prepares the decisions for the response.
	 */
	private async prepareDecisions(
		decisions: Decision[],
		flagsToForce: Record<string, Decision>,
		validStoredDecisions: Decision[],
		requestConfig: RequestConfigType
	): Promise<string | null> {
		if (!decisions?.length) {
			return null;
		}

		// Process decisions
		const processedDecisions = this.processDecisions(decisions);

		// Find matching CDN config
		if (this.state.request && processedDecisions.length > 0) {
			const url = new URL(this.state.request.url);
			const matchingConfig = this.findMatchingConfig(url.toString(), processedDecisions);

			if (matchingConfig) {
				const { flagKey, variationKey, cdnVariationSettings } = matchingConfig;
				if (cdnVariationSettings) {
					this.setCdnConfigProperties(cdnVariationSettings, flagKey, variationKey);
				}
			}
		}

		// Update metadata
		this.updateMetadata(requestConfig, Object.keys(flagsToForce || {}), validStoredDecisions);

		// Serialize decisions
		return JSON.stringify(decisions);
	}

	/**
	 * Updates the request configuration metadata.
	 */
	private updateMetadata(
		requestConfig: RequestConfigType,
		flagsToForce: string[],
		validStoredDecisions: Decision[]
	): void {
		if (!requestConfig.metadata) {
			requestConfig.metadata = {};
		}

		requestConfig.metadata.decisions = {
			valid: validStoredDecisions?.length || 0,
			forced: flagsToForce?.length || 0,
			invalid: this.state.invalidCookieDecisions?.length || 0
		};
	}

	/**
	 * Searches for a CDN configuration that matches a given URL within an array of decision objects.
	 */
	private findMatchingConfig(
		requestURL: string,
		decisions: Array<{
			flagKey: string;
			variationKey: string;
			cdnVariationSettings?: CDNVariationSettings;
		}>,
		ignoreQueryParameters = true
	): { flagKey: string; variationKey: string; cdnVariationSettings: CDNVariationSettings } | null {
		for (const decision of decisions) {
			const { cdnVariationSettings, flagKey, variationKey } = decision;
			if (!cdnVariationSettings?.cdnExperimentURL) continue;

			const experimentURL = this.removeExtraSlashes(cdnVariationSettings.cdnExperimentURL);
			const cleanRequestURL = this.removeExtraSlashes(requestURL);

			const experimentURLObj = new URL(experimentURL);
			const requestURLObj = new URL(cleanRequestURL);

			if (ignoreQueryParameters) {
				if (experimentURLObj.origin + experimentURLObj.pathname === 
					requestURLObj.origin + requestURLObj.pathname) {
					return { flagKey, variationKey, cdnVariationSettings };
				}
			} else {
				if (experimentURL === cleanRequestURL) {
					return { flagKey, variationKey, cdnVariationSettings };
				}
			}
		}

		return null;
	}

	/**
	 * Checks if the pathname indicates a decide operation.
	 */
	private getIsDecideOperation(pathName: string): boolean {
		return pathName.includes('/decide') || pathName.includes('/v1/decide');
	}

	/**
	 * Retrieves the visitor ID from the request, cookie, or generates a new one.
	 */
	private async getVisitorId(request: Request, requestConfig: RequestConfigType): Promise<string> {
		if (requestConfig.settings.forceVisitorId) {
			return this.overrideVisitorId(requestConfig);
		}

		const [visitorId, source] = await this.retrieveOrGenerateVisitorId(request, requestConfig);
		this.storeVisitorIdMetadata(requestConfig, visitorId, source);

		return visitorId;
	}

	/**
	 * Overrides the visitor ID by generating a new UUID.
	 */
	private async overrideVisitorId(requestConfig: RequestConfigType): Promise<string> {
		const visitorId = uuidv4();
		this.storeVisitorIdMetadata(requestConfig, visitorId, 'generated-forced');
		return visitorId;
	}

	/**
	 * Retrieves a visitor ID from a cookie or generates a new one if not found.
	 */
	private async retrieveOrGenerateVisitorId(
		request: Request,
		requestConfig: RequestConfigType
	): Promise<[string, string]> {
		// Check headers for visitor ID
		const headerVisitorId = request.headers.get('x-visitor-id');
		if (headerVisitorId) {
			return [headerVisitorId, 'header'];
		}

		// Check cookies for visitor ID
		if (this.state.cdnAdapter) {
			const cookieVisitorId = this.state.cdnAdapter.getRequestCookie(request, 'visitor_id');
			if (cookieVisitorId) {
				return [cookieVisitorId, 'cookie'];
			}
		}

		// Generate new visitor ID
		return [uuidv4(), 'generated'];
	}

	/**
	 * Stores visitor ID and its source in the configuration metadata.
	 */
	private storeVisitorIdMetadata(
		requestConfig: RequestConfigType,
		visitorId: string,
		visitorIdSource: string
	): void {
		if (requestConfig.settings.sendMetadata) {
			if (!requestConfig.metadata) {
				requestConfig.metadata = {};
			}
			requestConfig.metadata.visitorId = {
				value: visitorId,
				source: visitorIdSource
			};
		}
	}

	/**
	 * Retrieves the Optimizely datafile from KV storage or CDN.
	 */
	private async retrieveDatafile(
		requestConfig: RequestConfigType,
		env: Record<string, unknown>
	): Promise<string> {
		if (requestConfig.settings.enableKvStorage && this.kvStore) {
			try {
				const cachedDatafile = await this.kvStore.get('datafile');
				if (cachedDatafile) {
					if (requestConfig.settings.sendMetadata) {
						requestConfig.metadata.datafile = {
							origin: 'kv-store'
						};
					}
					return cachedDatafile;
				}
			} catch (error) {
				this.logger.error(`Error retrieving datafile from KV: ${error}`);
			}
		}

		try {
			const response = await fetch(`https://cdn.optimizely.com/datafiles/${this.sdkKey}.json`);
			const datafile = await response.text();

			if (requestConfig.settings.enableKvStorage && this.kvStore) {
				try {
					await this.kvStore.put('datafile', datafile);
				} catch (error) {
					this.logger.error(`Error caching datafile to KV: ${error}`);
				}
			}

			if (requestConfig.settings.sendMetadata) {
				requestConfig.metadata.datafile = {
					origin: 'cdn'
				};
			}

			return datafile;
		} catch (error) {
			this.logger.error(`Error retrieving datafile from CDN: ${error}`);
			throw error;
		}
	}

	/**
	 * Initializes the Optimizely instance.
	 */
	private async initializeOptimizely(
		datafile: string,
		visitorId: string,
		requestConfig: RequestConfigType,
		userAgent: string
	): Promise<boolean> {
		try {
			await this.optimizelyProvider.initialize(datafile);

			const attributes = {
				$opt_user_agent: userAgent,
				...requestConfig.metadata
			};

			await this.optimizelyProvider.createUserContext(visitorId, attributes);
			return true;
		} catch (error) {
			this.logger.error(`Error initializing Optimizely: ${error}`);
			return false;
		}
	}

	/**
	 * Prepares the final response with decisions and headers/cookies.
	 */
	private async prepareFinalResponse(
		decisions: Decision[],
		visitorId: string,
		requestConfig: RequestConfigType,
		serializedDecisions: string | null
	): Promise<Response> {
		// Handle forwarding to origin if needed
		if (this.shouldForwardToOrigin()) {
			return this.handleOriginForwarding(visitorId, serializedDecisions, requestConfig);
		}

		// Handle local response
		return this.prepareLocalResponse(decisions, visitorId, serializedDecisions, requestConfig);
	}

	/**
	 * Handles forwarding the request to the origin with necessary headers and cookies.
	 */
	private async handleOriginForwarding(
		visitorId: string,
		serializedDecisions: string | null,
		requestConfig: RequestConfigType
	): Promise<Response> {
		if (!this.state.request || !this.state.cdnAdapter || !this.state.cdnResponseURL) {
			throw new Error('Missing required state for origin forwarding');
		}

		// Prepare request for forwarding
		const originRequest = new Request(this.state.cdnResponseURL, {
			method: this.state.request.method,
			headers: new Headers(this.state.request.headers),
			body: this.state.request.body,
		});

		// Add visitor ID and decisions to request
		if (requestConfig.settings.sendFlagDecisions && serializedDecisions) {
			originRequest.headers.set('x-optimizely-decisions', serializedDecisions);
		}
		originRequest.headers.set('x-visitor-id', visitorId);

		// Forward to origin
		let response: Response;
		try {
			response = await fetch(originRequest);
		} catch (error) {
			this.logger.error(`Error forwarding to origin: ${error}`);
			throw error;
		}

		// Set response headers and cookies
		response = await this.setResponseHeaders(response, visitorId, serializedDecisions, requestConfig);
		response = await this.setResponseCookies(response, visitorId, serializedDecisions, requestConfig);

		return response;
	}

	/**
	 * Prepares a response when not forwarding to origin.
	 */
	private async prepareLocalResponse(
		decisions: Decision[] | string,
		visitorId: string,
		serializedDecisions: string | null,
		requestConfig: RequestConfigType
	): Promise<Response> {
		let responseBody: string;
		let contentType = 'application/json';

		if (typeof decisions === 'string') {
			responseBody = decisions;
		} else {
			const responseData = {
				decisions,
				visitorId,
				...(requestConfig.settings.sendMetadata ? { metadata: requestConfig.metadata } : {})
			};
			responseBody = JSON.stringify(responseData);
		}

		let response = new Response(responseBody, {
			status: 200,
			headers: {
				'Content-Type': contentType
			}
		});

		// Set response headers and cookies
		response = await this.setResponseHeaders(response, visitorId, serializedDecisions, requestConfig);
		response = await this.setResponseCookies(response, visitorId, serializedDecisions, requestConfig);

		return response;
	}

	/**
	 * Sets response headers based on the provided visitor ID and serialized decisions.
	 */
	private async setResponseHeaders(
		response: Response,
		visitorId: string,
		serializedDecisions: string | null,
		requestConfig: RequestConfigType
	): Promise<Response> {
		const newHeaders = new Headers(response.headers);

		// Set visitor ID header
		newHeaders.set('x-visitor-id', visitorId);

		// Set decisions header if enabled
		if (requestConfig.settings.sendFlagDecisions && serializedDecisions) {
			newHeaders.set('x-optimizely-decisions', serializedDecisions);
		}

		// Set metadata header if enabled
		if (requestConfig.settings.sendMetadata) {
			newHeaders.set('x-optimizely-metadata', JSON.stringify(requestConfig.metadata));
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders
		});
	}

	/**
	 * Sets response cookies based on the provided visitor ID and serialized decisions.
	 */
	private async setResponseCookies(
		response: Response,
		visitorId: string,
		serializedDecisions: string | null,
		requestConfig: RequestConfigType
	): Promise<Response> {
		if (!requestConfig.settings.enableCookies || !this.state.cdnAdapter) {
			return response;
		}

		let modifiedResponse = response;

		// Set visitor ID cookie
		modifiedResponse = this.state.cdnAdapter.setResponseCookie(
			modifiedResponse,
			'visitor_id',
			visitorId,
			{
				path: '/',
				maxAge: 365 * 24 * 60 * 60, // 1 year
				secure: true,
				sameSite: 'Lax'
			}
		);

		// Set decisions cookie if enabled
		if (requestConfig.settings.sendFlagDecisions && serializedDecisions) {
			modifiedResponse = this.state.cdnAdapter.setResponseCookie(
				modifiedResponse,
				'optimizely_decisions',
				serializedDecisions,
				{
					path: '/',
					maxAge: 30 * 60, // 30 minutes
					secure: true,
					sameSite: 'Lax'
				}
			);
		}

		return modifiedResponse;
	}
}
