import {
	IConfigurationService,
	OptimizelyConfigOptions,
	ServiceConfigSettings,
	ConfigMetadata,
	ValidationResult,
	ValidationRule,
	ValidationIssue,
	ValidationIssueType,
	ValidationSeverity,
} from '../interfaces/IConfigurationService';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IDatafileService } from '../interfaces/IDatafileService';

/**
 * Implementation of IConfigurationService that extracts and prioritizes configuration settings
 * from headers, query parameters, and request body.
 *
 * This implementation follows the precedence rules from the original implementation:
 * Headers > Query Parameters > Request Body > Default Values
 */
export class ConfigurationService implements IConfigurationService {
	private config: OptimizelyConfigOptions = {};
	private metadata: ConfigMetadata;
	private logger: ILoggerAdapter;
	private settings: ServiceConfigSettings;
	private readonly logPrefix = '[v2][ConfigurationService]';
	private isInitialized: boolean = false;
	private datafileService: IDatafileService;
	private cachedVersion: string | null = null;
	private cachedEnvironment: string | null = null;
	private cachedCdnProvider: string | null = null;
	private cachedAdminToken: string | null = null;

	// === v1 Compatibility Properties ===
	/**
	 * Configured header name for user attributes
	 */
	private attributesHeaderName?: string;
	/**
	 * Configured header name for event tags
	 */
	private eventTagsHeaderName?: string;
	/**
	 * Configured header name for event key
	 */
	private eventKeyHeaderName?: string;
	/**
	 * Whether Feature Experimentation (FEX) is enabled
	 */
	private enableFex: boolean = false;
	/**
	 * Whether cache override is enabled
	 */
	private overrideCache: boolean = false;
	/**
	 * Whether response metadata should be included
	 */
	private enableResponseMetadata: boolean = true;
	/**
	 * Whether debug headers should be included in responses
	 */
	private enableDebugHeaders: boolean = false;
	/**
	 * Whether flags should be loaded from KV storage
	 */
	private enableFlagsFromKV: boolean = false;
	/**
	 * Whether datafile should be loaded from KV storage
	 */
	private enableDatafileFromKV: boolean = false;

	/**
	 * Configurable cookie/header names for header/cookie parity (v1/v2).
	 */
	private decisionsCookieName: string = 'optly_edge_decisions';
	private visitorIdCookieName: string = 'optly_edge_visitor_id';
	private decisionsHeaderName: string = 'X-Optimizely-Edge-Decisions';
	private visitorIdHeaderName: string = 'X-Optimizely-Edge-Visitor-Id';

	/**
	 * Creates a new instance of ConfigurationService.
	 * @param datafileService - Service for managing datafiles.
	 * @param logger - The logger adapter.
	 */
	constructor(datafileService: IDatafileService, logger: ILoggerAdapter) {
		if (!datafileService || !logger) {
			throw new Error('ConfigurationService requires datafileService and logger.');
		}
		this.datafileService = datafileService;
		this.logger = logger;
		this.metadata = this.initializeConfigMetadata();
		this.settings = this.initializeSettings();
		this.logger.info(`${this.logPrefix} Initialized with default settings`);
		// Initialize v1 compatibility properties with defaults
		this.attributesHeaderName = undefined;
		this.eventTagsHeaderName = undefined;
		this.eventKeyHeaderName = undefined;
		this.enableFex = false;
		this.overrideCache = false;
		this.enableResponseMetadata = true;
		this.enableFlagsFromKV = false;
		this.enableDatafileFromKV = false;
	}

	/**
	 * Initializes configuration from a request adapter.
	 * @param request - The request adapter.
	 * @returns A promise resolving to the configuration options.
	 */
	async initialize(request: IRequestAdapter): Promise<OptimizelyConfigOptions> {
		this.logger.debug(`${this.logPrefix} Initializing configuration from request`);

		// Reset config for new request
		this.config = {};
		this.metadata = this.initializeConfigMetadata();

		// Initialize configuration from different sources with proper precedence
		// First from headers (highest priority)
		await this.initializeFromHeaders(request);

		// Then from query parameters (overrides if headers didn't set a value)
		await this.initializeFromQueryParams(request);

		// Finally from request body (lowest priority except for defaults)
		await this.initializeFromBody(request);

		// Apply remaining defaults and computed values
		this.applyDefaults();

		// Update metadata
		this.updateMetadata();

		// Validate the configuration
		const validationResult = this.validate();

		// Log validation issues
		if (validationResult.hasErrors) {
			this.logger.warn(
				`${this.logPrefix} Configuration has ${
					validationResult.issues.filter((i) => i.severity === ValidationSeverity.ERROR).length
				} error(s)`
			);
			for (const issue of validationResult.issues.filter((i) => i.severity === ValidationSeverity.ERROR)) {
				this.logger.warn(`${this.logPrefix} Validation error: ${issue.message}`, issue);
			}
		}

		if (validationResult.hasWarnings) {
			this.logger.debug(
				`${this.logPrefix} Configuration has ${
					validationResult.issues.filter((i) => i.severity === ValidationSeverity.WARNING).length
				} warning(s)`
			);
			for (const issue of validationResult.issues.filter((i) => i.severity === ValidationSeverity.WARNING)) {
				this.logger.debug(`${this.logPrefix} Validation warning: ${issue.message}`, issue);
			}
		}

		// Store validation result in metadata
		if (this.config.enableResponseMetadata) {
			this.metadata.validationResult = validationResult;
		}

		this.isInitialized = true;

		this.logger.debug(`${this.logPrefix} Configuration initialized:`, this.config);
		return this.config;
	}

	/**
	 * Gets the current configuration options.
	 * @returns The current configuration options.
	 */
	getConfig(): OptimizelyConfigOptions {
		return this.config;
	}

	/**
	 * Gets the service's default settings.
	 * @returns The service settings.
	 */
	getSettings(): ServiceConfigSettings {
		return this.settings;
	}

	/**
	 * Gets configuration metadata (useful for debugging and analytics).
	 * @returns The configuration metadata.
	 */
	getMetadata(): ConfigMetadata {
		return this.metadata;
	}

	/**
	 * Gets the API path prefix configuration.
	 * @returns The API path prefix (e.g., '/api/')
	 */
	getApiPathPrefix(): string {
		return this.settings.apiPathPrefix;
	}

	/**
	 * Updates configuration with new values.
	 * @param newConfig - The new configuration values to apply.
	 * @returns The updated configuration.
	 */
	updateConfig(newConfig: Partial<OptimizelyConfigOptions>): OptimizelyConfigOptions {
		this.logger.debug(`${this.logPrefix} Updating config with: ${JSON.stringify(newConfig)}`);

		if ('sdkKey' in newConfig) {
			this.logger.debug(`${this.logPrefix} SDK Key being updated to: '${newConfig.sdkKey}'`);
		}

		this.config = { ...this.config, ...newConfig };
		this.updateMetadata();

		this.logger.debug(`${this.logPrefix} SDK Key after config update: '${this.config.sdkKey}'`);
		return this.config;
	}

	/**
	 * Gets a specific configuration value.
	 * @param key - The configuration key.
	 * @returns The configuration value, or undefined if not set.
	 */
	getValue<T>(key: keyof OptimizelyConfigOptions): T | undefined {
		return this.config[key] as T | undefined;
	}

	/**
	 * Sets a specific configuration value.
	 * @param key - The configuration key.
	 * @param value - The value to set.
	 */
	setValue<T>(key: keyof OptimizelyConfigOptions, value: T): void {
		(this.config[key] as T) = value;
		this.updateMetadata();
	}

	/**
	 * Gets all decide options based on configuration.
	 * @returns An array of decide options.
	 */
	getDecideOptions(): string[] {
		let options: string[] = this.config.decideOptions || [];

		// Add options based on boolean flags
		if (this.config.enabledFlagsOnly && !options.includes('ENABLED_FLAGS_ONLY')) {
			options.push('ENABLED_FLAGS_ONLY');
		}

		if (this.config.includeReasons && !options.includes('INCLUDE_REASONS')) {
			options.push('INCLUDE_REASONS');
		}

		if (this.config.excludeVariables && !options.includes('EXCLUDE_VARIABLES')) {
			options.push('EXCLUDE_VARIABLES');
		}

		if (this.config.disableDecisionEvent && !options.includes('DISABLE_DECISION_EVENT')) {
			options.push('DISABLE_DECISION_EVENT');
		}

		if (this.config.ignoreUserProfileService && !options.includes('IGNORE_USER_PROFILE_SERVICE')) {
			options.push('IGNORE_USER_PROFILE_SERVICE');
		}

		return options;
	}

	/**
	 * Checks if a specific decide option is enabled.
	 * @param option - The decide option to check.
	 * @returns True if the option is enabled, false otherwise.
	 */
	hasDecideOption(option: string): boolean {
		const options = this.getDecideOptions();
		return options.includes(option);
	}

	/**
	 * Initializes configuration settings from HTTP headers.
	 * @param request - The request adapter.
	 */
	private async initializeFromHeaders(request: IRequestAdapter): Promise<void> {
		this.logger.debug(`${this.logPrefix} Initializing from headers`);
		const headers = request.getHeaders();

		// Log all headers for debugging
		const headerEntries: string[] = [];
		headers.forEach((value, key) => {
			headerEntries.push(`${key}=${value}`);
			console.log(`[HEADER_DEBUG] ${key}=${value}`);
		});
		this.logger.debug(`${this.logPrefix} Request headers: ${headerEntries.join(', ')}`);

		// EXTRA SPECIAL CASE FOR DEBUGGING: Check for SDK Key header explicitly
		if (headers.has('X-Optimizely-SDK-Key')) {
			const sdkKeyValue = headers.get('X-Optimizely-SDK-Key');
			console.log(`[HEADER_DEBUG] Found X-Optimizely-SDK-Key in headers: '${sdkKeyValue}'`);
			this.setConfigValue('sdkKey', sdkKeyValue, 'headers');
			console.log(`[HEADER_DEBUG] Set sdkKey to ${sdkKeyValue} from headers`);
		}

		// Process headers to extract configuration values
		headers.forEach((value, key) => {
			// Handle both x-optly-* and X-Optimizely-* headers
			if (key.toLowerCase().startsWith('x-optly-') || key.toLowerCase().startsWith('x-optimizely-')) {
				// Convert header name to camelCase config key
				let configKey = '';

				if (key.toLowerCase().startsWith('x-optly-')) {
					// Handle x-optly- prefix (legacy)
					configKey = this.convertHeaderToCamelCase(key.replace(/^x-optly-/i, ''));
				} else {
					// Handle X-Optimizely- prefix (standard)
					configKey = this.convertHeaderToCamelCase(key.replace(/^x-optimizely-/i, ''));

					// Special case mappings
					configKey = this.mapSpecialHeaderKeys(configKey);
				}

				// Extract value
				const configValue = this.parseHeaderValue(value, key);

				// Store in config
				this.setConfigValue(configKey as keyof OptimizelyConfigOptions, configValue, 'headers');
				this.logger.debug(
					`${this.logPrefix} Extracted header config: ${key} -> ${configKey} = ${JSON.stringify(configValue)}`
				);

				// [AI-AUTO-DOC] X-Optimizely-Enable-FEX explicit behavior:
				// If the X-Optimizely-Enable-FEX header exists and is enabled (true),
				// the worker proceeds with normal routing/processing as if there was no SDK installed,
				// no sdkKey provided, or the SDK was not installed. No special logic, override, or error is applied.
				// All other scenarios are out of scope for this implementation.
			}
		});

		// Handle special headers with direct mapping
		if (headers.has('X-Optimizely-Visitor-Id') && !this.config.userId) {
			this.setConfigValue('userId', headers.get('X-Optimizely-Visitor-Id'), 'headers');
			this.logger.debug(`${this.logPrefix} Extracted User-Id from header: ${headers.get('X-Optimizely-Visitor-Id')}`);
		}

		// SDK Key header has direct mapping
		if (headers.has(this.settings.sdkKeyHeader)) {
			const sdkKeyValue = headers.get(this.settings.sdkKeyHeader);
			this.logger.debug(`${this.logPrefix} Found SDK Key in header '${this.settings.sdkKeyHeader}': '${sdkKeyValue}'`);
			this.setConfigValue('sdkKey', sdkKeyValue, 'headers');
			
			// Extra logging for debugging
			console.log(`[HEADER_DEBUG] SDK key from header: ${sdkKeyValue}, source: headers`);
			console.log(`[HEADER_DEBUG] Metadata sdkKeyFrom: ${this.metadata.sdkKeyFrom}`);
		} else {
			this.logger.debug(`${this.logPrefix} No SDK Key found in headers. Looking for: '${this.settings.sdkKeyHeader}'`);
		}

		// Extract boolean values from headers
		this.extractBooleanHeaderValues(headers);

		// Extract complex objects from headers
		this.extractComplexHeaderValues(headers);
	}

	/**
	 * Maps special header keys to their corresponding config keys.
	 * @param key - The header key.
	 * @returns The mapped config key.
	 */
	private mapSpecialHeaderKeys(key: string): string {
		// Convert standard header names to expected config format
		switch (key.toLowerCase()) {
			case 'sdkkey':
				return 'sdkKey';
			case 'flagkey':
				return 'flagKey';
			case 'userid':
				return 'userId';
			case 'eventkey':
				return 'eventKey';
			default:
				return key;
		}
	}

	/**
	 * Converts a header name to camelCase.
	 * @param header - The header name.
	 * @returns The camelCase version of the header name.
	 */
	private convertHeaderToCamelCase(header: string): string {
		return header.replace(/-([a-z])/g, (_: string, char: string) => char.toUpperCase());
	}

	/**
	 * Extracts boolean values from headers.
	 * @param headers - The headers.
	 */
	private extractBooleanHeaderValues(headers: Headers): void {
		// Add debug logging for header processing
		this.logger.info(`${this.logPrefix} Processing boolean headers with values:`);
		headers.forEach((value, name) => {
			if (name.toLowerCase().startsWith('x-optim')) {
				this.logger.info(`${this.logPrefix} Header: ${name} = ${value}`);
			}
		});

		// Extract boolean config values from headers
		const booleanHeaderMappings: Record<string, keyof OptimizelyConfigOptions> = {
			[this.settings.overrideCacheHeader]: 'overrideCache',
			[this.settings.overrideVisitorIdHeader]: 'overrideVisitorId',
			[this.settings.setResponseHeadersHeader]: 'setResponseHeaders', // Fixed: Use correct property name
			[this.settings.setResponseCookiesHeader]: 'setResponseCookies', // Fixed: Use correct property name
			[this.settings.setRequestHeadersHeader]: 'setRequestHeaders',
			[this.settings.setRequestCookiesHeader]: 'setRequestCookies',
			[this.settings.enableFlagsFromKVHeader]: 'enableFlagsFromKV',
			[this.settings.enableDatafileFromKVHeader]: 'datafileFromKV',
			[this.settings.enableRespMetadataHeader]: 'enableResponseMetadata',
			[this.settings.enableDebugHeadersHeader]: 'enableDebugHeaders',
			[this.settings.trimmedDecisionsHeader]: 'trimmedDecisions',
		};

		// Process each boolean header
		for (const [headerName, configKey] of Object.entries(booleanHeaderMappings)) {
			if (headers.has(headerName)) {
				const headerValue = headers.get(headerName);
				const parsedValue = this.parseBoolean(headerValue);
				this.setConfigValue(configKey, parsedValue, 'headers');
				this.logger.info(
					`${this.logPrefix} Mapped header ${headerName} -> config.${String(configKey)} = ${parsedValue}`
				);
			}
		}
	}

	/**
	 * Extracts complex object values from headers.
	 * @param headers - The headers.
	 */
	private extractComplexHeaderValues(headers: Headers): void {
		// Extract and parse more complex header values that may need special handling
		this.extractHeaderValue(headers, 'X-Optimizely-Attributes', 'attributes');
		this.extractHeaderValue(headers, 'X-Optimizely-Event-Tags', 'eventTags');
		this.extractHeaderValue(headers, 'X-Optimizely-Decide-Options', 'decideOptions');

		// Special handling for forced decisions
		const forcedDecisionHeader = headers.get('X-Optimizely-Forced-Decision');
		if (forcedDecisionHeader) {
			console.log('[HEADER_DEBUG] Found X-Optimizely-Forced-Decision header:', forcedDecisionHeader);

			try {
				// Parse the header value
				const forcedDecisions = JSON.parse(forcedDecisionHeader);
				console.log('[HEADER_DEBUG] Parsed forcedDecisions:', JSON.stringify(forcedDecisions));

				// Set directly on the configuration
				this.setValue('forcedDecisions', forcedDecisions);
				this.setConfigValue('forcedDecisions', forcedDecisions, 'Header: X-Optimizely-Forced-Decision');

				// Also set it explicitly in the userContext.attributes to ensure it's passed to the SDK
				if (!this.config.attributes) {
					this.config.attributes = {};
				}

				if (typeof this.config.attributes === 'object' && this.config.attributes !== null) {
					this.config.attributes.forcedDecisions = forcedDecisions;
					console.log('[HEADER_DEBUG] Added forcedDecisions to attributes:', JSON.stringify(this.config.attributes));
				}
			} catch (error) {
				this.logger.error(`${this.logPrefix} Error parsing X-Optimizely-Forced-Decision header`, error);
				console.log('[HEADER_DEBUG] Error parsing X-Optimizely-Forced-Decision header:', error);
			}
		}

		// Extract CDN variation settings if present
		this.extractHeaderValue(headers, 'X-Optimizely-CDN-Settings', 'cdnVariationSettings');
	}

	/**
	 * Parses a header value, attempting JSON parsing if possible.
	 * @param value - The header value.
	 * @param headerName - The header name (for logging).
	 * @returns The parsed value.
	 */
	private parseHeaderValue(value: string, headerName: string): any {
		if (!value) return value;

		try {
			// Try to parse as JSON
			return JSON.parse(value);
		} catch (error) {
			// If not valid JSON, use as string
			this.logger.debug(`${this.logPrefix} Header ${headerName} is not valid JSON, using as string`);
			return value;
		}
	}

	/**
	 * Initializes configuration settings from URL query parameters.
	 * @param request - The request adapter.
	 */
	private async initializeFromQueryParams(request: IRequestAdapter): Promise<void> {
		this.logger.debug(`${this.logPrefix} Initializing from query parameters`);
		const url = request.getUrl();
		const queryParams = url.searchParams;

		// Log all query parameters for debugging
		this.logger.debug(
			`${this.logPrefix} Query parameters: ${Array.from(queryParams.entries())
				.map(([k, v]) => `${k}=${v}`)
				.join(', ')}`
		);

		// Map of query parameter names to config keys
		const queryParamMapping = this.getQueryParamMapping();

		// Process each query parameter and update config if allowed by precedence rules
		for (const [paramName, configKey] of Object.entries(queryParamMapping)) {
			if (queryParams.has(paramName)) {
				const paramValue = queryParams.get(paramName);
				
				// Check if we should apply this value based on precedence rules
				if (this.shouldApplyValueFromSource(configKey as keyof OptimizelyConfigOptions, 'queryParams')) {
					// Try to parse as complex type if applicable
					if (['attributes', 'eventTags', 'forcedDecisions', 'cdnVariationSettings'].includes(configKey)) {
						try {
							const parsedValue = paramValue ? JSON.parse(paramValue) : null;
							if (parsedValue !== null) {
								this.setConfigValue(configKey as keyof OptimizelyConfigOptions, parsedValue, 'queryParams');
								this.logger.debug(
									`${this.logPrefix} Extracted complex query param: ${paramName} -> ${configKey} = ${JSON.stringify(
										parsedValue
									)}`
								);
							}
						} catch (error) {
							this.logger.debug(`${this.logPrefix} Failed to parse ${paramName} as JSON:`, error);
						}
					} else if (configKey === 'decideOptions' && paramValue) {
						// Handle decide options as comma-separated list
						const decideOptions = paramValue.split(',').map((s) => s.trim());
						this.setConfigValue('decideOptions', decideOptions, 'queryParams');
						this.logger.debug(
							`${this.logPrefix} Extracted decide options from query param: ${paramName} = ${decideOptions.join(', ')}`
						);
					} else if (['true', 'false'].includes(paramValue?.toLowerCase() || '')) {
						// Handle boolean values
						const boolValue = paramValue?.toLowerCase() === 'true';
						this.setConfigValue(configKey as keyof OptimizelyConfigOptions, boolValue, 'queryParams');
						this.logger.debug(
							`${this.logPrefix} Extracted boolean query param: ${paramName} -> ${configKey} = ${boolValue}`
						);
					} else {
						// Handle regular values
						this.setConfigValue(configKey as keyof OptimizelyConfigOptions, paramValue, 'queryParams');
						this.logger.debug(`${this.logPrefix} Extracted query param: ${paramName} -> ${configKey} = ${paramValue}`);

						// Special logging for sdkKey
						if (configKey === 'sdkKey') {
							this.logger.debug(`${this.logPrefix} Found SDK Key in query parameter '${paramName}': '${paramValue}'`);
						}
					}
				} else {
					// Log that we're skipping due to precedence
					this.logger.debug(
						`${this.logPrefix} Skipping ${paramName} from query params due to precedence. Current source: ${
							(this.metadata as any)[`${configKey}From`]
						}`
					);
				}
			}
		}

		// Log current SDK key after query param processing
		this.logger.debug(`${this.logPrefix} Current SDK Key after query params: '${this.config.sdkKey}'`);

		// Special handling for flag keys (can have multiple values)
		if (queryParams.has('keys') && this.shouldApplyValueFromSource('flagKeys', 'queryParams')) {
			const flagKeys = queryParams.getAll('keys');
			this.setConfigValue('flagKeys', flagKeys, 'queryParams');
		}

		// Special handling for trimmedDecisions
		const trimmedDecisionsParam = queryParams.get('trimmedDecisions');
		if (trimmedDecisionsParam !== null && this.shouldApplyValueFromSource('trimmedDecisions', 'queryParams')) {
			this.setConfigValue('trimmedDecisions', trimmedDecisionsParam === 'true', 'queryParams');
		}
	}

	/**
	 * Gets the mapping of query parameter names to config keys.
	 * @returns The mapping of query parameter names to config keys.
	 */
	private getQueryParamMapping(): Record<string, keyof OptimizelyConfigOptions> {
		return {
			serverMode: 'serverMode',
			visitorId: 'visitorId',
			userId: 'userId',
			sdkKey: 'sdkKey',
			decideAll: 'decideAll',
			trimmedDecisions: 'trimmedDecisions',
			setRequestHeaders: 'setRequestHeaders',
			setResponseHeaders: 'setResponseHeaders',
			setRequestCookies: 'setRequestCookies',
			setResponseCookies: 'setResponseCookies',
			disableDecisionEvent: 'disableDecisionEvent',
			enabledFlagsOnly: 'enabledFlagsOnly',
			includeReasons: 'includeReasons',
			ignoreUserProfileService: 'ignoreUserProfileService',
			excludeVariables: 'excludeVariables',
			overrideVisitorId: 'overrideVisitorId',
			enableResponseMetadata: 'enableResponseMetadata',
			enableDatafileFromKV: 'datafileFromKV',
			enableFlagsFromKV: 'enableFlagsFromKV',
			eventKey: 'eventKey',
			overrideCache: 'overrideCache',
			flagKey: 'flagKey',
			attributes: 'attributes',
			eventTags: 'eventTags',
			forcedDecisions: 'forcedDecisions',
			value: 'value',
		};
	}

	/**
	 * Initializes configuration settings from the request body if available.
	 * @param request - The request adapter.
	 */
	/**
	 * Checks if a new value from the given source should be applied based on precedence rules.
	 * Headers take precedence over query parameters, which take precedence over body.
	 * 
	 * @param key - The configuration key
	 * @param source - The source of the new value ('headers', 'queryParams', or 'body')
	 * @returns True if the value should be applied, false otherwise
	 */
	private shouldApplyValueFromSource(key: keyof OptimizelyConfigOptions, source: string): boolean {
		const sourceField = `${String(key)}From`;
		const currentSource = (this.metadata as any)[sourceField];
		
		// If we don't have an existing source, always apply the new value
		if (!currentSource) {
			return true;
		}
		
		// Check precedence: headers > queryParams > body
		if (currentSource === 'headers') {
			// Headers have highest precedence, never override
			return false;
		}
		
		if (currentSource === 'queryParams' && source === 'body') {
			// Don't override query params with body values
			return false;
		}
		
		// In all other cases, apply the new value
		return true;
	}

	private async initializeFromBody(request: IRequestAdapter): Promise<void> {
		// Log all the values at the beginning
		console.log(`[BODY_DEBUG] Starting body processing with current metadata/config state:`);
		console.log(`[BODY_DEBUG] Current sdkKey: ${this.config.sdkKey}`);
		console.log(`[BODY_DEBUG] Current sdkKeyFrom: ${this.metadata.sdkKeyFrom}`);
		
		this.logger.debug(`${this.logPrefix} Initializing from body`);

		// Only process body for POST/PUT methods
		const method = request.getMethod();
		if (!['POST', 'PUT'].includes(method)) {
			this.logger.debug(`${this.logPrefix} Skipping body processing for ${method} request`);
			return;
		}

		// Check content type
		const contentType = request.getHeaders().get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			this.logger.debug(`${this.logPrefix} Skipping body processing for non-JSON content-type: ${contentType}`);
			return;
		}

		// Try to parse body as JSON
		try {
			const body = await request.getBodyJson<Record<string, any>>();
			if (!body) {
				this.logger.debug(`${this.logPrefix} No body found or body is empty`);
				return;
			}

			console.log(`[BODY_DEBUG] Request body: ${JSON.stringify(body)}`);
			this.logger.debug(`${this.logPrefix} Request body: ${JSON.stringify(body)}`);

			// SPECIAL DEBUGGING FOR SDK KEY
			if (body.sdkKey) {
				console.log(`[BODY_DEBUG] Found sdkKey in body: ${body.sdkKey}`);
				console.log(`[BODY_DEBUG] Current sdkKeyFrom: ${this.metadata.sdkKeyFrom}`);
				console.log(`[BODY_DEBUG] Should apply? ${this.shouldApplyValueFromSource('sdkKey', 'body')}`);
			}

			// Process each property in the body
			for (const [key, value] of Object.entries(body)) {
				// Only apply if allowed by precedence rules (bodies have lowest precedence)
				if (this.shouldApplyValueFromSource(key as keyof OptimizelyConfigOptions, 'body')) {
					console.log(`[BODY_DEBUG] Setting ${key} from body: ${JSON.stringify(value)}`);
					this.setConfigValue(key as keyof OptimizelyConfigOptions, value, 'body');
					this.logger.debug(`${this.logPrefix} Extracted from body: ${key} = ${JSON.stringify(value)}`);

					// Special logging for sdkKey
					if (key === 'sdkKey') {
						this.logger.debug(`${this.logPrefix} Found SDK Key in request body: '${value}'`);
					}
				} else {
					// Log that we're skipping due to precedence
					console.log(`[BODY_DEBUG] SKIPPING ${key} from body due to precedence. Current source: ${
						(this.metadata as any)[`${key}From`]
					}`);
					this.logger.debug(
						`${this.logPrefix} Skipping ${key} from body due to precedence. Current source: ${
							(this.metadata as any)[`${key}From`]
						}`
					);
				}
			}

			// Special handling for userId/visitorId (aliases)
			if (body.userId && this.shouldApplyValueFromSource('visitorId', 'body')) {
				this.setConfigValue('visitorId', body.userId, 'body');
				this.logger.debug(`${this.logPrefix} Using userId from body as visitorId: ${body.userId}`);
			}

			// Ensure flagKeys is an array
			if (body.flagKeys && this.shouldApplyValueFromSource('flagKeys', 'body')) {
				this.setConfigValue('flagKeys', Array.isArray(body.flagKeys) ? body.flagKeys : [body.flagKeys], 'body');
				this.logger.debug(`${this.logPrefix} Converted flagKeys to array: ${JSON.stringify(this.config.flagKeys)}`);
			}
		} catch (error) {
			this.logger.debug(`${this.logPrefix} Failed to parse request body as JSON:`, error);
		}

		// Log current SDK key after body processing
		console.log(`[BODY_DEBUG] AFTER BODY PROCESSING: sdkKey = ${this.config.sdkKey}, sdkKeyFrom = ${this.metadata.sdkKeyFrom}`);
		this.logger.debug(`${this.logPrefix} Current SDK Key after body processing: '${this.config.sdkKey}'`);
	}

	/**
	 * Applies default values to configuration options that are not set.
	 */
	private applyDefaults(): void {
		this.logger.debug(`${this.logPrefix} Applying defaults`);

		// Apply default values from settings
		if (this.config.trimmedDecisions === undefined) {
			this.config.trimmedDecisions = this.settings.defaultTrimmedDecisions;
		}

		if (this.config.setResponseCookies === undefined) {
			this.config.setResponseCookies = this.settings.defaultSetResponseCookies;
		}

		if (this.config.setResponseHeaders === undefined) {
			this.config.setResponseHeaders = this.settings.defaultSetResponseHeaders;
		}

		if (this.config.setRequestCookies === undefined) {
			this.config.setRequestCookies = this.settings.defaultSetRequestCookies;
		}

		if (this.config.setRequestHeaders === undefined) {
			this.config.setRequestHeaders = this.settings.defaultSetRequestHeaders;
		}

		if (this.config.overrideCache === undefined) {
			// If not set by request, check environment variable as fallback
			// Safely check if process.env exists (for Node.js environments)
			let envOverride = false;
			try {
				envOverride =
					typeof process !== 'undefined' &&
					process &&
					process.env &&
					process.env.OPTIMIZELY_OVERRIDE_CACHE?.toLowerCase() === 'true';
			} catch (e) {
				// In environments without process.env (like Cloudflare Workers)
				this.logger.debug(`${this.logPrefix} process.env not available in this environment`);
			}

			this.config.overrideCache = envOverride;
			this.logger.debug(
				`${this.logPrefix} overrideCache not set by request, falling back to ENV OPTIMIZELY_OVERRIDE_CACHE: ${envOverride}`
			);
		} else {
			// If already set by request, use the request value (which takes precedence)
			this.logger.debug(
				`${this.logPrefix} overrideCache was set by request to: ${this.config.overrideCache}, ignoring environment variable.`
			);
		}

		if (this.config.overrideVisitorId === undefined) {
			this.config.overrideVisitorId = this.settings.defaultOverrideVisitorId;
		}

		if (this.config.enableFlagsFromKV === undefined) {
			this.config.enableFlagsFromKV = this.settings.flagsFromKV;
		}

		if (this.config.datafileFromKV === undefined) {
			this.config.datafileFromKV = this.settings.datafileFromKV;
		}

		if (this.config.enableResponseMetadata === undefined) {
			this.config.enableResponseMetadata = this.settings.enableResponseMetadata;
		}

		// Handle enableDebugHeaders config and update the class property
		if (this.config.enableDebugHeaders !== undefined) {
			this.enableDebugHeaders = !!this.config.enableDebugHeaders;
			this.logger.debug(`${this.logPrefix} enableDebugHeaders set by request to: ${this.enableDebugHeaders}`);
		} else {
			// Check environment variable as fallback
			try {
				const envEnableDebug =
					typeof process !== 'undefined' &&
					process &&
					process.env &&
					process.env.OPTIMIZELY_ENABLE_DEBUG_HEADERS?.toLowerCase() === 'true';
				if (envEnableDebug) {
					this.enableDebugHeaders = true;
					this.logger.debug(
						`${this.logPrefix} enableDebugHeaders set from environment variable: ${this.enableDebugHeaders}`
					);
				}
			} catch (e) {
				// In environments without process.env (like Cloudflare Workers)
				this.logger.debug(
					`${this.logPrefix} process.env not available, using default for enableDebugHeaders: ${this.enableDebugHeaders}`
				);
			}
		}

		// Ensure flagKeys is an array
		if (this.config.flagKeys && !Array.isArray(this.config.flagKeys)) {
			this.config.flagKeys = [this.config.flagKeys as unknown as string];
		}

		// If single flagKey is provided but not flagKeys array
		if (this.config.flagKey && (!this.config.flagKeys || this.config.flagKeys.length === 0)) {
			this.config.flagKeys = [this.config.flagKey];
		}

		// Ensure attributes and eventTags are objects
		if (!this.config.attributes) {
			this.config.attributes = {};
		}

		if (!this.config.eventTags) {
			this.config.eventTags = {};
		}

		// Ensure decideOptions is an array
		if (!this.config.decideOptions) {
			this.config.decideOptions = [];
		}

		// Add decide options based on boolean flags
		this.config.decideOptions = this.getDecideOptions();
	}

	/**
	 * Updates configuration metadata based on current config.
	 */
	private updateMetadata(): void {
		// Extra debug logging
		console.log(`[META_DEBUG] Updating metadata, enableResponseMetadata: ${this.config.enableResponseMetadata}`);
		
		// Update metadata if enableResponseMetadata is true
		if (this.config.enableResponseMetadata) {
			// Update metadata with current config values
			if (this.config.sdkKey) {
				console.log(`[META_DEBUG] Setting metadata.sdkKey to ${this.config.sdkKey}`);
				this.metadata.sdkKey = this.config.sdkKey;
				console.log(`[META_DEBUG] Current metadata.sdkKeyFrom: ${this.metadata.sdkKeyFrom}`);
			}

			if (this.config.visitorId) {
				this.metadata.visitorId = this.config.visitorId;
			}

			this.metadata.decideOptions = this.getDecideOptions();
			this.metadata.attributes = this.config.attributes || {};
			this.metadata.eventTags = this.config.eventTags || {};
			this.metadata.trimmedDecisions = !!this.config.trimmedDecisions;
			this.metadata.decideAll = !!this.config.decideAll;

			if (this.config.flagKeys) {
				this.metadata.flagKeysDecided = Array.isArray(this.config.flagKeys)
					? this.config.flagKeys
					: [this.config.flagKeys as unknown as string];
			}
			
			// DEBUG: Log all metadata fields and values
			console.log('[META_DEBUG] Final metadata after update:');
			for (const [key, value] of Object.entries(this.metadata)) {
				console.log(`[META_DEBUG]   ${key}: ${JSON.stringify(value)}`);
			}
		}
	}

	/**
	 * Sets a configuration value and updates metadata about its source.
	 * @param key - The configuration key.
	 * @param value - The value to set.
	 * @param source - The source of the value.
	 */
	private setConfigValue<T>(key: keyof OptimizelyConfigOptions, value: T, source: string): void {
		if (value === null || value === undefined) {
			return;
		}

		// ===== DEBUG LOGGING FOR PRECEDENCE TESTING =====
		console.log(`[DEBUG] setConfigValue called: key=${key}, value=${JSON.stringify(value)}, source=${source}`);
		
		// Check for existing value and prioritize based on source
		const sourceField = `${String(key)}From`;
		const currentSource = (this.metadata as any)[sourceField];
		
		console.log(`[DEBUG] Current source for ${key}: ${currentSource || 'none'}`);
		
		// Implement precedence: headers > queryParams > body
		// Always check source precedence regardless of whether a value exists or not
		if (currentSource === 'headers') {
			// Headers always win, don't override with any other source
			console.log(`[DEBUG] Not overriding ${key} from 'headers' with value from '${source}'`);
			this.logger.debug(`${this.logPrefix} Not overriding ${key} from 'headers' with value from '${source}'`);
			return;
		}
		if (currentSource === 'queryParams' && source === 'body') {
			// queryParams win over body
			console.log(`[DEBUG] Not overriding ${key} from 'queryParams' with value from 'body'`);
			this.logger.debug(`${this.logPrefix} Not overriding ${key} from 'queryParams' with value from 'body'`);
			return;
		}

		// Log what we're setting and from where
		console.log(`[DEBUG] SETTING ${key} = ${JSON.stringify(value)} from source: ${source}`);
		this.logger.debug(`${this.logPrefix} Setting ${String(key)} = ${JSON.stringify(value)} from source: ${source}`);
		
		// Set the value in the config
		(this.config[key] as T) = value;

		// Track source for all parameters, not just the specific ones listed
		if (this.config.enableResponseMetadata !== false) {
			(this.metadata as any)[sourceField] = source;
			
			// Debug logging for source tracking
			console.log(`[DEBUG] Tracked source for ${key} as ${source} in metadata.${sourceField}`);
			this.logger.debug(`${this.logPrefix} Tracked source for ${key} as ${source} in metadata.${sourceField}`);
		}
	}

	/**
	 * Initializes metadata configuration for logging and debugging purposes.
	 * @returns The initial metadata configuration object.
	 */
	private initializeConfigMetadata(): ConfigMetadata {
		console.log(`[META_DEBUG] Initializing empty metadata object`);
		const newMetadata = {
			visitorId: '',
			visitorIdFrom: '',
			decideOptions: [],
			attributes: {},
			attributesFrom: '',
			eventTags: {},
			eventTagsFrom: '',
			sdkKey: '',
			sdkKeyFrom: '',
			datafileFrom: '',
			trimmedDecisions: true,
			decideAll: false,
			flagKeysDecided: [],
			flagKeysFrom: '',
			storedDecisionsFound: false,
			storedCookieDecisions: [],
			forcedDecisions: [],
			agentServerMode: false,
			pathName: '',
			cdnVariationSettings: {},
		};
		
		console.log(`[META_DEBUG] Initial metadata:`, newMetadata);
		return newMetadata;
	}

	/**
	 * Initializes the service's default settings.
	 * @returns The default settings.
	 */
	private initializeSettings(): ServiceConfigSettings {
		// Load configurable header/cookie names from environment variables if present
		try {
			const envAdapter = (this as any).datafileService?.getEnvironmentAdapter?.();
			if (envAdapter) {
				this.decisionsCookieName = envAdapter.getVariable('EDGE_DECISIONS_COOKIE_NAME') || this.decisionsCookieName;
				this.visitorIdCookieName = envAdapter.getVariable('EDGE_VISITOR_ID_COOKIE_NAME') || this.visitorIdCookieName;
				this.decisionsHeaderName = envAdapter.getVariable('EDGE_DECISIONS_HEADER_NAME') || this.decisionsHeaderName;
				this.visitorIdHeaderName = envAdapter.getVariable('EDGE_VISITOR_ID_HEADER_NAME') || this.visitorIdHeaderName;
			}
		} catch (e) {
			this.logger?.warn?.(`${this.logPrefix} Could not load header/cookie names from environment:`, e);
		}
		return {
			cdnProvider: 'cloudflare',
			responseJsonKeyName: 'decisions',
			apiPathPrefix: '/api/',

			enableResponseMetadata: true,
			flagsFromKV: false,
			datafileFromKV: false,

			defaultTrimmedDecisions: true,
			defaultSetResponseCookies: true,
			defaultSetResponseHeaders: true,
			defaultSetRequestCookies: true,
			defaultSetRequestHeaders: true,
			defaultResponseHeadersAndCookies: true,
			defaultOverrideCache: false,
			defaultOverrideVisitorId: false,

			decisionsKeyName: 'decisions',
			decisionsCookieName: this.decisionsCookieName,
			visitorIdCookieName: this.visitorIdCookieName,
			decisionsHeaderName: this.decisionsHeaderName,
			visitorIdsHeaderName: this.visitorIdHeaderName,

			prioritizeHeadersOverQueryParams: true,

			sdkKeyHeader: 'X-Optimizely-SDK-Key',
			setResponseHeadersHeader: 'X-Optimizely-Set-Response-Headers',
			setResponseCookiesHeader: 'X-Optimizely-Set-Response-Cookies',
			setRequestHeadersHeader: 'X-Optimizely-Set-Request-Headers',
			setRequestCookiesHeader: 'X-Optimizely-Set-Request-Cookies',
			overrideVisitorIdHeader: 'X-Optimizely-Override-Visitor-Id',
			attributesHeader: 'X-Optimizely-Attributes',
			eventTagsHeader: 'X-Optimizely-Event-Tags',
			datafileAccessTokenHeader: 'X-Optimizely-Datafile-Access-Token',
			enableOptimizelyHeader: 'X-Optimizely-Enable-FEX',
			decideOptionsHeader: 'X-Optimizely-Decide-Options',
			visitorIdHeader: 'X-Optimizely-Visitor-Id',
			trimmedDecisionsHeader: 'X-Optimizely-Trimmed-Decisions',
			enableFlagsFromKVHeader: 'X-Optimizely-Flags-KV',
			enableDatafileFromKVHeader: 'X-Optimizely-Datafile-KV',
			enableRespMetadataHeader: 'X-Optimizely-Enable-Response-Metadata',
			enableDebugHeadersHeader: 'X-Optimizely-Enable-Debug-Headers',
			overrideCacheHeader: 'X-Optimizely-Override-Cache',
			eventKeyHeader: 'X-Optimizely-Event-Key',
			implementationVersionHeader: 'X-Optimizely-Edge-Agent-Version',
			kvFlagKeyName: 'optly_flagKeys',
			kvDatafileKeyName: 'optly_sdk_datafile',

			cookieExpirationInDays: 400,
		};
	}

	/**
	 * Converts a string value to a boolean. Returns a default value if the input is null.
	 * @param value - The string value to convert.
	 * @param defaultValue - The default value to return if the input is null.
	 * @returns The boolean value of the string, or the default value.
	 */
	private parseBoolean(value: string | null, defaultValue: boolean = false): boolean {
		if (value === null) return defaultValue;
		return value.toLowerCase() === 'true';
	}

	/**
	 * Validates the structure of attributes for potential issues like circular references,
	 * deeply nested objects, or extremely large values which could cause performance issues.
	 * @param attributes - The attributes object to validate
	 * @returns A validation issue if problems are found, or null if valid
	 */
	private validateAttributesStructure(attributes: Record<string, any>): ValidationIssue | null {
		// Skip validation if attributes is null or undefined
		if (!attributes) return null;

		// Check for nested objects that are too deep (potential DoS or complexity issues)
		const maxDepth = 5;
		let hasCircularRef = false;

		// Use a WeakSet to track visited objects for circular reference detection
		const visitedObjects = new WeakSet();

		const checkDepth = (obj: any, currentDepth: number): boolean => {
			// Stop if we've reached max depth
			if (currentDepth > maxDepth) return true;

			// Only check objects
			if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;

			// Check for circular references
			if (visitedObjects.has(obj)) {
				hasCircularRef = true;
				return true;
			}

			visitedObjects.add(obj);

			// Check all properties recursively
			for (const key of Object.keys(obj)) {
				if (checkDepth(obj[key], currentDepth + 1)) return true;
			}

			return false;
		};

		const tooDeep = checkDepth(attributes, 0);

		if (tooDeep) {
			return {
				type: ValidationIssueType.INVALID_VALUE,
				field: 'attributes',
				message: hasCircularRef
					? 'Attributes contain circular references, which are not supported'
					: `Attributes are nested too deeply (max depth: ${maxDepth})`,
				severity: ValidationSeverity.ERROR,
				value: attributes,
			};
		}

		// Check for extremely large attribute values (potential DoS)
		const maxValueLength = 10000; // 10KB per value
		let largeValueFound = '';

		const checkValueSize = (obj: any): boolean => {
			if (typeof obj !== 'object' || obj === null) {
				// Check string length
				if (typeof obj === 'string' && obj.length > maxValueLength) {
					return true;
				}
				return false;
			}

			// Check arrays and objects
			for (const key of Object.keys(obj)) {
				if (typeof obj[key] === 'string' && obj[key].length > maxValueLength) {
					largeValueFound = key;
					return true;
				}
				if (typeof obj[key] === 'object' && obj[key] !== null) {
					if (checkValueSize(obj[key])) return true;
				}
			}

			return false;
		};

		if (checkValueSize(attributes)) {
			return {
				type: ValidationIssueType.INVALID_VALUE,
				field: 'attributes',
				message: `Attribute value for '${largeValueFound}' exceeds maximum allowed size (${maxValueLength} chars)`,
				severity: ValidationSeverity.ERROR,
				value: attributes,
			};
		}

		// Check for potentially problematic attribute names (e.g., reserved names)
		const reservedNames = ['$opt_', '$optly_', 'optimizely', 'system'];
		const problematicKeys = Object.keys(attributes).filter((key) =>
			reservedNames.some((prefix) => key.toLowerCase().startsWith(prefix))
		);

		if (problematicKeys.length > 0) {
			return {
				type: ValidationIssueType.INVALID_VALUE,
				field: 'attributes',
				message: `Attributes contain potentially reserved names: ${problematicKeys.join(', ')}`,
				severity: ValidationSeverity.WARNING,
				value: attributes,
				context: { problematicKeys },
			};
		}

		return null;
	}

	/**
	 * Gets the validation rules for configuration options.
	 * @returns An array of validation rules.
	 */
	getValidationRules(): ValidationRule[] {
		return [
			// Core configuration rules
			{
				field: 'sdkKey',
				type: 'string',
				required: true,
				minLength: 3,
				pattern: /^[a-zA-Z0-9_-]+$/,
				validator: (value) => {
					if (!value || typeof value !== 'string') {
						return {
							type: ValidationIssueType.REQUIRED_FIELD_MISSING,
							field: 'sdkKey',
							message: 'SDK key is required and must be a string',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Check for common mistakes in SDK keys
					if (value.includes(' ')) {
						return {
							type: ValidationIssueType.INVALID_VALUE,
							field: 'sdkKey',
							message: 'SDK key contains spaces, which are not allowed',
							severity: ValidationSeverity.ERROR,
							value,
							suggestedValue: value.replace(/\s+/g, ''),
						};
					}

					if (value.length < 8) {
						return {
							type: ValidationIssueType.INVALID_VALUE,
							field: 'sdkKey',
							message: 'SDK key is suspiciously short (standard keys are at least 8 characters)',
							severity: ValidationSeverity.WARNING,
							value,
						};
					}

					return null;
				},
			},
			{
				field: 'visitorId',
				type: 'string',
				minLength: 1,
				validator: (value, config) => {
					// Allow null/undefined since visitor ID can be generated
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'string') {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'visitorId',
							message: 'Visitor ID must be a string if provided',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}
					return null;
				},
			},
			{
				field: 'userId',
				type: 'string',
				validator: (value, config) => {
					// userId is an alias for visitorId
					if (value && typeof value === 'string' && !config.visitorId) {
						// This is not an error, but we'll set visitorId from userId
						// during initialization, so this is just an informational message
						return {
							type: ValidationIssueType.DEPRECATED,
							field: 'userId',
							message: 'userId is deprecated, use visitorId instead',
							severity: ValidationSeverity.INFO,
							value,
							suggestedValue: { visitorId: value, userId: undefined },
						};
					}
					return null;
				},
			},

			// Flag key rules
			{
				field: 'flagKey',
				type: 'string',
				validator: (value, config) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'string' || value.trim().length === 0) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'flagKey',
							message: 'Flag key must be a non-empty string if provided',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Check if both flagKey and flagKeys are provided
					if (config.flagKeys && Array.isArray(config.flagKeys) && config.flagKeys.length > 0) {
						return {
							type: ValidationIssueType.INCOMPATIBLE_OPTIONS,
							field: 'flagKey',
							message: 'Both flagKey and flagKeys are provided. flagKey will be ignored.',
							severity: ValidationSeverity.WARNING,
							value,
							context: { flagKeys: config.flagKeys },
						};
					}

					return null;
				},
			},
			{
				field: 'flagKeys',
				type: 'array',
				validator: (value, config) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (!Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'flagKeys',
							message: 'Flag keys must be an array',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Check if any flag key is not a string
					const nonStringKeys = value.filter((key) => typeof key !== 'string');
					if (nonStringKeys.length > 0) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'flagKeys',
							message: 'All flag keys must be strings',
							severity: ValidationSeverity.ERROR,
							value,
							context: { nonStringKeys },
						};
					}

					return null;
				},
			},

			// Attributes and event tags
			{
				field: 'attributes',
				type: 'object',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'object' || Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'attributes',
							message: 'Attributes must be an object',
							severity: ValidationSeverity.ERROR,
							value,
							suggestedValue: {},
						};
					}

					// Use the enhanced attributes structure validation
					return this.validateAttributesStructure(value);
				},
			},
			{
				field: 'eventTags',
				type: 'object',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'object' || Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'eventTags',
							message: 'Event tags must be an object',
							severity: ValidationSeverity.ERROR,
							value,
							suggestedValue: {},
						};
					}

					// Check for 'revenue' or 'value' tags and ensure they're numbers
					if ('revenue' in value && typeof value.revenue !== 'number') {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'eventTags',
							message: "Event tag 'revenue' must be a number",
							severity: ValidationSeverity.ERROR,
							value,
							context: { problematicTag: 'revenue', actualType: typeof value.revenue },
						};
					}

					if ('value' in value && typeof value.value !== 'number') {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'eventTags',
							message: "Event tag 'value' must be a number",
							severity: ValidationSeverity.ERROR,
							value,
							context: { problematicTag: 'value', actualType: typeof value.value },
						};
					}

					return null;
				},
			},

			// Event key and value
			{
				field: 'eventKey',
				type: 'string',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'string' || value.trim().length === 0) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'eventKey',
							message: 'Event key must be a non-empty string if provided',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					return null;
				},
			},
			{
				field: 'value',
				type: 'number',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'number' || isNaN(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'value',
							message: 'Value must be a number if provided',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					return null;
				},
			},

			// Decide options
			{
				field: 'decideOptions',
				type: 'array',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (!Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'decideOptions',
							message: 'Decide options must be an array',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Validate each decide option
					const validOptions = [
						'DISABLE_DECISION_EVENT',
						'ENABLED_FLAGS_ONLY',
						'INCLUDE_REASONS',
						'EXCLUDE_VARIABLES',
						'IGNORE_USER_PROFILE_SERVICE',
					];

					const invalidOptions = value.filter((opt) => !validOptions.includes(opt));
					if (invalidOptions.length > 0) {
						return {
							type: ValidationIssueType.INVALID_VALUE,
							field: 'decideOptions',
							message: `Invalid decide options: ${invalidOptions.join(', ')}`,
							severity: ValidationSeverity.WARNING,
							value,
							context: { validOptions, invalidOptions },
						};
					}

					return null;
				},
			},

			// Boolean flags
			{
				field: 'overrideVisitorId',
				type: 'boolean',
			},
			{
				field: 'overrideCache',
				type: 'boolean',
			},
			{
				field: 'enableFlagsFromKV',
				type: 'boolean',
				validator: (value) => {
					if (value !== undefined && typeof value !== 'boolean') {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'enableFlagsFromKV',
							message: 'enableFlagsFromKV must be a boolean',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}
					return null;
				},
			},
			{
				field: 'datafileFromKV',
				type: 'boolean',
				validator: (value) => {
					if (value !== undefined && typeof value !== 'boolean') {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'datafileFromKV',
							message: 'datafileFromKV must be a boolean',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}
					return null;
				},
			},
			{
				field: 'enableResponseMetadata',
				type: 'boolean',
			},
			{
				field: 'decideAll',
				type: 'boolean',
			},
			{
				field: 'trimmedDecisions',
				type: 'boolean',
				validator: (value) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'boolean') {
						const boolValue = value === 'true' || value === '1' || value === 1;
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'trimmedDecisions',
							message: 'trimmedDecisions must be a boolean value',
							severity: ValidationSeverity.WARNING,
							value,
							suggestedValue: boolValue, // Try to convert to proper boolean
							context: {
								note: "Non-boolean values are automatically converted to boolean, but it's better to use proper boolean values",
							},
						};
					}

					return null;
				},
			},
			{
				field: 'disableDecisionEvent',
				type: 'boolean',
			},
			{
				field: 'enabledFlagsOnly',
				type: 'boolean',
			},
			{
				field: 'includeReasons',
				type: 'boolean',
			},
			{
				field: 'excludeVariables',
				type: 'boolean',
			},
			{
				field: 'setResponseHeaders',
				type: 'boolean',
			},
			{
				field: 'setResponseCookies',
				type: 'boolean',
			},
			{
				field: 'setRequestHeaders',
				type: 'boolean',
			},
			{
				field: 'setRequestCookies',
				type: 'boolean',
			},

			// Advanced options
			{
				field: 'datafileAccessToken',
				type: 'string',
			},
			{
				field: 'serverMode',
				type: 'string',
				allowedValues: ['edge', 'agent'],
			},
			{
				field: 'forcedDecisions',
				type: 'object',
				validator: (value, config) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'object' || Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'forcedDecisions',
							message: 'Forced decisions must be an object',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Check the structure of forcedDecisions
					// Expected format: { "flag-key": { "variationKey": "variation-key" } }
					for (const [flagKey, decision] of Object.entries(value)) {
						if (typeof decision !== 'object' || decision === null || Array.isArray(decision)) {
							return {
								type: ValidationIssueType.INVALID_VALUE,
								field: 'forcedDecisions',
								message: `Forced decision for flag '${flagKey}' must be an object with a variationKey property`,
								severity: ValidationSeverity.ERROR,
								value,
								context: { flagKey, invalidDecision: decision },
							};
						}

						if (!('variationKey' in decision) || typeof decision.variationKey !== 'string') {
							return {
								type: ValidationIssueType.INVALID_VALUE,
								field: 'forcedDecisions',
								message: `Forced decision for flag '${flagKey}' must include a string variationKey`,
								severity: ValidationSeverity.ERROR,
								value,
								context: { flagKey, invalidDecision: decision },
							};
						}
					}

					// Add debug logging to see what's coming in
					console.log('[FORCED_DECISIONS_DEBUG] Validated forcedDecisions:', JSON.stringify(value));
					return null;
				},
			},
			{
				field: 'cdnVariationSettings',
				type: 'object',
				validator: (value, config) => {
					if (value === null || value === undefined) {
						return null;
					}

					if (typeof value !== 'object' || Array.isArray(value)) {
						return {
							type: ValidationIssueType.INVALID_TYPE,
							field: 'cdnVariationSettings',
							message: 'CDN variation settings must be an object',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Check for required CDN variation settings
					if (!value.cdnExperimentURL && !value.cdnResponseURL) {
						return {
							type: ValidationIssueType.INVALID_VALUE,
							field: 'cdnVariationSettings',
							message: 'CDN variation settings must include at least cdnExperimentURL or cdnResponseURL',
							severity: ValidationSeverity.ERROR,
							value,
						};
					}

					// Validate URLs if present
					if (value.cdnExperimentURL && typeof value.cdnExperimentURL === 'string') {
						try {
							new URL(value.cdnExperimentURL);
						} catch (error) {
							return {
								type: ValidationIssueType.INVALID_VALUE,
								field: 'cdnVariationSettings',
								message: 'cdnExperimentURL must be a valid URL',
								severity: ValidationSeverity.ERROR,
								value,
								context: { invalidUrl: value.cdnExperimentURL },
							};
						}
					}

					if (value.cdnResponseURL && typeof value.cdnResponseURL === 'string') {
						try {
							new URL(value.cdnResponseURL);
						} catch (error) {
							return {
								type: ValidationIssueType.INVALID_VALUE,
								field: 'cdnVariationSettings',
								message: 'cdnResponseURL must be a valid URL',
								severity: ValidationSeverity.ERROR,
								value,
								context: { invalidUrl: value.cdnResponseURL },
							};
						}
					}

					return null;
				},
			},
		];
	}

	/**
	 * Validates the current configuration.
	 * @returns A validation result with any issues found.
	 */
	validate(): ValidationResult {
		const issues: ValidationIssue[] = [];
		const rules = this.getValidationRules();

		// Validate each field according to its rules
		for (const rule of rules) {
			const value = this.config[rule.field];

			// Check if required field is missing
			if (rule.required && (value === undefined || value === null)) {
				issues.push({
					type: ValidationIssueType.REQUIRED_FIELD_MISSING,
					field: String(rule.field),
					message: `Required field ${String(rule.field)} is missing`,
					severity: ValidationSeverity.ERROR,
					value,
				});
				continue;
			}

			// Skip validation for undefined/null values if not required
			if (value === undefined || value === null) {
				continue;
			}

			// Check type
			if (rule.type) {
				const types = Array.isArray(rule.type) ? rule.type : [rule.type];
				let typeValid = false;

				for (const type of types) {
					switch (type) {
						case 'string':
							typeValid = typeof value === 'string';
							break;
						case 'number':
							typeValid = typeof value === 'number';
							break;
						case 'boolean':
							typeValid = typeof value === 'boolean';
							break;
						case 'object':
							typeValid = typeof value === 'object' && !Array.isArray(value);
							break;
						case 'array':
							typeValid = Array.isArray(value);
							break;
						default:
							typeValid = false;
					}

					if (typeValid) break;
				}

				if (!typeValid) {
					issues.push({
						type: ValidationIssueType.INVALID_TYPE,
						field: String(rule.field),
						message: `Field ${String(rule.field)} must be of type ${types.join(' or ')}`,
						severity: ValidationSeverity.ERROR,
						value,
					});
					continue;
				}
			}

			// Check allowed values
			if (rule.allowedValues && !rule.allowedValues.includes(value)) {
				issues.push({
					type: ValidationIssueType.INVALID_VALUE,
					field: String(rule.field),
					message: `Field ${String(rule.field)} must be one of: ${rule.allowedValues.join(', ')}`,
					severity: ValidationSeverity.ERROR,
					value,
					suggestedValue: rule.allowedValues[0],
				});
			}

			// Check min/max value
			if (typeof value === 'number') {
				if (rule.minValue !== undefined && value < rule.minValue) {
					issues.push({
						type: ValidationIssueType.INVALID_VALUE,
						field: String(rule.field),
						message: `Field ${String(rule.field)} must be at least ${rule.minValue}`,
						severity: ValidationSeverity.ERROR,
						value,
						suggestedValue: rule.minValue,
					});
				}

				if (rule.maxValue !== undefined && value > rule.maxValue) {
					issues.push({
						type: ValidationIssueType.INVALID_VALUE,
						field: String(rule.field),
						message: `Field ${String(rule.field)} must be at most ${rule.maxValue}`,
						severity: ValidationSeverity.ERROR,
						value,
						suggestedValue: rule.maxValue,
					});
				}
			}

			// Check min/max length
			if (typeof value === 'string' || Array.isArray(value)) {
				if (rule.minLength !== undefined && value.length < rule.minLength) {
					issues.push({
						type: ValidationIssueType.INVALID_VALUE,
						field: String(rule.field),
						message: `Field ${String(rule.field)} must have at least ${rule.minLength} characters/items`,
						severity: ValidationSeverity.ERROR,
						value,
					});
				}

				if (rule.maxLength !== undefined && value.length > rule.maxLength) {
					issues.push({
						type: ValidationIssueType.INVALID_VALUE,
						field: String(rule.field),
						message: `Field ${String(rule.field)} must have at most ${rule.maxLength} characters/items`,
						severity: ValidationSeverity.ERROR,
						value,
					});
				}
			}

			// Check pattern
			if (typeof value === 'string' && rule.pattern && !rule.pattern.test(value)) {
				issues.push({
					type: ValidationIssueType.INVALID_VALUE,
					field: String(rule.field),
					message: `Field ${String(rule.field)} must match pattern ${rule.pattern}`,
					severity: ValidationSeverity.ERROR,
					value,
				});
			}

			// Check incompatible options
			if (rule.incompatibleWith) {
				for (const incompatibleField of rule.incompatibleWith) {
					if (this.config[incompatibleField] !== undefined) {
						issues.push({
							type: ValidationIssueType.INCOMPATIBLE_OPTIONS,
							field: String(rule.field),
							message: `Field ${String(rule.field)} is incompatible with ${String(incompatibleField)}`,
							severity: ValidationSeverity.WARNING,
							value,
							context: { incompatibleField, incompatibleValue: this.config[incompatibleField] },
						});
					}
				}
			}

			// Check required with options
			if (rule.requiredWith) {
				for (const requiredField of rule.requiredWith) {
					if (this.config[requiredField] !== undefined && this.config[rule.field] === undefined) {
						issues.push({
							type: ValidationIssueType.REQUIRED_FIELD_MISSING,
							field: String(rule.field),
							message: `Field ${String(rule.field)} is required when ${String(requiredField)} is provided`,
							severity: ValidationSeverity.ERROR,
							value: undefined,
							context: { requiredField, requiredValue: this.config[requiredField] },
						});
					}
				}
			}

			// Run custom validator if provided
			if (rule.validator) {
				const validationIssue = rule.validator(value, this.config);
				if (validationIssue) {
					issues.push(validationIssue);
				}
			}
		}

		// Check for unknown options
		const knownFields = rules.map((rule) => rule.field);
		for (const field of Object.keys(this.config)) {
			if (!knownFields.includes(field as keyof OptimizelyConfigOptions)) {
				issues.push({
					type: ValidationIssueType.UNKNOWN_OPTION,
					field,
					message: `Unknown configuration option: ${field}`,
					severity: ValidationSeverity.WARNING,
					value: this.config[field as keyof OptimizelyConfigOptions],
				});
			}
		}

		// Calculate has errors/warnings
		const hasErrors = issues.some((issue) => issue.severity === ValidationSeverity.ERROR);
		const hasWarnings = issues.some((issue) => issue.severity === ValidationSeverity.WARNING);

		return {
			valid: !hasErrors,
			issues,
			hasErrors,
			hasWarnings,
		};
	}

	/**
	 * Validates a specific configuration value.
	 * @param key - The configuration key.
	 * @param value - The value to validate.
	 * @returns A validation issue or null if valid.
	 */
	validateValue<T>(key: keyof OptimizelyConfigOptions, value: T): ValidationIssue | null {
		const rules = this.getValidationRules();
		const rule = rules.find((r) => r.field === key);

		if (!rule) {
			return {
				type: ValidationIssueType.UNKNOWN_OPTION,
				field: String(key),
				message: `Unknown configuration option: ${String(key)}`,
				severity: ValidationSeverity.WARNING,
				value,
			};
		}

		// Check type
		if (rule.type && value !== null && value !== undefined) {
			const types = Array.isArray(rule.type) ? rule.type : [rule.type];
			let typeValid = false;

			for (const type of types) {
				switch (type) {
					case 'string':
						typeValid = typeof value === 'string';
						break;
					case 'number':
						typeValid = typeof value === 'number';
						break;
					case 'boolean':
						typeValid = typeof value === 'boolean';
						break;
					case 'object':
						typeValid = typeof value === 'object' && !Array.isArray(value);
						break;
					case 'array':
						typeValid = Array.isArray(value);
						break;
					default:
						typeValid = false;
				}

				if (typeValid) break;
			}

			if (!typeValid) {
				return {
					type: ValidationIssueType.INVALID_TYPE,
					field: String(key),
					message: `Field ${String(key)} must be of type ${types.join(' or ')}`,
					severity: ValidationSeverity.ERROR,
					value,
				};
			}
		}

		// Run custom validator if provided
		if (rule.validator) {
			// Create a temporary config with this value for context
			const tempConfig = { ...this.config, [key]: value };
			return rule.validator(value as any, tempConfig);
		}

		return null;
	}

	/**
	 * Fixes validation issues in the configuration if possible.
	 * @param issues - The validation issues to fix.
	 * @returns The number of issues fixed.
	 */
	fixValidationIssues(issues: ValidationIssue[]): number {
		let fixedCount = 0;

		for (const issue of issues) {
			// Skip issues that can't be fixed automatically
			if (issue.suggestedValue === undefined && issue.type !== ValidationIssueType.UNKNOWN_OPTION) {
				continue;
			}

			switch (issue.type) {
				case ValidationIssueType.INVALID_TYPE:
				case ValidationIssueType.INVALID_VALUE:
				case ValidationIssueType.DEPRECATED:
					// Apply suggested value if available
					if (issue.suggestedValue !== undefined) {
						if (typeof issue.suggestedValue === 'object' && issue.suggestedValue !== null) {
							// Handle complex suggestions (multiple fields)
							for (const [key, value] of Object.entries(issue.suggestedValue)) {
								this.setValue(key as keyof OptimizelyConfigOptions, value);
							}
						} else {
							// Handle simple suggestion (single value)
							this.setValue(issue.field as keyof OptimizelyConfigOptions, issue.suggestedValue);
						}
						fixedCount++;
					}
					break;

				case ValidationIssueType.UNKNOWN_OPTION:
					// Remove unknown option
					delete this.config[issue.field as keyof OptimizelyConfigOptions];
					fixedCount++;
					break;

				case ValidationIssueType.INCOMPATIBLE_OPTIONS:
					// If we can determine which option to remove from context, do so
					if (issue.context?.incompatibleField) {
						delete this.config[issue.context.incompatibleField as keyof OptimizelyConfigOptions];
						fixedCount++;
					}
					break;
			}
		}

		return fixedCount;
	}

	/**
	 * Extract a header value from Headers, parse it if it's JSON, and set it on the config.
	 * @param headers - The headers object
	 * @param headerName - The name of the header
	 * @param configKey - The configuration key to set
	 */
	private extractHeaderValue(headers: Headers, headerName: string, configKey: keyof OptimizelyConfigOptions): void {
		if (headers.has(headerName)) {
			const headerValue = headers.get(headerName);
			try {
				// Try to parse as JSON
				const parsedValue = headerValue ? JSON.parse(headerValue) : null;
				if (parsedValue !== null) {
					this.setConfigValue(configKey, parsedValue, 'headers');
				}
			} catch (error) {
				this.logger.debug(`${this.logPrefix} Failed to parse ${headerName} as JSON:`, error);
				// For decideOptions, treat as comma-separated list if JSON parse fails
				if (configKey === 'decideOptions' && headerValue) {
					this.setConfigValue(
						configKey,
						headerValue.split(',').map((s) => s.trim()),
						'headers'
					);
				}
			}
		}
	}

	/**
	 * Gets the configured header name for user attributes
	 */
	getAttributesHeaderName(): string | undefined {
		return this.attributesHeaderName || 'X-Optimizely-Attributes-Header';
	}
	/**
	 * Gets the configured header name for event tags
	 */
	getEventTagsHeaderName(): string | undefined {
		return this.eventTagsHeaderName || 'X-Optimizely-Event-Tags-Header';
	}
	/**
	 * Gets the configured header name for event key
	 */
	getEventKeyHeaderName(): string | undefined {
		return this.eventKeyHeaderName || 'X-Optimizely-Event-Key';
	}
	/**
	 * Returns true if Feature Experimentation (FEX) is enabled
	 * Checks if the "X-Optimizely-Enable-FEX" header is enabled.
	 */
	getEnableFex(): boolean {
		// Check the configuration first, then fall back to the class property
		return this.enableFex;
	}
	/**
	 * Returns true if cache override is enabled
	 */
	getOverrideCache(): boolean {
		return this.overrideCache;
	}
	/**
	 * Returns true if response metadata should be included
	 */
	getEnableResponseMetadata(): boolean {
		return this.enableResponseMetadata;
	}
	/**
	 * Returns true if debug headers should be included in responses
	 */
	getEnableDebugHeaders(): boolean {
		return this.enableDebugHeaders;
	}
	/**
	 * Returns true if flags should be loaded from KV storage
	 */
	getEnableFlagsFromKV(): boolean {
		return this.enableFlagsFromKV;
	}
	/**
	 * Returns true if datafile should be loaded from KV storage
	 */
	getEnableDatafileFromKV(): boolean {
		return this.enableDatafileFromKV;
	}

	/**
	 * Validates the current configuration against the schema.
	 * @returns True if the configuration is valid, false otherwise.
	 */
	validateConfiguration(): boolean {
		// Placeholder for actual validation logic
		this.logger.debug('Configuration validation not yet implemented.');
		return true;
	}

	/**
	 * Fetches the Optimizely configuration datafile for a given SDK key.
	 * First attempts to get from KV storage, then falls back to fetching from CDN if not found.
	 *
	 * @param sdkKey - The SDK key.
	 * @returns A promise resolving to the OptimizelyDatafile or null.
	 */
	async getDatafile(sdkKey?: string): Promise<any> {
		if (!sdkKey) {
			this.logger.error(`${this.logPrefix} getDatafile: SDK key is required.`);
			return null;
		}
		this.logger.debug(`${this.logPrefix} Attempting to fetch datafile for key '${sdkKey}'`);
		try {
			// First try to get from storage
			let datafileJson = await this.datafileService.getDatafile(sdkKey);
			// If not found in storage, try to fetch from CDN
			if (!datafileJson) {
				this.logger.debug(`${this.logPrefix} Datafile not found in storage for '${sdkKey}', fetching from CDN.`);
				datafileJson = await this.datafileService.refreshDatafile(sdkKey);
				if (!datafileJson) {
					this.logger.warn(`${this.logPrefix} Datafile not found for SDK key '${sdkKey}'.`);
					return null;
				}
			}
			// Parse the JSON string to an object
			const datafile = JSON.parse(datafileJson);
			// Try to get revision for logging, handle potential errors if structure is unexpected
			let revision = 'unknown';
			if (datafile && typeof datafile === 'object' && 'revision' in datafile) {
				revision = String((datafile as any).revision);
			}
			this.logger.info(
				`${this.logPrefix} Successfully fetched datafile for SDK key '${sdkKey}', revision '${revision}'.`
			);
			return datafile;
		} catch (error) {
			this.logger.error(`${this.logPrefix} Failed to fetch or parse datafile for SDK key '${sdkKey}'.`, error);
			return null;
		}
	}

	/**
	 * Gets the Edge Agent version.
	 * @returns The Edge Agent version string or the default if not available.
	 */
	getEdgeAgentVersion(): string | null {
		if (this.cachedVersion) {
			return this.cachedVersion;
		}
		// Safely check if process.env exists (for Node.js environments)
		try {
			if (typeof process !== 'undefined' && process && process.env) {
				this.cachedVersion = process.env.npm_package_version || process.env.EDGE_AGENT_VERSION || '2.0.0';
			} else {
				// In environments without process.env (like Cloudflare Workers)
				this.cachedVersion = '2.0.0'; // Default version
			}
		} catch (e) {
			// Handle any errors accessing process.env
			this.logger.debug(`${this.logPrefix} process.env not available in this environment, using default version`);
			this.cachedVersion = '2.0.0';
		}
		return this.cachedVersion;
	}

	/**
	 * Gets the current environment (e.g., 'production', 'development').
	 * @returns The environment string or the default if not available.
	 */
	getEnvironment(): string | null {
		if (!this.cachedEnvironment) {
			// Use the environment adapter instead of process.env
			try {
				const envAdapter = this.datafileService.getEnvironmentAdapter();
				this.cachedEnvironment = envAdapter.getVariable('ENVIRONMENT') || 'production';
			} catch (error) {
				this.logger.error('Error getting environment:', error);
				this.cachedEnvironment = 'production';
			}
		}
		return this.cachedEnvironment;
	}

	/**
	 * Gets the CDN provider (e.g., 'cloudflare', 'vercel', 'fastly').
	 * @returns The CDN provider string or the default if not available.
	 */
	getCdnProvider(): string | null {
		if (!this.cachedCdnProvider) {
			try {
				const envAdapter = this.datafileService.getEnvironmentAdapter();
				this.cachedCdnProvider = envAdapter.getVariable('CDN_PROVIDER') || 'cloudflare';
			} catch (error) {
				this.logger.error('Error getting CDN provider:', error);
				this.cachedCdnProvider = 'cloudflare';
			}
		}
		return this.cachedCdnProvider;
	}

	/**
	 * Gets the admin token for secure operations.
	 * @returns The admin token or null if not configured.
	 */
	getAdminToken(): string | null {
		if (!this.cachedAdminToken) {
			try {
				const envAdapter = this.datafileService.getEnvironmentAdapter();
				this.cachedAdminToken = envAdapter.getVariable('ADMIN_TOKEN') || null;
			} catch (error) {
				this.logger.error('Error getting admin token:', error);
				this.cachedAdminToken = null;
			}
		}
		return this.cachedAdminToken;
	}

	/**
	 * Gets the default decide options to apply at the SDK level.
	 * Returns decide options configured for this request that should be applied
	 * consistently at the SDK initialization level.
	 * @returns Array of decide option string literals from the configuration.
	 */
	getDefaultDecideOptions(): string[] {
		// Return the current request's decide options
		return this.getDecideOptions();
	}

	/**
	 * Gets the configured decisions cookie name (for header/cookie parity).
	 */
	getDecisionsCookieName(): string {
		return this.decisionsCookieName;
	}

	/**
	 * Gets the configured visitor ID cookie name (for header/cookie parity).
	 */
	getVisitorIdCookieName(): string {
		return this.visitorIdCookieName;
	}

	/**
	 * Gets the configured decisions header name (for header/cookie parity).
	 */
	getDecisionsHeaderName(): string {
		return this.decisionsHeaderName;
	}

	/**
	 * Gets the configured visitor ID header name (for header/cookie parity).
	 */
	getVisitorIdHeaderName(): string {
		return this.visitorIdHeaderName;
	}

	/**
	 * Gets the implementation version header name.
	 */
	getImplementationVersionHeader(): string {
		return this.settings.implementationVersionHeader;
	}
}
