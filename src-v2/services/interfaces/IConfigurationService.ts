import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';

/**
 * Interface for configuration options that can be set by request parameters.
 */
export interface OptimizelyConfigOptions {
  // Core decision making
  sdkKey?: string | null;                        // Optimizely SDK key
  visitorId?: string | null;                     // Visitor ID for making decisions
  userId?: string | null;                        // Alias for visitorId (backward compatibility)
  flagKey?: string | null;                       // Single flag key for decide operations
  flagKeys?: string[] | null;                    // Multiple flag keys for decide operations
  attributes?: Record<string, any> | null;       // User attributes for decision making
  forcedDecisions?: Record<string, any> | null;  // Forced decisions to apply
  
  // Event tracking
  eventKey?: string | null;                      // Event key for tracking conversions
  eventTags?: Record<string, any> | null;        // Tags for tracked events
  value?: number | null;                         // Numeric value for conversion events
  
  // Decision options
  decideOptions?: string[] | null;               // Options to pass to decide calls
  decideAll?: boolean | null;                    // Whether to decide all flags
  
  enabledFlagsOnly?: boolean | null;             // Whether to only include enabled flags in response
  includeReasons?: boolean | null;               // Whether to include decision reasons
  excludeVariables?: boolean | null;             // Whether to exclude variables from decisions
  disableDecisionEvent?: boolean | null;         // Whether to disable decision events
  ignoreUserProfileService?: boolean | null;     // Whether to ignore user profile service
  trimmedDecisions?: boolean | null;             // Whether to return trimmed decisions

  // Visitor ID management
  overrideVisitorId?: boolean | null;            // Whether to override visitor ID with query parameter

  // Response control
  setResponseHeaders?: boolean | null;           // Whether to set response headers
  setResponseCookies?: boolean | null;           // Whether to set response cookies
  setRequestHeaders?: boolean | null;            // Whether to set request headers
  setRequestCookies?: boolean | null;            // Whether to set request cookies

  // Storage and caching
  overrideCache?: boolean | null;                // Whether to override cache
  enableFlagsFromKV?: boolean | null;            // Whether to enable flags from KV storage
  datafileFromKV?: boolean | null;               // Whether to retrieve datafile from KV
  kvStorageFallback?: boolean | null;            // Whether to fall back to default sources when KV storage fails

  // Advanced options
  enableResponseMetadata?: boolean | null;       // Whether to include metadata in response
  datafileAccessToken?: string | null;           // Access token for datafile retrieval
  serverMode?: string | null;                    // Server mode (edge or agent)
  enableFex?: boolean | null;                    // Whether to enable Feature Experimentation bypass

  // Variation settings (for Edge Mode)
  cdnVariationSettings?: Record<string, any> | null; // CDN variation settings

  // New fields from the code block
  enableDebugHeaders?: boolean | null;
}

/**
 * Interface for service configuration settings
 */
export interface ServiceConfigSettings {
  // Core settings
  cdnProvider: string;                  // CDN provider (cloudflare, fastly, etc.)
  responseJsonKeyName: string;          // Key name for decisions in JSON response
  apiPathPrefix: string;                // Path prefix for API endpoints (default: '/api/')
  
  // Feature flags
  enableResponseMetadata: boolean;      // Whether to include metadata in response
  flagsFromKV: boolean;                 // Whether to use KV storage for flags
  datafileFromKV: boolean;              // Whether to use KV storage for datafiles
  kvStorageFallback: boolean;           // Whether to fall back to default sources when KV storage fails
  
  // Default behaviors
  defaultTrimmedDecisions: boolean;     // Default for trimmed decisions
  defaultSetResponseCookies: boolean;   // Default for setting response cookies
  defaultSetResponseHeaders: boolean;   // Default for setting response headers
  defaultSetRequestCookies: boolean;    // Default for setting request cookies 
  defaultSetRequestHeaders: boolean;    // Default for setting request headers
  defaultResponseHeadersAndCookies: boolean; // Default for setting response headers and cookies
  defaultOverrideCache: boolean;        // Default for overriding cache
  defaultOverrideVisitorId: boolean;    // Default for overriding visitor ID
  
  // Cookie and header names
  decisionsKeyName: string;             // Key name for decisions in cookies/storage
  decisionsCookieName: string;          // Cookie name for decisions
  visitorIdCookieName: string;          // Cookie name for visitor ID
  decisionsHeaderName: string;          // Header name for decisions
  visitorIdsHeaderName: string;         // Header name for visitor ID
  
  // Priority and precedence
  prioritizeHeadersOverQueryParams: boolean; // Whether headers have precedence over query params
  
  // Header names for configuration
  sdkKeyHeader: string;                 // Header for SDK key
  setResponseHeadersHeader: string;     // Header for controlling response headers
  setResponseCookiesHeader: string;     // Header for controlling response cookies
  setRequestHeadersHeader: string;      // Header for controlling request headers
  setRequestCookiesHeader: string;      // Header for controlling request cookies
  overrideVisitorIdHeader: string;      // Header for controlling visitor ID override
  attributesHeader: string;             // Header for attributes
  eventTagsHeader: string;              // Header for event tags
  datafileAccessTokenHeader: string;    // Header for datafile access token
  enableOptimizelyHeader: string;       // Header for enabling Optimizely
  decideOptionsHeader: string;          // Header for decide options
  visitorIdHeader: string;              // Header for visitor ID
  trimmedDecisionsHeader: string;       // Header for trimmed decisions
  enableFlagsFromKVHeader: string;      // Header for enabling flags from KV
  enableDatafileFromKVHeader: string;   // Header for enabling datafile from KV
  enableRespMetadataHeader: string;     // Header for enabling response metadata
  enableDebugHeadersHeader: string;     // Header for enabling debug headers
  overrideCacheHeader: string;          // Header for overriding cache
  eventKeyHeader: string;               // Header for event key
  implementationVersionHeader: string;  // Header for implementation version
  
  // Storage keys
  kvFlagKeyName: string;                // KV key name for flags
  kvDatafileKeyName: string;            // KV key name for datafile
  
  // Cookie settings
  cookieExpirationInDays: number;       // Cookie expiration in days

  // Additional header names for previously hardcoded headers
  flagKeyHeader: string;
  flagKeysHeader: string;
  forcedDecisionHeader: string;
  cdnSettingsHeader: string;
  serverModeHeader: string;
  userIdHeader: string;
  decideAllHeader: string;
  enabledFlagsOnlyHeader: string;
  includeReasonsHeader: string;
  excludeVariablesHeader: string;
  disableDecisionEventHeader: string;
  ignoreUserProfileServiceHeader: string;
}

/**
 * Interface for metadata about config initialization
 */
export interface ConfigMetadata {
  visitorId: string;                    // Visitor ID used
  visitorIdFrom: string;                // Source of visitor ID (headers, cookies, etc.)
  decideOptions: string[];              // Decide options used
  attributes: Record<string, any>;      // Attributes used
  attributesFrom: string;               // Source of attributes
  eventTags: Record<string, any>;       // Event tags used
  eventTagsFrom: string;                // Source of event tags
  sdkKey: string;                       // SDK key used
  sdkKeyFrom: string;                   // Source of SDK key
  datafileFrom: string;                 // Source of datafile
  trimmedDecisions: boolean;            // Whether decisions are trimmed
  trimmedDecisionsFrom?: string;        // Source of trimmedDecisions setting
  decideAll: boolean;                   // Whether all flags are decided
  decideAllFrom?: string;               // Source of decideAll setting
  flagKeysDecided: string[];            // Flag keys that were decided
  flagKeysFrom: string;                 // Source of flag keys
  storedDecisionsFound: boolean;        // Whether stored decisions were found
  storedCookieDecisions: any[];         // Stored decisions from cookies
  forcedDecisions: any[];               // Forced decisions applied
  forcedDecisionsFrom?: string;         // Source of forced decisions
  agentServerMode: boolean;             // Whether in agent server mode
  pathName: string;                     // Path name of request
  cdnVariationSettings: Record<string, any>; // CDN variation settings
  validationResult?: ValidationResult;  // Result of configuration validation
  updatedAt?: string;                   // Timestamp when metadata was last updated
  
  // Boolean parameter values (matching OptimizelyConfigOptions)
  enableFex?: boolean;                  // Whether Feature Experimentation bypass is enabled
  overrideCache?: boolean;              // Whether to override cache
  enableResponseMetadata?: boolean;     // Whether to include metadata in response
  overrideVisitorId?: boolean;          // Whether to override visitor ID
  setResponseHeaders?: boolean;         // Whether to set response headers
  setResponseCookies?: boolean;         // Whether to set response cookies
  setRequestHeaders?: boolean;          // Whether to set request headers
  setRequestCookies?: boolean;          // Whether to set request cookies
  kvStorageFallback?: boolean;          // Whether to fall back to default sources when KV fails
  
  // Add missing properties for flagKey and eventKey
  flagKey?: string;                     // Flag key for decide operations
  eventKey?: string;                    // Event key for tracking conversions

  // Track sources for all boolean parameters
  overrideCacheFrom?: string;           // Source of overrideCache setting
  overrideVisitorIdFrom?: string;       // Source of overrideVisitorId setting
  setResponseHeadersFrom?: string;      // Source of setResponseHeaders setting
  setResponseCookiesFrom?: string;      // Source of setResponseCookies setting
  setRequestHeadersFrom?: string;       // Source of setRequestHeaders setting
  setRequestCookiesFrom?: string;       // Source of setRequestCookies setting
  enableFexFrom?: string;               // Source of enableFex setting
  datafileFromKVFrom?: string;          // Source of datafileFromKV setting
  enableFlagsFromKVFrom?: string;       // Source of enableFlagsFromKV setting
  enableResponseMetadataFrom?: string;  // Source of enableResponseMetadata setting
  excludeVariablesFrom?: string;        // Source of excludeVariables setting
  eventKeyFrom?: string;                // Source of eventKey setting
  decideOptionsFrom?: string;           // Source of decideOptions setting
  disableDecisionEventFrom?: string;    // Source of disableDecisionEvent setting
  enabledFlagsOnlyFrom?: string;        // Source of enabledFlagsOnly setting
  includeReasonsFrom?: string;          // Source of includeReasons setting
  ignoreUserProfileServiceFrom?: string; // Source of ignoreUserProfileService setting
  kvStorageFallbackFrom?: string;       // Source of kvStorageFallback setting
  
  // Additional source tracking fields
  flagKeyFrom?: string;                 // Source of flagKey setting
  serverModeFrom?: string;              // Source of serverMode setting
  datafileAccessTokenFrom?: string;     // Source of datafileAccessToken setting
  cdnVariationSettingsFrom?: string;    // Source of cdnVariationSettings
  valueFrom?: string;                   // Source of numeric value field
  
  precedenceRules?: {                   // Parameter precedence rules used during initialization
    headersOverQueryParams: boolean;    // Whether headers take precedence over query parameters
    queryParamsOverBody: boolean;       // Whether query parameters take precedence over body
    order: string;                      // Human-readable precedence order
  };
}

/**
 * Types of validation issues that can occur with configuration options
 */
export enum ValidationIssueType {
  INVALID_TYPE = 'INVALID_TYPE',            // Value is of the wrong type
  INVALID_VALUE = 'INVALID_VALUE',          // Value is invalid (e.g., out of range)
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING', // Required field is missing
  DEPRECATED = 'DEPRECATED',               // Field is deprecated
  INCOMPATIBLE_OPTIONS = 'INCOMPATIBLE_OPTIONS', // Options conflict with each other
  UNKNOWN_OPTION = 'UNKNOWN_OPTION'         // Option is not recognized
}

/**
 * Severity levels for validation issues
 */
export enum ValidationSeverity {
  ERROR = 'ERROR',     // Prevents operation, must be fixed
  WARNING = 'WARNING', // Suboptimal but allowed, should be fixed
  INFO = 'INFO'       // Informational only
}

/**
 * Interface for a validation issue
 */
export interface ValidationIssue {
  type: ValidationIssueType;        // Type of issue
  field: string;                   // Field with the issue
  message: string;                 // Human-readable message
  severity: ValidationSeverity;    // Severity level
  value?: any;                     // Value that caused the issue
  suggestedValue?: any;            // Suggested fix
  context?: Record<string, any>;   // Additional context
}

/**
 * Interface for validation results
 */
export interface ValidationResult {
  valid: boolean;                  // Whether the configuration is valid
  issues: ValidationIssue[];       // List of validation issues
  hasErrors: boolean;              // Whether there are any ERROR severity issues
  hasWarnings: boolean;            // Whether there are any WARNING severity issues
}

/**
 * Interface for a validation rule
 */
export interface ValidationRule<T = any> {
  field: keyof OptimizelyConfigOptions;   // Field to validate
  type?: string | string[];               // Expected type(s)
  required?: boolean;                    // Whether field is required
  validator?: (value: T, config: OptimizelyConfigOptions) => ValidationIssue | null; // Custom validator
  deprecated?: boolean;                  // Whether field is deprecated
  allowedValues?: T[];                   // Allowed values
  minValue?: number;                     // Minimum value (for numbers)
  maxValue?: number;                     // Maximum value (for numbers)
  minLength?: number;                    // Minimum length (for strings/arrays)
  maxLength?: number;                    // Maximum length (for strings/arrays)
  pattern?: RegExp;                      // Pattern (for strings)
  childType?: string;                    // Type for array elements
  suggestedReplacement?: string;         // Suggested replacement for deprecated fields
  incompatibleWith?: (keyof OptimizelyConfigOptions)[]; // Fields that are incompatible with this one
  requiredWith?: (keyof OptimizelyConfigOptions)[]; // Fields that are required with this one
}

/**
 * @interface IConfigurationService
 * @description Defines the contract for configuration management.
 * This interface handles extraction and prioritization of configuration settings from 
 * various sources (headers, query parameters, request body).
 */
export interface IConfigurationService {
  /**
   * Initializes configuration from a request adapter.
   * @param request - The request adapter.
   * @returns A promise resolving to the configuration options.
   */
  initialize(request: IRequestAdapter): Promise<OptimizelyConfigOptions>;
  
  /**
   * Gets the current configuration options.
   * @returns The current configuration options.
   */
  getConfig(): OptimizelyConfigOptions;
  
  /**
   * Gets the service's default settings.
   * @returns The service settings.
   */
  getSettings(): ServiceConfigSettings;
  
  /**
   * Gets the API path prefix configuration.
   * @returns The API path prefix (e.g., '/api/')
   */
  getApiPathPrefix(): string;
  
  /**
   * Gets configuration metadata (useful for debugging and analytics).
   * @returns The configuration metadata.
   */
  getMetadata(): ConfigMetadata;
  
  /**
   * Updates configuration with new values.
   * @param newConfig - The new configuration values to apply.
   * @returns The updated configuration.
   */
  updateConfig(newConfig: Partial<OptimizelyConfigOptions>): OptimizelyConfigOptions;
  
  /**
   * Gets a specific configuration value.
   * @param key - The configuration key.
   * @returns The configuration value, or undefined if not set.
   */
  getValue<T>(key: keyof OptimizelyConfigOptions): T | undefined;
  
  /**
   * Sets a specific configuration value.
   * @param key - The configuration key.
   * @param value - The value to set.
   */
  setValue<T>(key: keyof OptimizelyConfigOptions, value: T): void;
  
  /**
   * Gets all decide options based on configuration.
   * @returns An array of decide options.
   */
  getDecideOptions(): string[];
  
  /**
   * Checks if a specific decide option is enabled.
   * @param option - The decide option to check.
   * @returns True if the option is enabled, false otherwise.
   */
  hasDecideOption(option: string): boolean;
  
  /**
   * Validates the current configuration.
   * @returns A validation result with any issues found.
   */
  validate(): ValidationResult;
  
  /**
   * Gets the validation rules for configuration options.
   * @returns An array of validation rules.
   */
  getValidationRules(): ValidationRule[];
  
  /**
   * Validates a specific configuration value.
   * @param key - The configuration key.
   * @param value - The value to validate.
   * @returns A validation issue or null if valid.
   */
  validateValue<T>(key: keyof OptimizelyConfigOptions, value: T): ValidationIssue | null;
  
  /**
   * Fixes validation issues in the configuration if possible.
   * @param issues - The validation issues to fix.
   * @returns The number of issues fixed.
   */
  fixValidationIssues(issues: ValidationIssue[]): number;

  /**
   * Gets the edge agent version, if any.
   * @returns The edge agent version string or null.
   */
  getEdgeAgentVersion(): string | null;

  /**
   * Gets the configured admin token, if any.
   * @returns The admin token string or null.
   */
  getAdminToken(): string | null;

  /**
   * Checks if the global cache override setting is enabled.
   * @returns True if cache should be overridden (no-store), false otherwise.
   */
  getOverrideCache(): boolean;

  /**
   * Gets the default decide options to apply at the SDK level.
   * Used to configure SDK initialization with consistent options.
   * @returns Array of decide option string literals.
   */
  getDefaultDecideOptions(): string[];

  /**
   * Gets the configured decisions cookie name (for header/cookie parity).
   */
  getDecisionsCookieName(): string;

  /**
   * Gets the configured visitor ID cookie name (for header/cookie parity).
   */
  getVisitorIdCookieName(): string;

  /**
   * Gets the configured decisions header name (for header/cookie parity).
   */
  getDecisionsHeaderName(): string;

  /**
   * Gets the configured visitor ID header name (for header/cookie parity).
   */
  getVisitorIdHeaderName(): string;

  /**
   * Returns true if the FEX (Feature Experimentation) bypass is enabled.
   */
  getEnableFex(): boolean;

  /**
   * Returns true if datafile should be loaded from KV storage.
   */
  getEnableDatafileFromKV(): boolean;

  /**
   * Returns true if flags should be loaded from KV storage.
   */
  getEnableFlagsFromKV(): boolean;

  /**
   * Returns true if response metadata should be included in responses.
   */
  getEnableResponseMetadata(): boolean;

  /**
   * Returns the current environment string (e.g., 'production', 'staging').
   */
  getEnvironment(): string | null;

  /**
   * Returns the current CDN provider string (e.g., 'cloudflare', 'fastly').
   */
  getCdnProvider(): string | null;

  /**
   * Fetches the Optimizely configuration datafile for a given SDK key.
   * @param sdkKey - The SDK key.
   * @returns A promise resolving to the OptimizelyDatafile or null.
   */
  getDatafile(sdkKey?: string): Promise<any>;

  /**
   * Returns true if debug headers should be included in responses.
   */
  getEnableDebugHeaders(): boolean;

  /**
   * Gets the implementation version header name.
   * @returns The implementation version header name.
   */
  getImplementationVersionHeader(): string;

  /**
   * Returns true if fallback to default sources is enabled when KV storage is unavailable.
   * @returns true if fallback is enabled, false otherwise
   */
  getEnableKVStorageFallback(): boolean;
} 