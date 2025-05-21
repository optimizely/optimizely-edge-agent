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
		
		// First initialize settings, then metadata to ensure proper dependencies
		this.settings = this.initializeSettings();
		this.metadata = this.initializeConfigMetadata();
		
		this.logger.info(`${this.logPrefix} Initialized with default settings`);
		
		// Initialize v1 compatibility properties with defaults
		this.attributesHeaderName = undefined;
		this.eventTagsHeaderName = undefined;
		this.eventKeyHeaderName = undefined;
		this.enableFex = false;
		this.overrideCache = false;
		this.enableResponseMetadata = true;
		this.enableDebugHeaders = false;
		this.enableFlagsFromKV = false;
		this.enableDatafileFromKV = false;
	}

	/**
	 * Resets the configuration object with initialized properties.
	 * This ensures that all properties exist with empty/default values
	 * before applying the OR pattern for configuration precedence.
	 */
	private resetConfig(): void {
		this.config = {
			// String properties
			sdkKey: '',
			visitorId: '',
			eventKey: '',
			flagKey: '',
			serverMode: '',
			datafileAccessToken: '',
			value: undefined,
			
			// Object properties
			attributes: {},
			eventTags: {},
			forcedDecisions: {},
			cdnVariationSettings: {},
			
			// Array properties
			decideOptions: [],
			flagKeys: [],
			
			// Boolean properties with defaults
			trimmedDecisions: this.settings.defaultTrimmedDecisions,
			overrideCache: this.settings.defaultOverrideCache,
			overrideVisitorId: this.settings.defaultOverrideVisitorId,
			setResponseHeaders: this.settings.defaultSetResponseHeaders,
			setResponseCookies: this.settings.defaultSetResponseCookies,
			setRequestHeaders: this.settings.defaultSetRequestHeaders,
			setRequestCookies: this.settings.defaultSetRequestCookies,
			enableFlagsFromKV: this.settings.flagsFromKV,
			datafileFromKV: this.settings.datafileFromKV,
			enableResponseMetadata: this.settings.enableResponseMetadata,
			enableDebugHeaders: false,
			decideAll: false,
			enabledFlagsOnly: false,
			includeReasons: false,
			excludeVariables: false,
			disableDecisionEvent: false,
			ignoreUserProfileService: false,
			enableFex: this.enableFex, // Copy class property for backward compatibility
		};
	}

	/**
	 * Initializes configuration from a request adapter.
	 * @param request - The request adapter.
	 * @returns A promise resolving to the configuration options.
	 */
	async initialize(request: IRequestAdapter): Promise<OptimizelyConfigOptions> {
		this.logger.debug(`${this.logPrefix} Initializing configuration from request`);

		// Reset config for new request with all properties initialized to empty values or defaults
		this.resetConfig();
		
		// Re-initialize metadata to ensure clean state
		this.metadata = this.initializeConfigMetadata();

		// Initialize configuration from different sources with proper precedence
		// First from headers (highest priority)
		await this.initializeFromHeaders(request);

		// DEBUG: Log state after headers (using standard debug log level)
		this.logger.debug(`${this.logPrefix} After headers - sdkKey: ${this.config.sdkKey}, source: ${this.metadata.sdkKeyFrom || 'none'}`);

		// Then from query parameters (overrides if headers didn't set a value)
		await this.initializeFromQueryParams(request);
		
		// DEBUG: Log state after query params
		this.logger.debug(`${this.logPrefix} After query params - sdkKey: ${this.config.sdkKey}, source: ${this.metadata.sdkKeyFrom || 'none'}`);

		// Finally from request body (lowest priority except for defaults)
		await this.initializeFromBody(request);
		
		// DEBUG: Log state after body
		this.logger.debug(`${this.logPrefix} After body - sdkKey: ${this.config.sdkKey}, source: ${this.metadata.sdkKeyFrom || 'none'}`);

		// Apply remaining defaults and computed values
		this.applyDefaults();

		// Update metadata - should be done after all sources processed
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
			
			// Try to automatically fix validation issues
			if (validationResult.issues.length > 0) {
				const fixedCount = this.fixValidationIssues(validationResult.issues);
				if (fixedCount > 0) {
					this.logger.info(`${this.logPrefix} Fixed ${fixedCount} validation issue(s)`);
					
					// Update metadata again after fixes
					this.updateMetadata();
				}
			}
		}

		// Set initialization flag
		this.isInitialized = true;

		// Return the configuration
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
	 * Initializes configuration metadata with empty values.
	 * @returns The initialized metadata.
	 */
	private initializeConfigMetadata(): ConfigMetadata {
		return {
			visitorId: '',
			visitorIdFrom: '',
			sdkKey: '',
			sdkKeyFrom: '',
			attributes: {},
			attributesFrom: '',
			eventTags: {},
			eventTagsFrom: '',
			decideOptions: [],
			decideOptionsFrom: '',
			datafileFrom: '',
			trimmedDecisions: this.settings.defaultTrimmedDecisions,
			trimmedDecisionsFrom: 'default',
			storedDecisionsFound: false,
			storedCookieDecisions: [],
			flagKeysDecided: [],
			flagKeysFrom: '',
			forcedDecisions: [],
			forcedDecisionsFrom: '',
			agentServerMode: false,
			pathName: '',
			cdnVariationSettings: {},
			decideAll: false,
			decideAllFrom: '',
			
			// Boolean parameter tracking
			overrideCache: this.settings.defaultOverrideCache,
			overrideCacheFrom: 'default',
			overrideVisitorId: this.settings.defaultOverrideVisitorId,
			overrideVisitorIdFrom: 'default',
			setResponseHeaders: this.settings.defaultSetResponseHeaders,
			setResponseHeadersFrom: 'default',
			setResponseCookies: this.settings.defaultSetResponseCookies,
			setResponseCookiesFrom: 'default',
			setRequestHeaders: this.settings.defaultSetRequestHeaders,
			setRequestHeadersFrom: 'default',
			setRequestCookies: this.settings.defaultSetRequestCookies,
			setRequestCookiesFrom: 'default',
			enableFex: this.enableFex,
			enableFexFrom: 'default',
			enableFlagsFromKVFrom: 'default',
			datafileFromKVFrom: 'default',
			enableResponseMetadata: this.settings.enableResponseMetadata,
			enableResponseMetadataFrom: 'default',
			excludeVariablesFrom: '',
			eventKeyFrom: '',
			disableDecisionEventFrom: '',
			enabledFlagsOnlyFrom: '',
			includeReasonsFrom: '',
			ignoreUserProfileServiceFrom: '',
			
			// Additional source tracking fields
			flagKeyFrom: '',
			serverModeFrom: '',
			datafileAccessTokenFrom: '',
			cdnVariationSettingsFrom: '',
			valueFrom: '',
			
			precedenceRules: {
				headersOverQueryParams: this.settings.prioritizeHeadersOverQueryParams,
				queryParamsOverBody: true,
				order: 'Headers > Query Params > Body > Defaults'
			}
		};
	}

	/**
	 * Initializes configuration settings.
	 * @returns The initialized settings.
	 */
	private initializeSettings(): ServiceConfigSettings {
		return {
			cdnProvider: 'cloudflare',
			responseJsonKeyName: 'decisions',
			apiPathPrefix: '/api/',
			enableResponseMetadata: true,
			flagsFromKV: this.enableFlagsFromKV,
			datafileFromKV: this.enableDatafileFromKV,
			defaultTrimmedDecisions: true,
			defaultSetResponseCookies: true,
			defaultSetResponseHeaders: true,
			defaultSetRequestCookies: true,
			defaultSetRequestHeaders: true,
			defaultResponseHeadersAndCookies: true,
			defaultOverrideCache: false,
			defaultOverrideVisitorId: false,
			decisionsKeyName: 'optimizely_decisions',
			decisionsCookieName: this.decisionsCookieName,
			visitorIdCookieName: this.visitorIdCookieName,
			decisionsHeaderName: this.decisionsHeaderName,
			visitorIdsHeaderName: this.visitorIdHeaderName,
			prioritizeHeadersOverQueryParams: true,
			sdkKeyHeader: 'x-optimizely-sdk-key',
			setResponseHeadersHeader: 'x-optimizely-set-response-headers',
			setResponseCookiesHeader: 'x-optimizely-set-response-cookies',
			setRequestHeadersHeader: 'x-optimizely-set-request-headers',
			setRequestCookiesHeader: 'x-optimizely-set-request-cookies',
			overrideVisitorIdHeader: 'x-optimizely-override-visitor-id',
			attributesHeader: 'x-optimizely-attributes',
			eventTagsHeader: 'x-optimizely-event-tags',
			datafileAccessTokenHeader: 'x-optimizely-datafile-access-token',
			enableOptimizelyHeader: 'x-optimizely-enable',
			decideOptionsHeader: 'x-optimizely-decide-options',
			visitorIdHeader: 'x-optimizely-visitor-id',
			trimmedDecisionsHeader: 'x-optimizely-trimmed-decisions',
			enableFlagsFromKVHeader: 'x-optimizely-flags-from-kv',
			enableDatafileFromKVHeader: 'x-optimizely-datafile-from-kv',
			enableRespMetadataHeader: 'x-optimizely-response-metadata',
			enableDebugHeadersHeader: 'x-optimizely-debug-headers',
			overrideCacheHeader: 'x-optimizely-override-cache',
			eventKeyHeader: 'x-optimizely-event-key',
			implementationVersionHeader: 'x-optimizely-implementation-version',
			kvFlagKeyName: 'optimizely_flags',
			kvDatafileKeyName: 'optimizely_datafile',
			cookieExpirationInDays: 365,
			
			// Additional header names
			flagKeyHeader: 'x-optimizely-flag-key',
			flagKeysHeader: 'x-optimizely-flag-keys',
			forcedDecisionHeader: 'x-optimizely-forced-decisions',
			cdnSettingsHeader: 'x-optimizely-cdn-settings',
			serverModeHeader: 'x-optimizely-server-mode',
			userIdHeader: 'x-optimizely-user-id',
			decideAllHeader: 'x-optimizely-decide-all',
			enabledFlagsOnlyHeader: 'x-optimizely-enabled-flags-only',
			includeReasonsHeader: 'x-optimizely-include-reasons',
			excludeVariablesHeader: 'x-optimizely-exclude-variables',
			disableDecisionEventHeader: 'x-optimizely-disable-decision-event',
			ignoreUserProfileServiceHeader: 'x-optimizely-ignore-user-profile-service'
		};
	}

	/**
	 * Initializes configuration from HTTP headers.
	 * @param request - The request adapter.
	 */
	private async initializeFromHeaders(request: IRequestAdapter): Promise<void> {
		this.logger.debug(`${this.logPrefix} Initializing from headers`);
		const headers = request.getHeaders();

		// Log all headers for debugging
		const headerEntries: string[] = [];
		headers.forEach((value, key) => {
			headerEntries.push(`${key}=${value}`);
		});
		this.logger.debug(`${this.logPrefix} Request headers: ${headerEntries.join(', ')}`);
		
		// Enhanced helper function for case-insensitive header lookup
		const getCaseInsensitiveHeader = (name: string): string | null => {
			// Use case-insensitive comparison
			let result = null;
			
			// First try exact match
			if (headers.has(name)) {
				return headers.get(name);
			}
			
			// Then case-insensitive match
			headers.forEach((value, key) => {
				if (key.toLowerCase() === name.toLowerCase()) {
					result = value;
				}
			});
			
			return result;
		};

		// === Helper function for setting boolean parameters with source tracking ===
		const setBoolParam = (paramName: keyof OptimizelyConfigOptions, headerName: string, legacyHeaderName?: string) => {
			// Try to get header value with case-insensitive match
			let headerValue = getCaseInsensitiveHeader(headerName);
			
			// Try legacy header if provided and main header not found
			if (!headerValue && legacyHeaderName) {
				headerValue = getCaseInsensitiveHeader(legacyHeaderName);
			}
			
			if (headerValue !== null) {
				this.logger.debug(`${this.logPrefix} Found header ${headerName}: '${headerValue}'`);
				
				// Parse the boolean value, handling various formats:
				// - JSON booleans: true, false
				// - String booleans: "true", "false"
				// - Numeric booleans: "1", "0"
				// - Empty string is treated as true (presence indicates enabled)
				let boolValue: boolean;
				
				if (headerValue === '') {
					// Empty header value treated as true (header presence indicates enabled)
					boolValue = true;
				} else {
					// Try parsing as JSON first
					try {
						const parsedValue = JSON.parse(headerValue.toLowerCase());
						if (typeof parsedValue === 'boolean') {
							boolValue = parsedValue;
				} else {
							// If parsed successfully but not boolean, use truthiness
							boolValue = Boolean(parsedValue);
				}
			} catch (e) {
						// If JSON parsing failed, check for string representations
						const strValue = headerValue.toLowerCase();
						if (strValue === 'true' || strValue === '1') {
							boolValue = true;
						} else if (strValue === 'false' || strValue === '0') {
							boolValue = false;
				} else {
							// For any other string, use presence as true
							boolValue = true;
						}
					}
				}
				
				// Type-safe assignment
				switch(paramName) {
					case 'trimmedDecisions':
					case 'overrideCache':
					case 'overrideVisitorId':
					case 'setResponseHeaders':
					case 'setResponseCookies':
					case 'setRequestHeaders':
					case 'setRequestCookies':
					case 'enableFlagsFromKV':
					case 'datafileFromKV':
					case 'enableResponseMetadata':
					case 'enableDebugHeaders':
					case 'decideAll':
					case 'enabledFlagsOnly':
					case 'includeReasons':
					case 'excludeVariables':
					case 'disableDecisionEvent':
					case 'ignoreUserProfileService':
					case 'enableFex':
						// Type-safe assignment
						this.config[paramName] = boolValue;
						
						// Set the appropriate source tracking field
						this.setMetadataSourceField(paramName, 'header');
						this.logger.debug(`${this.logPrefix} Set ${String(paramName)} from headers: ${boolValue}`);
						break;
					default:
						// Do nothing for incompatible types
						this.logger.warn(`${this.logPrefix} Cannot set non-boolean property ${String(paramName)} to boolean value`);
						break;
				}
			}
		};

		// === String Parameters ===
		// Using direct OR pattern for precedence

		// SDK Key - Use case-insensitive lookup for this critical parameter
		const sdkKeyHeader = getCaseInsensitiveHeader(this.settings.sdkKeyHeader) || getCaseInsensitiveHeader('x-optly-sdk-key');
		if (sdkKeyHeader) {
			this.config.sdkKey = String(sdkKeyHeader).trim();
			this.setMetadataSourceField('sdkKey', 'header');
			this.logger.debug(`${this.logPrefix} Set sdkKey from headers: '${this.config.sdkKey}'`);
		}
		
		// Visitor ID - Also use case-insensitive lookup
		const visitorIdHeader = getCaseInsensitiveHeader(this.settings.visitorIdHeader) || getCaseInsensitiveHeader('x-optly-visitor-id');
		if (visitorIdHeader) {
			this.config.visitorId = String(visitorIdHeader).trim();
			this.setMetadataSourceField('visitorId', 'header');
			this.logger.debug(`${this.logPrefix} Set visitorId from headers: '${this.config.visitorId}'`);
		}
		
		// User ID (as alias for visitor ID)
		if (!this.config.visitorId) {
			const userIdHeader = getCaseInsensitiveHeader(this.settings.userIdHeader) || getCaseInsensitiveHeader('x-optly-user-id');
			if (userIdHeader) {
				this.config.visitorId = String(userIdHeader).trim();
				this.setMetadataSourceField('userId', 'header');
				this.logger.debug(`${this.logPrefix} Set visitorId from userId headers: '${this.config.visitorId}'`);
			}
		}
		
		// Event Key
		const eventKeyHeader = getCaseInsensitiveHeader(this.settings.eventKeyHeader) || getCaseInsensitiveHeader('x-optly-event-key');
		if (eventKeyHeader) {
			this.config.eventKey = String(eventKeyHeader).trim();
			this.setMetadataSourceField('eventKey', 'header');
			this.logger.debug(`${this.logPrefix} Set eventKey from headers: '${this.config.eventKey}'`);
		}
		
		// Flag Key
		const flagKeyHeader = getCaseInsensitiveHeader(this.settings.flagKeyHeader) || getCaseInsensitiveHeader('x-optly-flag-key');
		if (flagKeyHeader) {
			this.config.flagKey = String(flagKeyHeader).trim();
			this.setMetadataSourceField('flagKey', 'header');
			this.logger.debug(`${this.logPrefix} Set flagKey from headers: '${this.config.flagKey}'`);
		}
		
		// Server Mode
		const serverModeHeader = getCaseInsensitiveHeader(this.settings.serverModeHeader) || getCaseInsensitiveHeader('x-optly-server-mode');
		if (serverModeHeader) {
			this.config.serverMode = String(serverModeHeader).trim();
			this.setMetadataSourceField('serverMode', 'header');
			this.logger.debug(`${this.logPrefix} Set serverMode from headers: '${this.config.serverMode}'`);
		}
		
		// Datafile Access Token
		const datafileAccessTokenHeader = getCaseInsensitiveHeader(this.settings.datafileAccessTokenHeader) || getCaseInsensitiveHeader('x-optly-datafile-access-token');
		if (datafileAccessTokenHeader) {
			this.config.datafileAccessToken = String(datafileAccessTokenHeader).trim();
			this.setMetadataSourceField('datafileAccessToken', 'header');
			this.logger.debug(`${this.logPrefix} Set datafileAccessToken from headers`); // Don't log token for security
		}
		
		// === Object Parameters ===
		// These require JSON parsing

		// Attributes
		try {
			const attributesHeader = getCaseInsensitiveHeader(this.settings.attributesHeader) || getCaseInsensitiveHeader('x-optly-attributes');
			if (attributesHeader) {
				const parsedAttributes = JSON.parse(attributesHeader);
				if (typeof parsedAttributes === 'object' && parsedAttributes !== null) {
					this.config.attributes = parsedAttributes;
					this.setMetadataSourceField('attributes', 'header');
					this.logger.debug(`${this.logPrefix} Set attributes from headers: ${JSON.stringify(parsedAttributes)}`);
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} Failed to parse attributes header: ${e}`);
		}
		
		// === Boolean Parameters ===
		// Using the helper function to handle boolean parameters
		
		// Feature Experimentation (FEX) - Special case handling
		// Find header regardless of case
		let fexHeaderValue = null;
		headers.forEach((value, key) => {
			if (key.toLowerCase() === 'x-optimizely-enable-fex') {
				fexHeaderValue = value;
			}
		});
		
		if (fexHeaderValue !== null) {
			// Simple parsing - 'true', '1', or empty string all mean true
			const fexValue = String(fexHeaderValue).toLowerCase() === 'true' || 
						   fexHeaderValue === '1' || 
						   fexHeaderValue === '';
			
			this.config.enableFex = fexValue;
			this.metadata.enableFexFrom = 'header';
			this.metadata.enableFex = fexValue;
			this.logger.debug(`${this.logPrefix} Set enableFex from headers: ${fexValue}, original value: '${fexHeaderValue}'`);
		}
		
		// Cache Override - Both kebab and camel case variations
		setBoolParam('overrideCache', 'X-Optimizely-Override-Cache', 'x-optimizely-override-cache');
		
		// Response Metadata - Several header variations
		setBoolParam('enableResponseMetadata', 'X-Optimizely-Response-Metadata', 'x-optimizely-enable-response-metadata');
		
		// Debug Headers
		setBoolParam('enableDebugHeaders', 'X-Optimizely-Debug-Headers', 'x-optimizely-enable-debug-headers');
		
		// Trimmed Decisions
		setBoolParam('trimmedDecisions', 'X-Optimizely-Trimmed-Decisions', 'x-optimizely-trimmed-decisions');
		
		// Decide All
		setBoolParam('decideAll', 'X-Optimizely-Decide-All', 'x-optimizely-decide-all');
		
		// Enabled Flags Only
		setBoolParam('enabledFlagsOnly', 'X-Optimizely-Enabled-Flags-Only', 'x-optimizely-enabled-flags-only');
		
		// Include Reasons
		setBoolParam('includeReasons', 'X-Optimizely-Include-Reasons', 'x-optimizely-include-reasons');
		
		// Exclude Variables
		setBoolParam('excludeVariables', 'X-Optimizely-Exclude-Variables', 'x-optimizely-exclude-variables');
		
		// Disable Decision Event
		setBoolParam('disableDecisionEvent', 'X-Optimizely-Disable-Decision-Event', 'x-optimizely-disable-decision-event');
		
		// Response Headers/Cookies
		setBoolParam('setResponseHeaders', 'X-Optimizely-Set-Response-Headers', 'x-optimizely-set-response-headers');
		setBoolParam('setResponseCookies', 'X-Optimizely-Set-Response-Cookies', 'x-optimizely-set-response-cookies');
		setBoolParam('setRequestHeaders', 'X-Optimizely-Set-Request-Headers', 'x-optimizely-set-request-headers');
		setBoolParam('setRequestCookies', 'X-Optimizely-Set-Request-Cookies', 'x-optimizely-set-request-cookies');
		
		// Storage settings
		setBoolParam('enableFlagsFromKV', 'X-Optimizely-Flags-From-KV', 'x-optimizely-flags-from-kv');
		setBoolParam('datafileFromKV', 'X-Optimizely-Datafile-From-KV', 'x-optimizely-datafile-from-kv');
	}

	/**
	 * Track the source of a configuration parameter.
	 * This helper method sets the appropriate source tracking field in metadata
	 * without using dynamic property access.
	 * 
	 * @param paramName - The name of the parameter
	 * @param source - The source of the parameter value
	 */
	private setMetadataSourceField(paramName: keyof OptimizelyConfigOptions, source: string): void {
		// CRITICAL: ALWAYS set the source tracking fields (xxxFrom) regardless of enableResponseMetadata,
		// because these fields are used for precedence checking in query params and body processing.
		// Failing to set these fields breaks parameter precedence.
		
		// The actual metadata values are only updated when enableResponseMetadata is not false
		const shouldUpdateValue = this.config.enableResponseMetadata !== false;

		// For each parameter, set the appropriate metadata field
		// ALWAYS set the source tracking (xxxFrom) field regardless of enableResponseMetadata setting
		// Only set the actual value fields when shouldUpdateValue is true
		switch(paramName) {
			case 'sdkKey':
				this.metadata.sdkKeyFrom = source;
				if (shouldUpdateValue) this.metadata.sdkKey = this.config.sdkKey || '';
				break;
			case 'visitorId':
			case 'userId': // Alias for visitorId
				this.metadata.visitorIdFrom = paramName === 'userId' ? `${source} (userId)` : source;
				if (shouldUpdateValue) this.metadata.visitorId = this.config.visitorId || '';
				break;
			case 'attributes':
				this.metadata.attributesFrom = source;
				if (shouldUpdateValue && this.config.attributes) {
					this.metadata.attributes = this.config.attributes;
				}
				break;
			case 'eventTags':
				this.metadata.eventTagsFrom = source;
				if (shouldUpdateValue && this.config.eventTags) {
					this.metadata.eventTags = this.config.eventTags;
				}
				break;
			case 'forcedDecisions':
				this.metadata.forcedDecisionsFrom = source;
				// Keep metadata.forcedDecisions as an empty array to maintain type compatibility
				if (shouldUpdateValue) {
					this.metadata.forcedDecisions = [];
				}
				break;
			case 'decideOptions':
				this.metadata.decideOptionsFrom = source;
				if (shouldUpdateValue && this.config.decideOptions) {
					this.metadata.decideOptions = this.config.decideOptions;
				}
				break;
			case 'flagKeys':
				this.metadata.flagKeysFrom = source;
				break;
			case 'trimmedDecisions':
				this.metadata.trimmedDecisionsFrom = source;
				if (shouldUpdateValue) this.metadata.trimmedDecisions = !!this.config.trimmedDecisions;
				break;
			case 'overrideCache':
				this.metadata.overrideCacheFrom = source;
				if (shouldUpdateValue) this.metadata.overrideCache = !!this.config.overrideCache;
				break;
			case 'overrideVisitorId':
				this.metadata.overrideVisitorIdFrom = source;
				if (shouldUpdateValue) this.metadata.overrideVisitorId = !!this.config.overrideVisitorId;
				break;
			case 'setResponseHeaders':
				this.metadata.setResponseHeadersFrom = source;
				if (shouldUpdateValue) this.metadata.setResponseHeaders = !!this.config.setResponseHeaders;
				break;
			case 'setResponseCookies':
				this.metadata.setResponseCookiesFrom = source;
				if (shouldUpdateValue) this.metadata.setResponseCookies = !!this.config.setResponseCookies;
				break;
			case 'setRequestHeaders':
				this.metadata.setRequestHeadersFrom = source;
				if (shouldUpdateValue) this.metadata.setRequestHeaders = !!this.config.setRequestHeaders;
				break;
			case 'setRequestCookies':
				this.metadata.setRequestCookiesFrom = source;
				if (shouldUpdateValue) this.metadata.setRequestCookies = !!this.config.setRequestCookies;
				break;
			case 'enableFlagsFromKV':
				this.metadata.enableFlagsFromKVFrom = source;
				// No value field for this in metadata
				break;
			case 'datafileFromKV':
				this.metadata.datafileFromKVFrom = source;
				// No value field for this in metadata
				break;
			case 'enableResponseMetadata':
				this.metadata.enableResponseMetadataFrom = source;
				if (shouldUpdateValue) this.metadata.enableResponseMetadata = !!this.config.enableResponseMetadata;
				break;
			case 'decideAll':
				this.metadata.decideAllFrom = source;
				if (shouldUpdateValue) this.metadata.decideAll = !!this.config.decideAll;
				break;
			case 'enabledFlagsOnly':
				this.metadata.enabledFlagsOnlyFrom = source;
				break;
			case 'includeReasons':
				this.metadata.includeReasonsFrom = source;
				break;
			case 'excludeVariables':
				this.metadata.excludeVariablesFrom = source;
				break;
			case 'disableDecisionEvent':
				this.metadata.disableDecisionEventFrom = source;
				break;
			case 'ignoreUserProfileService':
				this.metadata.ignoreUserProfileServiceFrom = source;
				break;
			case 'enableFex':
				this.metadata.enableFexFrom = source;
				if (shouldUpdateValue) this.metadata.enableFex = !!this.config.enableFex;
				break;
			case 'eventKey':
				this.metadata.eventKeyFrom = source;
				break;
			case 'flagKey':
				this.metadata.flagKeyFrom = source;
				break;
			case 'serverMode':
				this.metadata.serverModeFrom = source;
				break;
			case 'datafileAccessToken':
				this.metadata.datafileAccessTokenFrom = source;
				break;
			case 'cdnVariationSettings':
				this.metadata.cdnVariationSettingsFrom = source;
				if (shouldUpdateValue && this.config.cdnVariationSettings) {
					this.metadata.cdnVariationSettings = this.config.cdnVariationSettings;
				}
				break;
			case 'value':
				this.metadata.valueFrom = source;
				break;
		}
	}

	/**
	 * Updates configuration metadata.
	 */
	private updateMetadata(): void {
		// Update all metadata fields from config
		// String fields
		this.metadata.visitorId = this.config.visitorId || '';
		this.metadata.sdkKey = this.config.sdkKey || '';
		
		// Object fields (only if response metadata is enabled)
		if (this.config.attributes && typeof this.config.attributes === 'object') {
			this.metadata.attributes = this.config.attributes;
		}
		
		if (this.config.eventTags && typeof this.config.eventTags === 'object') {
			this.metadata.eventTags = this.config.eventTags;
		}
		
		if (this.config.cdnVariationSettings && typeof this.config.cdnVariationSettings === 'object') {
			this.metadata.cdnVariationSettings = this.config.cdnVariationSettings;
		}
		
		// Handle forcedDecisions - it's an object in config but array in metadata
		if (this.config.forcedDecisions && typeof this.config.forcedDecisions === 'object') {
			// Keep metadata.forcedDecisions as an empty array to maintain type compatibility
			// The actual config data is stored in the config object
			this.metadata.forcedDecisions = [];
		}
		
		// Array fields
		if (Array.isArray(this.config.decideOptions)) {
			this.metadata.decideOptions = [...this.config.decideOptions];
		}
		
		// Ensure flagKeysDecided is initialized
		if (!Array.isArray(this.metadata.flagKeysDecided)) {
			this.metadata.flagKeysDecided = [];
		}
		
		// Boolean fields - check for explicit null/undefined to avoid overwriting
		if (this.config.trimmedDecisions !== undefined && this.config.trimmedDecisions !== null) {
			this.metadata.trimmedDecisions = !!this.config.trimmedDecisions;
		}
		
		if (this.config.decideAll !== undefined && this.config.decideAll !== null) {
			this.metadata.decideAll = !!this.config.decideAll;
		}
		
		if (this.config.overrideCache !== undefined && this.config.overrideCache !== null) {
			this.metadata.overrideCache = !!this.config.overrideCache;
		}
		
		if (this.config.overrideVisitorId !== undefined && this.config.overrideVisitorId !== null) {
			this.metadata.overrideVisitorId = !!this.config.overrideVisitorId;
		}
		
		if (this.config.setResponseHeaders !== undefined && this.config.setResponseHeaders !== null) {
			this.metadata.setResponseHeaders = !!this.config.setResponseHeaders;
		}
		
		if (this.config.setResponseCookies !== undefined && this.config.setResponseCookies !== null) {
			this.metadata.setResponseCookies = !!this.config.setResponseCookies;
		}
		
		if (this.config.setRequestHeaders !== undefined && this.config.setRequestHeaders !== null) {
			this.metadata.setRequestHeaders = !!this.config.setRequestHeaders;
		}
		
		if (this.config.setRequestCookies !== undefined && this.config.setRequestCookies !== null) {
			this.metadata.setRequestCookies = !!this.config.setRequestCookies;
		}
		
		if (this.config.enableFex !== undefined && this.config.enableFex !== null) {
			this.metadata.enableFex = !!this.config.enableFex;
		}
		
		if (this.config.enableResponseMetadata !== undefined && this.config.enableResponseMetadata !== null) {
			this.metadata.enableResponseMetadata = !!this.config.enableResponseMetadata;
		}
		
		// Set an updated timestamp
		this.metadata.updatedAt = new Date().toISOString();
	}

	/**
	 * Applies default values to configuration.
	 */
	private applyDefaults(): void {
		// Apply default values for any missing properties
		if (!this.config.visitorId) {
			this.config.visitorId = '';
		}
		if (!this.config.sdkKey) {
			this.config.sdkKey = '';
		}
		if (!this.config.flagKey) {
			this.config.flagKey = '';
		}
		if (!this.config.serverMode) {
			this.config.serverMode = '';
		}
		if (!this.config.datafileAccessToken) {
			this.config.datafileAccessToken = '';
		}
		if (!this.config.attributes) {
			this.config.attributes = {};
		}
		if (!this.config.eventTags) {
			this.config.eventTags = {};
		}
		if (!this.config.forcedDecisions) {
			this.config.forcedDecisions = {};
		}
		if (!this.config.cdnVariationSettings) {
			this.config.cdnVariationSettings = {};
		}
		if (!this.config.decideOptions) {
			this.config.decideOptions = [];
		}
		if (!this.config.flagKeys) {
			this.config.flagKeys = [];
		}
		if (this.config.trimmedDecisions === null || this.config.trimmedDecisions === undefined) {
			this.config.trimmedDecisions = this.settings.defaultTrimmedDecisions;
		}
		if (this.config.overrideCache === null || this.config.overrideCache === undefined) {
			this.config.overrideCache = this.settings.defaultOverrideCache;
		}
		if (this.config.overrideVisitorId === null || this.config.overrideVisitorId === undefined) {
			this.config.overrideVisitorId = this.settings.defaultOverrideVisitorId;
		}
		if (this.config.setResponseHeaders === null || this.config.setResponseHeaders === undefined) {
			this.config.setResponseHeaders = this.settings.defaultSetResponseHeaders;
		}
		if (this.config.setResponseCookies === null || this.config.setResponseCookies === undefined) {
			this.config.setResponseCookies = this.settings.defaultSetResponseCookies;
		}
		if (this.config.setRequestHeaders === null || this.config.setRequestHeaders === undefined) {
			this.config.setRequestHeaders = this.settings.defaultSetRequestHeaders;
		}
		if (this.config.setRequestCookies === null || this.config.setRequestCookies === undefined) {
			this.config.setRequestCookies = this.settings.defaultSetRequestCookies;
		}
		if (this.config.enableFlagsFromKV === null || this.config.enableFlagsFromKV === undefined) {
			this.config.enableFlagsFromKV = this.settings.flagsFromKV;
		}
		if (this.config.datafileFromKV === null || this.config.datafileFromKV === undefined) {
			this.config.datafileFromKV = this.settings.datafileFromKV;
		}
		if (this.config.enableResponseMetadata === null || this.config.enableResponseMetadata === undefined) {
			this.config.enableResponseMetadata = this.settings.enableResponseMetadata;
		}
		if (this.config.enableDebugHeaders === null || this.config.enableDebugHeaders === undefined) {
			this.config.enableDebugHeaders = false;
		}
		if (this.config.decideAll === null || this.config.decideAll === undefined) {
			this.config.decideAll = false;
		}
		if (this.config.enabledFlagsOnly === null || this.config.enabledFlagsOnly === undefined) {
			this.config.enabledFlagsOnly = false;
		}
		if (this.config.includeReasons === null || this.config.includeReasons === undefined) {
			this.config.includeReasons = false;
		}
		if (this.config.excludeVariables === null || this.config.excludeVariables === undefined) {
			this.config.excludeVariables = false;
		}
		if (this.config.disableDecisionEvent === null || this.config.disableDecisionEvent === undefined) {
			this.config.disableDecisionEvent = false;
		}
		if (this.config.ignoreUserProfileService === null || this.config.ignoreUserProfileService === undefined) {
			this.config.ignoreUserProfileService = false;
		}
		if (this.config.enableFex === null || this.config.enableFex === undefined) {
			this.config.enableFex = this.enableFex;
		}
	}

	/**
	 * Validates the configuration.
	 * @returns The validation result.
	 */
	public validate(): ValidationResult {
		const issues: ValidationIssue[] = [];
		
		// Get validation rules and apply them
		const rules = this.getValidationRules();

		for (const rule of rules) {
			const key = rule.field;
			const value = this.config[key];

			// Check if required field is missing
			if (rule.required && (value === undefined || value === null || value === '')) {
				issues.push({
					type: ValidationIssueType.REQUIRED_FIELD_MISSING,
					field: key,
					message: `Required field '${key}' is missing`,
					severity: ValidationSeverity.ERROR
				});
				continue;
			}

			// Skip validation of undefined optional fields
			if (value === undefined || value === null) {
				continue;
			}

			// Apply custom validator if provided
			if (rule.validator) {
				const issue = rule.validator(value, this.config);
				if (issue) {
					issues.push(issue);
				}
			}
		}
		
		const hasErrors = issues.some(issue => issue.severity === ValidationSeverity.ERROR);
		const hasWarnings = issues.some(issue => issue.severity === ValidationSeverity.WARNING);

		return {
			valid: !hasErrors,
			issues,
			hasErrors,
			hasWarnings
		};
	}

	/**
	 * Gets the validation rules for configuration options.
	 * @returns An array of validation rules.
	 */
	getValidationRules(): ValidationRule[] {
		// Return basic validation rules - this will be expanded in future PRs
		return [
			{ field: 'sdkKey', type: 'string', required: true }
		];
	}

	/**
	 * Validates a specific configuration value.
	 * @param key - The configuration key.
	 * @param value - The value to validate.
	 * @returns A validation issue or null if valid.
	 */
	validateValue<T>(key: keyof OptimizelyConfigOptions, value: T): ValidationIssue | null {
		// Basic validation implementation - will be expanded in future PRs
		if (key === 'sdkKey' && (!value || typeof value !== 'string')) {
				return {
					type: ValidationIssueType.INVALID_TYPE,
				field: key,
				message: 'SDK Key must be a non-empty string',
					severity: ValidationSeverity.ERROR,
				value
			};
		}
		return null;
	}

	/**
	 * Fixes validation issues in the configuration if possible.
	 * @param issues - The validation issues to fix.
	 * @returns The number of issues fixed.
	 */
	fixValidationIssues(issues: ValidationIssue[]): number {
		// Basic implementation - will be expanded in future PRs
		let fixed = 0;
		for (const issue of issues) {
			if (issue.type === ValidationIssueType.INVALID_TYPE && issue.suggestedValue !== undefined) {
				// Safe property access
				const fieldName = issue.field as keyof OptimizelyConfigOptions;
				if (fieldName in this.config) {
					// We need to manually check field types
					switch(fieldName) {
						case 'sdkKey':
						case 'visitorId':
						case 'userId':
						case 'flagKey':
						case 'eventKey':
						case 'serverMode':
						case 'datafileAccessToken':
							if (typeof issue.suggestedValue === 'string') {
								this.config[fieldName] = issue.suggestedValue;
								fixed++;
							}
							break;
						
						case 'attributes':
						case 'eventTags':
						case 'forcedDecisions':
						case 'cdnVariationSettings':
							if (typeof issue.suggestedValue === 'object') {
								this.config[fieldName] = issue.suggestedValue;
								fixed++;
							}
							break;
						
						case 'decideOptions':
						case 'flagKeys':
							if (Array.isArray(issue.suggestedValue)) {
								this.config[fieldName] = issue.suggestedValue;
								fixed++;
							}
							break;
						
						case 'value':
							if (typeof issue.suggestedValue === 'number') {
								this.config[fieldName] = issue.suggestedValue;
								fixed++;
							}
							break;
						
						// For boolean properties
						case 'trimmedDecisions':
						case 'overrideCache':
						case 'overrideVisitorId':
						case 'setResponseHeaders':
						case 'setResponseCookies':
						case 'setRequestHeaders':
						case 'setRequestCookies':
						case 'enableFlagsFromKV':
						case 'datafileFromKV':
						case 'enableResponseMetadata':
						case 'enableDebugHeaders':
						case 'decideAll':
						case 'enabledFlagsOnly':
						case 'includeReasons':
						case 'excludeVariables':
						case 'disableDecisionEvent':
						case 'ignoreUserProfileService':
						case 'enableFex':
							if (typeof issue.suggestedValue === 'boolean') {
								this.config[fieldName] = issue.suggestedValue;
								fixed++;
							}
							break;
					}
				}
			}
		}
		return fixed;
	}

	/**
	 * Gets the edge agent version, if any.
	 * @returns The edge agent version string or null.
	 */
	getEdgeAgentVersion(): string | null {
		// This will be implemented in future PRs
		return null;
	}

	/**
	 * Gets the configured admin token, if any.
	 * @returns The admin token string or null.
	 */
	getAdminToken(): string | null {
		// This will be implemented in future PRs
		return this.cachedAdminToken;
	}

	/**
	 * Checks if the global cache override setting is enabled.
	 * @returns True if cache should be overridden (no-store), false otherwise.
	 */
	getOverrideCache(): boolean {
		return !!this.config.overrideCache;
	}

	/**
	 * Gets the default decide options to apply at the SDK level.
	 * @returns Array of decide option string literals.
	 */
	getDefaultDecideOptions(): string[] {
		// This will be implemented in future PRs
		return [];
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
	 * Returns true if the FEX (Feature Experimentation) bypass is enabled.
	 */
	getEnableFex(): boolean {
		return !!this.config.enableFex;
	}

	/**
 * Returns true if datafile should be loaded from KV storage.
 */
getEnableDatafileFromKV(): boolean {
	return !!this.config.datafileFromKV;
}

	/**
 * Returns true if flags should be loaded from KV storage.
 */
getEnableFlagsFromKV(): boolean {
	return !!this.config.enableFlagsFromKV;
}

	/**
 * Returns true if response metadata should be included in responses.
 */
getEnableResponseMetadata(): boolean {
	return !!this.config.enableResponseMetadata;
}

	/**
	 * Returns the current environment string (e.g., 'production', 'staging').
	 */
	getEnvironment(): string | null {
		// This will be implemented in future PRs
		return this.cachedEnvironment;
	}

	/**
	 * Returns the current CDN provider string (e.g., 'cloudflare', 'fastly').
	 */
	getCdnProvider(): string | null {
		// This will be implemented in future PRs
		return this.cachedCdnProvider;
	}

	/**
	 * Fetches the Optimizely configuration datafile for a given SDK key.
	 * @param sdkKey - The SDK key.
	 * @returns A promise resolving to the OptimizelyDatafile or null.
	 */
	async getDatafile(sdkKey?: string): Promise<any> {
		// Use a safe default for the SDK key
		const safeKey = sdkKey || this.config.sdkKey || '';
		
		// Pass the datafileFromKV option from config to the datafile service
		const useKV = !!this.config.datafileFromKV;
		
		this.logger.debug(`${this.logPrefix} Getting datafile for SDK key ${safeKey}, useKV=${useKV}, datafileFromKV in config=${JSON.stringify(this.config.datafileFromKV)}`);
		
		// Try getting the datafile with detailed error handling
		try {
			const datafileStr = await this.datafileService.getDatafile(safeKey, { useKV });
			
			if (!datafileStr) {
				this.logger.error(`${this.logPrefix} Datafile is null or undefined - fetch failed`);
				return null;
			} else {
				this.logger.debug(`${this.logPrefix} Successfully fetched datafile (${datafileStr.length} characters)`);
				
				// Parse the datafile string to JSON before returning
				try {
					// Return the parsed JSON object, not the string
					const datafileObj = JSON.parse(datafileStr);
					return datafileObj;
				} catch (parseError) {
					this.logger.error(`${this.logPrefix} Failed to parse datafile JSON:`, parseError);
					return null;
				}
			}
		} catch (error) {
			this.logger.error(`${this.logPrefix} Error fetching datafile:`, error);
			throw error;
		}
	}

	/**
 * Returns true if debug headers should be included in responses.
 */
getEnableDebugHeaders(): boolean {
	return !!this.config.enableDebugHeaders;
}

	/**
	 * Gets the implementation version header name.
	 * @returns The implementation version header name.
	 */
	getImplementationVersionHeader(): string {
		return this.settings.implementationVersionHeader;
	}

	/**
	 * Initializes configuration from query parameters.
	 * @param request - The request adapter.
	 */
	private async initializeFromQueryParams(request: IRequestAdapter): Promise<void> {
		this.logger.debug(`${this.logPrefix} Initializing from query parameters`);
		
		// Get parameters from URL
		const url = request.getUrl();
		const searchParams = url.searchParams;
		
		// Log all query parameters for debugging
		this.logger.debug(`${this.logPrefix} Request query parameters: ${searchParams.toString()}`);

		// === Helper function for setting boolean parameters with source tracking ===
		const setQueryBoolParam = (paramName: keyof OptimizelyConfigOptions, paramKey: string, fallbackKey?: string) => {
			// Skip if already set from headers (higher priority)
			const metadataField = `${String(paramName)}From`;
			if (metadataField in this.metadata && (this.metadata as any)[metadataField] === 'header') {
				return;
			}

			// Use case-insensitive parameter lookup
			const queryValue = getParamCaseInsensitive(paramKey) || (fallbackKey ? getParamCaseInsensitive(fallbackKey) : null);
			if (queryValue !== null) {
				// Parse boolean value handling multiple formats
				let boolValue: boolean;
				
				if (queryValue === '') {
					// Empty value treated as true (presence indicates enabled)
					boolValue = true;
				} else {
					// Try parsing as JSON first
					try {
						const parsedValue = JSON.parse(queryValue.toLowerCase());
						if (typeof parsedValue === 'boolean') {
							boolValue = parsedValue;
						} else {
							// If parsed successfully but not boolean, use truthiness
							boolValue = Boolean(parsedValue);
						}
					} catch (e) {
						// If JSON parsing failed, check for string representations
						const strValue = queryValue.toLowerCase();
						if (strValue === 'true' || strValue === '1') {
							boolValue = true;
						} else if (strValue === 'false' || strValue === '0') {
							boolValue = false;
						} else {
							// For any other string, use presence as true
							boolValue = true;
						}
					}
				}
				
				// Type-safe assignment
				switch(paramName) {
					case 'trimmedDecisions':
					case 'overrideCache':
					case 'overrideVisitorId':
					case 'setResponseHeaders':
					case 'setResponseCookies':
					case 'setRequestHeaders':
					case 'setRequestCookies':
					case 'enableFlagsFromKV':
					case 'datafileFromKV':
					case 'enableResponseMetadata':
					case 'enableDebugHeaders':
					case 'decideAll':
					case 'enabledFlagsOnly':
					case 'includeReasons':
					case 'excludeVariables':
					case 'disableDecisionEvent':
					case 'ignoreUserProfileService':
					case 'enableFex':
						// Type-safe assignment
						this.config[paramName] = boolValue;
						
						// Now set the appropriate source tracking field
						this.setMetadataSourceField(paramName, 'query');
						this.logger.debug(`${this.logPrefix} Set ${String(paramName)} from query params: ${boolValue}`);
						break;
					default:
						// Do nothing for incompatible types
						this.logger.warn(`${this.logPrefix} Cannot set non-boolean property ${String(paramName)} to boolean value`);
						break;
				}
			}
		};

		// === String Parameters ===
		// Using direct OR pattern for precedence, but only if not already set from headers

		// SDK Key - Use case-insensitive parameter lookup for consistency
		// Helper for case-insensitive parameter lookup
		const getParamCaseInsensitive = (baseName: string): string | null => {
			let result = null;
			// Try all common case variations
			const variations = [`${baseName}`, `${baseName.toLowerCase()}`, `${baseName.toUpperCase()}`, 
								baseName.replace(/([A-Z])/g, '_$1').toLowerCase(), // camelCase to snake_case
								baseName.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]; // snake_case to camelCase
			for (const name of variations) {
				if (searchParams.has(name)) {
					result = searchParams.get(name);
					break;
				}
			}
			return result;
		};

		// SDK Key
		if (!this.metadata.sdkKeyFrom || this.metadata.sdkKeyFrom !== 'header') {
			const sdkKeyParam = getParamCaseInsensitive('sdkKey') || getParamCaseInsensitive('sdk_key');
			if (sdkKeyParam) {
				this.config.sdkKey = sdkKeyParam.trim();
				this.setMetadataSourceField('sdkKey', 'query');
				this.logger.debug(`${this.logPrefix} Set sdkKey from query params: '${this.config.sdkKey}'`);
			}
		}
		
		// Visitor ID
		if (!this.metadata.visitorIdFrom || this.metadata.visitorIdFrom !== 'header') {
			const visitorIdParam = getParamCaseInsensitive('visitorId') || getParamCaseInsensitive('visitor_id');
			if (visitorIdParam) {
				this.config.visitorId = visitorIdParam.trim();
				this.setMetadataSourceField('visitorId', 'query');
				this.logger.debug(`${this.logPrefix} Set visitorId from query params: '${this.config.visitorId}'`);
			}
		}
		
		// User ID (as alias for visitor ID)
		if (!this.metadata.visitorIdFrom || this.metadata.visitorIdFrom !== 'header') {
			if (!this.config.visitorId) {
				const userIdParam = getParamCaseInsensitive('userId') || getParamCaseInsensitive('user_id');
				if (userIdParam) {
					this.config.visitorId = userIdParam.trim();
					this.setMetadataSourceField('userId', 'query');
					this.logger.debug(`${this.logPrefix} Set visitorId from userId query param: '${this.config.visitorId}'`);
				}
			}
		}
		
		// Event Key
		if (!this.metadata.eventKeyFrom || this.metadata.eventKeyFrom !== 'header') {
			const eventKeyParam = getParamCaseInsensitive('eventKey') || getParamCaseInsensitive('event_key');
			if (eventKeyParam) {
				this.config.eventKey = eventKeyParam.trim();
				this.setMetadataSourceField('eventKey', 'query');
				this.logger.debug(`${this.logPrefix} Set eventKey from query params: '${this.config.eventKey}'`);
			}
		}
		
		// Flag Key
		if (!this.metadata.flagKeyFrom || this.metadata.flagKeyFrom !== 'header') {
			const flagKeyParam = getParamCaseInsensitive('flagKey') || getParamCaseInsensitive('flag_key');
			if (flagKeyParam) {
				this.config.flagKey = flagKeyParam.trim();
				this.setMetadataSourceField('flagKey', 'query');
				this.logger.debug(`${this.logPrefix} Set flagKey from query params: '${this.config.flagKey}'`);
			}
		}
		
		// Server Mode
		if (!this.metadata.serverModeFrom || this.metadata.serverModeFrom !== 'header') {
			const serverModeParam = getParamCaseInsensitive('serverMode') || getParamCaseInsensitive('server_mode');
			if (serverModeParam) {
				this.config.serverMode = serverModeParam.trim();
				this.setMetadataSourceField('serverMode', 'query');
				this.logger.debug(`${this.logPrefix} Set serverMode from query params: '${this.config.serverMode}'`);
			}
		}
		
		// Datafile Access Token
		if (!this.metadata.datafileAccessTokenFrom || this.metadata.datafileAccessTokenFrom !== 'header') {
			const tokenParam = getParamCaseInsensitive('datafileAccessToken') || getParamCaseInsensitive('datafile_access_token');
			if (tokenParam) {
				this.config.datafileAccessToken = tokenParam.trim();
				this.setMetadataSourceField('datafileAccessToken', 'query');
				this.logger.debug(`${this.logPrefix} Set datafileAccessToken from query params`); // Don't log token for security
			}
		}
		
		// === Object Parameters ===
		// These require JSON parsing
		
		// Attributes
		if (!this.metadata.attributesFrom || this.metadata.attributesFrom !== 'header') {
			try {
				const attributesParam = getParamCaseInsensitive('attributes') || getParamCaseInsensitive('attrs');
				if (attributesParam) {
					const parsedAttributes = JSON.parse(attributesParam);
					if (typeof parsedAttributes === 'object' && parsedAttributes !== null) {
						this.config.attributes = parsedAttributes;
						this.setMetadataSourceField('attributes', 'query');
						this.logger.debug(`${this.logPrefix} Set attributes from query: ${JSON.stringify(parsedAttributes)}`);
					}
				}
			} catch (e) {
				this.logger.debug(`${this.logPrefix} Failed to parse attributes from query params: ${e}`);
			}
		}
		
		// === Boolean Parameters ===
		// Using helper for consistent handling
		
		// Only set these if not already set from headers
		setQueryBoolParam('enableFex', 'enable_fex', 'enableFex');
		setQueryBoolParam('overrideCache', 'override_cache', 'overrideCache');
		setQueryBoolParam('enableResponseMetadata', 'response_metadata', 'enableResponseMetadata');
		setQueryBoolParam('enableDebugHeaders', 'debug_headers', 'enableDebugHeaders');
		setQueryBoolParam('trimmedDecisions', 'trimmed_decisions', 'trimmedDecisions');
		setQueryBoolParam('decideAll', 'decide_all', 'decideAll');
		setQueryBoolParam('enabledFlagsOnly', 'enabled_flags_only', 'enabledFlagsOnly');
		setQueryBoolParam('includeReasons', 'include_reasons', 'includeReasons');
		setQueryBoolParam('excludeVariables', 'exclude_variables', 'excludeVariables');
		setQueryBoolParam('disableDecisionEvent', 'disable_decision_event', 'disableDecisionEvent');
		setQueryBoolParam('ignoreUserProfileService', 'ignore_user_profile_service', 'ignoreUserProfileService');
		setQueryBoolParam('setResponseHeaders', 'set_response_headers', 'setResponseHeaders');
		setQueryBoolParam('setResponseCookies', 'set_response_cookies', 'setResponseCookies');
		setQueryBoolParam('setRequestHeaders', 'set_request_headers', 'setRequestHeaders');
		setQueryBoolParam('setRequestCookies', 'set_request_cookies', 'setRequestCookies');
		setQueryBoolParam('enableFlagsFromKV', 'flags_from_kv', 'enableFlagsFromKV');
		setQueryBoolParam('datafileFromKV', 'datafile_from_kv', 'datafileFromKV');
	}

	/**
	 * Initializes configuration from the request body.
	 * @param request - The request adapter.
	 */
	private async initializeFromBody(request: IRequestAdapter): Promise<void> {
		this.logger.debug(`${this.logPrefix} Initializing from request body`);
		
		try {
			// Get body as JSON from the request adapter
			const body = await request.getBodyJson<Record<string, any>>();
			
			if (!body || typeof body !== 'object') {
				this.logger.debug(`${this.logPrefix} No JSON body found or body is not an object, skipping body initialization`);
				return;
			}

			this.logger.debug(`${this.logPrefix} Request body: ${JSON.stringify(body)}`);
			
			// Helper function to get case-insensitive property from body
			const getBodyPropCaseInsensitive = (key: string): any => {
				// Check direct property first
				if (key in body) {
					return body[key];
				}
				
				// Check for case-insensitive match
				const lowerKey = key.toLowerCase();
				const bodyKeys = Object.keys(body);
				for (const bodyKey of bodyKeys) {
					if (bodyKey.toLowerCase() === lowerKey) {
						return body[bodyKey];
					}
				}
				
				// Try common variations
				const variations = [
					key,
					key.toLowerCase(),
					key.toUpperCase(),
					key.replace(/([A-Z])/g, '_$1').toLowerCase(), // camelCase to snake_case
					key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) // snake_case to camelCase
				];
				
				for (const variant of variations) {
					if (variant in body) {
						return body[variant];
					}
				}
				
				return undefined;
			};
			
			// === Helper function for setting boolean parameters from body ===
			const setBodyBoolParam = (paramName: keyof OptimizelyConfigOptions, bodyKey: string, snakeBodyKey?: string) => {
				// Skip if already set from headers or query params (higher priorities)
				const metadataField = `${String(paramName)}From`;
				if (metadataField in this.metadata && 
					((this.metadata as any)[metadataField] === 'header' || (this.metadata as any)[metadataField] === 'query')) {
					return;
				}
				
				// Get property using case-insensitive lookup
				const bodyValue = getBodyPropCaseInsensitive(bodyKey) || (snakeBodyKey ? getBodyPropCaseInsensitive(snakeBodyKey) : undefined);
				
				if (bodyValue === undefined) {
					return; // Property not found in body
				}
				
				// Parse boolean value correctly
				let boolValue: boolean;
				
				if (bodyValue === null || bodyValue === undefined) {
					return; // Skip null/undefined values
				} else if (typeof bodyValue === 'boolean') {
					// Direct boolean value
					boolValue = bodyValue;
				} else if (typeof bodyValue === 'number') {
					// Number as boolean (0 = false, anything else = true)
					boolValue = bodyValue !== 0;
				} else if (typeof bodyValue === 'string') {
					// String representation
					const strValue = bodyValue.toLowerCase();
					if (strValue === 'true' || strValue === '1') {
						boolValue = true;
					} else if (strValue === 'false' || strValue === '0') {
						boolValue = false;
					} else {
						// For any other string, use presence as true
						boolValue = true;
					}
				} else {
					// For objects or other types, use truthiness
					boolValue = Boolean(bodyValue);
				}
				
				// Type-safe assignment
				switch(paramName) {
					case 'trimmedDecisions':
					case 'overrideCache':
					case 'overrideVisitorId':
					case 'setResponseHeaders':
					case 'setResponseCookies':
					case 'setRequestHeaders':
					case 'setRequestCookies':
					case 'enableFlagsFromKV':
					case 'datafileFromKV':
					case 'enableResponseMetadata':
					case 'enableDebugHeaders':
					case 'decideAll':
					case 'enabledFlagsOnly':
					case 'includeReasons':
					case 'excludeVariables':
					case 'disableDecisionEvent':
					case 'ignoreUserProfileService':
					case 'enableFex':
						// Type-safe assignment
						this.config[paramName] = boolValue;
						
						// Set the appropriate source tracking field
						this.setMetadataSourceField(paramName, 'body');
						this.logger.debug(`${this.logPrefix} Set ${String(paramName)} from body: ${boolValue}`);
						break;
					default:
						// Do nothing for incompatible types
						this.logger.warn(`${this.logPrefix} Cannot set non-boolean property ${String(paramName)} to boolean value`);
						break;
				}
			};
			
			// === String Parameters ===
			// Only set if not already set from headers or query params (lowest priority except defaults)
			
			// SDK Key
			if (!this.metadata.sdkKeyFrom || (this.metadata.sdkKeyFrom !== 'header' && this.metadata.sdkKeyFrom !== 'query')) {
				const sdkKeyValue = getBodyPropCaseInsensitive('sdkKey') || getBodyPropCaseInsensitive('sdk_key');
				if (typeof sdkKeyValue === 'string') {
					this.config.sdkKey = sdkKeyValue.trim();
					this.setMetadataSourceField('sdkKey', 'body');
					this.logger.debug(`${this.logPrefix} Set sdkKey from body: '${this.config.sdkKey}'`);
				}
			}
			
			// Visitor ID
			if (!this.metadata.visitorIdFrom || (this.metadata.visitorIdFrom !== 'header' && this.metadata.visitorIdFrom !== 'query')) {
				const visitorIdValue = getBodyPropCaseInsensitive('visitorId') || getBodyPropCaseInsensitive('visitor_id');
				if (typeof visitorIdValue === 'string') {
					this.config.visitorId = visitorIdValue.trim();
					this.setMetadataSourceField('visitorId', 'body');
					this.logger.debug(`${this.logPrefix} Set visitorId from body: '${this.config.visitorId}'`);
				}
			}
			
			// User ID (as alias for visitor ID)
			if (!this.metadata.visitorIdFrom || (this.metadata.visitorIdFrom !== 'header' && this.metadata.visitorIdFrom !== 'query')) {
				if (!this.config.visitorId) {
					const userIdValue = getBodyPropCaseInsensitive('userId') || getBodyPropCaseInsensitive('user_id');
					if (typeof userIdValue === 'string') {
						this.config.visitorId = userIdValue.trim();
						this.setMetadataSourceField('userId', 'body');
						this.logger.debug(`${this.logPrefix} Set visitorId from userId in body: '${this.config.visitorId}'`);
					}
				}
			}
			
			// Event Key
			if ((!this.metadata.eventKeyFrom || (this.metadata.eventKeyFrom !== 'header' && this.metadata.eventKeyFrom !== 'query')) && 
				('eventKey' in body || 'event_key' in body)) {
				const eventKeyValue = body.eventKey || body.event_key;
				if (typeof eventKeyValue === 'string') {
					this.config.eventKey = eventKeyValue.trim();
					this.setMetadataSourceField('eventKey', 'body');
					this.logger.debug(`${this.logPrefix} Set eventKey from body: '${this.config.eventKey}'`);
				}
			}
			
			// Flag Key
			if ((!this.metadata.flagKeyFrom || (this.metadata.flagKeyFrom !== 'header' && this.metadata.flagKeyFrom !== 'query')) && 
				('flagKey' in body || 'flag_key' in body)) {
				const flagKeyValue = body.flagKey || body.flag_key;
				if (typeof flagKeyValue === 'string') {
					this.config.flagKey = flagKeyValue.trim();
					this.setMetadataSourceField('flagKey', 'body');
					this.logger.debug(`${this.logPrefix} Set flagKey from body: '${this.config.flagKey}'`);
				}
			}
			
			// Server Mode
			if ((!this.metadata.serverModeFrom || (this.metadata.serverModeFrom !== 'header' && this.metadata.serverModeFrom !== 'query')) && 
				('serverMode' in body || 'server_mode' in body)) {
				const serverModeValue = body.serverMode || body.server_mode;
				if (typeof serverModeValue === 'string') {
					this.config.serverMode = serverModeValue.trim();
					this.setMetadataSourceField('serverMode', 'body');
					this.logger.debug(`${this.logPrefix} Set serverMode from body: '${this.config.serverMode}'`);
				}
			}
			
			// Datafile Access Token
			if ((!this.metadata.datafileAccessTokenFrom || (this.metadata.datafileAccessTokenFrom !== 'header' && this.metadata.datafileAccessTokenFrom !== 'query')) && 
				('datafileAccessToken' in body || 'datafile_access_token' in body)) {
				const tokenValue = body.datafileAccessToken || body.datafile_access_token;
				if (typeof tokenValue === 'string') {
					this.config.datafileAccessToken = tokenValue.trim();
					this.setMetadataSourceField('datafileAccessToken', 'body');
					this.logger.debug(`${this.logPrefix} Set datafileAccessToken from body`); // Don't log token for security
				}
			}
			
			// === Object Parameters ===
			// These require proper typing verification
			
			// Attributes
			if ((!this.metadata.attributesFrom || (this.metadata.attributesFrom !== 'header' && this.metadata.attributesFrom !== 'query')) && 
				'attributes' in body && typeof body.attributes === 'object' && body.attributes !== null) {
				this.config.attributes = body.attributes;
				this.setMetadataSourceField('attributes', 'body');
				this.logger.debug(`${this.logPrefix} Set attributes from body: ${JSON.stringify(body.attributes)}`);
			}
			
			// Event Tags
			if ((!this.metadata.eventTagsFrom || (this.metadata.eventTagsFrom !== 'header' && this.metadata.eventTagsFrom !== 'query')) && 
				('eventTags' in body || 'event_tags' in body)) {
				const eventTags = body.eventTags || body.event_tags;
				if (typeof eventTags === 'object' && eventTags !== null) {
					this.config.eventTags = eventTags;
					this.setMetadataSourceField('eventTags', 'body');
					this.logger.debug(`${this.logPrefix} Set eventTags from body: ${JSON.stringify(eventTags)}`);
				}
			}
			
			// === Boolean Parameters ===
			// Using helper function for consistent handling
			
			// Only set boolean params if not already set from higher priority sources
			setBodyBoolParam('enableFex', 'enableFex', 'enable_fex');
			setBodyBoolParam('overrideCache', 'overrideCache', 'override_cache');
			setBodyBoolParam('overrideVisitorId', 'overrideVisitorId', 'override_visitor_id');
			setBodyBoolParam('enableResponseMetadata', 'enableResponseMetadata', 'enable_response_metadata');
			setBodyBoolParam('enableDebugHeaders', 'enableDebugHeaders', 'enable_debug_headers');
			setBodyBoolParam('trimmedDecisions', 'trimmedDecisions', 'trimmed_decisions');
			setBodyBoolParam('decideAll', 'decideAll', 'decide_all');
			setBodyBoolParam('enabledFlagsOnly', 'enabledFlagsOnly', 'enabled_flags_only');
			setBodyBoolParam('includeReasons', 'includeReasons', 'include_reasons');
			setBodyBoolParam('excludeVariables', 'excludeVariables', 'exclude_variables');
			setBodyBoolParam('disableDecisionEvent', 'disableDecisionEvent', 'disable_decision_event');
			setBodyBoolParam('ignoreUserProfileService', 'ignore_user_profile_service', 'ignoreUserProfileService');
			setBodyBoolParam('setResponseHeaders', 'setResponseHeaders', 'set_response_headers');
			setBodyBoolParam('setResponseCookies', 'setResponseCookies', 'set_response_cookies');
			setBodyBoolParam('setRequestHeaders', 'setRequestHeaders', 'set_request_headers');
			setBodyBoolParam('setRequestCookies', 'setRequestCookies', 'set_request_cookies');
			setBodyBoolParam('enableFlagsFromKV', 'enableFlagsFromKV', 'enable_flags_from_kv');
			setBodyBoolParam('datafileFromKV', 'datafileFromKV', 'datafile_from_kv');
		} catch (e) {
			this.logger.debug(`${this.logPrefix} Failed to parse or process request body: ${e}`);
		}
	}
}