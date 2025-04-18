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
		this.logger.info(`[${this.logPrefix}] Initialized services`, {
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
		this.logger.info('Initialized with required and optional services', {
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
			this.logger.info(`${this.logPrefix} RequestHandler: Initialized with metrics tracking enabled.`);
		}

		if (this.edgeModeIntegration) {
			this.logger.info(`${this.logPrefix} RequestHandler: Initialized with Edge Mode integration.`);
		}

		if (this.flagStorage) {
			this.logger.info(`${this.logPrefix} RequestHandler: Initialized with Flag Storage integration.`);
			if (this.requestTriggeringEnabled) {
				this.logger.info(
					`${this.logPrefix} RequestHandler: Automatic cleanup triggering enabled (interval: ${
						this.cleanupTriggerInterval
					}ms, probability: ${this.cleanupTriggerProbability * 100}%)`
				);
			}
		}

		if (this.apiRouter) {
			this.logger.info(`${this.logPrefix} RequestHandler: Initialized with API Router integration.`);
		}

		this.logger.info(`${this.logPrefix} RequestHandler initialized`);
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

		this.logger.info(
			`${this.logPrefix} RequestHandler: Handling ${method} request ${requestId} for URL: ${url.toString()}`
		);

		try {
			// Special case for pixel tracking - handle both GET and POST
			if (path.endsWith('/track.gif')) {
				const result = await this.handlePixelTrackingRequest(requestAdapter, requestId);

				// Try to trigger cleanup after processing
				this.triggerCleanupIfNeeded();

				return result;
			}

			// Check if this is an API request
			if (path.startsWith('/api/')) {
				this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Detected API request for path: ${path}`);

				// For the SDK endpoint, return SDK info directly (keep this for backward compatibility)
				if (path === '/api/sdk') {
					return {
						status: 200,
						body: JSON.stringify({
							name: 'optimizely-edge-agent',
							version: 'v2',
							environment: 'test',
							cdnProvider: 'cloudflare',
						}),
						headers: {
							'Content-Type': 'application/json',
							'X-Implementation-Version': 'v2',
							'X-Request-ID': requestId,
						},
					};
				}

				// If ApiRouter is available, delegate to it
				if (this.apiRouter) {
					this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Delegating API request to ApiRouter`);

					try {
						// Call ApiRouter and return its result
						const result = await this.apiRouter.routeApiRequest(requestAdapter);

						// Ensure the request ID is included in the response headers
						if (!result.headers) {
							result.headers = {};
						}
						result.headers['X-Request-ID'] = requestId;

						return result;
					} catch (error) {
						this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error calling ApiRouter`, error);

						// Track API error
						this.metrics?.incrementCounter('api_errors_total', 1, {
							path,
							method,
							error_type: error instanceof Error ? error.name : 'unknown',
						});

						// Return error response
						return {
							status: 500,
							body: JSON.stringify({
								error: 'API request handling error',
								message: error instanceof Error ? error.message : 'Unknown error',
								path: path,
							}),
							headers: {
								'Content-Type': 'application/json',
								'X-Implementation-Version': 'v2',
								'X-Request-ID': requestId,
							},
						};
					}
				} else {
					// ApiRouter not available, return a more helpful message
					this.logger.warn(`${this.logPrefix} RequestHandler [${requestId}]: ApiRouter not available for API request`);

					return {
						status: 501,
						body: JSON.stringify({
							error: 'API Router not configured in RequestHandler',
							path: path,
							message:
								'The server is not configured to handle API requests. ApiRouter is missing from RequestHandler initialization.',
						}),
						headers: {
							'Content-Type': 'application/json',
							'X-Implementation-Version': 'v2',
							'X-Request-ID': requestId,
						},
					};
				}
			}

			// Extract User Context for non-API requests
			const userId = await this.getVisitorId(requestAdapter);
			const userContext: OptimizelyUserContext = {
				userId,
				attributes: await this.extractAttributes(requestAdapter),
			};

			this.logger.debug(`${this.logPrefix} RequestHandler [${requestId}]: User context created`, userContext);

			let result: ResponseResult;

			if (method === 'POST') {
				// Agent Mode (POST requests) - Acts as a serverless API endpoint
				result = await this.handleAgentModeRequest(requestAdapter, requestId, userContext);
				this.metrics?.incrementCounter('agent_mode_requests', 1);
			} else if (method === 'GET') {
				// Edge Mode (GET requests) - Matches URLs and serves variations
				result = await this.handleEdgeModeRequest(requestAdapter, requestId, userContext);
				this.metrics?.incrementCounter('edge_mode_requests', 1);
			} else {
				// Handle unsupported methods
				result = this.createErrorResponse(requestId, 405, 'Method Not Allowed');
				this.metrics?.incrementCounter('unsupported_method_requests', 1, { method });
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
			result.headers['X-Implementation-Version'] = 'v2';
			result.headers['X-Request-ID'] = requestId;

			// Stop request timer
			if (requestTimer) {
				requestTimer.stop();
			}

			// After processing the request, trigger cleanup if needed
			// Extract sdkKey from request config if available
			let sdkKey: string | undefined;
			try {
				const config = await this.getRequestConfig(requestAdapter);
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
			errorResponse.headers['X-Implementation-Version'] = 'v2';
			errorResponse.headers['X-Request-ID'] = requestId;

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
			this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Processing pixel tracking request`);

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
			const userContext: OptimizelyUserContext = {
				userId,
				attributes: requestBody.attributes || (await this.extractAttributes(requestAdapter)),
			};

			// Create and track the event
			const event: ExtendedEventData = {
				type: 'conversion',
				eventKey,
				timestamp: Date.now(),
				uuid: uuidv4(),
				userContext,
				attributes: requestBody.attributes || {},
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
					'X-Implementation-Version': 'v2',
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
					'X-Implementation-Version': 'v2',
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

				// Return the decision with proper headers and cookies
				return this.createJsonResponse(requestId, 200, decision, userContext, decisions, config);
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

				// Return the decisions with proper headers and cookies
				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Decide-all decisions`,
					JSON.stringify(decisions)
				);
				return this.createJsonResponse(requestId, 200, decisions, userContext, decisions, config);
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

				// Return the decisions with proper headers and cookies
				this.logger.info(
					`${this.logPrefix} RequestHandler [${requestId}]: Decide-for-keys decisions`,
					JSON.stringify(decisions)
				);
				return this.createJsonResponse(requestId, 200, decisions, userContext, decisions, config);
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
	 * Handles Edge Mode (GET) requests by matching URLs and serving variations.
	 * Enhanced to support all cdnVariationSettings properties.
	 * @param requestAdapter - The request adapter.
	 * @param requestId - The unique request ID.
	 * @param userContext - The user context for decisions.
	 * @returns A promise resolving to the ResponseResult.
	 */
	private async handleEdgeModeRequest(
		requestAdapter: IRequestAdapter,
		requestId: string,
		userContext: OptimizelyUserContext
	): Promise<ResponseResult> {
		const methodTimer = this.metrics?.startTimer('edge_mode_duration');
		this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Processing Edge Mode (GET) request`);

		try {
			// If Edge Mode Integration is available, use it
			if (this.edgeModeIntegration) {
				this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: Using Edge Mode Integration service`);
				try {
					const response = await this.edgeModeIntegration.processEdgeModeRequest(
						requestAdapter,
						userContext,
						requestId
					);

					// Convert the Response to ResponseResult
					const responseResult: ResponseResult = {
						status: response.status,
						body: await response.text(),
						headers: {},
					};

					// Copy headers from Response to ResponseResult
					response.headers.forEach((value, key) => {
						responseResult.headers[key] = value;
					});

					// Log success
					this.logger.info(
						`${this.logPrefix} RequestHandler [${requestId}]: Edge Mode Integration processed request successfully`
					);

					if (methodTimer) methodTimer.stop();
					return responseResult;
				} catch (error) {
					this.logger.error(
						`${this.logPrefix} RequestHandler [${requestId}]: Error in Edge Mode Integration, falling back to legacy implementation`,
						error
					);
					// Continue with legacy implementation as fallback
				}
			}

			// Legacy Edge Mode implementation
			const requestUrl = requestAdapter.getUrl();

			// Get all flags for the user
			const decisionTimer = this.metrics?.startTimer('batch_decision_duration');
			const allDecisions = (await this.decisionService.decideAll?.(userContext)) || {};
			if (decisionTimer) decisionTimer.stop();

			this.metrics?.recordHistogram('edge_mode_decisions_count', Object.keys(allDecisions).length);

			// Track decision processing time
			const matchingTimer = this.metrics?.startTimer('url_matching_duration');
			// Extract cdnVariationSettings from decisions
			const matchingConfig = await this.findMatchingConfig(requestUrl.toString(), allDecisions);
			if (matchingTimer) matchingTimer.stop();

			if (!matchingConfig) {
				this.logger.info(`${this.logPrefix} RequestHandler [${requestId}]: No matching experiment URL found`);
				this.metrics?.incrementCounter('edge_mode_url_match', 1, { match: 'false' });
				// No matching experiment, forward to origin
				return this.createForwardResponse(requestAdapter, requestId, userContext, null);
			}

			this.metrics?.incrementCounter('edge_mode_url_match', 1, { match: 'true' });
			this.logger.debug(
				`${this.logPrefix} RequestHandler [${requestId}]: Found matching configuration`,
				matchingConfig
			);

			// Use the parsedSettings for boolean values to avoid string comparison
			const { flagKey, variationKey, cdnResponseURL } = matchingConfig;

			// Get the typed boolean values
			const { forwardRequestToOrigin, cacheRequestToOrigin, isControlVariation, requireAuth, cacheTTL } =
				matchingConfig.parsedSettings;

			// Track the matched flag
			this.metrics?.incrementCounter('flag_matched', 1, {
				flag_key: flagKey,
				variation_key: variationKey || 'unknown',
				is_control: isControlVariation ? 'true' : 'false',
			});

			// Check authentication if required
			if (requireAuth) {
				// Get the auth header
				const authHeader = requestAdapter.getHeader('authorization');
				if (!authHeader) {
					this.logger.warn(
						`${this.logPrefix} RequestHandler [${requestId}]: Authentication required but no auth header present`
					);
					return this.createErrorResponse(requestId, 401, 'Authentication required');
				}

				// Check for allowed roles if specified
				if (matchingConfig.allowedRoles) {
					const allowedRoles = matchingConfig.allowedRoles.split(',').map((role: string) => role.trim());

					// In a real implementation, extract roles from auth token and check
					// For now, just log the required roles
					this.logger.debug(
						`${this.logPrefix} RequestHandler [${requestId}]: Role check required for: ${allowedRoles.join(', ')}`
					);

					// Mock role validation (future enhancement point)
					if (authHeader && allowedRoles.length > 0) {
						this.logger.debug(
							`${this.logPrefix} RequestHandler [${requestId}]: Auth header present, proceeding with role validation`
						);
						// Role validation would happen here
					}
				}
			}

			// Make specific decision to ensure proper tracking
			const trackingTimer = this.metrics?.startTimer('tracking_decision_duration');
			const decision = await this.decisionService.decide(flagKey, userContext);
			if (trackingTimer) trackingTimer.stop();

			// Dispatch impression event
			const eventTimer = this.metrics?.startTimer('impression_event_duration');
			const impressionEvent: OptimizelyEventData = {
				type: 'impression',
				timestamp: Date.now(),
				uuid: uuidv4(),
				userContext: userContext,
				flagKey: flagKey,
				variationKey: variationKey,
			};
			await this.eventService.trackEvent(impressionEvent);
			if (eventTimer) eventTimer.stop();

			this.metrics?.incrementCounter('events_tracked', 1, {
				event_type: 'impression',
				flag_key: flagKey,
			});

			// Determine if we need to forward to origin or serve directly
			let result: ResponseResult;
			if (forwardRequestToOrigin) {
				const forwardTimer = this.metrics?.startTimer('forward_response_duration');
				result = await this.createForwardResponse(requestAdapter, requestId, userContext, matchingConfig);
				if (forwardTimer) forwardTimer.stop();

				this.metrics?.incrementCounter('edge_mode_response_type', 1, { type: 'forward' });
			} else {
				// Serve content directly
				const contentTimer = this.metrics?.startTimer('content_response_duration');
				result = await this.createContentResponse(requestAdapter, requestId, userContext, matchingConfig);
				if (contentTimer) contentTimer.stop();

				this.metrics?.incrementCounter('edge_mode_response_type', 1, { type: 'direct' });
			}

			// Apply any custom headers if specified
			if (matchingConfig.responseHeaders) {
				try {
					const customHeaders = JSON.parse(matchingConfig.responseHeaders);
					if (typeof customHeaders === 'object' && customHeaders !== null) {
						Object.entries(customHeaders).forEach(([name, value]) => {
							if (typeof value === 'string') {
								result.headers[name] = value;
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

			// Apply any content transformation if specified
			if (matchingConfig.transformContent && typeof result.body === 'string') {
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

			if (methodTimer) methodTimer.stop();
			return result;
		} catch (error) {
			this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error in Edge Mode handler`, error);

			// Track error
			this.metrics?.incrementCounter('edge_mode_errors', 1, {
				error_type: error instanceof Error ? error.name : 'unknown',
			});

			if (methodTimer) methodTimer.stop();
			return this.createErrorResponse(requestId, 500, 'Error processing edge mode request');
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
	 * Extracts attributes from the request.
	 * @param requestAdapter - The request adapter.
	 * @returns A promise resolving to attributes object.
	 */
	private async extractAttributes(requestAdapter: IRequestAdapter): Promise<Record<string, any>> {
		const attributes: Record<string, any> = {};

		// Extract attributes from headers
		const userAttributesHeader = requestAdapter.getHeader('x-user-attributes');
		if (userAttributesHeader) {
			try {
				const headerAttributes = JSON.parse(userAttributesHeader);
				Object.assign(attributes, headerAttributes);
			} catch (error) {
				this.logger.warn('Failed to parse x-user-attributes header as JSON', error);
			}
		}

		// Extract attributes from query parameters
		const url = requestAdapter.getUrl();
		const attributesParam = url.searchParams.get('attributes');
		if (attributesParam) {
			try {
				const queryAttributes = JSON.parse(attributesParam);
				this.mergeAttributes(attributes, queryAttributes);
			} catch (error) {
				this.logger.warn('Failed to parse attributes query parameter as JSON', error);
			}
		}

		// For POST requests, extract attributes from body
		if (requestAdapter.getMethod() === 'POST') {
			try {
				const body = await requestAdapter.getBodyJson<{ attributes?: Record<string, unknown> }>();
				if (body.attributes) {
					this.mergeAttributes(attributes, body.attributes);
				}
			} catch (error) {
				// Ignore body parsing errors
				this.logger.debug('No valid JSON body or no attributes in body', error);
			}
		}

		return attributes;
	}

	/**
	 * Merges attributes from different sources with proper handling of array attributes.
	 * @param target - The target attributes object to merge into.
	 * @param source - The source attributes to merge from.
	 */
	private mergeAttributes(target: Record<string, any>, source: Record<string, any>): void {
		if (!source || typeof source !== 'object') {
			return;
		}

		for (const [key, value] of Object.entries(source)) {
			// Special handling for array values
			if (Array.isArray(value)) {
				// If target already has this key as an array, concatenate the arrays
				if (Array.isArray(target[key])) {
					target[key] = [...target[key], ...value];
				} else if (target[key] === undefined) {
					// If key doesn't exist in target yet, just assign the array
					target[key] = [...value];
				} else {
					// If target has this key as a non-array, convert to array and append new values
					target[key] = [target[key], ...value];
				}
			} else if (value !== null && typeof value === 'object') {
				// For nested objects, recursively merge
				if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
					target[key] = {};
				}
				this.mergeAttributes(target[key], value);
			} else {
				// For primitive values, use header/query param precedence as per documentation
				// Headers have highest precedence, already applied first, so only overwrite if not set
				if (target[key] === undefined) {
					target[key] = value;
				}
			}
		}
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
		if (headers.has('X-Optimizely-User-Id') && !config.userId) {
			config.userId = headers.get('X-Optimizely-User-Id');
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
	 * Creates a JSON response with properly formatted headers.
	 * Enhanced to use the comprehensive header management.
	 * @param requestId - The request ID.
	 * @param status - The HTTP status code.
	 * @param body - The response body.
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

		// Always include basic request tracking headers
		const baseHeaders: Record<string, string> = {
			'X-Request-ID': requestId,
			'X-Implementation-Version': 'v2',
		};

		// Merge with dynamically generated headers from our comprehensive header management
		const responseHeaders = {
			...baseHeaders,
			...this.createResponseHeaders(effectiveUserContext, effectiveDecisions, effectiveConfig),
		};

		return {
			status,
			headers: responseHeaders,
			body: JSON.stringify(body),
		};
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
						responseHeaders['X-Implementation-Version'] = 'v2';
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
				responseHeaders['X-Implementation-Version'] = 'v2';
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
				responseHeaders['X-Implementation-Version'] = 'v2';
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
		// Skip if return decisions is disabled or headers are disabled
		if (config.returnDecisions === false || config.responseHeadersAndCookies === false) {
			this.logger.debug(
				`${this.logPrefix} Skipping decision headers (returnDecisions or responseHeadersAndCookies is false)`
			);
			return;
		}

		// Log config and decisions for debugging
		this.logger.debug(`${this.logPrefix} Adding decision headers with config: ${JSON.stringify(config)}`);
		this.logger.debug(`${this.logPrefix} SDK Key in config: '${config.sdkKey}'`);
		this.logger.debug(`${this.logPrefix} Type of SDK Key: ${typeof config.sdkKey}`);
		this.logger.debug(`${this.logPrefix} Decisions to add: ${Object.keys(decisions).join(', ')}`);

		// Check for header configuration - if headers config is present, use it to control which headers to include
		const headerConfig = config.headers || {
			decisions: true,
			variations: true,
			experiments: true,
			'visitor-id': true,
			'sdk-key': true,
			'powered-by': true,
		};

		// Add Powered-By header if enabled
		if (headerConfig['powered-by'] !== false) {
			responseHeaders['X-Powered-By'] = 'Optimizely Edge';
			this.logger.debug(`${this.logPrefix} Added X-Powered-By header: 'Optimizely Edge'`);
		}

		// Add SDK Key header if enabled and available
		if (headerConfig['sdk-key'] !== false) {
			// Log diagnostic information about the SDK key
			this.logger.debug(`${this.logPrefix} SDK Key header enabled: ${headerConfig['sdk-key'] !== false}`);
			this.logger.debug(`${this.logPrefix} SDK Key in config: '${config.sdkKey}'`);

			if (config.sdkKey !== undefined && config.sdkKey !== null) {
				// Ensure SDK key is a valid string
				const sdkKeyValue = String(config.sdkKey).trim();
				this.logger.debug(`${this.logPrefix} SDK Key after trim: '${sdkKeyValue}'`);

				if (sdkKeyValue) {
					responseHeaders['X-Optimizely-SDK-Key'] = sdkKeyValue;
					this.logger.debug(`${this.logPrefix} Added X-Optimizely-SDK-Key header: '${sdkKeyValue}'`);
				} else {
					this.logger.warn(`${this.logPrefix} SDK Key was empty after trimming, not adding to response headers`);
				}
			} else {
				this.logger.debug(
					`${this.logPrefix} No SDK Key available in config (${typeof config.sdkKey}), not adding to response headers`
				);
			}
		} else {
			this.logger.debug(`${this.logPrefix} SDK Key header disabled in headerConfig`);
		}

		// Add Visitor ID header if enabled and available
		if (headerConfig['visitor-id'] !== false && config.userId !== undefined && config.userId !== null) {
			const visitorIdValue = String(config.userId).trim();
			if (visitorIdValue) {
				responseHeaders['X-Optimizely-Visitor-Id'] = visitorIdValue;
				this.logger.debug(`${this.logPrefix} Added X-Optimizely-Visitor-Id header: '${visitorIdValue}'`);
			} else {
				this.logger.debug(`${this.logPrefix} Visitor ID was empty after trimming, not adding to response headers`);
			}
		}

		// Add individual decision/variation/experiment headers
		for (const [flagKey, decision] of Object.entries(decisions)) {
			// Add variation header if available and enabled
			if (decision.variationKey && headerConfig['variations'] !== false) {
				responseHeaders[`X-Optimizely-Variation-${flagKey}`] = decision.variationKey;
				this.logger.debug(`${this.logPrefix} Added variation header for ${flagKey}: '${decision.variationKey}'`);
			}

			// Add experiment header if available and enabled
			if (decision.experimentKey && headerConfig['experiments'] !== false) {
				responseHeaders[`X-Optimizely-Experiment-${flagKey}`] = decision.experimentKey;
				this.logger.debug(`${this.logPrefix} Added experiment header for ${flagKey}: '${decision.experimentKey}'`);
			}
		}

		// Add full decisions header if we have decisions and it's enabled
		if (Object.keys(decisions).length > 0 && headerConfig['decisions'] !== false) {
			const decisionsToEncode = config.trimmedDecisions ? this.createTrimmedDecisions(decisions) : decisions;

			try {
				// Just stringify the decisions for the header - no base64 encoding
				const decisionsJson = JSON.stringify(decisionsToEncode);
				responseHeaders['X-Optimizely-Decision'] = decisionsJson;
				this.logger.debug(
					`${this.logPrefix} Added X-Optimizely-Decision header with ${Object.keys(decisionsToEncode).length} decisions`
				);
			} catch (error) {
				this.logger.error(`${this.logPrefix} Error encoding decisions for header:`, error);
			}
		}

		// Add cache control headers
		this.addCacheControlHeaders(config, responseHeaders);

		// Log final headers
		this.logger.debug(`${this.logPrefix} Final response headers: ${Object.keys(responseHeaders).join(', ')}`);
	}

	/**
	 * Creates trimmed decision objects for more compact headers
	 * @param decisions Full decision objects
	 * @returns Trimmed decision objects with only essential fields
	 */
	private createTrimmedDecisions(decisions: Record<string, OptimizelyDecision>): Record<string, any> {
		const trimmed: Record<string, any> = {};

		for (const [flagKey, decision] of Object.entries(decisions)) {
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
	 * Adds cache control headers to the response.
	 * Enhanced to match original implementation.
	 * @param config - Configuration options
	 * @param responseHeaders - Existing response headers to augment
	 */
	private addCacheControlHeaders(config: Record<string, any>, responseHeaders: Record<string, string>): void {
		// Skip if cache control is not configured
		if (!config.cacheControl) {
			return;
		}

		// Add custom cache control headers if configured
		if (config.cacheControl.headers) {
			Object.entries(config.cacheControl.headers).forEach(([headerName, value]) => {
				responseHeaders[headerName] = value as string;
			});
		}

		// Add standard CF cache control headers based on configuration
		if (config.cacheControl.default) {
			// Set Cache-Control header if not already set
			if (!responseHeaders['Cache-Control'] && config.cacheControl.default.browserTTL !== undefined) {
				const browserTTL = config.cacheControl.default.browserTTL;
				responseHeaders['Cache-Control'] = browserTTL > 0 ? `max-age=${browserTTL}` : 'no-store';
			}

			// Set CF-specific cache headers
			if (config.cacheControl.default.edgeTTL !== undefined) {
				responseHeaders['CDN-Cache-Control'] = `max-age=${config.cacheControl.default.edgeTTL}`;
			}

			// Set bypass cache header if configured
			if (config.cacheControl.default.bypassCache === true) {
				responseHeaders['CF-Cache-Status'] = 'BYPASS';
			}
		}
	}

	/**
	 * Gets all decisions for a user context
	 * @param userContext - The user context
	 * @returns Record of decisions for all applicable flags
	 */
	private async getAllDecisions(userContext: OptimizelyUserContext): Promise<Record<string, OptimizelyDecision>> {
		try {
			// If we have a decision service, get all decisions
			if (this.decisionService) {
				return await this.decisionService.getAllDecisions(userContext.userId, userContext.attributes);
			}
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error getting all decisions:`, error);
		}

		// Return empty object if we can't get decisions
		return {};
	}

	/**
	 * Creates response with appropriate cookies and headers.
	 * Enhanced to match original implementation's cookie handling.
	 * @param userContext - The user context
	 * @param decisions - The decision objects
	 * @param config - Configuration options
	 * @param responseHeaders - Existing response headers to augment
	 */
	// In RequestHandler.ts, modify the addCookiesToResponse method:
	private addCookiesToResponse(
		userContext: OptimizelyUserContext,
		decisions: Record<string, OptimizelyDecision>,
		config: Record<string, any>,
		responseHeaders: Record<string, string>
	): void {
		// Skip if cookies are disabled or cookie service not available
		if (config.responseCookies === false || !this.cookieService) {
			return;
		}

		const cookies = [];

		// Apply cookie configuration from request config
		const cookieOptions: Record<string, any> = {
			cookieDomain: config.cookieDomain || undefined,
			secure: config.secureCookies === true,
			path: config.cookiePath || '/',
		};

		// Add visitor ID cookie
		if (userContext.userId) {
			const visitorIdCookieOptions = {
				...cookieOptions,
				cookieName: config.visitorIdCookieName || 'optly_edge_visitor_id',
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
				cookieName: config.decisionsCookieName || 'optly_edge_decisions',
				ttl: config.decisionsCookieTTL || 600, // 10 minutes default
			};

			// Create trimmed decisions for the cookie to reduce size
			const trimmedDecisions = this.createTrimmedDecisions(decisions);

			const decisionsCookie = this.cookieService.createDecisionsCookie(
				trimmedDecisions, // Use trimmed version instead of full decisions
				this.cookieService.applyCookieOptionsFromConfig(decisionsCookieOptions, config)
			);
			cookies.push(decisionsCookie);
		}

		// Set the cookies in the response headers
		if (cookies.length > 0) {
			const cookieHeaders = this.cookieService.createSetCookieHeaders(cookies);
			responseHeaders['Set-Cookie'] = cookieHeaders.join('\n');
		}
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
	private addCustomHeadersFromConfig(config: Record<string, any>, responseHeaders: Record<string, string>): void {
		// Skip if custom headers are not configured or headers are disabled
		if (!config.customHeaders || config.responseHeadersAndCookies === false) {
			return;
		}

		// Add all custom headers from config
		Object.entries(config.customHeaders).forEach(([headerName, value]) => {
			// Skip if the value is null or undefined
			if (value === null || value === undefined) {
				return;
			}

			// If the value is an object or array, stringify it
			const headerValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

			responseHeaders[headerName] = headerValue;
		});
	}

	/**
	 * Creates response headers from configuration, decisions, and userContext.
	 * Enhanced to match original implementation.
	 * @param userContext - The user context
	 * @param decisions - The decision objects
	 * @param config - Configuration options
	 * @returns The response headers
	 */
	private createResponseHeaders(
		userContext: OptimizelyUserContext,
		decisions: Record<string, OptimizelyDecision>,
		config: Record<string, any>
	): Record<string, string> {
		try {
			this.logger.debug(`${this.logPrefix} Creating response headers for user ${userContext?.userId}`);
			this.logger.debug(
				`${this.logPrefix} Configuration for headers: ${JSON.stringify({
					sdkKey: config.sdkKey,
					userId: config.userId,
					trimmedDecisions: config.trimmedDecisions,
					responseHeadersAndCookies: config.responseHeadersAndCookies,
				})}`
			);

			// Initialize headers with standard values
			const responseHeaders: Record<string, string> = {
				'X-Optimizely-Edge-Agent': 'v2',
			};

			// Set content type if not explicitly disabled
			if (config.includeContentType !== false) {
				responseHeaders['Content-Type'] = 'application/json';
			}

			// Add standard decision-related headers with error handling
			try {
				this.logger.debug(`${this.logPrefix} Adding decision headers to response`);
				this.addDecisionHeadersToResponse(decisions, config, responseHeaders);
			} catch (error) {
				this.logger.error(`${this.logPrefix} Error adding decision headers:`, error);
			}

			// Add custom headers from config with error handling
			try {
				this.logger.debug(`${this.logPrefix} Adding custom headers to response`);
				this.addCustomHeadersFromConfig(config, responseHeaders);
			} catch (error) {
				this.logger.error(`${this.logPrefix} Error adding custom headers:`, error);
			}

			// Add cookies to response headers with error handling
			try {
				this.logger.debug(`${this.logPrefix} Adding cookies to response`);
				this.addCookiesToResponse(userContext, decisions, config, responseHeaders);
			} catch (error) {
				this.logger.error(`${this.logPrefix} Error adding cookies to response:`, error);
			}

			// Final validation pass to ensure all header values are strings
			const headersBefore = { ...responseHeaders };
			Object.keys(responseHeaders).forEach((key) => {
				const value = responseHeaders[key];
				if (value === undefined || value === null) {
					this.logger.warn(`${this.logPrefix} Header '${key}' has undefined/null value, removing`);
					delete responseHeaders[key];
				} else if (typeof value !== 'string') {
					try {
						this.logger.warn(
							`${this.logPrefix} Header '${key}' has non-string value (${typeof value}), converting to string`
						);
						responseHeaders[key] = String(value);
					} catch (e) {
						this.logger.error(`${this.logPrefix} Invalid header value for ${key}, removing header: ${e}`);
						delete responseHeaders[key];
					}
				}
			});

			// Log headers that were changed during validation
			for (const key of Object.keys(headersBefore)) {
				if (headersBefore[key] !== responseHeaders[key]) {
					this.logger.debug(
						`${this.logPrefix} Header '${key}' changed during validation from '${headersBefore[key]}' to '${responseHeaders[key]}'`
					);
				}
			}

			this.logger.debug(`${this.logPrefix} Final response headers: ${JSON.stringify(responseHeaders)}`);
			return responseHeaders;
		} catch (error) {
			// Return minimal safe headers if there's an unexpected error
			this.logger.error(`${this.logPrefix} Critical error creating response headers:`, error);
			return {
				'X-Optimizely-Edge-Agent': 'v2',
				'Content-Type': 'application/json',
			};
		}
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
