import { IRequestHandler, ResponseResult } from '../interfaces/IRequestHandler';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import {
	IDecisionService,
	OptimizelyDecision,
	OptimizelyDecideOption,
	OptimizelyUserContext,
} from '../interfaces/IDecisionService';
import { IEventService, OptimizelyEventData } from '../interfaces/IEventService';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IMetricsAdapter } from '../../adapters/interfaces/IMetricsAdapter';
import { v4 as uuidv4 } from 'uuid';
import { ICacheService } from '../interfaces/ICacheService';
import { IEdgeModeIntegration } from './EdgeModeIntegration';
import { ICookieService } from '../interfaces/ICookieService';
import { IFlagStorageService } from '../interfaces/IFlagStorageService';
import { IConfigurationService } from '../interfaces/IConfigurationService';
import { ApiRouter } from './ApiRouter'; // Add import for ApiRouter
import type { UserAttributes } from '@optimizely/optimizely-sdk';
import { extractAttributes, ExtractAttributesResult } from '../utils/extractAttributes'; // Import the utility and type


/**
 * Comprehensive interface for cdnVariationSettings with all possible properties
 * and their expected types defined according to the Feature Parity Guide.
 */
interface CdnVariationSettings {
	// Core URL Patterns
	cdnExperimentURL?: string; // URL pattern to match against incoming requests
	cdnResponseURL?: string; // URL from which to fetch variation content

	// Caching Configuration
	cacheKey?: string; // Identifier for caching (special value "VARIATION_KEY" or custom string)
	cacheTTL?: string; // Cache time-to-live in seconds (string format)

	// Request Handling Configuration
	forwardRequestToOrigin?: string; // Controls whether to forward requests to origin ("true"/"false")
	cacheRequestToOrigin?: string; // Controls whether to cache responses ("true"/"false")

	// Variation Flags
	isControlVariation?: string; // Identifies control variations ("true"/"false")

	// Advanced URL Handling
	pathRegex?: string; // Optional regex pattern for more complex URL matching
	ignoreQueryParams?: string; // Whether to ignore query parameters in URL matching ("true"/"false")
	requiredQueryParams?: string; // Comma-separated list of required query parameters

	// Response Customization
	responseHeaders?: string; // JSON string of additional headers to add to the response
	transformContent?: string; // JavaScript function (as string) to transform the content

	// Authentication and Security
	requireAuth?: string; // Whether authentication is required ("true"/"false")
	allowedRoles?: string; // Comma-separated list of roles allowed to access the content

	// Generic extension point for any additional properties
	[key: string]: any;
}

// Extended OptimizelyEventData with attributes and tags
interface ExtendedEventData extends OptimizelyEventData {
	attributes?: Record<string, any>;
	tags?: Record<string, any>;
}

/**
 * Service responsible for handling incoming requests and orchestrating
 * calls to other services to produce a response.
 */
export class RequestHandler implements IRequestHandler {
	private decisionService: IDecisionService;
	private eventService: IEventService;
	private logger: ILoggerAdapter;
	private metrics: IMetricsAdapter | null;
	private readonly logPrefix = 'RequestHandler';
	private cacheService: ICacheService;
	private edgeModeIntegration: IEdgeModeIntegration | null;
	private cookieService: ICookieService | null;
	private flagStorage: IFlagStorageService | null;
	private configurationService: IConfigurationService | null;
	private apiRouter: ApiRouter | null; // Add ApiRouter property
	private lastCleanupTime: number = 0;
	private cleanupTriggerInterval: number = 3600000; // Default: trigger possibility every hour
	private cleanupTriggerProbability: number = 0.1; // Default: 10% probability
	private requestTriggeringEnabled: boolean = true; // Default: true
	private implementationVersionHeader: string = 'X-Implementation-Version'; // Default implementation version header

	/**
	 * Creates an instance of the RequestHandler.
	 * @param decisionService - Service for making Optimizely decisions.
	 * @param eventService - Service for tracking and dispatching events.
	 * @param logger - Logger adapter.
	 * @param cacheService - Cache service.
	 * @param edgeModeIntegration - Optional Edge Mode integration service.
	 * @param metrics - Optional metrics adapter for tracking performance and operational metrics.
	 * @param cookieService - Optional cookie service for managing cookies.
	 * @param flagStorage - Optional flag storage service for flag-specific KV operations.
	 * @param configurationService - Optional configuration service for configuration handling.
	 * @param cleanupConfig - Optional configuration for flag storage cleanup behavior.
	 * @param apiRouter - Optional API Router for handling API requests.
	 */
	constructor(
		decisionService: IDecisionService,
		eventService: IEventService,
		logger: ILoggerAdapter,
		cacheService: ICacheService,
		edgeModeIntegration?: IEdgeModeIntegration,
		metrics?: IMetricsAdapter,
		cookieService?: ICookieService,
		flagStorage?: IFlagStorageService,
		configurationService?: IConfigurationService,
		cleanupConfig?: {
			triggerIntervalMs?: number; // How often to consider cleanup (default: 3600000ms = 1 hour)
			triggerProbability?: number; // Probability of triggering cleanup (0-1, default: 0.1 = 10%)
			requestTriggeringEnabled?: boolean; // Whether to trigger cleanup after requests (default: true)
		},
		apiRouter?: ApiRouter // Add apiRouter parameter
	) {
		if (!decisionService || !eventService || !logger || !cacheService) {
			throw new Error('RequestHandler requires decisionService, eventService, logger, and cacheService.');
		}
		this.decisionService = decisionService;
		this.eventService = eventService;
		this.logger = logger.forComponent(this.logPrefix);
		this.cacheService = cacheService;
		this.edgeModeIntegration = edgeModeIntegration || null;
		this.metrics = metrics || null;
		this.cookieService = cookieService || null;
		this.flagStorage = flagStorage || null;
		this.configurationService = configurationService || null;
		this.apiRouter = apiRouter || null; // Set apiRouter

		// Initialize implementationVersionHeader from configurationService if available
		if (this.configurationService && typeof this.configurationService.getImplementationVersionHeader === 'function') {
			this.implementationVersionHeader = this.configurationService.getImplementationVersionHeader();
		}

		// Setup cleanup configuration
		if (cleanupConfig) {
			if (cleanupConfig.triggerIntervalMs !== undefined) {
				this.cleanupTriggerInterval = cleanupConfig.triggerIntervalMs;
			}
			if (cleanupConfig.triggerProbability !== undefined) {
				this.cleanupTriggerProbability = Math.max(0, Math.min(1, cleanupConfig.triggerProbability));
			}
			this.requestTriggeringEnabled = cleanupConfig.requestTriggeringEnabled !== false;
		}

		// Create service availability metrics
		if (this.metrics) {
			this.metrics.setGauge('service_available', 1, { service: 'decision_service' });
			this.metrics.setGauge('service_available', 1, { service: 'event_service' });
			this.metrics.setGauge('service_available', 1, { service: 'cache_service' });
			this.metrics.setGauge('service_available', edgeModeIntegration ? 1 : 0, { service: 'edge_mode_integration' });
			this.metrics.setGauge('service_available', cookieService ? 1 : 0, { service: 'cookie_service' });
			this.metrics.setGauge('service_available', flagStorage ? 1 : 0, { service: 'flag_storage' });
			this.metrics.setGauge('service_available', configurationService ? 1 : 0, { service: 'configuration_service' });
			this.metrics.setGauge('service_available', apiRouter ? 1 : 0, { service: 'api_router' }); // Add API Router metric

			// Add cleanup configuration metrics
			if (this.flagStorage && this.requestTriggeringEnabled) {
				this.metrics.setGauge('cleanup_trigger_interval_ms', this.cleanupTriggerInterval);
				this.metrics.setGauge('cleanup_trigger_probability', this.cleanupTriggerProbability);
			}
		}

		// Log initialized services
		this.logger.debug(`${this.logPrefix} Initialized services`, {
			decisionService: !!decisionService,
			eventService: !!eventService,
			cacheService: !!cacheService,
			edgeModeIntegration: !!edgeModeIntegration,
			metricsAdapter: !!metrics,
			cookieService: !!cookieService,
			flagStorage: !!flagStorage,
			configurationService: !!configurationService,
			apiRouter: !!apiRouter, // Log API Router initialization
		});

		// Log initialized services using structured logging
		this.logger.debug('Initialized with required and optional services', {
			services: {
				decisionService: true,
				eventService: true,
				cacheService: true,
				edgeModeIntegration: !!edgeModeIntegration,
				metrics: !!metrics,
				cookieService: !!cookieService,
				flagStorage: !!flagStorage,
				configurationService: !!configurationService,
				apiRouter: !!apiRouter, // Include API Router in structured logging
			},
			cleanup: this.flagStorage
				? {
						enabled: this.requestTriggeringEnabled,
						triggerInterval: this.cleanupTriggerInterval,
						triggerProbability: this.cleanupTriggerProbability,
				  }
				: null,
		});

		if (this.metrics) {
			this.logger.debug(`${this.logPrefix} Initialized with metrics tracking enabled.`);
		}

		if (this.edgeModeIntegration) {
			this.logger.debug(`${this.logPrefix} Initialized with Edge Mode integration.`);
		}

		if (this.flagStorage) {
			this.logger.debug(`${this.logPrefix} Initialized with Flag Storage integration.`);
			if (this.requestTriggeringEnabled) {
				this.logger.debug(
					`${this.logPrefix} Automatic cleanup triggering enabled (interval: ${
						this.cleanupTriggerInterval
					}ms, probability: ${this.cleanupTriggerProbability * 100}%)`
				);
			}
		}

		if (this.apiRouter) {
			this.logger.debug(`${this.logPrefix} Initialized with API Router integration.`);
		}

		// Single info log at end of initialization for visibility
		this.logger.info(`${this.logPrefix} RequestHandler initialized successfully`);
	}

	/**
	 * Handles an incoming request.
	 * @param requestAdapter - The adapter for the incoming request.
	 * @returns A promise resolving to the ResponseResult.
	 */
	async handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
		const requestId = uuidv4();
		const method = requestAdapter.getMethod();
		const url = requestAdapter.getUrl();
		const path = url.pathname;

		// Start request timer
		const requestTimer = this.metrics?.startTimer('request_duration', {
			method,
			path,
		});

		// Track request counters
		this.metrics?.incrementCounter('requests_total', 1, {
			method,
			path,
		});

		this.logger.debug(
			`${this.logPrefix} Handling ${method} request ${requestId} for URL: ${url.toString()}`
		);

		try {
			// Extract basic config to include in debug headers
			let config = await this.getRequestConfig(requestAdapter);
			
			// Create result variable to allow adding headers before returning
			let result: ResponseResult = {
				status: 404,
				body: '',
				headers: {}
			};

			// Special case for pixel tracking - handle both GET and POST
			if (path.endsWith('/track.gif')) {
				result = await this.handlePixelTrackingRequest(requestAdapter, requestId);
			} else {
				// Get API path prefix from configuration or use default
				const apiPathPrefix = this.configurationService ? 
					this.configurationService.getApiPathPrefix() : '/api/';

				// REVISED ROUTING LOGIC:
				// 1. API path requests (any method) = Use ApiRouter
				// 2. Non-API path + POST method = Unsupported route error
				// 3. Non-API path + GET method = Use Edge Mode

				// Check if this is an API request
				const isApiPath = path.startsWith(apiPathPrefix);

				// Case 1: API path (any method) = Use ApiRouter
				if (isApiPath) {
					this.logger.debug(`${this.logPrefix} [${requestId}]: Routing ${method} request to API router: ${path}`);
					
					if (this.apiRouter) {
						// Use ApiRouter to handle API requests (regardless of method)
						result = await this.apiRouter.routeApiRequest(requestAdapter);
						
						// Track API requests
						this.metrics?.incrementCounter('api_requests_handled', 1, {
							method,
							path,
							status: result.status.toString()
						});
					} else {
						// API router not available
						this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: API router not available for ${method} request to ${path}`);
						result = this.createErrorResponse(requestId, 501, 'API router not available');
					}
				}
				
				// Case 2: Non-API path + POST method = Unsupported route error
				else if (!isApiPath && method === 'POST') {
					this.logger.debug(`${this.logPrefix} [${requestId}]: Rejected POST request to non-API path: ${path}`);
					
					// Track rejected non-API POST requests
					this.metrics?.incrementCounter('non_api_requests_rejected', 1, {
						method: 'POST',
						path,
						reason: 'unsupported_route'
					});
					
					result = this.createErrorResponse(requestId, 404, 'Unsupported route. POST requests must use an API endpoint.');
				}
				
				// Case 3: Non-API path + GET method = Use Edge Mode
				else if (!isApiPath && method === 'GET') {
					// Extract User Context for non-API requests
					const userId = await this.getVisitorId(requestAdapter);
					const extractResult = await extractAttributes(requestAdapter, this.logger);
					if (extractResult.errorCount > 0) this.logger.warn(`extractAttributes encountered ${extractResult.errorCount} errors`, extractResult.errors);
					const userContext: OptimizelyUserContext = {
						userId,
						attributes: extractResult.attributes,
					};

					this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: User context created`, userContext);

					// Process through Edge Mode
					this.logger.debug(`${this.logPrefix} [${requestId}]: Processing GET request through Edge Mode: ${path}`);
					result = await this.handleEdgeModeRequest(requestAdapter, requestId, userContext);
					this.metrics?.incrementCounter('edge_mode_requests', 1);
				}
			}

			// Record response status
			this.metrics?.incrementCounter('response_status', 1, {
				status: result.status.toString(),
				method,
			});

			// Add implementation version header
			if (!result.headers) {
				result.headers = {};
			}
			
			// Add request ID and implementation version to all responses
			result.headers[this.implementationVersionHeader] = 'v2';
			result.headers['X-Request-ID'] = requestId;
			
			// Add debug header to all responses with configuration information
			result.headers['X-Optimizely-Config-Debug'] = JSON.stringify({
				setResponseHeaders: config.setResponseHeaders,
				setResponseCookies: config.setResponseCookies,
				path: path,
				method: method
			});

			// Stop request timer
			if (requestTimer) {
				requestTimer.stop();
			}

			// After processing the request, trigger cleanup if needed
			// Extract sdkKey from request config if available
			let sdkKey: string | undefined;
			try {
				sdkKey = config.sdkKey;
			} catch (error) {
				// If we can't get the SDK key, just pass undefined to do a global cleanup
			}

			// Trigger cleanup with the SDK key if available
			this.triggerCleanupIfNeeded(sdkKey);

			return result;
			
		} catch (error) {
			this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error handling request.`, error);

			// Track error
			this.metrics?.incrementCounter('request_errors', 1, {
				method,
				path: url.pathname,
				error_type: error instanceof Error ? error.name : 'unknown',
			});

			// Stop request timer
			if (requestTimer) {
				requestTimer.stop();
			}

			// Try to trigger cleanup even on errors
			try {
				this.triggerCleanupIfNeeded();
			} catch (cleanupError) {
				// Ignore cleanup errors on the error path
			}

			const errorResponse = this.createErrorResponse(requestId, 500, 'Internal Server Error');

			// Add implementation version header
			if (!errorResponse.headers) {
				errorResponse.headers = {};
			}
			errorResponse.headers[this.implementationVersionHeader] = 'v2';
			errorResponse.headers['X-Request-ID'] = requestId;
			errorResponse.headers['X-Optimizely-Error'] = error instanceof Error ? error.message : 'Unknown error';

			return errorResponse;
		}
	}

	/**
	 * Handles pixel tracking requests (both GET and POST methods).
	 * @param requestAdapter - The request adapter.
	 * @param requestId - The unique request ID.
	 * @returns A promise resolving to the ResponseResult with a 1x1 transparent GIF.
	 */
	private async handlePixelTrackingRequest(
		requestAdapter: IRequestAdapter,
		requestId: string
	): Promise<ResponseResult> {
		try {
			this.logger.debug(`${this.logPrefix} [${requestId}]: Processing pixel tracking request`);

			// Parse request configuration
			const requestBody = await this.getRequestConfig(requestAdapter);

			// Extract required parameters
			const sdkKey = requestBody.sdkKey;
			const eventKey = requestBody.eventKey;
			const userId = requestBody.userId || (await this.getVisitorId(requestAdapter));

			// Validate required parameters
			if (!sdkKey) {
				this.metrics?.incrementCounter('agent_mode_errors', 1, { error_type: 'missing_sdk_key' });
			return this.createErrorResponse(requestId, 400, 'SDK key is required');
			}

			if (!eventKey) {
				this.metrics?.incrementCounter('agent_mode_errors', 1, { error_type: 'missing_event_key' });
				return this.createErrorResponse(requestId, 400, 'Event key is required');
			}

			const eventTimer = this.metrics?.startTimer('event_tracking_duration');

			// Create user context
			const extractResult2 = await extractAttributes(requestAdapter, this.logger);
			if (extractResult2.errorCount > 0) this.logger.warn(`extractAttributes encountered ${extractResult2.errorCount} errors`, extractResult2.errors);
			const userContext: OptimizelyUserContext = {
				userId,
				attributes: extractResult2.attributes,
			};

			// Create and track the event
			const event: ExtendedEventData = {
				type: 'conversion',
				eventKey,
				timestamp: Date.now(),
				uuid: uuidv4(),
				userContext,
				attributes: extractResult2.attributes,
				tags: requestBody.eventTags || {},
			};

			// Add value from query param if present
			if (requestBody.value !== undefined) {
				// Initialize tags if it's undefined
				event.tags = event.tags || {};
				event.tags.value = parseFloat(requestBody.value);
			}

			// Track the event
			await this.eventService.trackEvent(event);
			if (eventTimer) eventTimer.stop();

			// Track event in metrics
			this.metrics?.incrementCounter('events_tracked', 1, {
				event_type: 'conversion',
				event_key: eventKey,
				tracking_type: 'pixel',
			});

			// Return a 1x1 transparent GIF
			// This is a base64-encoded 1x1 transparent GIF
			const transparentGif = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

			return {
				status: 200,
				headers: {
					'Content-Type': 'image/gif',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0',
					'X-Request-ID': requestId,
					[this.implementationVersionHeader]: 'v2',
				},
				body: transparentGif,
			};
		} catch (error) {
			this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error in pixel tracking handler`, error);

			// Track error
			this.metrics?.incrementCounter('pixel_tracking_errors', 1, {
				error_type: error instanceof Error ? error.name : 'unknown',
			});

			// Return an error GIF (still a 1x1 transparent GIF, but with error headers)
			// Using status 200 to avoid browser errors for image src attributes
			const transparentGif = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

			return {
				status: 200,
				headers: {
					'Content-Type': 'image/gif',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0',
					'X-Error': 'Pixel tracking failed',
					'X-Request-ID': requestId,
					[this.implementationVersionHeader]: 'v2',
				},
				body: transparentGif,
			};
		}
	}

	/**
	 * Enhanced handleAgentModeRequest to use cookie-based decisions for sticky bucketing.
	 */
	private async handleAgentModeRequest(
		requestAdapter: IRequestAdapter,
		requestId: string,
		userContext: OptimizelyUserContext
	): Promise<ResponseResult> {
		// Get/parse request details
		const url = requestAdapter.getUrl();
		const path = url.pathname;

		// Extract configuration from request
		const config = await this.getRequestConfig(requestAdapter);

		// Read previous decisions from cookies if available
		const cookieDecisions = this.getDecisionsFromCookies(requestAdapter, config);

		// Handle different endpoints
		switch (path) {
			case '/decide': {
				const flagKey = config.flagKey;

				if (!flagKey) {
					return this.createErrorResponse(requestId, 400, 'Missing flagKey parameter');
				}

				// Use decideForFlag which handles sticky bucketing
				const decision = await this.decideForFlag(flagKey, userContext, requestAdapter, config);
				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Decision for flag ${flagKey}`,
					JSON.stringify(decision)
				);

				if (!decision) {
					return this.createErrorResponse(requestId, 500, `Error getting decision for flag ${flagKey}`);
				}

				// Create a decisions object with this single decision
				const decisions = { [flagKey]: decision };

				// Apply trimming to decision if configured
				const responseBody = config.trimmedDecisions 
					? this.createTrimmedDecisions(decisions, config)[flagKey] 
					: decision;

				// Return the decision with proper headers and cookies
				return this.createJsonResponse(requestId, 200, responseBody, userContext, decisions, config);
			}

			case '/decide-all': {
				const sdkKey = config.sdkKey;

				if (!sdkKey) {
					return this.createErrorResponse(requestId, 400, 'Missing sdkKey parameter');
				}

				const flagKeys = config.flagKeys;

				if (!flagKeys || !Array.isArray(flagKeys) || flagKeys.length === 0) {
					return this.createErrorResponse(requestId, 400, 'Missing or invalid flagKeys parameter');
				}

				// Use decideAll with proper null check
				const decisions = this.decisionService.decideAll
					? await this.decisionService.decideAll(userContext, flagKeys, {
							sdkKey,
							decideOptions: config.decideOptions || [],
					  })
					: {};

				// Use trimmed decisions for the response body if configured
				const responseBody = config.trimmedDecisions 
					? this.createTrimmedDecisions(decisions, config) 
					: decisions;

				// Return the decisions with proper headers and cookies
				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Decide-all decisions`,
					JSON.stringify(decisions)
				);
				
				return this.createJsonResponse(requestId, 200, responseBody, userContext, decisions, config);
			}

			case '/decide-for-keys': {
				const sdkKey = config.sdkKey;

				if (!sdkKey) {
					return this.createErrorResponse(requestId, 400, 'Missing sdkKey parameter');
				}

				const flagKeys = config.flagKeys;

				if (!flagKeys || !Array.isArray(flagKeys) || flagKeys.length === 0) {
					return this.createErrorResponse(requestId, 400, 'Missing or invalid flagKeys parameter');
				}

				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Processing decide-for-keys with ${flagKeys.length} keys`
				);

				// Use decideAll with filter for specific keys
				const decisions = this.decisionService.decideAll
					? await this.decisionService.decideAll(userContext, flagKeys, {
							sdkKey,
							decideOptions: config.decideOptions || [],
					  })
					: {};

				// Use trimmed decisions for the response body if configured
				const responseBody = config.trimmedDecisions 
					? this.createTrimmedDecisions(decisions, config) 
					: decisions;

				// Return the decisions with proper headers and cookies
				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Decide-for-keys decisions`,
					JSON.stringify(decisions)
				);
				
				return this.createJsonResponse(requestId, 200, responseBody, userContext, decisions, config);
			}

			case '/track': {
				const sdkKey = config.sdkKey;
				const eventKey = config.eventKey;

				if (!sdkKey) {
					return this.createErrorResponse(requestId, 400, 'Missing sdkKey or eventKey parameter');
				}

				if (!eventKey) {
					return this.createErrorResponse(requestId, 400, 'Missing eventKey parameter');
				}

				// Create the event for tracking
				const event = {
					type: 'track',
					eventKey,
					timestamp: Date.now(),
					uuid: uuidv4(),
					userContext,
					attributes: config.attributes || {},
					tags: config.eventTags || {},
				};

				// Dispatch tracking event
				await this.eventService.trackEvent(event);

				// Return success response with appropriate headers
				return this.createJsonResponse(requestId, 200, { success: true }, userContext, {}, config);
			}

			default: {
				return this.createErrorResponse(requestId, 404, `Unknown endpoint ${path}`);
			}
		}
	}

	/**
	 * Decides on a feature flag for the given context.
	 * Enhanced with sticky bucketing from cookies.
	 * @param flagKey - The feature flag key.
	 * @param userContext - The user context.
	 * @param requestAdapter - The request adapter.
	 * @param config - The request configuration.
	 * @returns The decision for the feature flag.
	 */
	private async decideForFlag(
		flagKey: string,
		userContext: OptimizelyUserContext,
		requestAdapter: IRequestAdapter,
		config: Record<string, any>
	): Promise<OptimizelyDecision | null> {
		if (!this.decisionService) {
			return null;
		}

		// Check for previous decisions in cookies for sticky bucketing
		const previousDecisions = this.getDecisionsFromCookies(requestAdapter, config);
		const previousDecision = previousDecisions?.[flagKey];

		// If we have a previous decision and sticky bucketing is not disabled, use it
		if (previousDecision && config.stickyBucketing !== false) {
			this.logger.debug(`${this.logPrefix} Using previous decision from cookie for flag ${flagKey}`);
			return previousDecision;
		}

		// Otherwise, make a new decision
		try {
			// Call getDecision instead of decide, since the parameter order is different
			return await this.decisionService.getDecision(userContext.userId, flagKey, userContext.attributes, {
				sdkKey: config.sdkKey,
				decideOptions: config.decideOptions,
			});
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error making decision for flag ${flagKey}`, error);
			return null;
		}
	}

	/**
	 * Gets decisions from cookies if available.
	 * Enhanced for full parity with original implementation.
	 * @param requestAdapter - The request adapter
	 * @param config - The request configuration
	 * @returns Decision record or null if not found
	 */
	private getDecisionsFromCookies(
		requestAdapter: IRequestAdapter,
		config: Record<string, any>
	): Record<string, OptimizelyDecision> | null {
		// Return null if cookies are disabled, no cookie service, or explicit opt-out
		if (config.responseCookies === false || config.stickyBucketing === false || !this.cookieService) {
			return null;
		}

		try {
			const decisions = this.cookieService.getDecisionsFromCookies(requestAdapter);

			if (decisions && Object.keys(decisions).length > 0) {
				this.logger.debug(`${this.logPrefix} Retrieved decisions from cookies: ${Object.keys(decisions).join(', ')}`);
				return decisions;
			}
		} catch (error) {
			this.logger.warn(`${this.logPrefix} Error extracting decisions from cookies`, error);
		}

		return null;
	}

	/**
	 * Handles a request in Edge Mode.
	 * @param requestAdapter - The adapter for the incoming request.
	 * @param requestId - The unique request ID.
	 * @param userContext - The user context for decisions.
	 * @returns A promise resolving to the ResponseResult.
	 */
	private async handleEdgeModeRequest(
		requestAdapter: IRequestAdapter,
		requestId: string,
		userContext: OptimizelyUserContext
	): Promise<ResponseResult> {
		try {
			// Track edge mode request
			this.metrics?.incrementCounter('edge_mode_requests', 1);

			// Log edge mode request
			this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Processing Edge Mode (${requestAdapter.getMethod()}) request`);

			// Log service availability for debugging
			this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Service availability: cookieService=${!!this.cookieService}, decisionService=${!!this.decisionService}`);

			// Check if Edge Mode Integration is available
			if (!this.edgeModeIntegration) {
				this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Edge Mode Integration is not available`);
				return this.createErrorResponse(requestId, 501, 'Edge Mode Integration is not available');
			}

			this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Using Edge Mode Integration service`);

			// Get decisions for header/cookie generation - needed regardless of Edge Mode integration result
			const allDecisions = (await this.decisionService.decideAll?.(userContext)) || {};
			this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Got ${Object.keys(allDecisions).length} decisions for headers/cookies`);
			
			let config = await this.getRequestConfig(requestAdapter);
			
			// Enhance config for proper header/cookie generation
			config = {
				...config,
				userId: userContext.userId,
				returnDecisions: true,
				responseHeadersAndCookies: true,
				responseCookies: true,
				decisionsCookieName: config.decisionsCookieName || 'optly_edge_decisions',
				visitorIdCookieName: config.visitorIdCookieName || 'optly_edge_visitor_id',
				// Set header options explicitly to ensure decision headers are added
				headers: {
					decisions: true,
					variations: true,
					experiments: true, 
					'visitor-id': true,
					'sdk-key': true,
					'powered-by': true
				}
			};

			// Process request with Edge Mode Integration
			const edgeModeTimer = this.metrics?.startTimer('edge_mode_duration');
			const edgeModeResult = await this.edgeModeIntegration.processEdgeModeRequest(
				requestAdapter,
				userContext,
				requestId
			);
			if (edgeModeTimer) {
				edgeModeTimer.stop();
			}

			// Extract finalBody and finalStatus based on the type of result
			let finalBody: string;
			let finalStatus: number;

			switch (edgeModeResult.type) {
				case 'PROXIED_FALLBACK':
					this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Edge Mode Integration returned proxied fallback. Generating standard response headers/cookies.`);
					finalBody = edgeModeResult.body;
					finalStatus = edgeModeResult.status;
					break;

				case 'STANDARD_RESPONSE':
					this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Edge Mode Integration returned standard response. Extracting body/status and generating headers/cookies.`);
					// Extract body and status from the Response object
					finalBody = await edgeModeResult.response.text();
					finalStatus = edgeModeResult.response.status;
					break;

				case 'ERROR':
					this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Edge Mode Integration returned error.`);
					finalBody = edgeModeResult.body;
					finalStatus = edgeModeResult.status;
					break;

				default:
					this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Unknown result type from Edge Mode Integration.`);
					return this.createErrorResponse(requestId, 500, 'Unknown result type from Edge Mode Integration');
			}
			
			// Log headers debug
			this.logger.debug(`${this.logPrefix} Creating response with decisions: ${Object.keys(allDecisions).length} decisions, important config values: userId=${config.userId}, returnDecisions=${config.returnDecisions}, responseCookies=${config.responseCookies}`);

			// ALWAYS use createJsonResponse to generate the final response with proper headers/cookies
			// regardless of the EdgeModeResult type
			const response = this.createJsonResponse(
				requestId,
				finalStatus,
				finalBody,
				userContext,
				allDecisions,
				config
			);
			
			// Log the generated response headers for debugging
			this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Generated response headers: ${Object.keys(response.headers).join(', ')}`);
			if (response.headers['Set-Cookie']) {
				this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Set-Cookie header is present`);
			} else {
				this.logger.warn(`${this.logPrefix} RequestHandler [${requestId}]: Set-Cookie header is missing`);
			}
			if (response.headers['X-Optimizely-Decision']) {
				this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: X-Optimizely-Decision header is present`);
			} else {
				this.logger.warn(`${this.logPrefix} RequestHandler [${requestId}]: X-Optimizely-Decision header is missing`);
			}
			
			return response;
		} catch (error) {
			this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error in Edge Mode request handling:`, error);
			
			// Track error
			this.metrics?.incrementCounter('edge_mode_errors', 1, {
				error_type: error instanceof Error ? error.name : 'unknown'
			});
			
			// Return error response
			return this.createErrorResponse(requestId, 500, 'Error in Edge Mode request handling');
		}
	}

	/**
	 * Retrieves or generates a visitor ID from the request.
	 * Enhanced to match original implementation's precedence rules.
	 * @param requestAdapter - The request adapter.
	 * @returns The visitor ID.
	 */
	private async getVisitorId(requestAdapter: IRequestAdapter): Promise<string> {
		const config = await this.getRequestConfig(requestAdapter);

		// Visitor ID precedence (matching original implementation):
		// 1. Request-provided visitor ID (userId from query params, headers, etc.)
		// 2. Override visitor ID from query param (if override enabled)
		// 3. Cookie-based visitor ID
		// 4. Generated UUID as fallback

		// First check for userId in request (headers, query params, etc.)
		const userId = config.userId || '';
		if (userId) {
			this.logger.debug(`${this.logPrefix} Using visitor ID from request: ${userId}`);
			return userId;
		}

		// Check for override parameter if enabled
		if (config.overrideVisitorId && requestAdapter.getUrl().searchParams.get('visitor_id')) {
			const visitorId = requestAdapter.getUrl().searchParams.get('visitor_id');
			this.logger.debug(`${this.logPrefix} Using visitor ID from override parameter: ${visitorId}`);
			return visitorId as string;
		}

		// Check cookie for visitor ID if cookie service is available and cookies are not disabled
		if (config.responseCookies !== false) {
			const cookieVisitorId = this.extractVisitorIdFromCookies(requestAdapter);
			if (cookieVisitorId) {
				this.logger.debug(`${this.logPrefix} Using visitor ID from cookie: ${cookieVisitorId}`);
				return cookieVisitorId;
			}
		}

		// Generate a new visitor ID if none found
		const newVisitorId = this.generateUUID();
		this.logger.debug(`${this.logPrefix} Generated new visitor ID: ${newVisitorId}`);
		return newVisitorId;
	}

	/**
	 * Extracts visitor ID from cookies.
	 * @param requestAdapter - The request adapter.
	 * @returns The visitor ID from cookies or null.
	 */
	private extractVisitorIdFromCookies(requestAdapter: IRequestAdapter): string | null {
		if (this.cookieService) {
			return this.cookieService.getVisitorIdFromCookies(requestAdapter);
		}

		// Fallback to existing implementation if cookie service not available
		const cookieHeader = requestAdapter.getHeader('cookie');
		if (!cookieHeader) {
			return null;
		}

		const cookies: Record<string, string> = cookieHeader
			.split(';')
			.map((cookie) => cookie.trim().split('='))
			.reduce((acc: Record<string, string>, [key, value]) => ({ ...acc, [key]: value }), {});

		return cookies['optimizely_visitor_id'] || null;
	}

	/**
	 * Gets request configuration from the request adapter.
	 * If ConfigurationService is available, use it, otherwise fall back to legacy implementation.
	 * @param requestAdapter - The request adapter.
	 * @returns A promise resolving to the request configuration.
	 */
	private async getRequestConfig(requestAdapter: IRequestAdapter): Promise<Record<string, any>> {
		// If configurationService is available, use it
		if (this.configurationService) {
			try {
				// Configure from request
				await this.configurationService.initialize(requestAdapter);

				// Return the configuration
				const config = this.configurationService.getConfig();

				// Add debug logging for the forced decisions header
				const forcedDecisionHeader = requestAdapter.getHeader('X-Optimizely-Forced-Decision');
				if (forcedDecisionHeader) {
					console.log('[CONFIG_DEBUG] X-Optimizely-Forced-Decision header found:', forcedDecisionHeader);

					try {
						const parsedHeader = JSON.parse(forcedDecisionHeader);
						console.log('[CONFIG_DEBUG] Parsed forced decisions from header:', JSON.stringify(parsedHeader));

						// Check if forcedDecisions exists in config and log it
						if (config.forcedDecisions) {
							console.log('[CONFIG_DEBUG] forcedDecisions in config:', JSON.stringify(config.forcedDecisions));
						} else {
							console.log('[CONFIG_DEBUG] No forcedDecisions in config object');
						}
					} catch (error) {
						console.log('[CONFIG_DEBUG] Failed to parse forced decisions header:', error);
					}
				}

				// Log the complete config for debugging
				console.log('[CONFIG_DEBUG] Final config object:', JSON.stringify(config));

				return config;
			} catch (error) {
				this.logger.error(`${this.logPrefix} Failed to get configuration from ConfigurationService:`, error);
				throw error;
			}
		}

		// Fall back to manual configuration extraction if ConfigurationService is not available
		this.logger.debug(`${this.logPrefix} RequestHandler: Using legacy configuration extraction`);
		let config: Record<string, any> = {};

		// Try to get configuration from body first
		try {
			config = await requestAdapter.getBodyJson<Record<string, any>>();
		} catch (error) {
			this.logger.debug('Failed to parse request body as JSON', error);
		}

		// Override with query parameters
		const url = requestAdapter.getUrl();
		for (const [key, value] of url.searchParams.entries()) {
			try {
				// Try to parse as JSON if possible
				config[key] = JSON.parse(value);
			} catch (error) {
				// Otherwise use as string
				config[key] = value;
			}
		}

		// Override with headers (highest priority)
		const headers = requestAdapter.getHeaders();

		// Use forEach method which is available on Headers
		headers.forEach((value, key) => {
			// Fix: Process both x-optly-* and X-Optimizely-* headers
			if (key.toLowerCase().startsWith('x-optly-') || key.toLowerCase().startsWith('x-optimizely-')) {
				// Convert header name to camelCase config key
				let configKey = '';

				if (key.toLowerCase().startsWith('x-optly-')) {
					// Handle x-optly- prefix (legacy)
					configKey = key
						.replace(/^x-optly-/i, '')
						.replace(/-([a-z])/g, (_: string, char: string) => char.toUpperCase());
				} else {
					// Handle X-Optimizely- prefix (standard)
					configKey = key
						.replace(/^x-optimizely-/i, '')
						.replace(/-([a-z])/g, (_: string, char: string) => char.toUpperCase());

					// Special case for standard headers - convert to expected request format
					switch (configKey.toLowerCase()) {
						case 'sdkkey':
							configKey = 'sdkKey';
							break;
						case 'flagkey':
							configKey = 'flagKey';
							break;
						case 'userid':
							configKey = 'userId';
							break;
						case 'eventkey':
							configKey = 'eventKey';
							break;
						case 'attributes':
							// For attributes, try to parse as JSON
							try {
								config['attributes'] = JSON.parse(value);
								// Skip the regular processing below for the attributes header
								return;
							} catch (error) {
								this.logger.debug('Failed to parse X-Optimizely-Attributes header as JSON', error);
								configKey = 'attributes';
							}
							break;
					}
				}

				try {
					// Try to parse the value as JSON
					config[configKey] = JSON.parse(value);
				} catch (error) {
					// If not valid JSON, use as string
					config[configKey] = value;
				}
			}
		});

		// Special handling for userId from headers (backwards compatibility)
		if (headers.has('X-Optimizely-Visitor-Id') && !config.userId) {
			config.userId = headers.get('X-Optimizely-Visitor-Id');
		}

		this.logger.debug(`${this.logPrefix} RequestHandler: Extracted config from request:`, config);

		// Special handling for query parameter forced variations
		// Check for key=flagKey&variation=variationKey pattern
		if (url.searchParams.has('key') && url.searchParams.has('variation')) {
			const flagKey = url.searchParams.get('key');
			const variationKey = url.searchParams.get('variation');

			console.log(`[QUERY_DEBUG] Found forced variation in query params: flag=${flagKey}, variation=${variationKey}`);

			// Create the forced decision object
			if (flagKey && variationKey) {
				// Initialize forcedDecisions if not present
				if (!config.forcedDecisions) {
					config.forcedDecisions = {};
				}

				// Add the forced decision
				config.forcedDecisions[flagKey] = { variationKey };

				// Also add to attributes for compatibility with our SDK integration
				if (!config.attributes) {
					config.attributes = {};
				}

				if (typeof config.attributes === 'object' && config.attributes !== null) {
					if (!config.attributes.forcedDecisions) {
						config.attributes.forcedDecisions = {};
					}
					config.attributes.forcedDecisions[flagKey] = { variationKey };
				}

				console.log('[QUERY_DEBUG] Added forced decision to config:', JSON.stringify(config.forcedDecisions));
			}
		}

		return config;
	}

	/**
	 * Safely parse URL search parameters into a Record
	 * @param search - URL search string (including or excluding the leading ?)
	 * @returns A record of parameter key-value pairs
	 * @private
	 */
	private parseUrlParams(search: string): Record<string, string> {
		// Remove leading ? if present
		const queryString = search.startsWith('?') ? search.substring(1) : search;

		// Handle empty query string
		if (!queryString) {
			return {};
		}

		// Parse parameter pairs
		const params: Record<string, string> = {};
		queryString.split('&').forEach((pair) => {
			// Skip empty pairs
			if (!pair) return;

			// Handle param with no value (e.g., "param=" or just "param")
			const equalPos = pair.indexOf('=');
			if (equalPos === -1) {
				params[pair] = '';
			} else {
				const key = pair.substring(0, equalPos);
				const value = pair.substring(equalPos + 1);
				if (key) {
					params[key] = value;
				}
			}
		});

		return params;
	}

	/**
	 * Finds a matching configuration for the given request URL.
	 * Enhanced version with full feature parity for cdnVariationSettings.
	 * @param requestURL - The request URL to match against.
	 * @param decisions - The decisions map containing variations.
	 * @param ignoreQueryParameters - Whether to ignore query parameters in URL matching.
	 * @returns The matching configuration or null.
	 */
	private async findMatchingConfig(
		requestURL: string,
		decisions: Record<string, OptimizelyDecision>,
		ignoreQueryParameters: boolean = true
	): Promise<Record<string, any> | null> {
		// Parse the request URL
		const url = new URL(requestURL);

		// Normalize the path (remove trailing slashes, handle consecutive slashes)
		const normalizedPath = this.normalizePath(url.pathname);

		// Build the base URL for comparison (without query parameters if ignoring them)
		const compareUrl = url.origin + normalizedPath;

		this.logger.debug(`${this.logPrefix} RequestHandler: Matching URL ${compareUrl}`);

		// Track how many variations were evaluated for metrics
		let variationsEvaluated = 0;

		// Extract cdnVariationSettings from all decisions
		for (const [flagKey, decision] of Object.entries(decisions)) {
			variationsEvaluated++;

			// Skip if not enabled or no variables
			if (!decision.enabled || !decision.variables) {
				this.logger.debug(
					`${this.logPrefix} RequestHandler: Skipping disabled flag or flag without variables: ${flagKey}`
				);
				continue;
			}

			// Skip if no cdnVariationSettings
			const cdnVariationSettingsRaw = decision.variables.cdnVariationSettings;
			if (!cdnVariationSettingsRaw) {
				this.logger.debug(`${this.logPrefix} RequestHandler: Flag ${flagKey} has no cdnVariationSettings`);
				continue;
			}

			// Parse and validate cdnVariationSettings
			let settings: CdnVariationSettings;
			try {
				// If cdnVariationSettings is a string (JSON), parse it
				if (typeof cdnVariationSettingsRaw === 'string') {
					try {
						settings = JSON.parse(cdnVariationSettingsRaw);
					} catch (e) {
						this.logger.error(
							`${this.logPrefix} RequestHandler: Invalid JSON in cdnVariationSettings for flag ${flagKey}`,
							e
						);
						continue;
					}
				} else {
					// Otherwise assume it's already an object
					settings = cdnVariationSettingsRaw as CdnVariationSettings;
				}
			} catch (e) {
				this.logger.error(
					`${this.logPrefix} RequestHandler: Error parsing cdnVariationSettings for flag ${flagKey}`,
					e
				);
				continue;
			}

			// Skip if cdnExperimentURL is not defined
			if (!settings.cdnExperimentURL) {
				this.logger.debug(`${this.logPrefix} RequestHandler: Flag ${flagKey} missing cdnExperimentURL in settings`);
				continue;
			}

			// Track if this settings uses path regex
			const usesPathRegex = !!settings.pathRegex;

			// Check if we need to consider query parameters (override default)
			const shouldIgnoreQueryParams = settings.ignoreQueryParams
				? settings.ignoreQueryParams.toLowerCase() === 'true'
				: ignoreQueryParameters;

			// Path matching logic - either use regex or direct comparison
			let pathMatch = false;

			if (usesPathRegex) {
				try {
					const pathRegex = new RegExp(settings.pathRegex || '');
					pathMatch = pathRegex.test(normalizedPath);
					this.logger.debug(`${this.logPrefix} RequestHandler: Regex path match result for ${flagKey}: ${pathMatch}`);
				} catch (e) {
					this.logger.error(`${this.logPrefix} RequestHandler: Invalid path regex for flag ${flagKey}`, e);
					continue;
				}
			} else {
				// Standard path matching
				// Normalize the experiment URL for comparison
				const experimentUrl = new URL(settings.cdnExperimentURL);
				const experimentPath = this.normalizePath(experimentUrl.pathname);

				let compareExperimentUrl = experimentUrl.origin + experimentPath;

				this.logger.debug(`${this.logPrefix} RequestHandler: Comparing with experiment URL ${compareExperimentUrl}`);

				// Check for direct path match
				pathMatch = compareUrl === compareExperimentUrl;
			}

			// If path didn't match, continue to next variation
			if (!pathMatch) {
				continue;
			}

			// Handle query parameters if needed
			if (!shouldIgnoreQueryParams && url.search) {
				// Parse request and experiment URL parameters
				const requestParams = this.parseUrlParams(url.search);

				// Handle required query parameters if specified
				if (settings.requiredQueryParams) {
					const requiredParams = settings.requiredQueryParams.split(',').map((param: string) => param.trim());
					const missingParams = requiredParams.filter((param) => !(param in requestParams));

					if (missingParams.length > 0) {
						this.logger.debug(
							`${this.logPrefix} RequestHandler: Missing required parameters for ${flagKey}: ${missingParams.join(
								', '
							)}`
						);
						continue;
					}
				}

				// Check experiment URL parameter matching
				if (settings.cdnExperimentURL.includes('?')) {
					const experimentUrl = new URL(settings.cdnExperimentURL);
					const experimentParams = this.parseUrlParams(experimentUrl.search);

					// Check all experiment parameters match the request
					let paramsMismatch = false;

					for (const [key, value] of Object.entries(experimentParams)) {
						if (!(key in requestParams)) {
							this.logger.debug(`${this.logPrefix} RequestHandler: Parameter ${key} missing in request URL`);
							paramsMismatch = true;
							break;
						}

						if (requestParams[key] !== value) {
							this.logger.debug(
								`${this.logPrefix} RequestHandler: Parameter ${key} value mismatch: expected '${value}', got '${requestParams[key]}'`
							);
							paramsMismatch = true;
							break;
						}
					}

					if (paramsMismatch) {
						this.logger.debug(
							`${this.logPrefix} RequestHandler: Query parameter mismatch for ${settings.cdnExperimentURL}`
						);
						continue;
					}
				}
			}

			// We got a match! Log success
			this.logger.info(
				`${this.logPrefix} RequestHandler: Match found for URL ${compareUrl}, flag: ${flagKey}, variation: ${decision.variationKey}`
			);

			// Track metrics
			this.metrics?.incrementCounter('url_matches', 1, {
				flag_key: flagKey,
				variation_key: decision.variationKey || '',
			});
			this.metrics?.recordHistogram('variations_evaluated_before_match', variationsEvaluated);

			// Parse boolean settings (converting string values to booleans with defaults)
			const parseBooleanSetting = (value: string | undefined, defaultValue: boolean): boolean => {
				if (!value) return defaultValue;
				return value.toLowerCase() === 'true';
			};

			// Parse numeric settings (converting string values to numbers with defaults)
			const parseNumericSetting = (value: string | undefined, defaultValue: number): number => {
				if (!value) return defaultValue;
				const parsed = parseInt(value, 10);
				return isNaN(parsed) ? defaultValue : parsed;
			};

			// Return a consolidated config object with proper typing and defaults
			return {
				flagKey,
				variationKey: decision.variationKey,

				// Core URL patterns
				cdnExperimentURL: settings.cdnExperimentURL,
				cdnResponseURL: settings.cdnResponseURL || '',

				// Caching configuration
				cacheKey: settings.cacheKey || 'VARIATION_KEY',
				cacheTTL: settings.cacheTTL || '3600',

				// Request handling configuration
				forwardRequestToOrigin: settings.forwardRequestToOrigin || 'false',
				cacheRequestToOrigin: settings.cacheRequestToOrigin || 'false',

				// Variation flags
				isControlVariation: settings.isControlVariation || 'false',

				// Advanced URL handling
				pathRegex: settings.pathRegex || '',
				ignoreQueryParams: settings.ignoreQueryParams || 'true',
				requiredQueryParams: settings.requiredQueryParams || '',

				// Response customization
				responseHeaders: settings.responseHeaders || '',
				transformContent: settings.transformContent || '',

				// Authentication and security
				requireAuth: settings.requireAuth || 'false',
				allowedRoles: settings.allowedRoles || '',

				// Original settings object for any custom properties
				originalSettings: settings,

				// Parsed boolean settings for easier use
				parsedSettings: {
					forwardRequestToOrigin: parseBooleanSetting(settings.forwardRequestToOrigin, false),
					cacheRequestToOrigin: parseBooleanSetting(settings.cacheRequestToOrigin, false),
					isControlVariation: parseBooleanSetting(settings.isControlVariation, false),
					ignoreQueryParams: parseBooleanSetting(settings.ignoreQueryParams, true),
					requireAuth: parseBooleanSetting(settings.requireAuth, false),
					cacheTTL: parseNumericSetting(settings.cacheTTL, 3600),
				},
			};
		}

		// Track the miss
		this.metrics?.incrementCounter('url_match_misses', 1);
		this.logger.debug(`${this.logPrefix} RequestHandler: No matching configuration found for URL ${compareUrl}`);
		return null;
	}

	/**
	 * Normalizes a URL path by removing trailing slashes,
	 * handling consecutive slashes, and standardizing format.
	 * @param path - The path to normalize.
	 * @returns The normalized path.
	 */
	private normalizePath(path: string): string {
		// Handle empty path
		if (!path) return '/';

		// Replace consecutive slashes with a single slash
		let normalized = path.replace(/\/+/g, '/');

		// Remove trailing slash if present (unless it's just a root slash)
		if (normalized.length > 1 && normalized.endsWith('/')) {
			normalized = normalized.slice(0, -1);
		}

		return normalized;
	}

	/**
	 * Creates a JSON response with proper headers.
	 * @param requestId - The request ID.
	 * @param status - The HTTP status code.
	 * @param body - The response body (can be object or string).
	 * @param userContext - Optional user context for personalized headers.
	 * @param decisions - Optional decisions to include in headers.
	 * @param config - Optional configuration options.
	 * @returns The ResponseResult.
	 */
	private createJsonResponse(
		requestId: string,
		status: number,
		body: any,
		userContext?: OptimizelyUserContext,
		decisions?: Record<string, OptimizelyDecision>,
		config?: Record<string, any>
	): ResponseResult {
		// Set default empty objects if not provided
		const effectiveUserContext = userContext || { userId: '' };
		const effectiveDecisions = decisions || {};
		const effectiveConfig = config || {};

		// DEBUG LOG: Add diagnostic info for trimmedDecisions issue
		this.logger.info(
			`[TRIM_DEBUG] trimmedDecisions=${effectiveConfig.trimmedDecisions}, ` +
			`bodyType=${typeof body}, keys=${body && typeof body === 'object' ? Object.keys(body || {}).join(',') : 'n/a'}`
		);

		// Always include basic request tracking headers
		const baseHeaders: Record<string, string> = {
			'X-Request-ID': requestId,
			[this.implementationVersionHeader]: 'v2',
		};

		// Merge with dynamically generated headers from our comprehensive header management
		const responseHeaders = {
			...baseHeaders,
			...this.createResponseHeaders(effectiveUserContext, effectiveDecisions, effectiveConfig),
		};

		// Apply trimmedDecisions transformation to the body if:
		// 1. We have a body that appears to contain decisions
		// 2. The config has trimmedDecisions enabled
		// 3. The body isn't already a string or primitive
		let responseBody = body;
		
		// If body is already a string, don't process it further
		if (typeof body === 'string') {
			try {
				// Try to parse it in case it's a JSON string that needs processing
				const parsedBody = JSON.parse(body);
				
				// If we successfully parsed it AND it looks like a decision object, 
				// process it according to trimmedDecisions rules
				if (typeof parsedBody === 'object' && parsedBody !== null) {
					// Run it through our normal object processing rules
					const processedBody = this.processBodyForResponse(parsedBody, effectiveConfig);
					// Only use the processed version if it changed something
					if (processedBody !== parsedBody) {
						responseBody = JSON.stringify(processedBody);
					}
				}
			} catch (e) {
				// If we can't parse it as JSON, leave it as is
				this.logger.debug(`${this.logPrefix} Body is a non-JSON string, returning as is`);
			}
		} else if (typeof body === 'object' && body !== null) {
			// Normal object processing
			responseBody = this.processBodyForResponse(body, effectiveConfig);
		}

		return {
			status,
			headers: responseHeaders,
			body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
		};
	}

	/**
	 * Process a body object according to trimmedDecisions rules
	 * @param body - The body object to process
	 * @param config - Configuration options
	 * @returns The processed body
	 */
	private processBodyForResponse(body: any, config: Record<string, any>): any {
		// Check if ENABLED_FLAGS_ONLY is set in config
		const enabledFlagsOnly = config && (
			config.enabledFlagsOnly === true || 
			(config.decideOptions && 
				Array.isArray(config.decideOptions) && 
				config.decideOptions.includes('ENABLED_FLAGS_ONLY'))
		);

		// Handle disabled flags first if ENABLED_FLAGS_ONLY is set for a single flag
		if (enabledFlagsOnly && 
			body && 
			typeof body === 'object' && 
			'flagKey' in body && 
			'enabled' in body && 
			body.enabled === false) {
			// This is a single disabled flag and ENABLED_FLAGS_ONLY is set
			// We should not include it in the response at all
			this.logger.debug(`${this.logPrefix} Removing disabled flag ${body.flagKey} from response due to ENABLED_FLAGS_ONLY option`);
			return {}; // Return empty object instead
		}

		// Handle normal trimming
		if (
			config.trimmedDecisions === true ||
			config.trimmedDecisions === 'true' ||
			config.trimmedDecisions === 1 ||
			config.trimmedDecisions === '1'
		) {
			// Case 1: If the body is a single decision object (for /decide endpoint)
			if (body.flagKey && typeof body.enabled !== 'undefined' && body.variationKey) {
				// If ENABLED_FLAGS_ONLY is set and this flag is disabled, return empty object
				if (enabledFlagsOnly && body.enabled === false) {
					this.logger.debug(`${this.logPrefix} Removing disabled flag ${body.flagKey} from response due to ENABLED_FLAGS_ONLY option`);
					return {};
				}
				
				// Create a trimmed version
				const singleTrimmedDecision: Record<string, any> = {
					flagKey: body.flagKey,
					enabled: body.enabled,
					variationKey: body.variationKey,
					variables: body.variables,
				};
				
				// Add optional fields if present
				if (body.experimentKey) {
					singleTrimmedDecision.experimentKey = body.experimentKey;
				}
				if (body.ruleKey) {
					singleTrimmedDecision.ruleKey = body.ruleKey;
				}
				
				this.logger.debug(`${this.logPrefix} Trimmed single decision for response body`);
				return singleTrimmedDecision;
			}
			// Case 2: If the body contains multiple decisions (for /decide-all or /decide-for-keys)
			else if (Object.keys(body).length > 0 && Object.values(body).some(val => 
				typeof val === 'object' && val !== null && 'flagKey' in val && 'enabled' in val)) {
				// This looks like a decisions object - create trimmed versions
				this.logger.debug(`${this.logPrefix} Trimmed multiple decisions for response body`);
				return this.createTrimmedDecisions(body, config);
			}
		} else if (enabledFlagsOnly) {
			// Even if trimmedDecisions is not set, we still need to respect ENABLED_FLAGS_ONLY
			
			// Case 1: Single decision object
			if (body && body.flagKey && typeof body.enabled !== 'undefined') {
				if (body.enabled === false) {
					this.logger.debug(`${this.logPrefix} Removing disabled flag ${body.flagKey} from response due to ENABLED_FLAGS_ONLY option`);
					return {};
				}
				return body;
			}
			
			// Case 2: Multiple decisions object
			if (typeof body === 'object' && body !== null && Object.keys(body).length > 0) {
				const filteredDecisions: Record<string, any> = {};
				
				for (const [flagKey, decision] of Object.entries(body)) {
					const typedDecision = decision as any;
					if (typedDecision && typeof typedDecision === 'object' && 
						'enabled' in typedDecision && typedDecision.enabled === false) {
						this.logger.debug(`${this.logPrefix} Removing disabled flag ${flagKey} from response due to ENABLED_FLAGS_ONLY option`);
						continue;
					}
					filteredDecisions[flagKey] = decision;
				}
				
				return filteredDecisions;
			}
		}
		
		// Return unchanged if no trimming or filtering applied
		return body;
	}

	/**
	 * Creates an error response with proper headers.
	 * @param requestId - The request ID.
	 * @param status - The HTTP status code.
	 * @param message - The error message.
	 * @param userContext - Optional user context for personalized headers.
	 * @param config - Optional configuration options.
	 * @returns The ResponseResult.
	 */
	private createErrorResponse(
		requestId: string,
		status: number,
		message: string,
		userContext?: OptimizelyUserContext,
		config?: Record<string, any>
	): ResponseResult {
		return this.createJsonResponse(
			requestId,
			status,
			{
				error: message,
				requestId: requestId,
			},
			userContext,
			{},
			config
		);
	}

	/**
	 * Creates a response that forwards the request to the origin with additional headers.
	 * Enhanced with feature parity for all header and cookie handling.
	 * @param requestAdapter - The request adapter.
	 * @param requestId - The unique request ID.
	 * @param userContext - The user context.
	 * @param matchingConfig - The matching configuration.
	 * @returns A promise resolving to the response.
	 */
	private async createForwardResponse(
		requestAdapter: IRequestAdapter,
		requestId: string,
		userContext: OptimizelyUserContext,
		matchingConfig: Record<string, any> | null
	): Promise<ResponseResult> {
		try {
			const request = requestAdapter.getNativeRequest<Request>();

			// Clone the request to modify
			const requestUrl = request.url; // Get the URL as string
			const clonedRequest = new Request(requestUrl, {
				method: request.method,
				headers: request.headers,
				body: request.body,
				redirect: request.redirect,
			});

			// Add optimizely headers to the request
			const headers = new Headers(clonedRequest.headers);

			// Add visitor ID and tracking headers
			headers.set('X-Optimizely-Visitor-Id', userContext.userId);

			// Add variation information if we have a matching config
			if (matchingConfig) {
				const { flagKey, variationKey } = matchingConfig;
				headers.set('X-Optimizely-Variation', variationKey);
				headers.set('X-Optimizely-Flag', flagKey);

				// Add user attributes (safely)
				if (userContext.attributes) {
					try {
						// Filter out potentially sensitive information
						const safeAttributes = { ...userContext.attributes };
						delete safeAttributes.email;
						delete safeAttributes.password;
						delete safeAttributes.token;

						headers.set('X-Optimizely-Attributes', JSON.stringify(safeAttributes));
					} catch (error) {
						this.logger.warn(
							`${this.logPrefix} RequestHandler [${requestId}]: Failed to serialize user attributes`,
							error
						);
					}
				}

				// Get target URL - use cdnResponseURL if provided, otherwise original URL
				let targetUrl = matchingConfig.cdnResponseURL || clonedRequest.url;

				// Define cache key for response caching
				const cacheKey = matchingConfig.cacheKey || 'VARIATION_KEY';
				const { cacheTTL } = matchingConfig.parsedSettings;
				const { cacheRequestToOrigin } = matchingConfig.parsedSettings;

				// Check cache first if caching is enabled
				let cachedResponse = null;
				if (cacheRequestToOrigin && cacheTTL > 0) {
					const generatedCacheKey = this.cacheService.generateCacheKey(
						cacheKey,
						matchingConfig.flagKey,
						matchingConfig.variationKey
					);

					// Try to get cached response
					interface CachedResponseData {
						content: string;
						status: number;
						headers: Record<string, string>;
					}

					cachedResponse = await this.cacheService.get<CachedResponseData>(generatedCacheKey);
					if (cachedResponse) {
						this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Cache hit for origin response`);

						// Track cache hit
						this.metrics?.incrementCounter('origin_cache_hits', 1, {
							flag_key: matchingConfig.flagKey,
							variation_key: matchingConfig.variationKey,
						});

						// Return cached response
						const responseHeaders = { ...cachedResponse.headers };

						// Add Optimizely-specific headers
						responseHeaders['X-Request-ID'] = requestId;
						responseHeaders[this.implementationVersionHeader] = 'v2';
						responseHeaders['X-Optimizely-Visitor-Id'] = userContext.userId;
						responseHeaders['X-Optimizely-Cache'] = 'HIT';

						// Set cookie for visitor ID tracking
						const cookieValue = `optimizely_visitor_id=${userContext.userId}; Path=/; Max-Age=2592000; SameSite=Lax`;
						responseHeaders['Set-Cookie'] = cookieValue;

						return {
							status: cachedResponse.status,
							headers: responseHeaders,
							body: cachedResponse.content,
						};
					}
				}

				// No cache hit, fetch from origin
				this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Forwarding request to ${targetUrl}`);

				// Track fetch operation
				const fetchTimer = this.metrics?.startTimer('origin_fetch_duration');

				// Create modified request with headers and target URL
				const modifiedRequest = new Request(targetUrl, {
					method: clonedRequest.method,
					headers,
					body: clonedRequest.body,
					redirect: clonedRequest.redirect,
				});

				// Fetch from origin
				const response = await fetch(modifiedRequest);
				if (fetchTimer) fetchTimer.stop();

				// Extract content and headers from response
				const content = await response.text();
				const responseHeaders: Record<string, string> = {};

				// Copy headers from origin response
				response.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});

				// Add optimizely headers
				responseHeaders['X-Request-ID'] = requestId;
				responseHeaders[this.implementationVersionHeader] = 'v2';
				responseHeaders['X-Optimizely-Visitor-Id'] = userContext.userId;
				responseHeaders['X-Optimizely-Cache'] = 'MISS';

				// Set cookie for visitor ID tracking
				const cookieValue = `optimizely_visitor_id=${userContext.userId}; Path=/; Max-Age=2592000; SameSite=Lax`;
				responseHeaders['Set-Cookie'] = cookieValue;

				// If caching is enabled, cache the response
				if (cacheRequestToOrigin && cacheTTL > 0) {
					const ttl = cacheTTL || 3600;
					const generatedCacheKey = this.cacheService.generateCacheKey(
						cacheKey,
						matchingConfig.flagKey,
						matchingConfig.variationKey
					);

					const cacheData = {
						content,
						status: response.status,
						headers: responseHeaders,
					};

					await this.cacheService.set(generatedCacheKey, cacheData, ttl);
					this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Cached origin response with TTL ${ttl}s`);

					// Track cache writes
					this.metrics?.incrementCounter('origin_cache_writes', 1, {
						flag_key: matchingConfig.flagKey,
						variation_key: matchingConfig.variationKey,
					});
				}

				// Handle non-success responses with proper logging
				if (!response.ok) {
					this.logger.warn(
						`${this.logPrefix} RequestHandler [${requestId}]: Origin returned non-success status ${response.status}`
					);

					// Track origin errors
					this.metrics?.incrementCounter('origin_errors', 1, {
						status: response.status.toString(),
						flag_key: matchingConfig.flagKey,
						variation_key: matchingConfig.variationKey,
					});
				}

				// Apply any custom headers from cdnVariationSettings
				if (matchingConfig.responseHeaders) {
					try {
						const customHeaders = JSON.parse(matchingConfig.responseHeaders);
						if (typeof customHeaders === 'object' && customHeaders !== null) {
							Object.entries(customHeaders).forEach(([name, value]) => {
								if (typeof value === 'string') {
									responseHeaders[name] = value;
								}
							});
						}
					} catch (e) {
						this.logger.warn(
							`${this.logPrefix} RequestHandler [${requestId}]: Failed to parse custom response headers`,
							e
						);
					}
				}

				// Apply content transformation if specified
				let transformedContent = content;
				if (matchingConfig.transformContent && typeof content === 'string') {
					try {
						// This is a security risk in production, so this would need careful validation
						// For the purpose of this implementation, we log but don't actually execute
						this.logger.info(
							`${this.logPrefix} RequestHandler [${requestId}]: Content transformation specified but not executed for security reasons`
						);
						// In a real implementation with proper security, this might be implemented as:
						// const transformFn = new Function('content', matchingConfig.transformContent);
						// result.body = transformFn(result.body);
					} catch (e) {
						this.logger.error(
							`${this.logPrefix} RequestHandler [${requestId}]: Failed to execute content transformation`,
							e
						);
					}
				}

				return {
					status: response.status,
					headers: responseHeaders,
					body: transformedContent,
				};
			} else {
				// No matching config, just forward the request as is
				this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Forwarding request without variations`);

				// Track fetch operation
				const fetchTimer = this.metrics?.startTimer('origin_fetch_duration');

				// Add basic optimizely headers
				headers.set('X-Optimizely-Visitor-Id', userContext.userId);

				// Create request with tracking headers
				const modifiedRequest = new Request(clonedRequest.url, {
					method: clonedRequest.method,
					headers,
					body: clonedRequest.body,
					redirect: clonedRequest.redirect,
				});

				const response = await fetch(modifiedRequest);
				if (fetchTimer) fetchTimer.stop();

				const content = await response.text();

				// Extract headers
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});

				// Add optimizely headers
				responseHeaders['X-Request-ID'] = requestId;
				responseHeaders[this.implementationVersionHeader] = 'v2';
				responseHeaders['X-Optimizely-Visitor-Id'] = userContext.userId;

				// Track non-success responses
				if (!response.ok) {
					this.metrics?.incrementCounter('origin_errors', 1, {
						status: response.status.toString(),
						variation: 'none',
					});
				}

				return {
					status: response.status,
					headers: responseHeaders,
					body: content,
				};
			}
		} catch (error) {
			this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error forwarding request`, error);

			// Track error type for metrics
			this.metrics?.incrementCounter('origin_request_failures', 1, {
				error_type: error instanceof Error ? error.name : 'unknown',
				matching_config: matchingConfig ? 'true' : 'false',
			});

			// Try to generate a helpful error message
			let errorMessage = 'Error forwarding request';
			if (error instanceof Error) {
				errorMessage = error.message;

				// Check for common error types
				if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
					errorMessage = 'Could not connect to origin server';
				} else if (error.message.includes('ETIMEDOUT')) {
					errorMessage = 'Connection to origin server timed out';
				} else if (error.message.includes('certificate')) {
					errorMessage = 'SSL certificate error connecting to origin';
				}
			}

			return this.createErrorResponse(requestId, 500, errorMessage);
		}
	}

	/**
	 * Creates a content response based on the matching configuration.
	 * Enhanced with feature parity for all header and cookie handling.
	 * @param requestAdapter - The request adapter.
	 * @param requestId - The unique request ID.
	 * @param userContext - The user context.
	 * @param matchingConfig - The matching configuration.
	 * @returns A promise resolving to the response.
	 */
	private async createContentResponse(
		requestAdapter: IRequestAdapter,
		requestId: string,
		userContext: OptimizelyUserContext,
		matchingConfig: Record<string, any>
	): Promise<ResponseResult> {
		const { flagKey, variationKey, cdnResponseURL, cacheKey } = matchingConfig;

		// Get parsed settings
		const { cacheTTL } = matchingConfig.parsedSettings;

		// Use default TTL if not specified or invalid
		const ttlValue = !isNaN(cacheTTL) ? cacheTTL : 3600;

		// Generate the cache key
		const generatedCacheKey = this.cacheService.generateCacheKey(cacheKey, flagKey, variationKey);

		this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Generated cache key ${generatedCacheKey}`);

		// Define a type for cached content that includes original response info
		interface CachedContentWithMetadata {
			content: string;
			headers?: Record<string, string>;
			contentType?: string;
			status?: number;
		}

		// Try to get content from cache first
		let cachedData = await this.cacheService.get<CachedContentWithMetadata>(generatedCacheKey);
		let content: string;
		let contentType: string = 'text/html; charset=utf-8'; // Default
		let status: number = 200;
		let originHeaders: Record<string, string> = {};

		// If not in cache or cacheTTL is 0, fetch from origin
		if (!cachedData || ttlValue === 0) {
			this.logger.debug(
				`${this.logPrefix} RequestHandler [${requestId}]: Cache miss, fetching content from ${cdnResponseURL}`
			);

			// Validate URL before fetching
			if (!cdnResponseURL) {
				this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: No cdnResponseURL provided`);
				return this.createErrorResponse(requestId, 500, 'Missing cdnResponseURL');
			}

			try {
				// Track the fetch operation
				const fetchTimer = this.metrics?.startTimer('origin_fetch_duration');

				// Prepare the fetch request with Optimizely headers
				const headers = new Headers();
				headers.set('X-Optimizely-Visitor-Id', userContext.userId);
				headers.set('X-Optimizely-Variation', variationKey);
				headers.set('X-Optimizely-Flag', flagKey);

				// Add any user attributes as headers for context
				if (userContext.attributes) {
					// Only include safe attributes, avoid large payloads
					const safeAttributes = { ...userContext.attributes };
					// Remove potentially sensitive fields
					delete safeAttributes.email;
					delete safeAttributes.password;
					delete safeAttributes.token;

					try {
						headers.set('X-Optimizely-Attributes', JSON.stringify(safeAttributes));
					} catch (e) {
						// If attributes can't be serialized, log and continue
						this.logger.warn(`${this.logPrefix} RequestHandler [${requestId}]: Failed to serialize user attributes`);
					}
				}

				// Fetch content from cdnResponseURL with headers
				const response = await fetch(cdnResponseURL, { headers });
				if (fetchTimer) fetchTimer.stop();

				if (!response.ok) {
					this.logger.error(
						`${this.logPrefix} RequestHandler [${requestId}]: Failed to fetch content from ${cdnResponseURL}, status: ${response.status}`
					);
					return this.createErrorResponse(requestId, response.status, 'Failed to fetch content');
				}

				// Get response content
				content = await response.text();

				// Get content type from response or use default
				const responseContentType = response.headers.get('content-type');
				if (responseContentType) {
					contentType = responseContentType;
				} else {
					// Try to infer content type from URL or content
					if (cdnResponseURL.endsWith('.json')) {
						contentType = 'application/json; charset=utf-8';
					} else if (cdnResponseURL.endsWith('.css')) {
						contentType = 'text/css; charset=utf-8';
					} else if (cdnResponseURL.endsWith('.js')) {
						contentType = 'application/javascript; charset=utf-8';
					} else if (cdnResponseURL.endsWith('.xml')) {
						contentType = 'application/xml; charset=utf-8';
					} else if (content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
						contentType = 'application/json; charset=utf-8';
					}
					// Default stays as text/html otherwise
				}

				// Get status from response
				status = response.status;

				// Extract all response headers
				originHeaders = {};
				response.headers.forEach((value, key) => {
					originHeaders[key] = value;
				});

				// Cache the content and metadata if cacheTTL > 0
				if (ttlValue > 0) {
					const cacheData: CachedContentWithMetadata = {
						content,
						headers: originHeaders,
						contentType,
						status,
					};

					await this.cacheService.set(generatedCacheKey, cacheData, ttlValue);
					this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Content cached with TTL ${ttlValue}s`);

					// Track cache writes
					this.metrics?.incrementCounter('content_cache_writes', 1, {
						flag_key: flagKey,
						variation_key: variationKey,
					});
				}
			} catch (error) {
				this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error fetching content`, error);
				return this.createErrorResponse(requestId, 500, 'Error fetching content');
			}
		} else {
			// We have cached data
			this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: Cache hit for ${generatedCacheKey}`);

			// Unpack the cached data with defaults
			content = cachedData.content;
			contentType = cachedData.contentType || 'text/html; charset=utf-8';
			status = cachedData.status || 200;
			originHeaders = cachedData.headers || {};

			// Track cache hits
			this.metrics?.incrementCounter('content_cache_hits', 1, {
				flag_key: flagKey,
				variation_key: variationKey,
			});
		}

		// Apply content transformation if specified
		if (matchingConfig.transformContent && typeof content === 'string') {
			try {
				// For security, we should carefully validate the transformation function
				// In a full implementation, this would use a sandboxed environment

				// IMPORTANT: This is just a placeholder implementation. In production,
				// content transformation should use a proper sandboxed evaluation.
				const transformCode = matchingConfig.transformContent;

				// Basic validation of the transform code
				if (
					transformCode &&
					!transformCode.includes('eval(') &&
					!transformCode.includes('Function(') &&
					!transformCode.includes('setTimeout(') &&
					!transformCode.includes('setInterval(')
				) {
					// Create a safe transform function
					const transformFn = new Function(
						'content',
						'"use strict";\n' +
							'// Transform the content\n' +
							'let result = content;\n' +
							'try {\n' +
							'  ' +
							transformCode +
							'\n' +
							'} catch (e) {\n' +
							'  console.error("Transform error:", e);\n' +
							'}\n' +
							'return result;'
					);

					// Apply the transformation
					const transformedContent = transformFn(content);

					// Only use the result if it's a string
					if (typeof transformedContent === 'string') {
						content = transformedContent;
						this.logger.info(
							`${this.logPrefix} RequestHandler [${requestId}]: Content transformation applied successfully`
						);

						// Track successful transformations
						this.metrics?.incrementCounter('content_transformations', 1, {
							flag_key: flagKey,
							variation_key: variationKey,
							success: 'true',
						});
					} else {
						this.logger.warn(
							`${this.logPrefix} RequestHandler [${requestId}]: Content transformation returned non-string result`
						);

						// Track failed transformations
						this.metrics?.incrementCounter('content_transformations', 1, {
							flag_key: flagKey,
							variation_key: variationKey,
							success: 'false',
						});
					}
				} else {
					this.logger.warn(
						`${this.logPrefix} RequestHandler [${requestId}]: Content transformation contains potentially unsafe code`
					);
				}
			} catch (e) {
				this.logger.error(
					`${this.logPrefix} RequestHandler [${requestId}]: Failed to execute content transformation`,
					e
				);

				// Track failed transformations
				this.metrics?.incrementCounter('content_transformations', 1, {
					flag_key: flagKey,
					variation_key: variationKey,
					success: 'false',
					error: e instanceof Error ? e.name : 'unknown',
				});
			}
		}

		// Start with essential Optimizely headers
		const responseHeaders: Record<string, string> = {
			'X-Optimizely-Edge-Agent': 'v2',
			'X-Optimizely-Variation': matchingConfig.variationKey || '',
			'Content-Type': contentType || 'text/html',
		};

		// Add cache control headers based on TTL
		if (ttlValue > 0) {
			responseHeaders['Cache-Control'] = `max-age=${ttlValue}, private`;
		} else {
			responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate';
			responseHeaders['Pragma'] = 'no-cache';
			responseHeaders['Expires'] = '0';
		}

		// Merge origin headers, but our Optimizely headers take precedence
		for (const [key, value] of Object.entries(originHeaders)) {
			// Skip certain headers that we want to control
			if (!['content-type', 'set-cookie', 'cache-control'].includes(key.toLowerCase())) {
				responseHeaders[key] = value;
			}
		}

		// Set cookies for tracking visitor ID and bucketing
		const cookieValue = `optimizely_visitor_id=${userContext.userId}; Path=/; Max-Age=2592000; SameSite=Lax`; // 30 day cookie
		responseHeaders['Set-Cookie'] = cookieValue;

		// Apply any custom headers if specified
		if (matchingConfig.responseHeaders) {
			try {
				const customHeaders = JSON.parse(matchingConfig.responseHeaders);
				if (typeof customHeaders === 'object' && customHeaders !== null) {
					Object.entries(customHeaders).forEach(([name, value]) => {
						if (typeof value === 'string') {
							responseHeaders[name] = value;
						}
					});
				}
			} catch (e) {
				this.logger.warn(`${this.logPrefix} RequestHandler [${requestId}]: Failed to parse custom response headers`, e);
			}
		}

		// Get the request config for cookie and header options
		const config = await this.getRequestConfig(requestAdapter);

		// Get the decision for headers and cookies (based on matching flag)
		const decision = await this.decisionService.getDecision(
			userContext.userId,
			matchingConfig.flagKey,
			userContext.attributes,
			{ sdkKey: config.sdkKey, decideOptions: config.decideOptions }
		);

		// Add decision headers based on configuration
		if (config.returnDecisions !== false) {
			// Don't use btoa() - just use the stringified JSON directly
			responseHeaders['X-Optimizely-Decision'] = JSON.stringify(decision);
		}

		// Add cookies using the new cookie service
		this.addCookiesToResponse(userContext, { [matchingConfig.flagKey]: decision }, config, responseHeaders);

		return {
			status,
			headers: responseHeaders,
			body: content,
		};
	}

	/**
	 * Adds decision-related headers to the response based on configuration.
	 * Enhanced to match original implementation.
	 * @param decisions - The decision objects
	 * @param config - Configuration options
	 * @param responseHeaders - Existing response headers to augment
	 */
	private addDecisionHeadersToResponse(
		decisions: Record<string, OptimizelyDecision>,
		config: Record<string, any>,
		responseHeaders: Record<string, string>
	): void {
		// DEBUG: Log all relevant config flags
		this.logger.info(`${this.logPrefix} HEADER DEBUG - config flags: setResponseHeaders=${config.setResponseHeaders}, responseHeadersAndCookies=${config.responseHeadersAndCookies}`);
		
		// Check all possible variations of the headers flag and only skip if explicitly false
		const headersEnabled = 
			config.setResponseHeaders !== false && 
			config.responseHeadersAndCookies !== false;
		
		// Skip if headers are explicitly disabled or no decisions
		if (!headersEnabled || Object.keys(decisions).length === 0) {
			this.logger.warn(`${this.logPrefix} Skipping decision headers: headersEnabled=${headersEnabled}, decisionsCount=${Object.keys(decisions).length}`);
			return;
		}

		// Try to get the visitor ID from the decisions (for header)
		let visitorId = '';
		
		// Look for visitor ID in decisions user context
		for (const key of Object.keys(decisions)) {
			const decision = decisions[key];
			if (decision && decision.userContext) {
				// First try to get ID from getUserId method (type-safe approach)
				if (typeof decision.userContext.getUserId === 'function') {
					visitorId = decision.userContext.getUserId();
					if (visitorId) break;
				}
				
				// This will make TypeScript ignore the property access errors
				// We know these properties exist at runtime in our system
				const anyContext = decision.userContext as any;
				if (anyContext && anyContext.userId) {
					visitorId = anyContext.userId;
					break;
				}
				if (anyContext && anyContext.visitorId) {
					visitorId = anyContext.visitorId;
					break;
				}
			}
		}

		try {
			// Get the configured header names from config service (if available)
			const decisionsHeaderName = this.configurationService?.getDecisionsHeaderName() || 'X-Optimizely-Edge-Decisions';
			const visitorIdHeaderName = this.configurationService?.getVisitorIdHeaderName() || 'X-Optimizely-Edge-Visitor-Id';
			
			// Create trimmed decisions for the header to reduce size
			const trimmedDecisions = this.createTrimmedDecisions(decisions, config);
			
			// Set the decisions header with trimmed decisions (as JSON string)
			responseHeaders[decisionsHeaderName] = JSON.stringify(trimmedDecisions);
			
			// FORCE ADD additional headers for debugging
			responseHeaders['X-Optimizely-Decision-Debug'] = JSON.stringify({
				decisionsCount: Object.keys(decisions).length,
				headerName: decisionsHeaderName,
				config: {
					setResponseHeaders: config.setResponseHeaders,
					responseHeadersAndCookies: config.responseHeadersAndCookies
				}
			});
			
			this.logger.info(`${this.logPrefix} Added ${decisionsHeaderName} header with ${Object.keys(trimmedDecisions).length} decisions`);
			
			// Set the visitor ID header if we have one
			if (visitorId) {
				responseHeaders[visitorIdHeaderName] = visitorId;
				this.logger.debug(`${this.logPrefix} Added ${visitorIdHeaderName} header with ID: ${visitorId}`);
			}
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error adding decision headers:`, error);
		}
	}

	/**
	 * Creates trimmed decision objects for more compact headers
	 * @param decisions Full decision objects
	 * @param config The request configuration with possible decideOptions
	 * @returns Trimmed decision objects with only essential fields
	 */
	private createTrimmedDecisions(
		decisions: Record<string, OptimizelyDecision>,
		config?: Record<string, any>
	): Record<string, any> {
		const trimmed: Record<string, any> = {};
		
		// Check if ENABLED_FLAGS_ONLY is set in config
		const enabledFlagsOnly = config && (
			config.enabledFlagsOnly === true || 
			(config.decideOptions && 
				Array.isArray(config.decideOptions) && 
				config.decideOptions.includes('ENABLED_FLAGS_ONLY'))
		);

		for (const [flagKey, decision] of Object.entries(decisions)) {
			// Skip if we have no decision or if we're skipping disabled flags
			if (!decision || (enabledFlagsOnly && decision.enabled === false)) {
				this.logger.debug(`${this.logPrefix} Skipping ${flagKey} in trimmed decisions: ${!decision ? 'No decision found' : 'Disabled flag with ENABLED_FLAGS_ONLY'}`);
				continue;
			}
			
			trimmed[flagKey] = {
				flagKey: decision.flagKey,
				enabled: decision.enabled,
				variationKey: decision.variationKey,
				variables: decision.variables,
			};

			// Add experiment key if available
			if (decision.experimentKey) {
				trimmed[flagKey].experimentKey = decision.experimentKey;
			}

			// Add rule key if available
			if (decision.ruleKey) {
				trimmed[flagKey].ruleKey = decision.ruleKey;
			}
		}

		return trimmed;
	}

	/**
	 * Adds cookies to the response based on configuration.
	 * Enhanced to match original implementation.
	 * @param userContext - The user context
	 * @param decisions - The decision objects
	 * @param config - Configuration options
	 * @param responseHeaders - Existing response headers to augment
	 */
	private addCookiesToResponse(
		userContext: OptimizelyUserContext | Record<string, any>,
		decisions: Record<string, OptimizelyDecision>,
		config: Record<string, any>,
		responseHeaders: Record<string, string>
	): void {
		// Skip if cookies are disabled
		if (config.setResponseCookies === false) {
			this.logger.debug(`${this.logPrefix} Skipping cookie generation (setResponseCookies is false)`);
			return;
		}

		// Log decisions count and cookie service availability
		this.logger.debug(`${this.logPrefix} Adding cookies to response: ${Object.keys(decisions).length} decisions, cookieService available: ${!!this.cookieService}`);

		// Get the configured cookie names from config service (if available) or config or defaults
		const visitorIdCookieName = this.configurationService?.getVisitorIdCookieName() || 
			config.visitorIdCookieName || 'optly_edge_visitor_id';
		
		const decisionsCookieName = this.configurationService?.getDecisionsCookieName() || 
			config.decisionsCookieName || 'optly_edge_decisions';

		// Check if we have the cookie service available
		if (this.cookieService) {
			const cookies = [];

			// Apply cookie configuration from request config
			const cookieOptions: Record<string, any> = {
				cookieDomain: config.cookieDomain || undefined,
				secure: config.secureCookies === true,
				path: config.cookiePath || '/',
			};

			// Add visitor ID cookie if userContext is the correct type
			if (this.isUserContext(userContext) && userContext.userId) {
				const visitorIdCookieOptions = {
					...cookieOptions,
					cookieName: visitorIdCookieName,
					ttl: config.visitorIdCookieTTL || 86400 * 365, // 1 year default
				};

				const visitorIdCookie = this.cookieService.createVisitorIdCookie(
					userContext.userId,
					this.cookieService.applyCookieOptionsFromConfig(visitorIdCookieOptions, config)
				);
				cookies.push(visitorIdCookie);
			}

			// Add decisions cookie if we have decisions - USE TRIMMED DECISIONS HERE
			if (Object.keys(decisions).length > 0) {
				const decisionsCookieOptions = {
					...cookieOptions,
					cookieName: decisionsCookieName,
					ttl: config.decisionsCookieTTL || 600, // 10 minutes default
				};

				// Create trimmed decisions for the cookie to reduce size
				const trimmedDecisions = this.createTrimmedDecisions(decisions, config);

				const decisionsCookie = this.cookieService.createDecisionsCookie(
					trimmedDecisions, // Use trimmed version instead of full decisions
					this.cookieService.applyCookieOptionsFromConfig(decisionsCookieOptions, config)
				);
				cookies.push(decisionsCookie);
			}

			// Set the cookies in the response headers
			if (cookies.length > 0) {
				const cookieHeaders = this.cookieService.createSetCookieHeaders(cookies);
				
				// Check if there are already cookie headers set
				if (responseHeaders['Set-Cookie']) {
					// If Set-Cookie is already a string, convert to array and add new cookies
					if (typeof responseHeaders['Set-Cookie'] === 'string') {
						responseHeaders['Set-Cookie'] = [responseHeaders['Set-Cookie'], ...cookieHeaders].join('\n');
					} else if (Array.isArray(responseHeaders['Set-Cookie'])) {
						// If already an array, just concatenate
						responseHeaders['Set-Cookie'] = [...responseHeaders['Set-Cookie'], ...cookieHeaders].join('\n');
					} else {
						// Otherwise just set it
						responseHeaders['Set-Cookie'] = cookieHeaders.join('\n');
					}
				} else {
					responseHeaders['Set-Cookie'] = cookieHeaders.join('\n');
				}
				
				this.logger.debug(`${this.logPrefix} Added ${cookies.length} cookies to response using cookie service`);
			}
		} else {
			// FALLBACK IMPLEMENTATION when cookie service is not available
			this.logger.debug(`${this.logPrefix} Using fallback cookie implementation (cookieService not available)`);
			
			const cookies = [];
			
			// Add visitor ID cookie if we have a user ID from userContext
			if (this.isUserContext(userContext) && userContext.userId) {
				// Use the variable defined above
				const cookieTTL = config.visitorIdCookieTTL || 86400 * 365; // 1 year default
				const cookiePath = config.cookiePath || '/';
				const cookieDomain = config.cookieDomain ? `; Domain=${config.cookieDomain}` : '';
				const secure = config.secureCookies === true ? '; Secure' : '';
				const httpOnly = '; HttpOnly';
				const sameSite = '; SameSite=Lax';
				
				// Calculate expiration date
				const expiryDate = new Date();
				expiryDate.setTime(expiryDate.getTime() + (cookieTTL * 1000));
				
				// Create cookie string
				const visitorIdCookie = `${visitorIdCookieName}=${userContext.userId}; Expires=${expiryDate.toUTCString()}; Path=${cookiePath}${cookieDomain}${secure}${httpOnly}${sameSite}`;
				cookies.push(visitorIdCookie);
				
				this.logger.debug(`${this.logPrefix} Created fallback visitor ID cookie: ${visitorIdCookie}`);
			}
			
			// Add decisions cookie if we have decisions
			if (Object.keys(decisions).length > 0) {
				// Use the variable defined above
				const cookieTTL = config.decisionsCookieTTL || 600; // 10 minutes default
				const cookiePath = config.cookiePath || '/';
				const cookieDomain = config.cookieDomain ? `; Domain=${config.cookieDomain}` : '';
				const secure = config.secureCookies === true ? '; Secure' : '';
				const httpOnly = '; HttpOnly';
				const sameSite = '; SameSite=Lax';
				
				// Create trimmed decisions for the cookie to reduce size
				const trimmedDecisions = this.createTrimmedDecisions(decisions, config);
				const decisionsValue = encodeURIComponent(JSON.stringify(trimmedDecisions));
				
				// Calculate expiration date
				const expiryDate = new Date();
				expiryDate.setTime(expiryDate.getTime() + (cookieTTL * 1000));
				
				// Create cookie string
				const decisionsCookie = `${decisionsCookieName}=${decisionsValue}; Expires=${expiryDate.toUTCString()}; Path=${cookiePath}${cookieDomain}${secure}${httpOnly}${sameSite}`;
				cookies.push(decisionsCookie);
				
				this.logger.debug(`${this.logPrefix} Created fallback decisions cookie with ${Object.keys(trimmedDecisions).length} decisions`);
			}
			
			// Set cookies in response headers
			if (cookies.length > 0) {
				responseHeaders['Set-Cookie'] = cookies.join('\n');
				this.logger.debug(`${this.logPrefix} Added ${cookies.length} cookies to response using fallback implementation`);
			}
		}
	}

	/**
	 * Helper method to check if the object is a UserContext
	 * @param obj - The object to check
	 * @returns True if the object is a UserContext
	 */
	private isUserContext(obj: any): obj is OptimizelyUserContext {
		return obj && typeof obj === 'object' && 'userId' in obj && typeof obj.userId === 'string';
	}

	/**
	 * Legacy array-based cookie implementation
	 * @param config - Configuration options
	 * @param decisions - Decisions in array format
	 * @param responseHeaders - Existing response headers to augment
	 */
	private addCookiesArrayFormat(
		config: Record<string, any>,
		decisions: Record<string, OptimizelyDecision[]>,
		responseHeaders: Record<string, string>
	): void {
		// This method is kept for backwards compatibility but is no longer used
		// due to the normalized decision format in createResponseHeaders
		// which ensures consistent formats are used for both headers and cookies
		this.logger.debug(`${this.logPrefix} addCookiesArrayFormat called but is deprecated`);
	}

	// Helper method to generate a UUID for new visitor IDs
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * Adds custom headers specified in the configuration.
	 * @param config - Configuration options
	 * @param responseHeaders - Existing response headers to augment
	 */
	private addCustomHeadersFromConfig(
		config: Record<string, any>,
		responseHeaders: Record<string, string>
	): void {
		// Skip if response headers are disabled
		if (config.responseHeadersAndCookies === false) {
			this.logger.debug(`${this.logPrefix} Skipping custom headers (responseHeadersAndCookies is false)`);
			return;
		}

		// Check if there are custom headers to add
		if (!config.customResponseHeaders || typeof config.customResponseHeaders !== 'object') {
			this.logger.debug(`${this.logPrefix} No custom headers defined in config`);
			return;
		}

		this.logger.debug(`${this.logPrefix} Adding custom headers from config`);

		try {
			// Iterate through custom headers and add them to the response
			const customHeaders = config.customResponseHeaders;
			const customHeaderKeys = Object.keys(customHeaders);

			if (customHeaderKeys.length === 0) {
				this.logger.debug(`${this.logPrefix} Custom headers object is empty`);
				return;
			}

			// Add each custom header to the response
			for (const headerName of customHeaderKeys) {
				const headerValue = customHeaders[headerName];
				
				// Skip null/undefined values
				if (headerValue === null || headerValue === undefined) {
					this.logger.debug(`${this.logPrefix} Skipping null/undefined header value for "${headerName}"`);
					continue;
				}

				// Convert to string if needed
				const finalHeaderValue = typeof headerValue === 'string' ? 
					headerValue : JSON.stringify(headerValue);
				
				// Add the header
				responseHeaders[headerName] = finalHeaderValue;
				this.logger.debug(`${this.logPrefix} Added custom header: ${headerName}`);
			}

			this.logger.debug(`${this.logPrefix} Added ${customHeaderKeys.length} custom header(s) to response`);
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error adding custom headers:`, error);
		}
	}

	/**
	 * Creates response headers based on user context, decisions, and configuration.
	 * @param userContext - The user context
	 * @param decisions - Decisions used for header generation
	 * @param config - Configuration options
	 * @returns Response headers
	 */
	private createResponseHeaders(
		userContext: OptimizelyUserContext,
		decisions: Record<string, OptimizelyDecision>,
		config: Record<string, any>
	): Record<string, string> {
		// CRITICAL FIX: Normalize config flags for consistent behavior using correct property names
		// Ensure cookies and headers settings are consistent - if one is true, the other should be too
		if (config.setResponseCookies === true && config.setResponseHeaders !== true) {
			config.setResponseHeaders = true;
		}
		
		this.logger.info(
			`${this.logPrefix} Creating response headers - flags: setResponseHeaders=${config.setResponseHeaders}, ` +
			`setResponseCookies=${config.setResponseCookies}, decisionsCount=${Object.keys(decisions).length}`
		);
		
		// Create base headers
		const responseHeaders: Record<string, string> = {};

		// Always try to add decision headers (method has internal safeguards based on config)
		try {
			this.addDecisionHeadersToResponse(decisions, config, responseHeaders);
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error adding decision headers to response:`, error);
		}

		// Add custom headers from config if enabled
		try {
			this.addCustomHeadersFromConfig(config, responseHeaders);
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error adding custom headers to response:`, error);
		}

		// Add cookies if enabled (method has internal safeguards based on config)
		try {
			// Ensure exact same decisions object is passed to cookie method
			this.addCookiesToResponse(userContext, decisions, config, responseHeaders);
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error adding cookies to response:`, error);
		}

		// Add a debug header to show which headers were enabled
		responseHeaders['X-Optimizely-Headers-Debug'] = JSON.stringify({
			configFlags: {
				setResponseHeaders: config.setResponseHeaders,
				setResponseCookies: config.setResponseCookies
			},
			decisionsCount: Object.keys(decisions).length
		});

		return responseHeaders;
	}

	/**
	 * Triggers flag storage cleanup based on usage patterns and configuration.
	 * This uses a probabilistic approach to avoid excessive cleanup calls.
	 * @param sdkKey - The SDK key for cleanup scope.
	 * @param forceCheck - Force cleanup eligibility check regardless of time interval.
	 * @private
	 */
	private triggerCleanupIfNeeded(sdkKey?: string, forceCheck: boolean = false): void {
		// Skip if flag storage is not available or request triggering is disabled
		if (!this.flagStorage || (!forceCheck && !this.requestTriggeringEnabled)) {
			return;
		}

		const now = Date.now();

		// Check if enough time has passed since last cleanup
		if (!forceCheck && now - this.lastCleanupTime < this.cleanupTriggerInterval) {
			return;
		}

		// Only run cleanup based on configured probability to avoid performance impact
		// Unless forceCheck is true
		if (!forceCheck && Math.random() > this.cleanupTriggerProbability) {
			return;
		}

		this.lastCleanupTime = now;

		// Run cleanup asynchronously to not block request processing
		Promise.resolve().then(async () => {
			try {
				const cleanedCount = await this.flagStorage!.performCleanup(sdkKey);
				if (cleanedCount > 0) {
					this.logger.debug(`${this.logPrefix} Triggered cleanup removed ${cleanedCount} expired entries`);
				}
			} catch (error) {
				// Only log error, don't let it affect request processing
				this.logger.error(`${this.logPrefix} Error during triggered cleanup:`, error);
			}
		});
	}
}
