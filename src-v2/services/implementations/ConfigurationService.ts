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

// Define the metadata source type
type MetadataSource = 'header' | 'query' | 'body' | 'default' | 'cookie' | 'localstorage';

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
	 * Whether to fall back to default sources when KV storage fails
	 */
	private kvStorageFallback: boolean = true;

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
		const requestId = Math.random().toString(36).substring(2, 10);
		this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Initializing configuration from request`);

		// Reset config for new request with all properties initialized to empty values or defaults
		this.resetConfig();
		// Debug log removed
		
		// Re-initialize metadata to ensure clean state
		this.metadata = this.initializeConfigMetadata();
		// Debug log removed

		// CRITICAL: First collect ALL values from ALL sources WITHOUT setting metadata
		// This is essential for proper precedence ordering
		
		// Extract parameters from each source with setSource=false to prevent premature source setting
		const headerValues = await this.extractHeaderValues(request, false, requestId);
		const queryValues = await this.extractQueryValues(request, false, requestId);
		const bodyValues = await this.extractBodyValues(request, false, requestId);
		
		// Log critical parameters for debugging
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Parameters from headers: sdkKey=${headerValues.sdkKey || 'none'}, visitorId=${headerValues.visitorId || 'none'}, flagKey=${headerValues.flagKey || 'none'}`);
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Parameters from query: sdkKey=${queryValues.sdkKey || 'none'}, visitorId=${queryValues.visitorId || 'none'}, flagKey=${queryValues.flagKey || 'none'}`);
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Parameters from body: sdkKey=${bodyValues.sdkKey || 'none'}, visitorId=${bodyValues.visitorId || 'none'}, flagKey=${bodyValues.flagKey || 'none'}`);

		// Apply values in strict precedence order (Headers > Query > Body > Defaults)
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Applying values with precedence: Headers > Query > Body > Defaults`);
		
		// Apply each source in correct order with its respective source type
		if (Object.keys(headerValues).length > 0) {
			this.applyIndividualSourceValues(headerValues, 'header', requestId);
		}
		
		if (Object.keys(queryValues).length > 0) {
			this.applyIndividualSourceValues(queryValues, 'query', requestId);
		}
		
		if (Object.keys(bodyValues).length > 0) {
			this.applyIndividualSourceValues(bodyValues, 'body', requestId);
		}
		
		// Apply remaining defaults and computed values
		this.applyDefaults();
		
		// Update metadata after all sources are processed
		this.updateMetadata();
		
		// Log final parameter values and sources
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Final config: sdkKey=${this.config.sdkKey} (from ${this.metadata.sdkKeyFrom}), visitorId=${this.config.visitorId} (from ${this.metadata.visitorIdFrom}), flagKey=${this.config.flagKey} (from ${this.metadata.flagKeyFrom})`);

		// Validate the configuration
		const validationResult = this.validate();
		
		// Log validation issues and attempt fixes
		if (validationResult.hasErrors) {
			this.logger.warn(
				`${this.logPrefix} [REQUEST:${requestId}] Configuration has ${
					validationResult.issues.filter((i) => i.severity === ValidationSeverity.ERROR).length
				} error(s)`
			);
			
			// Try to automatically fix validation issues
			if (validationResult.issues.length > 0) {
				const fixedCount = this.fixValidationIssues(validationResult.issues);
				if (fixedCount > 0) {
					this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Fixed ${fixedCount} validation issue(s)`);
					this.updateMetadata(); // Update metadata after fixes
				}
			}
		}

		// Set initialization flag
		this.isInitialized = true;
		this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Configuration initialized`);

		// Return the configuration
		return this.config;
	}

	/**
	 * Helper method to safely stringify objects for logging
	 * @param obj - Object to stringify
	 * @returns A string representation of the object that's safe for logging
	 */
	private safeStringify(obj: any): string {
		try {
			return JSON.stringify(obj);
		} catch (e) {
			return '[Object cannot be stringified]';
		}
	}

	/**
	 * Simple, bulletproof header extraction
	 * @param request - The request adapter
	 * @param headerName - The header name to look for
	 * @returns The header value or null if not found
	 */
	private getHeader(request: IRequestAdapter, headerName: string, requestId?: string): string | null {
		const headers = request.getHeaders();
		const headerNameLower = headerName.toLowerCase();
		
		this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId || 'unknown'}] Looking for header '${headerName}' (lowercase: '${headerNameLower}')`);
		
		// Log all available headers for debugging
		if (requestId) {
			try {
				const allHeaderNames: string[] = [];
				if (typeof headers.forEach === 'function') {
					headers.forEach((value, key) => {
						allHeaderNames.push(`${key}=${value}`);
					});
					this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] Available headers: ${allHeaderNames.join(', ')}`);
				}
			} catch (e) {
				this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] Could not list all headers: ${e}`);
			}
		}
		
		// One pass, lowercase everything, single comparison
		let value = null;
		let matchedHeaderName = null;
		
		headers.forEach((headerValue, key) => {
			const keyLower = key.toLowerCase();
			if (keyLower === headerNameLower) {
				value = headerValue;
				matchedHeaderName = key;
				if (requestId) {
					this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] MATCH FOUND - Original: '${key}', Lowercase: '${keyLower}', Value: '${headerValue}'`);
				}
			} else if (requestId && keyLower.includes(headerNameLower.replace(/^x-/, ''))) {
				// Log near-matches for debugging
				this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] NEAR MATCH - Found related header '${key}' (${keyLower}) when looking for '${headerNameLower}'`);
			}
		});
		
		// Log failure to find header
		if (value === null && requestId) {
			this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] HEADER NOT FOUND - '${headerName}' not present in request`);
		} else if (requestId) {
			this.logger.debug(`${this.logPrefix} [HEADER DEBUG] [REQUEST:${requestId}] HEADER EXTRACTED - Using '${matchedHeaderName}' = '${value}'`);
		}
		
		return value;
	}

	/**
	 * Extracts configuration values from request headers without applying them
	 * @param request - The request adapter
	 * @returns A partial configuration object with values from headers
	 */
	private async extractHeaderValues(request: IRequestAdapter, setSource: boolean, requestId: string): Promise<Partial<OptimizelyConfigOptions>> {
		const values: Partial<OptimizelyConfigOptions> = {};
		const headers = request.getHeaders();
		
		// DEBUG LOG: Log available headers
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] HEADERS DEBUG - Starting header extraction`);
		
		// Log all available header names for debugging
		try {
			const allHeaderKeys: string[] = [];
			// Only works if Headers implementation supports forEach
			if (typeof headers.forEach === 'function') {
				headers.forEach((_, key) => {
					allHeaderKeys.push(key);
				});
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] HEADERS DEBUG - Headers present: ${allHeaderKeys.join(', ')}`);
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] HEADERS DEBUG - Could not list all headers: ${e}`);
		}

		// Helper function to parse boolean header values
		const parseHeaderBool = (value: string | null): boolean | null => {
			if (value === null) return null;
			
			if (value === '') return true; // Empty value means enabled
			
			try {
				// Try parsing as JSON
				const parsed = JSON.parse(value.toLowerCase());
				if (typeof parsed === 'boolean') return parsed;
				return Boolean(parsed); // Fallback to truthiness
			} catch (e) {
				// If JSON parsing failed, check string values
				const str = value.toLowerCase();
				if (str === 'true' || str === '1') return true;
				if (str === 'false' || str === '0') return false;
				return true; // Default to true for any other string value
			}
		};

		// === String Parameters - SIMPLIFIED HEADER EXTRACTION ===
		
		// SDK Key - just get it directly
		const sdkKeyHeader = this.getHeader(request, 'x-optimizely-sdk-key', requestId);
		if (sdkKeyHeader) {
			values.sdkKey = String(sdkKeyHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY FOUND - Setting to: ${values.sdkKey}`);
			if (setSource) {
				this.setMetadataSourceField('sdkKey', 'header');
			}
		}
		
		// Visitor ID
		const visitorIdHeader = this.getHeader(request, 'x-optimizely-visitor-id', requestId);
		if (visitorIdHeader) {
			values.visitorId = String(visitorIdHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] VISITOR ID FOUND - Setting to: ${values.visitorId}`);
			if (setSource) {
				this.setMetadataSourceField('visitorId', 'header');
			}
		}
		
		// User ID (as alias for visitor ID)
		if (!values.visitorId) {
			const userIdHeader = this.getHeader(request, 'x-optimizely-user-id', requestId);
			if (userIdHeader) {
				values.visitorId = String(userIdHeader).trim();
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] USER ID FOUND - Using as visitorId: ${values.visitorId}`);
				if (setSource) {
					this.setMetadataSourceField('visitorId', 'header');
				}
			}
		}
		
		// Event Key
		const eventKeyHeader = this.getHeader(request, 'x-optimizely-event-key', requestId);
		if (eventKeyHeader) {
			values.eventKey = String(eventKeyHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] EVENT KEY FOUND - Setting to: ${values.eventKey}`);
			if (setSource) {
				this.setMetadataSourceField('eventKey', 'header');
			}
		}
		
		// Flag Key
		const flagKeyHeader = this.getHeader(request, 'x-optimizely-flag-key', requestId);
		if (flagKeyHeader) {
			values.flagKey = String(flagKeyHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] FLAG KEY FOUND - Setting to: ${values.flagKey}`);
			if (setSource) {
				this.setMetadataSourceField('flagKey', 'header');
			}
		}
		
		// Server Mode
		const serverModeHeader = this.getHeader(request, 'x-optimizely-server-mode', requestId);
		if (serverModeHeader) {
			values.serverMode = String(serverModeHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SERVER MODE FOUND - Setting to: ${values.serverMode}`);
			if (setSource) this.setMetadataSourceField('serverMode', 'header');
		}
		
		// Datafile Access Token
		const datafileAccessTokenHeader = this.getHeader(request, 'x-optimizely-datafile-access-token', requestId);
		if (datafileAccessTokenHeader) {
			values.datafileAccessToken = String(datafileAccessTokenHeader).trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] DATAFILE ACCESS TOKEN FOUND - Setting to: ${values.datafileAccessToken}`);
			if (setSource) this.setMetadataSourceField('datafileAccessToken', 'header');
		}
		
		// === Object Parameters ===
		// Attributes
		try {
			const attributesHeader = this.getHeader(request, 'x-optimizely-attributes', requestId);
			if (attributesHeader) {
				const parsedAttributes = JSON.parse(attributesHeader);
				if (typeof parsedAttributes === 'object' && parsedAttributes !== null) {
					values.attributes = parsedAttributes;
					this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] ATTRIBUTES FOUND - Parsed and set`);
					if (setSource) this.setMetadataSourceField('attributes', 'header');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse attributes header: ${e}`);
		}
		
		// Forced Decisions
		try {
			const forcedDecisionsHeader = this.getHeader(request, 'x-optimizely-forced-decisions', requestId);
			if (forcedDecisionsHeader) {
				const parsedForcedDecisions = JSON.parse(forcedDecisionsHeader);
				if (typeof parsedForcedDecisions === 'object' && parsedForcedDecisions !== null) {
					values.forcedDecisions = parsedForcedDecisions;
					this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] FORCED DECISIONS FOUND - Parsed and set`);
					if (setSource) this.setMetadataSourceField('forcedDecisions', 'header');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse forced decisions header: ${e}`);
		}
		
		// === Boolean Parameters ===
		// Feature Experimentation (FEX)
		const fexHeader = this.getHeader(request, 'x-optimizely-enable-fex', requestId);
		if (fexHeader !== null) {
			values.enableFex = parseHeaderBool(fexHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] ENABLE FEX FOUND - Setting to: ${values.enableFex}`);
			if (setSource) this.setMetadataSourceField('enableFex', 'header');
		}
		
		// Cache Override
		const overrideCacheHeader = this.getHeader(request, 'x-optimizely-override-cache', requestId);
		if (overrideCacheHeader !== null) {
			values.overrideCache = parseHeaderBool(overrideCacheHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] OVERRIDE CACHE FOUND - Setting to: ${values.overrideCache}`);
			if (setSource) this.setMetadataSourceField('overrideCache', 'header');
		}
		
		// Response Metadata - already handled above with standard header x-optimizely-enable-response-metadata
		
		// Debug Headers - already handled above with standard header x-optimizely-enable-debug-headers
		
		// Trimmed Decisions
		const trimmedDecisionsHeader = this.getHeader(request, 'x-optimizely-trimmed-decisions', requestId);
		if (trimmedDecisionsHeader !== null) {
			values.trimmedDecisions = parseHeaderBool(trimmedDecisionsHeader) ?? this.settings.defaultTrimmedDecisions;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TRIMMED DECISIONS FOUND - Setting to: ${values.trimmedDecisions}`);
			if (setSource) this.setMetadataSourceField('trimmedDecisions', 'header');
		}
		
		// Decide All
		const decideAllHeader = this.getHeader(request, 'x-optimizely-decide-all', requestId);
		if (decideAllHeader !== null) {
			values.decideAll = parseHeaderBool(decideAllHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] DECIDE ALL FOUND - Setting to: ${values.decideAll}`);
			if (setSource) this.setMetadataSourceField('decideAll', 'header');
		}
		
		// Enabled Flags Only
		const enabledFlagsOnlyHeader = this.getHeader(request, 'x-optimizely-enabled-flags-only', requestId);
		if (enabledFlagsOnlyHeader !== null) {
			values.enabledFlagsOnly = parseHeaderBool(enabledFlagsOnlyHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] ENABLED FLAGS ONLY FOUND - Setting to: ${values.enabledFlagsOnly}`);
			if (setSource) this.setMetadataSourceField('enabledFlagsOnly', 'header');
		}
		
		// Include Reasons
		const includeReasonsHeader = this.getHeader(request, 'x-optimizely-include-reasons', requestId);
		if (includeReasonsHeader !== null) {
			values.includeReasons = parseHeaderBool(includeReasonsHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] INCLUDE REASONS FOUND - Setting to: ${values.includeReasons}`);
			if (setSource) this.setMetadataSourceField('includeReasons', 'header');
		}
		
		// Exclude Variables
		const excludeVariablesHeader = this.getHeader(request, 'x-optimizely-exclude-variables', requestId);
		if (excludeVariablesHeader !== null) {
			values.excludeVariables = parseHeaderBool(excludeVariablesHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] EXCLUDE VARIABLES FOUND - Setting to: ${values.excludeVariables}`);
			if (setSource) this.setMetadataSourceField('excludeVariables', 'header');
		}
		
		// Disable Decision Event
		const disableDecisionEventHeader = this.getHeader(request, 'x-optimizely-disable-decision-event', requestId);
		if (disableDecisionEventHeader !== null) {
			values.disableDecisionEvent = parseHeaderBool(disableDecisionEventHeader) ?? false;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] DISABLE DECISION EVENT FOUND - Setting to: ${values.disableDecisionEvent}`);
			if (setSource) this.setMetadataSourceField('disableDecisionEvent', 'header');
		}
		
		// Response Headers/Cookies
		const setRespHeadersHeader = this.getHeader(request, 'x-optimizely-set-response-headers', requestId);
		if (setRespHeadersHeader !== null) {
			values.setResponseHeaders = parseHeaderBool(setRespHeadersHeader) ?? this.settings.defaultSetResponseHeaders;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SET RESPONSE HEADERS FOUND - Setting to: ${values.setResponseHeaders}`);
			if (setSource) this.setMetadataSourceField('setResponseHeaders', 'header');
		}
		
		const setRespCookiesHeader = this.getHeader(request, 'x-optimizely-set-response-cookies', requestId);
		if (setRespCookiesHeader !== null) {
			values.setResponseCookies = parseHeaderBool(setRespCookiesHeader) ?? this.settings.defaultSetResponseCookies;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SET RESPONSE COOKIES FOUND - Setting to: ${values.setResponseCookies}`);
			if (setSource) this.setMetadataSourceField('setResponseCookies', 'header');
		}
		
		const setReqHeadersHeader = this.getHeader(request, 'x-optimizely-set-request-headers', requestId);
		if (setReqHeadersHeader !== null) {
			values.setRequestHeaders = parseHeaderBool(setReqHeadersHeader) ?? this.settings.defaultSetRequestHeaders;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SET REQUEST HEADERS FOUND - Setting to: ${values.setRequestHeaders}`);
			if (setSource) this.setMetadataSourceField('setRequestHeaders', 'header');
		}
		
		const setReqCookiesHeader = this.getHeader(request, 'x-optimizely-set-request-cookies', requestId);
		if (setReqCookiesHeader !== null) {
			values.setRequestCookies = parseHeaderBool(setReqCookiesHeader) ?? this.settings.defaultSetRequestCookies;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SET REQUEST COOKIES FOUND - Setting to: ${values.setRequestCookies}`);
			if (setSource) this.setMetadataSourceField('setRequestCookies', 'header');
		}
		
		// Storage settings
		const flagsFromKVHeader = this.getHeader(request, 'x-optimizely-flags-from-kv', requestId);
		if (flagsFromKVHeader !== null) {
			values.enableFlagsFromKV = parseHeaderBool(flagsFromKVHeader) ?? this.settings.flagsFromKV;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] FLAGS FROM KV FOUND - Setting to: ${values.enableFlagsFromKV}`);
			if (setSource) this.setMetadataSourceField('enableFlagsFromKV', 'header');
		}
		
		const datafileFromKVHeader = this.getHeader(request, 'x-optimizely-datafile-from-kv', requestId);
		if (datafileFromKVHeader !== null) {
			values.datafileFromKV = parseHeaderBool(datafileFromKVHeader) ?? this.settings.datafileFromKV;
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] DATAFILE FROM KV FOUND - Setting to: ${values.datafileFromKV}`);
			if (setSource) this.setMetadataSourceField('datafileFromKV', 'header');
		}
		
		return values;
	}
	
	/**
	 * Extracts configuration values from query parameters without applying them
	 * @param request - The request adapter
	 * @returns A partial configuration object with values from query parameters
	 */
	private async extractQueryValues(request: IRequestAdapter, setSource: boolean, requestId: string): Promise<Partial<OptimizelyConfigOptions>> {
		const values: Partial<OptimizelyConfigOptions> = {};
		const url = request.getUrl();
		const searchParams = new URL(url).searchParams;
		
		// Helper for case-insensitive parameter lookup
		const getParamCaseInsensitive = (baseName: string): string | null => {
			// Try common param name variations
			const variations = [
				baseName,                  // Original
				baseName.toLowerCase(),    // lowercase
				baseName.replace(/_/g, ''),// no underscores
				// Convert from snake_case to camelCase
				baseName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
			];
			
			for (const variation of variations) {
				if (searchParams.has(variation)) {
					return searchParams.get(variation);
				}
			}
			
			return null;
		};
		
		// Helper for parsing boolean params
		const parseBoolParam = (value: string | null): boolean | null => {
			if (value === null) return null;
			
			if (value === '') return true; // Empty value means enabled
			
			try {
				const parsed = JSON.parse(value.toLowerCase());
				if (typeof parsed === 'boolean') return parsed;
				return Boolean(parsed); // Fallback to truthiness
			} catch (e) {
				// If JSON parsing failed, check string values
				const str = value.toLowerCase();
				if (str === 'true' || str === '1') return true;
				if (str === 'false' || str === '0') return false;
				return true; // Default to true for any other string value
			}
		};
		
		// === String Parameters ===
		// SDK Key
		const sdkKeyParam = getParamCaseInsensitive('sdk_key');
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY QUERY DEBUG - sdkKeyParam value: ${sdkKeyParam}`);
		
		if (sdkKeyParam) {
			values.sdkKey = sdkKeyParam.trim();
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY QUERY DEBUG - Setting values.sdkKey to: ${values.sdkKey}`);
			if (setSource) {
				this.setMetadataSourceField('sdkKey', 'query');
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY QUERY DEBUG - Setting metadata source to 'query'`);
			}
		}
		
		// Visitor ID
		const visitorIdParam = getParamCaseInsensitive('visitor_id');
		if (visitorIdParam) {
			values.visitorId = visitorIdParam.trim();
			if (setSource) this.setMetadataSourceField('visitorId', 'query');
		}
		
		// User ID (as alias for visitor ID)
		if (!values.visitorId) {
			const userIdParam = getParamCaseInsensitive('user_id');
			if (userIdParam) {
				values.visitorId = userIdParam.trim();
				if (setSource) this.setMetadataSourceField('userId', 'query');
			}
		}
		
		// Event Key
		const eventKeyParam = getParamCaseInsensitive('event_key');
		if (eventKeyParam) {
			values.eventKey = eventKeyParam.trim();
			if (setSource) this.setMetadataSourceField('eventKey', 'query');
		}
		
		// Flag Key
		const flagKeyParam = getParamCaseInsensitive('flag_key');
		if (flagKeyParam) {
			values.flagKey = flagKeyParam.trim();
			if (setSource) this.setMetadataSourceField('flagKey', 'query');
		}
		
		// Server Mode
		const serverModeParam = getParamCaseInsensitive('server_mode');
		if (serverModeParam) {
			values.serverMode = serverModeParam.trim();
			if (setSource) this.setMetadataSourceField('serverMode', 'query');
		}
		
		// Datafile Access Token
		const datafileAccessTokenParam = getParamCaseInsensitive('datafile_access_token');
		if (datafileAccessTokenParam) {
			values.datafileAccessToken = datafileAccessTokenParam.trim();
			if (setSource) this.setMetadataSourceField('datafileAccessToken', 'query');
		}
		
		// === JSON Object Parameters ===
		// Attributes
		try {
			const attributesParam = getParamCaseInsensitive('attributes');
			if (attributesParam) {
				const parsedAttributes = JSON.parse(attributesParam);
				if (typeof parsedAttributes === 'object' && parsedAttributes !== null) {
					values.attributes = parsedAttributes;
					if (setSource) this.setMetadataSourceField('attributes', 'query');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse attributes from query params: ${e}`);
		}
		
		// Forced Decisions
		try {
			const forcedDecisionsParam = getParamCaseInsensitive('forced_decisions');
			if (forcedDecisionsParam) {
				const parsedForcedDecisions = JSON.parse(forcedDecisionsParam);
				if (typeof parsedForcedDecisions === 'object' && parsedForcedDecisions !== null) {
					values.forcedDecisions = parsedForcedDecisions;
					if (setSource) this.setMetadataSourceField('forcedDecisions', 'query');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse forced decisions from query params: ${e}`);
		}
		
		// === Boolean parameters ===
		const setQueryBoolParam = (paramName: keyof OptimizelyConfigOptions, queryName: string) => {
			const queryValue = getParamCaseInsensitive(queryName);
			if (queryValue !== null) {
				const boolValue = parseBoolParam(queryValue) ?? false;
				
				// Only set boolean parameters - TypeScript enforces this with the constraint
				this.setBooleanProperty(values, paramName, boolValue);
				if (setSource) this.setMetadataSourceField(paramName, 'query');
			}
		};
		
		// Boolean parameters
		setQueryBoolParam('enableFex', 'enable_fex');
		setQueryBoolParam('overrideCache', 'override_cache');
		setQueryBoolParam('enableResponseMetadata', 'enable_response_metadata');
		setQueryBoolParam('enableDebugHeaders', 'enable_debug_headers');
		setQueryBoolParam('trimmedDecisions', 'trimmed_decisions');
		setQueryBoolParam('decideAll', 'decide_all');
		setQueryBoolParam('enabledFlagsOnly', 'enabled_flags_only');
		setQueryBoolParam('includeReasons', 'include_reasons');
		setQueryBoolParam('excludeVariables', 'exclude_variables');
		setQueryBoolParam('disableDecisionEvent', 'disable_decision_event');
		setQueryBoolParam('setResponseHeaders', 'set_response_headers');
		setQueryBoolParam('setResponseCookies', 'set_response_cookies');
		setQueryBoolParam('setRequestHeaders', 'set_request_headers');
		setQueryBoolParam('setRequestCookies', 'set_request_cookies');
		setQueryBoolParam('enableFlagsFromKV', 'flags_from_kv');
		setQueryBoolParam('datafileFromKV', 'datafile_from_kv');
		
		return values;
	}
	
	/**
	 * Extracts configuration values from request body without applying them
	 * @param request - The request adapter
	 * @returns A partial configuration object with values from body
	 */
	private async extractBodyValues(request: IRequestAdapter, setSource: boolean, requestId: string): Promise<Partial<OptimizelyConfigOptions>> {
		const values: Partial<OptimizelyConfigOptions> = {};
		
		try {
			// Get body as JSON from the request adapter
			const body = await request.getBodyJson<Record<string, any>>();
			
			if (!body || typeof body !== 'object') {
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] No JSON body found or body is not an object, skipping body initialization`);
				return values;
			}

			// Helper for case-insensitive body property lookup
			const getBodyPropCaseInsensitive = (baseName: string): any => {
				// Try common property name variations
				const variations = [
					baseName,                  // Original
					baseName.toLowerCase(),    // lowercase
					baseName.toUpperCase(),    // UPPERCASE
					// Convert from snake_case to camelCase
					baseName.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
					// Convert from camelCase to snake_case
					baseName.replace(/([A-Z])/g, '_$1').toLowerCase()
				];
				
				for (const variation of variations) {
					if (variation in body) {
						return body[variation];
					}
				}
				
				return undefined;
			};
			
			// === String Parameters ===
			// SDK Key
			const sdkKeyValue = getBodyPropCaseInsensitive('sdk_key');
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY BODY DEBUG - sdkKeyValue: ${JSON.stringify(sdkKeyValue)}, type: ${typeof sdkKeyValue}`);
			
			if (sdkKeyValue !== undefined && typeof sdkKeyValue === 'string') {
				values.sdkKey = sdkKeyValue.trim();
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY BODY DEBUG - Setting values.sdkKey to: ${values.sdkKey}`);
				if (setSource) {
					this.setMetadataSourceField('sdkKey', 'body');
					this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] SDK KEY BODY DEBUG - Setting metadata source to 'body'`);
				}
			}
			
			// Visitor ID
			const visitorIdValue = getBodyPropCaseInsensitive('visitor_id');
			if (visitorIdValue !== undefined && typeof visitorIdValue === 'string') {
				values.visitorId = visitorIdValue.trim();
				if (setSource) this.setMetadataSourceField('visitorId', 'body');
			}
			
			// User ID (as alias for Visitor ID)
			if (!values.visitorId) {
				const userIdValue = getBodyPropCaseInsensitive('user_id');
				if (userIdValue !== undefined && typeof userIdValue === 'string') {
					values.visitorId = userIdValue.trim();
					if (setSource) this.setMetadataSourceField('userId', 'body');
				}
			}
			
			// Event Key
			const eventKeyValue = getBodyPropCaseInsensitive('event_key');
			if (eventKeyValue !== undefined && typeof eventKeyValue === 'string') {
				values.eventKey = eventKeyValue.trim();
				if (setSource) this.setMetadataSourceField('eventKey', 'body');
			}
			
			// Flag Key
			const flagKeyValue = getBodyPropCaseInsensitive('flag_key');
			if (flagKeyValue !== undefined && typeof flagKeyValue === 'string') {
				values.flagKey = flagKeyValue.trim();
				if (setSource) this.setMetadataSourceField('flagKey', 'body');
			}
			
			// Server Mode
			const serverModeValue = getBodyPropCaseInsensitive('server_mode');
			if (serverModeValue !== undefined && typeof serverModeValue === 'string') {
				values.serverMode = serverModeValue.trim();
				if (setSource) this.setMetadataSourceField('serverMode', 'body');
			}
			
			// Datafile Access Token
			const tokenValue = getBodyPropCaseInsensitive('datafile_access_token');
			if (tokenValue !== undefined && typeof tokenValue === 'string') {
				values.datafileAccessToken = tokenValue.trim();
				if (setSource) this.setMetadataSourceField('datafileAccessToken', 'body');
			}
			
			// === Object Parameters ===
			// Attributes
			const attributesValue = getBodyPropCaseInsensitive('attributes');
			if (attributesValue !== undefined && typeof attributesValue === 'object' && attributesValue !== null) {
				values.attributes = attributesValue;
				if (setSource) this.setMetadataSourceField('attributes', 'body');
			}
			
			// Forced Decisions
			const forcedDecisionsValue = getBodyPropCaseInsensitive('forced_decisions');
			if (forcedDecisionsValue !== undefined && typeof forcedDecisionsValue === 'object' && forcedDecisionsValue !== null) {
				values.forcedDecisions = forcedDecisionsValue;
				if (setSource) this.setMetadataSourceField('forcedDecisions', 'body');
			}
			
			// === Boolean Parameters ===
			// Helper for processing boolean body parameters
			const processBodyBoolParam = (paramName: keyof OptimizelyConfigOptions, bodyKey: string): void => {
				const bodyValue = getBodyPropCaseInsensitive(bodyKey);
				if (bodyValue !== undefined) {
					// Allow various boolean representations
					let boolValue: boolean;
					
					if (typeof bodyValue === 'boolean') {
						boolValue = bodyValue;
					} else if (typeof bodyValue === 'string') {
						// Handle string representations of booleans
						const strValue = bodyValue.toLowerCase();
						boolValue = strValue === 'true' || strValue === '1' || strValue === '';
					} else if (typeof bodyValue === 'number') {
						// Handle numeric representations of booleans
						boolValue = bodyValue !== 0;
					} else {
						// Default to presence = true
						boolValue = true;
					}
					
					// Use type-safe property setting
					this.setBooleanProperty(values, paramName, boolValue);
					if (setSource) this.setMetadataSourceField(paramName, 'body');
				}
			};
			
			// Apply all boolean parameters
			processBodyBoolParam('enableFex', 'enable_fex');
			
			processBodyBoolParam('overrideCache', 'override_cache');
			processBodyBoolParam('enableResponseMetadata', 'enable_response_metadata');
			
			processBodyBoolParam('enableDebugHeaders', 'enable_debug_headers');
			processBodyBoolParam('trimmedDecisions', 'trimmed_decisions');
			processBodyBoolParam('decideAll', 'decide_all');
			processBodyBoolParam('enabledFlagsOnly', 'enabled_flags_only');
			processBodyBoolParam('includeReasons', 'include_reasons');
			processBodyBoolParam('excludeVariables', 'exclude_variables');
			processBodyBoolParam('disableDecisionEvent', 'disable_decision_event');
			processBodyBoolParam('setResponseHeaders', 'set_response_headers');
			processBodyBoolParam('setResponseCookies', 'set_response_cookies');
			processBodyBoolParam('setRequestHeaders', 'set_request_headers');
			processBodyBoolParam('setRequestCookies', 'set_request_cookies');
			processBodyBoolParam('enableFlagsFromKV', 'flags_from_kv');
			processBodyBoolParam('datafileFromKV', 'datafile_from_kv');
			
		} catch (e) {
			this.logger.warn(`${this.logPrefix} [REQUEST:${requestId}] Failed to initialize from body: ${e}`);
		}
		
		return values;
	}
	
	/**
	 * Applies configuration values from a single source
	 * @param values - Configuration values to apply
	 * @param source - Source of the values (header, query, body)
	 * @param requestId - Request ID for logging
	 */
	private applyIndividualSourceValues(
		values: Partial<OptimizelyConfigOptions>,
		source: MetadataSource,
		requestId: string
	): void {
		// Process each key in the values object
		Object.keys(values).forEach(key => {
			const typedKey = key as keyof OptimizelyConfigOptions;
			const value = values[typedKey];
			
			// Get current source for this key (if any)
			const currentSource = this.getMetadataSourceField(typedKey);
			
			// Only apply if the new source has higher precedence
			if (value !== undefined && this.shouldOverrideValue(currentSource, source)) {
				// Type-safe assignment to ensure type compatibility
				(this.config[typedKey] as any) = value;
				this.setMetadataSourceField(typedKey, source);
				
				// Only log critical parameters (sdkKey, visitorId, flagKey)
				if (['sdkKey', 'visitorId', 'flagKey'].includes(String(typedKey))) {
					this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Applied ${String(typedKey)}='${this.safeStringify(value)}' from ${source}`);
				}
			}
		});
	}
	
	/**
	 * Applies configuration values from different sources with proper precedence
	 * This method is maintained for backward compatibility but delegates to applyIndividualSourceValues
	 * @param headerValues - Values from headers (highest priority)
	 * @param queryValues - Values from query parameters (medium priority)
	 * @param bodyValues - Values from request body (lowest priority)
	 */
	private applyConfigValues(
		headerValues: Partial<OptimizelyConfigOptions>,
		queryValues: Partial<OptimizelyConfigOptions>,
		bodyValues: Partial<OptimizelyConfigOptions>,
		requestId: string
	): void {
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] APPLY_CONFIG DEBUG - Starting to apply all values with precedence (delegating to individual source methods)`);
		
		// Apply each source in proper precedence order (header > query > body)
		// This ensures higher priority sources are applied first and lower priority ones don't override
		if (Object.keys(headerValues).length > 0) {
			this.applyIndividualSourceValues(headerValues, 'header', requestId);
		}
		
		if (Object.keys(queryValues).length > 0) {
			this.applyIndividualSourceValues(queryValues, 'query', requestId);
		}
		
		if (Object.keys(bodyValues).length > 0) {
			this.applyIndividualSourceValues(bodyValues, 'body', requestId);
		}
		
		// Log the result of applying all values with precedence
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] PRECEDENCE CHECK - Final config:`);
		
		// Special case logging for important values to help debug precedence issues
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] PRECEDENCE CHECK - sdkKey: ${this.config.sdkKey} (from: ${this.metadata.sdkKeyFrom || 'unknown'})`);
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] PRECEDENCE CHECK - visitorId: ${this.config.visitorId} (from: ${this.metadata.visitorIdFrom || 'unknown'})`);
		
		if (this.config.flagKey) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] PRECEDENCE CHECK - flagKey: ${this.config.flagKey} (from: ${this.metadata.flagKeyFrom || 'unknown'})`);
		}
		
		if (this.config.eventKey) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] PRECEDENCE CHECK - eventKey: ${this.config.eventKey} (from: ${this.metadata.eventKeyFrom || 'unknown'})`);
		}
	}

	/**
	 * Assigns a value to a specific config property in a type-safe manner while maintaining source information.
	 * @param key - The configuration key to assign to
	 * @param headerValue - Value from headers (highest priority)
	 * @param queryValue - Value from query params (medium priority)
	 * @param bodyValue - Value from body (lowest priority)
	 */
	private typeSafeAssign<K extends keyof OptimizelyConfigOptions>(
		key: K,
		headerValue: OptimizelyConfigOptions[K] | undefined,
		queryValue: OptimizelyConfigOptions[K] | undefined,
		bodyValue: OptimizelyConfigOptions[K] | undefined,
		requestId: string
	): void {
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Processing key '${String(key)}'`);
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Values - Header: ${this.safeStringify(headerValue)}, Query: ${this.safeStringify(queryValue)}, Body: ${this.safeStringify(bodyValue)}, Current: ${this.safeStringify(this.config[key])}`);
	
		// Get current source for this key (if any)
		const currentSource = this.getMetadataSourceField(key);
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Current source for '${String(key)}': ${currentSource || 'none'}`);
	
		// STRICT precedence handling: headers > query params > body > defaults
		// Only override if new source has higher precedence than current source
		if (headerValue !== undefined) {
			// Header values have highest precedence
			if (this.shouldOverrideValue(currentSource, 'header')) {
				this.config[key] = headerValue;
				this.setMetadataSourceField(key, 'header');
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Used HEADER value for '${String(key)}': ${this.safeStringify(headerValue)}`);
			} else {
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - NOT using HEADER value for '${String(key)}' because current source ${currentSource} has higher precedence`);
			}
		} else if (queryValue !== undefined) {
			// Query parameters have second precedence
			if (this.shouldOverrideValue(currentSource, 'query')) {
				this.config[key] = queryValue;
				this.setMetadataSourceField(key, 'query');
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Used QUERY value for '${String(key)}': ${this.safeStringify(queryValue)}`);
			} else {
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - NOT using QUERY value for '${String(key)}' because current source ${currentSource} has higher precedence`);
			}
		} else if (bodyValue !== undefined) {
			// Body values have third precedence
			if (this.shouldOverrideValue(currentSource, 'body')) {
				this.config[key] = bodyValue;
				this.setMetadataSourceField(key, 'body');
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Used BODY value for '${String(key)}': ${this.safeStringify(bodyValue)}`);
			} else {
				this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - NOT using BODY value for '${String(key)}' because current source ${currentSource} has higher precedence`);
			}
		} else {
			// If no source has a value, we don't need to change anything
			// We're keeping the existing default value
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - No source had a value for '${String(key)}', keeping default: ${this.safeStringify(this.config[key])}`);
		}
		
		// Final verification - the metadata should always match the actual value used
		this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] TYPESAFE_ASSIGN DEBUG - Final value for '${String(key)}': ${this.safeStringify(this.config[key])}`);
	}
	
	/**
	 * Determines if a value should be overridden based on source precedence
	 * @param currentSource - The current source of the value (if any)
	 * @param newSource - The new source trying to set the value
	 * @returns True if the new source has higher or equal precedence
	 */
	private shouldOverrideValue(currentSource: MetadataSource | null, newSource: MetadataSource): boolean {
		// If no current source, always apply the new value
		if (currentSource === null) {
			return true;
		}
		
		// Define precedence order (highest to lowest)
		const precedence: MetadataSource[] = [
			'header',
			'query',
			'body',
			'default',
			'cookie',
			'localstorage'
		];
		
		// Get precedence indices (lower index = higher precedence)
		const currentIndex = precedence.indexOf(currentSource);
		const newIndex = precedence.indexOf(newSource);
		
		// Handle unknown sources (should never happen)
		if (currentIndex === -1 || newIndex === -1) {
			return true; // Default to overriding if we can't determine precedence
		}
		
		// Return true if new source has higher or equal precedence (lower or equal index)
		return newIndex <= currentIndex;
	}
	
	
	/**
	 * Gets the metadata source field for a given parameter
	 * @param paramName - The parameter name to check
	 * @returns The source of the parameter or null if not set
	 */
	private getMetadataSourceField(paramName: keyof OptimizelyConfigOptions): MetadataSource | null {
		let source: MetadataSource | null = null;
		
		// Handle special cases for known parameters with explicit source fields
		switch (paramName) {
			case 'visitorId':
				source = this.metadata.visitorIdFrom as MetadataSource || null;
				break;
			case 'sdkKey':
				source = this.metadata.sdkKeyFrom as MetadataSource || null;
				break;
			case 'attributes':
				source = this.metadata.attributesFrom as MetadataSource || null;
				break;
			case 'eventTags':
				source = this.metadata.eventTagsFrom as MetadataSource || null;
				break;
			case 'decideOptions':
				source = this.metadata.decideOptionsFrom as MetadataSource || null;
				break;
			case 'flagKey':
				source = this.metadata.flagKeyFrom as MetadataSource || null;
				break;
			case 'flagKeys':
				source = this.metadata.flagKeysFrom as MetadataSource || null;
				break;
			case 'forcedDecisions':
				source = this.metadata.forcedDecisionsFrom as MetadataSource || null;
				break;
			case 'serverMode':
				source = this.metadata.serverModeFrom as MetadataSource || null;
				break;
			case 'cdnVariationSettings':
				source = this.metadata.cdnVariationSettingsFrom as MetadataSource || null;
				break;
			case 'datafileAccessToken':
				source = this.metadata.datafileAccessTokenFrom as MetadataSource || null;
				break;
			case 'decideAll':
				source = this.metadata.decideAllFrom as MetadataSource || null;
				break;
			case 'eventKey':
				source = this.metadata.eventKeyFrom as MetadataSource || null;
				break;
			
			// Boolean parameters
			case 'trimmedDecisions':
				source = this.metadata.trimmedDecisionsFrom as MetadataSource || null;
				break;
			case 'overrideCache':
				source = this.metadata.overrideCacheFrom as MetadataSource || null;
				break;
			case 'overrideVisitorId':
				source = this.metadata.overrideVisitorIdFrom as MetadataSource || null;
				break;
			case 'setResponseHeaders':
				source = this.metadata.setResponseHeadersFrom as MetadataSource || null;
				break;
			case 'setResponseCookies':
				source = this.metadata.setResponseCookiesFrom as MetadataSource || null;
				break;
			case 'setRequestHeaders':
				source = this.metadata.setRequestHeadersFrom as MetadataSource || null;
				break;
			case 'setRequestCookies':
				source = this.metadata.setRequestCookiesFrom as MetadataSource || null;
				break;
			case 'enableFex':
				source = this.metadata.enableFexFrom as MetadataSource || null;
				break;
			case 'enableFlagsFromKV':
				source = this.metadata.enableFlagsFromKVFrom as MetadataSource || null;
				break;
			case 'datafileFromKV':
				source = this.metadata.datafileFromKVFrom as MetadataSource || null;
				break;
			case 'enableResponseMetadata':
				source = this.metadata.enableResponseMetadataFrom as MetadataSource || null;
				break;
			case 'excludeVariables':
				source = this.metadata.excludeVariablesFrom as MetadataSource || null;
				break;
			case 'enabledFlagsOnly':
				source = this.metadata.enabledFlagsOnlyFrom as MetadataSource || null;
				break;
			case 'includeReasons':
				source = this.metadata.includeReasonsFrom as MetadataSource || null;
				break;
			case 'disableDecisionEvent':
				source = this.metadata.disableDecisionEventFrom as MetadataSource || null;
				break;
			case 'ignoreUserProfileService':
				source = this.metadata.ignoreUserProfileServiceFrom as MetadataSource || null;
				break;
			
			default:
				// For other parameters without explicit tracking, default to null
				source = null;
		}
		
		return source;
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
			kvStorageFallback: this.kvStorageFallback,
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
	 * Sets a metadata source field and optionally the corresponding value field.
	 * @param paramName - The parameter name.
	 * @param source - The source of the parameter value ('header', 'query', 'body', etc.).
	 */
	
	private setMetadataSourceField(paramName: keyof OptimizelyConfigOptions, source: MetadataSource): void {
		// Set the appropriate metadata field based on the parameter name
		switch (paramName) {
			case 'sdkKey':
				this.metadata.sdkKeyFrom = source;
				break;
			case 'visitorId':
				this.metadata.visitorIdFrom = source;
				break;
			case 'decideOptions':
				this.metadata.decideOptionsFrom = source;
				break;
			case 'attributes':
				this.metadata.attributesFrom = source;
				break;
			case 'eventTags':
				this.metadata.eventTagsFrom = source;
				break;
			case 'trimmedDecisions':
				this.metadata.trimmedDecisionsFrom = source;
				break;
			case 'flagKey':
				this.metadata.flagKeyFrom = source;
				break;
			case 'eventKey':
				this.metadata.eventKeyFrom = source;
				break;
			default:
				// For any other fields, we still want to track the source
				// Use type assertion to add dynamic property if needed
				(this.metadata as Record<string, any>)[`${String(paramName)}From`] = source;
		}
	}

	/**
	 * Updates configuration metadata.
	 */
	private updateMetadata(): void {
		// String fields
		this.metadata.visitorId = this.config.visitorId || '';
		this.metadata.sdkKey = this.config.sdkKey || '';
		
		// Object fields (only update the values, not the source tracking)
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
		if (!this.cachedAdminToken) {
			try {
				const envAdapter = this.datafileService.getEnvironmentAdapter();
				this.cachedAdminToken = envAdapter.getVariable('ADMIN_TOKEN') || null;
			} catch (error) {
				this.logger.error("Error getting admin token:", error);
				this.cachedAdminToken = null;
			}
		}
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
		return this.enableDatafileFromKV;
	}

	/**
	 * Returns true if flags should be loaded from KV storage.
	 */
	getEnableFlagsFromKV(): boolean {
		return this.enableFlagsFromKV;
	}

	/**
	 * Returns true if fallback to default sources is enabled when KV storage is unavailable.
	 * @returns true if fallback is enabled, false otherwise
	 */
	getEnableKVStorageFallback(): boolean {
		return this.kvStorageFallback;
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
	 * Gets the datafile for the current configuration, or a specified SDK key.
	 * @param sdkKey - Optional SDK key to get the datafile for, defaults to the one in config
	 * @returns A promise resolving to the datafile as a parsed JSON object or null if not found
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
			} 
			
			this.logger.debug(`${this.logPrefix} Successfully fetched datafile (${datafileStr.length} characters)`);
			
			// Parse the datafile string into a JSON object
			try {
				const datafileObj = JSON.parse(datafileStr);
				return datafileObj;
			} catch (e) {
				this.logger.error(`${this.logPrefix} Failed to parse datafile as JSON: ${e}`);
				return null;
			}
		} catch (e) {
			this.logger.error(`${this.logPrefix} Error while getting datafile: ${e}`);
			return null;
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
	 * Sets a boolean property safely without using type assertions
	 * @param obj - The object to modify
	 * @param key - The key of the boolean property to set
	 * @param value - The boolean value to set
	 */
	private setBooleanProperty<T>(
		obj: Partial<OptimizelyConfigOptions>,
		key: keyof OptimizelyConfigOptions,
		value: boolean
	): void {
		// Only set boolean properties
		switch (key) {
			// Boolean parameters that we know exist in OptimizelyConfigOptions
			case 'enableFex':
					case 'overrideCache':
					case 'enableResponseMetadata':
					case 'enableDebugHeaders':
			case 'trimmedDecisions':
					case 'decideAll':
					case 'enabledFlagsOnly':
					case 'includeReasons':
					case 'excludeVariables':
					case 'disableDecisionEvent':
					case 'ignoreUserProfileService':
					case 'setResponseHeaders':
					case 'setResponseCookies':
					case 'setRequestHeaders':
					case 'setRequestCookies':
					case 'enableFlagsFromKV':
					case 'datafileFromKV':
			case 'overrideVisitorId':
				// Direct assignment for boolean properties without any type casting
				obj[key] = value;
						break;
					default:
				this.logger.warn(`${this.logPrefix} Attempted to set non-boolean property ${String(key)} with boolean value`);
		}
	}
}