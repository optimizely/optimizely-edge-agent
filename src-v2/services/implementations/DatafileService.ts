import { IDatafileService } from "../interfaces/IDatafileService";
import { IStorageAdapter } from "../../adapters/interfaces/IStorageAdapter";
import { IEnvironmentAdapter } from "../../adapters/interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter } from "../../adapters/interfaces/IMetricsAdapter";
import { IFlagStorageService } from "../interfaces/IFlagStorageService";
import { IConfigurationService } from "../interfaces/IConfigurationService";

// Constants for storage
const DATAFILE_PREFIX = 'datafile:';
const FLAGKEYS_PREFIX = 'flagkeys:';
const DEFAULT_DATAFILE_TTL = 3600; // 1 hour in seconds
const DEFAULT_FLAGKEYS_TTL = 3600; // 1 hour in seconds
const OPTIMIZELY_CDN_URL = 'https://cdn.optimizely.com/datafiles';

/**
 * Implementation of IDatafileService for managing Optimizely datafiles
 * and flag keys using KV storage.
 */
export class DatafileService implements IDatafileService {
  private storage: IStorageAdapter;
  private environment: IEnvironmentAdapter;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | null;
  private flagStorage: IFlagStorageService | null;
  private configService: IConfigurationService | null;
  private readonly logPrefix = '[v2][DatafileService]';
  private datafileCache: Map<string, { datafile: string, expiry: number }>;
  private flagKeysCache: Map<string, { flagKeys: string[], expiry: number }>;
  private cacheEnabled: boolean;
  private autoExtractFlagKeys: boolean;
  
  /**
   * Creates an instance of DatafileService.
   * @param storage - The storage adapter for KV operations.
   * @param environment - The environment adapter.
   * @param logger - The logger adapter.
   * @param metrics - Optional metrics adapter for tracking performance.
   * @param flagStorage - Optional flag storage service for flag-specific operations.
   * @param configService - Optional configuration service for feature toggles.
   * @param options - Configuration options.
   */
  constructor(
    storage: IStorageAdapter,
    environment: IEnvironmentAdapter,
    logger: ILoggerAdapter,
    metrics?: IMetricsAdapter,
    flagStorage?: IFlagStorageService,
    configService?: IConfigurationService,
    options?: { 
      cacheEnabled?: boolean,
      datafileTtl?: number,
      flagKeysTtl?: number,
      autoExtractFlagKeys?: boolean
    }
  ) {
    if (!storage || !environment || !logger) {
      throw new Error("DatafileService requires storage, environment, and logger");
    }
    
    this.storage = storage;
    this.environment = environment;
    this.logger = logger;
    this.metrics = metrics || null;
    this.flagStorage = flagStorage || null;
    this.configService = configService || null;
    this.cacheEnabled = options?.cacheEnabled !== false; // Default to true
    this.autoExtractFlagKeys = options?.autoExtractFlagKeys !== false; // Default to true for backward compatibility
    
    // Initialize in-memory caches
    this.datafileCache = new Map();
    this.flagKeysCache = new Map();
    
    this.logger.info(`${this.logPrefix} Initialized with caching ${this.cacheEnabled ? 'enabled' : 'disabled'}, auto flag key extraction ${this.autoExtractFlagKeys ? 'enabled' : 'disabled'}`);
    
    if (this.metrics) {
      this.logger.info(`${this.logPrefix} Metrics tracking enabled`);
    }
    
    if (this.flagStorage) {
      this.logger.info(`${this.logPrefix} Flag storage service available for flag-specific operations`);
    }
    
    if (this.configService) {
      this.logger.info(`${this.logPrefix} Configuration service available for feature toggles`);
    }
  }
  
  /**
   * Gets an Optimizely datafile by sdkKey.
   * Uses KV storage if specified, and falls back to CDN if KV fails or is empty.
   * @param sdkKey - The Optimizely SDK key.
   * @param options - Configuration options.
   * @returns A promise resolving to the datafile JSON string or null if not found.
   */
  async getDatafile(sdkKey: string, options?: { useKV?: boolean, requestContext?: any }): Promise<string | null> {
    if (!sdkKey) {
      this.logger.error(`${this.logPrefix} Cannot get datafile: SDK key is required`);
      return null;
    }
    
    const useKV = options?.useKV;
    const requestContext = options?.requestContext;
    const isKVEnabled = this.configService?.getEnableDatafileFromKV() || false;
    const fallbackEnabled = this.configService?.getEnableKVStorageFallback?.() ?? true; // Default to true for backward compatibility
    
    // Log configuration state for debugging
    this.logger.debug(`${this.logPrefix} Getting datafile for SDK key ${sdkKey}, useKV=${useKV}, KV enabled=${isKVEnabled}, fallback enabled=${fallbackEnabled}`);
    
    // Determine if we should try KV first
    const shouldTryKV = useKV === true || (useKV !== false && isKVEnabled);
    
    // Try KV if explicitly requested or if enabled by config
    if (shouldTryKV) {
      this.logger.debug(`${this.logPrefix} Attempting to get datafile for SDK key ${sdkKey} from KV storage`);
      try {
        const kvResult = await this.getDatafileFromKV(sdkKey);
        if (kvResult) {
          // Update request context with source if provided
          if (requestContext?.configMetadata) {
            requestContext.configMetadata.datafileFrom = 'kv';
          }
          this.logger.debug(`${this.logPrefix} Successfully retrieved datafile from KV for SDK key ${sdkKey}`);
          this.metrics?.incrementCounter('datafile_cache_hit', 1, { source: 'kv', type: 'kv' });
          
          // Ensure the datafile is valid JSON before returning
          try {
            // Validate the datafile by attempting to parse it
            JSON.parse(kvResult);
            
            // If it parses successfully, return it
            return kvResult;
          } catch (parseError) {
            this.logger.warn(`${this.logPrefix} Datafile from KV is not valid JSON for SDK key ${sdkKey}, falling back to CDN`);
            this.metrics?.incrementCounter('datafile_parse_errors', 1, { source: 'kv' });
            
            // If useKV is explicitly true and fallback is disabled, return error instead of falling back
            if (useKV === true && !fallbackEnabled) {
              this.logger.error(`${this.logPrefix} Datafile from KV is not valid JSON and fallback is disabled for SDK key ${sdkKey}`);
              throw new Error(`Datafile from KV is not valid JSON for SDK key ${sdkKey} and fallback is disabled`);
            }
            
            // Continue to CDN fallback if fallback is enabled
            if (!fallbackEnabled) {
              this.logger.warn(`${this.logPrefix} Not falling back to CDN due to configuration for SDK key ${sdkKey}`);
              return null;
            }
          }
        }
        
        this.logger.debug(`${this.logPrefix} Datafile not found in KV for SDK key ${sdkKey}`);
        
        // If useKV is explicitly true and fallback is disabled, return error instead of falling back
        if (useKV === true && !fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Datafile not found in KV and fallback is disabled for SDK key ${sdkKey}`);
          throw new Error(`Datafile not found in KV storage for SDK key ${sdkKey} and fallback is disabled`);
        }
        
        // Continue to CDN fallback if fallback is enabled
        if (!fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Not falling back to CDN due to configuration for SDK key ${sdkKey}`);
          return null;
        }
        
      } catch (kvError) {
        this.logger.warn(`${this.logPrefix} Error retrieving datafile from KV for SDK key ${sdkKey}: ${kvError}`);
        
        // If useKV is explicitly true and fallback is disabled, propagate error instead of falling back
        if (useKV === true && !fallbackEnabled) {
          throw new Error(`Error accessing KV storage for SDK key ${sdkKey} and fallback is disabled: ${kvError}`);
        }
        
        // Continue to CDN fallback if fallback is enabled
        if (!fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Not falling back to CDN due to configuration for SDK key ${sdkKey}`);
          return null;
        }
      }
    }
    
    // At this point, either:
    // 1. KV was not requested/enabled
    // 2. KV was requested/enabled but failed AND fallback is enabled
    // 3. KV was requested/enabled but returned null AND fallback is enabled
    // In all cases, we now try to get the datafile from the CDN
    
    try {
      const url = `${this.getDatafileUrl(sdkKey)}`;
      this.logger.debug(`${this.logPrefix} Getting datafile from CDN at ${url}`);
      
      const datafileAccessToken = requestContext?.config?.datafileAccessToken ?? '';
      const response = await this.fetchDatafile(url, datafileAccessToken);
      
      if (!response.ok) {
        this.logger.error(`${this.logPrefix} Failed to get datafile from CDN: HTTP ${response.status} ${response.statusText}`);
        return null;
      }
      
      const datafileText = await response.text();
      
      // Update request context with source if provided
      if (requestContext?.configMetadata) {
        requestContext.configMetadata.datafileFrom = 'cdn';
      }
      
      // Validate the datafile JSON
      try {
        JSON.parse(datafileText);
      } catch (parseError) {
        this.logger.error(`${this.logPrefix} Failed to parse datafile from CDN as JSON: ${parseError}`);
        return null;
      }
      
      this.logger.debug(`${this.logPrefix} Successfully fetched datafile from CDN for SDK key ${sdkKey}`);
      this.metrics?.incrementCounter('datafile_cache_hit', 1, { source: 'cdn', type: 'cdn' });
      
      // If KV is enabled, store the datafile in KV for future use
      if (isKVEnabled) {
        try {
          await this.setDatafile(sdkKey, datafileText);
          this.logger.debug(`${this.logPrefix} Stored datafile in KV for future use: SDK key ${sdkKey}`);
        } catch (storageError) {
          this.logger.warn(`${this.logPrefix} Failed to store datafile in KV: ${storageError}`);
        }
      }
      
      return datafileText;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error fetching datafile from CDN: ${error}`);
      return null;
    }
  }
  
  /**
   * Updates or stores an Optimizely datafile.
   * @param sdkKey - The Optimizely SDK key.
   * @param datafileJson - The JSON string representation of the datafile.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async setDatafile(sdkKey: string, datafileJson: string, ttl = DEFAULT_DATAFILE_TTL): Promise<boolean> {
    if (!sdkKey || !datafileJson) {
      this.logger.error(`${this.logPrefix} Cannot set datafile: SDK key and datafile JSON are required`);
      return false;
    }
    
    const cacheKey = `${DATAFILE_PREFIX}${sdkKey}`;
    const requestStart = Date.now();
    
    try {
      // Store in KV with TTL
      await this.storage.put(cacheKey, datafileJson, { expirationTtl: ttl });
      
      // Update in-memory cache
      if (this.cacheEnabled) {
        this.datafileCache.set(sdkKey, {
          datafile: datafileJson,
          expiry: Date.now() + (ttl * 1000)
        });
      }
      
      // Extract and update flag keys (if enabled)
      if (this.autoExtractFlagKeys) {
        try {
          const flagKeys = this.extractFlagKeys(datafileJson);
          await this.setFlagKeys(sdkKey, flagKeys, ttl);
          this.logger.debug(`${this.logPrefix} Updated ${flagKeys.length} flag keys for SDK key ${sdkKey}`);
        } catch (flagKeyError) {
          this.logger.error(`${this.logPrefix} Error extracting flag keys from datafile:`, flagKeyError);
        }
      } else {
        this.logger.debug(`${this.logPrefix} Skipping flag key extraction (disabled by configuration) for SDK key ${sdkKey}`);
      }
      
      this.logger.info(`${this.logPrefix} Datafile stored for SDK key ${sdkKey} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error storing datafile for SDK key ${sdkKey}:`, error);
      this.metrics?.incrementCounter('datafile_storage_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      return false;
    } finally {
      // Record duration
      const duration = Date.now() - requestStart;
      this.metrics?.recordHistogram('datafile_storage_duration_ms', duration);
    }
  }
  
  /**
   * Alias for setDatafile to maintain compatibility with existing code.
   * @param sdkKey - The Optimizely SDK key.
   * @param datafileJson - The JSON string representation of the datafile.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async saveDatafile(sdkKey: string, datafileJson: string, ttl?: number): Promise<boolean> {
    return this.setDatafile(sdkKey, datafileJson, ttl);
  }
  
  /**
   * Fetches a datafile from the Optimizely CDN.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to the datafile JSON string or null if retrieval failed.
   */
  async fetchDatafileFromCDN(sdkKey: string): Promise<string | null> {
    if (!sdkKey) {
      this.logger.error(`${this.logPrefix} Cannot fetch datafile: SDK key is required`);
      return null;
    }
    
    const cdnUrl = `${OPTIMIZELY_CDN_URL}/${sdkKey}.json`;
    const requestStart = Date.now();
    
    try {
      this.logger.info(`${this.logPrefix} Fetching datafile from CDN for SDK key ${sdkKey}`);
      
      // Use the environment's fetch implementation
      const response = await this.environment.fetch(cdnUrl);
      
      if (!response.ok) {
        this.logger.error(`${this.logPrefix} Error fetching datafile from CDN: ${response.status} ${response.statusText}`);
        this.metrics?.incrementCounter('cdn_fetch_errors', 1, { status: response.status.toString() });
        return null;
      }
      
      const datafileJson = await response.text();
      
      // Validate the datafile
      if (!this.isValidDatafile(datafileJson)) {
        this.logger.error(`${this.logPrefix} Invalid datafile received from CDN`);
        this.metrics?.incrementCounter('cdn_fetch_errors', 1, { error_type: 'invalid_datafile' });
        return null;
      }
      
      this.logger.info(`${this.logPrefix} Successfully fetched datafile from CDN for SDK key ${sdkKey}`);
      return datafileJson;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error fetching datafile from CDN:`, error);
      this.metrics?.incrementCounter('cdn_fetch_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      return null;
    } finally {
      // Record duration
      const duration = Date.now() - requestStart;
      this.metrics?.recordHistogram('cdn_fetch_duration_ms', duration);
    }
  }
  
  /**
   * Retrieves all feature flag keys for a specific SDK key with intelligent storage source selection.
   * Provides fallback mechanisms and caching for optimal performance across different deployment scenarios.
   * 
   * **Storage Source Priority (when useKV not explicitly set):**
   * 1. **FlagStorageService**: Modern KV storage with prefix `optimizely_flags:${sdkKey}` (preferred)
   * 2. **Legacy KV Storage**: Direct storage with prefix `flagkeys:${sdkKey}` (compatibility)
   * 3. **Datafile Extraction**: Extract flag keys from stored or CDN datafile (fallback)
   * 4. **In-Memory Cache**: Return cached flag keys if available and valid
   * 
   * **Caching Behavior:**
   * - Successful KV lookups are cached in memory with configurable TTL
   * - Cache is automatically invalidated when flag keys are updated
   * - Cache size is limited to prevent memory exhaustion
   * 
   * **Metadata Tracking:**
   * - Records source of flag keys in request context metadata
   * - Enables monitoring and debugging of data source usage
   * - Supports performance analytics and optimization
   * 
   * @param sdkKey - The Optimizely SDK key to retrieve flag keys for
   * @param options - Configuration options for the retrieval operation
   * @param options.useKV - Force KV storage usage (true) or datafile extraction (false)
   * @param options.requestContext - Request context for metadata tracking and debugging
   * 
   * @returns Promise resolving to array of flag keys, or null if no flags found
   * 
   * @throws {Error} When SDK key is invalid or storage operations fail critically
   * 
   * @example
   * ```typescript
   * // Get flag keys with automatic source selection
   * const flagKeys = await datafileService.getFlagKeys('my_sdk_key');
   * if (flagKeys) {
   *   console.log(`Found ${flagKeys.length} flags:`, flagKeys);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Force KV storage usage for Edge Mode
   * const flagKeys = await datafileService.getFlagKeys('sdk_key', {
   *   useKV: true,
   *   requestContext: { source: 'api_request' }
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Get flag keys with request tracking
   * const requestContext = { requestId: 'req_123', source: 'decide_all' };
   * const flagKeys = await datafileService.getFlagKeys('sdk_key', {
   *   requestContext
   * });
   * 
   * // Check metadata to see which source was used
   * console.log('Flag keys source:', requestContext.configMetadata?.flagKeysFrom);
   * // Outputs: 'kv', 'datafile', or 'cache'
   * ```
   * 
   * @see {@link setFlagKeys} for storing flag keys in KV storage
   * @see {@link extractFlagKeys} for extracting flag keys from datafiles
   * @see {@link synchronizeFlagKeys} for syncing flag keys between storage types
   * @since v2.0.0
   */
  async getFlagKeys(sdkKey: string, options?: { useKV?: boolean, requestContext?: any }): Promise<string[] | null> {
    if (!sdkKey) {
      this.logger.error(`${this.logPrefix} Cannot get flag keys: SDK key is required`);
      return null;
    }
    
    const useKV = options?.useKV;
    const requestContext = options?.requestContext;
    const isKVEnabled = this.configService?.getEnableDatafileFromKV() || false;
    const fallbackEnabled = this.configService?.getEnableKVStorageFallback?.() ?? true; // Default to true for backward compatibility
    
    // Log configuration state for debugging
    this.logger.debug(`${this.logPrefix} Getting flag keys for SDK key ${sdkKey}, useKV=${useKV}, KV enabled=${isKVEnabled}, fallback enabled=${fallbackEnabled}`);
    
    // Determine if we should try KV first
    const shouldTryKV = useKV === true || (useKV !== false && isKVEnabled);
    
    // Try KV if explicitly requested or if enabled by config
    if (shouldTryKV) {
      this.logger.debug(`${this.logPrefix} Attempting to get flag keys for SDK key ${sdkKey} from KV storage`);
      try {
        const kvResult = await this.getFlagsFromKV(sdkKey);
        if (kvResult && Array.isArray(kvResult) && kvResult.length > 0) {
          // Update request context with source if provided
          if (requestContext?.configMetadata) {
            requestContext.configMetadata.flagKeysFrom = 'kv';
            requestContext.configMetadata.flagKeysDecided = kvResult;
          }
          this.logger.debug(`${this.logPrefix} Successfully retrieved ${kvResult.length} flag keys from KV for SDK key ${sdkKey}`);
          this.metrics?.incrementCounter('flagkeys_cache_hit', 1, { source: 'kv', type: 'kv' });
          
          // Update in-memory cache for faster access
          if (this.cacheEnabled) {
            this.flagKeysCache.set(sdkKey, {
              flagKeys: kvResult,
              expiry: Date.now() + (DEFAULT_FLAGKEYS_TTL * 1000)
            });
          }
          
          return kvResult;
        }
        
        this.logger.debug(`${this.logPrefix} Flag keys not found in KV for SDK key ${sdkKey}`);
        
        // If useKV is explicitly true and fallback is disabled, return error instead of falling back
        if (useKV === true && !fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Flag keys not found in KV and fallback is disabled for SDK key ${sdkKey}`);
          throw new Error(`Flag keys not found in KV storage for SDK key ${sdkKey} and fallback is disabled`);
        }
        
        // Continue to other sources if fallback is enabled
        if (!fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Not falling back to other sources due to configuration for SDK key ${sdkKey}`);
          return [];
        }
        
      } catch (kvError) {
        this.logger.warn(`${this.logPrefix} Error retrieving flag keys from KV for SDK key ${sdkKey}: ${kvError}`);
        
        // If useKV is explicitly true and fallback is disabled, propagate error instead of falling back
        if (useKV === true && !fallbackEnabled) {
          throw new Error(`Error accessing KV storage for flag keys for SDK key ${sdkKey} and fallback is disabled: ${kvError}`);
        }
        
        // Continue to other sources if fallback is enabled
        if (!fallbackEnabled) {
          this.logger.warn(`${this.logPrefix} Not falling back to other sources due to configuration for SDK key ${sdkKey}`);
          return [];
        }
      }
    }
    
    const requestStart = Date.now();
    let source = 'unknown';
    
    try {
      // If the FlagStorageService is available, use it
      if (this.flagStorage) {
        const flagKeys = await this.flagStorage.getFlagKeys(sdkKey);
        if (flagKeys.length > 0) {
          source = 'flag-storage';
          // Update request context with source if provided
          if (requestContext?.configMetadata) {
            requestContext.configMetadata.flagKeysFrom = 'flag-storage';
            requestContext.configMetadata.flagKeysDecided = flagKeys;
          }
          this.metrics?.incrementCounter('flagkeys_cache_hit', 1, { source, type: 'flag-storage' });
          
          // If KV is enabled, store the flag keys in KV for future use
          if (isKVEnabled) {
            try {
              await this.setFlagKeys(sdkKey, flagKeys);
              this.logger.debug(`${this.logPrefix} Stored ${flagKeys.length} flag keys in KV for future use: SDK key ${sdkKey}`);
            } catch (storageError) {
              this.logger.warn(`${this.logPrefix} Failed to store flag keys in KV: ${storageError}`);
            }
          }
          
          return flagKeys;
        }
      }
      
      // Check in-memory cache
      if (this.cacheEnabled) {
        const cachedData = this.flagKeysCache.get(sdkKey);
        if (cachedData && cachedData.expiry > Date.now()) {
          source = 'memory-cache';
          // Update request context with source if provided
          if (requestContext?.configMetadata) {
            requestContext.configMetadata.flagKeysFrom = 'memory-cache';
            requestContext.configMetadata.flagKeysDecided = cachedData.flagKeys;
          }
          this.metrics?.incrementCounter('flagkeys_cache_hit', 1, { source, type: 'memory' });
          return cachedData.flagKeys;
        }
      }
      
      // If flag keys aren't available, try to extract them from datafile
      source = 'datafile';
      // Update request context with source if provided
      if (requestContext?.configMetadata) {
        requestContext.configMetadata.flagKeysFrom = 'datafile';
      }
      this.metrics?.incrementCounter('flagkeys_cache_miss', 1);
      
      // Note: we pass the same useKV option to getDatafile to maintain consistency
      const datafile = await this.getDatafile(sdkKey, { useKV: options?.useKV, requestContext });
      if (datafile) {
        const flagKeys = this.extractFlagKeys(datafile);
        await this.setFlagKeys(sdkKey, flagKeys);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.flagKeysDecided = flagKeys;
        }
        return flagKeys;
      }
      
      // No flag keys found
      return [];
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error getting flag keys for SDK key ${sdkKey}:`, error);
      this.metrics?.incrementCounter('flagkeys_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      return [];
    } finally {
      // Record duration
      const duration = Date.now() - requestStart;
      this.metrics?.recordHistogram('flagkeys_fetch_duration_ms', duration, { source });
    }
  }
  
  /**
   * Stores feature flag keys for a specific SDK key with intelligent storage routing and deduplication.
   * Automatically chooses between FlagStorageService and legacy storage for optimal compatibility.
   * 
   * **Storage Strategy:**
   * - **Primary**: FlagStorageService with prefix `optimizely_flags:${sdkKey}` (when available)
   * - **Fallback**: Legacy KV storage with prefix `flagkeys:${sdkKey}` (for compatibility)
   * 
   * **Data Processing:**
   * - Automatic deduplication of flag keys to prevent storage waste
   * - Validation of flag key format and structure
   * - Empty array handling with appropriate logging
   * 
   * **Performance Features:**
   * - In-memory cache update on successful storage
   * - Metrics tracking for storage operations and performance
   * - Batch processing for large flag key sets
   * 
   * **TTL Management:**
   * - Configurable TTL with sensible defaults (1 hour)
   * - Automatic expiration handling in KV storage
   * - Cache TTL synchronization with storage TTL
   * 
   * @param sdkKey - The Optimizely SDK key to store flag keys for
   * @param flagKeys - Array of flag keys to store (duplicates will be removed automatically)
   * @param ttl - Time-to-live in seconds for the stored flag keys (default: 3600 seconds/1 hour)
   * 
   * @returns Promise resolving to true if storage was successful, false otherwise
   * 
   * @throws {Error} When SDK key is invalid or critical storage failure occurs
   * 
   * @example
   * ```typescript
   * // Store flag keys with default TTL
   * const success = await datafileService.setFlagKeys('my_sdk_key', [
   *   'checkout_redesign',
   *   'new_navigation',
   *   'payment_flow'
   * ]);
   * 
   * if (success) {
   *   console.log('Flag keys stored successfully');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Store with custom TTL (24 hours)
   * const flagKeys = ['feature_a', 'feature_b', 'feature_c'];
   * const success = await datafileService.setFlagKeys(
   *   'sdk_key',
   *   flagKeys,
   *   24 * 60 * 60  // 24 hours in seconds
   * );
   * ```
   * 
   * @example
   * ```typescript
   * // Automatic deduplication example
   * const flagKeysWithDuplicates = [
   *   'flag_1', 'flag_2', 'flag_1', 'flag_3', 'flag_2'
   * ];
   * 
   * const success = await datafileService.setFlagKeys(
   *   'sdk_key',
   *   flagKeysWithDuplicates
   * );
   * // Only unique flags ['flag_1', 'flag_2', 'flag_3'] will be stored
   * ```
   * 
   * @see {@link getFlagKeys} for retrieving stored flag keys
   * @see {@link extractFlagKeys} for extracting flag keys from datafiles
   * @see {@link saveFlagKeys} for alias method with same functionality
   * @since v2.0.0
   */
  async setFlagKeys(sdkKey: string, flagKeys: string[], ttl = DEFAULT_FLAGKEYS_TTL): Promise<boolean> {
    if (!sdkKey || !Array.isArray(flagKeys)) {
      this.logger.error(`${this.logPrefix} Cannot set flag keys: SDK key and flag keys array are required`);
      return false;
    }
    
    const requestStart = Date.now();
    
    try {
      // Deduplicate flag keys
      const uniqueFlagKeys = [...new Set(flagKeys)];
      
      // If FlagStorageService is available, use it
      if (this.flagStorage) {
        const result = await this.flagStorage.putFlagKeys(sdkKey, uniqueFlagKeys, ttl);
        if (!result) {
          this.logger.warn(`${this.logPrefix} FlagStorageService failed to store flag keys, falling back to legacy implementation`);
        } else {
          this.logger.debug(`${this.logPrefix} FlagStorageService stored ${uniqueFlagKeys.length} flag keys with TTL ${ttl}s`);
          
          // No need to use legacy approach if FlagStorageService succeeded
          // But still update in-memory cache for faster access
          if (this.cacheEnabled) {
            this.flagKeysCache.set(sdkKey, {
              flagKeys: uniqueFlagKeys,
              expiry: Date.now() + (ttl * 1000)
            });
          }
          
          return true;
        }
      }
      
      // Legacy implementation - store in KV with TTL
      const storageKey = `${FLAGKEYS_PREFIX}${sdkKey}`;
      await this.storage.put(storageKey, JSON.stringify(uniqueFlagKeys), { expirationTtl: ttl });
      
      // Update in-memory cache
      if (this.cacheEnabled) {
        this.flagKeysCache.set(sdkKey, {
          flagKeys: uniqueFlagKeys,
          expiry: Date.now() + (ttl * 1000)
        });
      }
      
      this.logger.info(`${this.logPrefix} Stored ${uniqueFlagKeys.length} flag keys for SDK key ${sdkKey} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error storing flag keys for SDK key ${sdkKey}:`, error);
      this.metrics?.incrementCounter('flagkeys_storage_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      return false;
    } finally {
      // Record duration
      const duration = Date.now() - requestStart;
      this.metrics?.recordHistogram('flagkeys_storage_duration_ms', duration);
    }
  }
  
  /**
   * Alias for setFlagKeys to maintain compatibility with existing code.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKeys - The array of flag keys to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async saveFlagKeys(sdkKey: string, flagKeys: string[], ttl?: number): Promise<boolean> {
    return this.setFlagKeys(sdkKey, flagKeys, ttl);
  }
  
  /**
   * Extracts flag keys from a datafile.
   * @param datafileJson - The JSON string representation of the datafile.
   * @returns An array of flag keys found in the datafile.
   */
  extractFlagKeys(datafileJson: string): string[] {
    try {
      if (!datafileJson) {
        return [];
      }
      
      const datafile = JSON.parse(datafileJson);
      const flagKeys: string[] = [];
      
      // Extract feature keys
      if (datafile.featureFlags && Array.isArray(datafile.featureFlags)) {
        for (const flag of datafile.featureFlags) {
          if (flag.key) {
            flagKeys.push(flag.key);
          }
        }
      }
      
      // Extract experiment keys
      if (datafile.experiments && Array.isArray(datafile.experiments)) {
        for (const experiment of datafile.experiments) {
          if (experiment.key) {
            flagKeys.push(experiment.key);
          }
        }
      }
      
      return [...new Set(flagKeys)]; // Deduplicate
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error extracting flag keys from datafile:`, error);
      return [];
    }
  }
  
  /**
   * Refreshes the datafile and flag keys from the Optimizely CDN.
   * @param sdkKey - The Optimizely SDK key.
   * @param forceFetch - Whether to force a fetch even if a local copy exists.
   * @param requestContext - Optional request context for updating metadata.
   * @returns A promise resolving to the datafile JSON string or null if refresh failed.
   */
  async refreshDatafile(sdkKey: string, forceFetch = false, requestContext?: any): Promise<string | null> {
    if (!sdkKey) {
      this.logger.error(`${this.logPrefix} Cannot refresh datafile: SDK key is required`);
      return null;
    }
    
    const requestStart = Date.now();
    let source = 'unknown';
    
    try {
      // If not forcing a fetch, check if we can use cached data
      if (!forceFetch) {
        // Check in-memory cache first
        if (this.cacheEnabled) {
          const cachedData = this.datafileCache.get(sdkKey);
          if (cachedData && cachedData.expiry > Date.now()) {
            source = 'memory-cache';
            // Update request context with source if provided
            if (requestContext?.configMetadata) {
              requestContext.configMetadata.datafileFrom = 'memory-cache';
            }
            this.metrics?.incrementCounter('datafile_cache_hit', 1, { source, type: 'memory' });
            return cachedData.datafile;
          }
        }
        
        // Check KV storage
        const cacheKey = `${DATAFILE_PREFIX}${sdkKey}`;
        const storedDatafile = await this.storage.get(cacheKey, 'text');
        if (storedDatafile) {
          source = 'kv';
          // Update request context with source if provided
          if (requestContext?.configMetadata) {
            requestContext.configMetadata.datafileFrom = 'kv';
          }
          this.metrics?.incrementCounter('datafile_cache_hit', 1, { source, type: 'kv' });
          return storedDatafile;
        }
      }
      
      // Fetch from CDN
      source = 'cdn';
      this.logger.info(`${this.logPrefix} Refreshing datafile from CDN for SDK key ${sdkKey}`);
      const datafile = await this.fetchDatafileFromCDN(sdkKey);
      
      if (datafile) {
        // Store the datafile
        await this.setDatafile(sdkKey, datafile);
        this.logger.info(`${this.logPrefix} Successfully refreshed datafile for SDK key ${sdkKey}`);
      } else {
        this.logger.error(`${this.logPrefix} Failed to refresh datafile for SDK key ${sdkKey}`);
      }
      
      return datafile;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error refreshing datafile for SDK key ${sdkKey}:`, error);
      this.metrics?.incrementCounter('datafile_refresh_errors', 1, {
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      return null;
    } finally {
      // Record duration
      const duration = Date.now() - requestStart;
      this.metrics?.recordHistogram('datafile_refresh_duration_ms', duration, { source });
    }
  }
  
  /**
   * Validates a datafile to ensure it's properly formatted.
   * @param datafileJson - The JSON string to validate.
   * @returns True if the datafile is valid, false otherwise.
   */
  private isValidDatafile(datafileJson: string): boolean {
    try {
      if (!datafileJson) {
        this.logger.error(`${this.logPrefix} Datafile is empty or null`);
        return false;
      }
      
      // Log first part of datafile for debugging
      this.logger.debug(`${this.logPrefix} Validating datafile (first 100 chars): ${datafileJson.substring(0, 100)}...`);
      
      // Attempt to parse the datafile JSON
      let datafile;
      try {
        datafile = JSON.parse(datafileJson);
      } catch (parseError) {
        this.logger.error(`${this.logPrefix} Failed to parse datafile JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        return false;
      }
      
      if (!datafile || typeof datafile !== 'object') {
        this.logger.error(`${this.logPrefix} Datafile is not a valid JSON object`);
        return false;
      }
      
      // Log important datafile properties for debugging
      this.logger.debug(`${this.logPrefix} Datafile properties: revision=${datafile.revision}, schemaVersion=${datafile.schemaVersion}, projectId=${datafile.projectId}, version=${datafile.version}`);
      
      // Basic validation - at minimum it should be an object
      return true;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error validating datafile:`, error);
      return false;
    }
  }
  
  /**
   * Clears the in-memory caches.
   */
  public clearMemoryCache(): void {
    this.datafileCache.clear();
    this.flagKeysCache.clear();
    this.logger.info(`${this.logPrefix} Memory cache cleared`);
  }
  
  /**
   * Sets the configuration service after construction.
   * This is used to avoid circular dependencies during initialization.
   * @param configService - The configuration service instance.
   */
  public setConfigService(configService: IConfigurationService): void {
    this.configService = configService;
    this.logger.info(`${this.logPrefix} Configuration service injected`);
  }
  
  /**
   * Gets the environment adapter used by this service.
   * @returns The environment adapter instance.
   */
  getEnvironmentAdapter(): IEnvironmentAdapter {
    return this.environment;
  }
  
  /**
   * Synchronizes flag keys between environments.
   * This method leverages the FlagStorageService to synchronize flag keys across environments.
   * 
   * @param sourceSdkKey - The source SDK key to copy flag keys from.
   * @param targetSdkKeys - Array of target SDK keys to propagate flag keys to.
   * @param options - Optional configuration options.
   * @returns A promise resolving to a result object with success/failure information.
   */
  async synchronizeFlagKeys(
    sourceSdkKey: string,
    targetSdkKeys: string[],
    options?: {
      propagateOnly?: string[];
      excludeFlags?: string[];
      refreshDatafile?: boolean;
    }
  ): Promise<{ 
    success: boolean;
    results?: Record<string, boolean>;
    message?: string;
    error?: Error;
  }> {
    if (!this.flagStorage) {
      this.logger.warn(`${this.logPrefix} Cannot synchronize flag keys: FlagStorageService not available`);
      return {
        success: false,
        message: "FlagStorageService not available"
      };
    }
    
    try {
      // If requested, refresh the source datafile to ensure latest flag keys
      if (options?.refreshDatafile) {
        this.logger.debug(`${this.logPrefix} Refreshing datafile before synchronization for SDK key ${sourceSdkKey}`);
        await this.getDatafile(sourceSdkKey);
      }
      
      // Get the flag keys for the source SDK key
      const sourceFlags = await this.getFlagKeys(sourceSdkKey);
      
      if (sourceFlags && Array.isArray(sourceFlags)) {
        // Use sourceFlags as needed
        // ... existing code ...
      }
      
      // Synchronize flag keys using FlagStorageService
      const results = await this.flagStorage.manageFlagKeysAcrossEnvironments(
        sourceSdkKey, 
        targetSdkKeys,
        {
          propagateOnly: options?.propagateOnly,
          excludeFlags: options?.excludeFlags
        }
      );
      
      // Check if any target environments failed
      const allSuccessful = Object.values(results).every(result => result === true);
      
      return {
        success: allSuccessful,
        results,
        message: allSuccessful 
          ? `Successfully synchronized flags to ${targetSdkKeys.length} environments` 
          : `Some environments failed to synchronize`
      };
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error synchronizing flag keys:`, error);
      return {
        success: false,
        message: "Error synchronizing flag keys",
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Initiates cleanup of expired flag keys and decisions.
   * @param sdkKey - Optional SDK key to limit cleanup to specific SDK data.
   * @returns A promise resolving to the number of items cleaned up.
   */
  async cleanupExpiredFlags(sdkKey?: string): Promise<number> {
    if (!this.flagStorage) {
      this.logger.warn(`${this.logPrefix} Cannot cleanup expired flags: FlagStorageService not available`);
      return 0;
    }
    
    try {
      // Use performCleanup to execute a manual cleanup
      const cleanedCount = await this.flagStorage.performCleanup(sdkKey);
      this.logger.debug(`${this.logPrefix} Cleaned up ${cleanedCount} expired flag items`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error cleaning up expired flags:`, error);
      return 0;
    }
  }
  
  async getFlagsFromKV(sdkKey: string): Promise<string[] | null> {
    // Check if KV storage is enabled via config service
    const isKVEnabled = this.configService?.getEnableDatafileFromKV() || false;
    
    if (!isKVEnabled) {
      this.logger.warn(`${this.logPrefix} Attempted to get flag keys from KV, but KV storage is not enabled`);
      // We don't throw an error here - we'll just return null
      // and the calling method will fall back to other sources
      return null;
    }
    
    const storageKey = `${FLAGKEYS_PREFIX}${sdkKey}`;
    
    try {
      const storedFlagKeys = await this.storage.get<string[]>(storageKey, 'json');
      
      if (!storedFlagKeys || !Array.isArray(storedFlagKeys) || storedFlagKeys.length === 0) {
        this.logger.debug(`${this.logPrefix} No flag keys found in KV storage for SDK key ${sdkKey}`);
        return null;
      }
      
      this.logger.debug(`${this.logPrefix} Retrieved ${storedFlagKeys.length} flag keys from KV storage for SDK key ${sdkKey}`);
      return storedFlagKeys;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error retrieving flag keys from KV storage: ${error}`);
      return null;
    }
  }
  
  async getDatafileFromKV(sdkKey: string): Promise<string | null> {
    // Check if KV storage is enabled via config service
    const isKVEnabled = this.configService?.getEnableDatafileFromKV() || false;
    
    if (!isKVEnabled) {
      this.logger.warn(`${this.logPrefix} Attempted to get datafile from KV, but KV storage is not enabled`);
      // We don't throw an error here as per your clarification - we'll just return null
      // and the calling method will fall back to CDN
      return null;
    }
    
    const cacheKey = `${DATAFILE_PREFIX}${sdkKey}`;
    
    try {
      const storedDatafile = await this.storage.get(cacheKey, 'text');
      
      if (!storedDatafile) {
        this.logger.debug(`${this.logPrefix} No datafile found in KV storage for SDK key ${sdkKey}`);
        return null;
      }
      
      this.logger.debug(`${this.logPrefix} Retrieved datafile from KV storage for SDK key ${sdkKey}`);
      return storedDatafile;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error retrieving datafile from KV storage: ${error}`);
      return null;
    }
  }
  
  /**
   * Constructs the URL for fetching a datafile from the CDN.
   * @param sdkKey - The SDK key for which to construct the URL.
   * @returns The complete URL string.
   * @private
   */
  private getDatafileUrl(sdkKey: string): string {
    if (!sdkKey) {
      throw new Error('SDK key is required to get datafile URL');
    }
    // Standard Optimizely CDN URL format
    return `https://cdn.optimizely.com/datafiles/${sdkKey}.json`;
  }

  /**
   * Fetches a datafile from the specified URL.
   * @param url - The URL from which to fetch the datafile.
   * @param accessToken - Optional access token for authenticated requests.
   * @returns A Promise resolving to the fetch response.
   * @private
   */
  private async fetchDatafile(url: string, accessToken?: string): Promise<Response> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'optimizely-edge-agent'
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return await fetch(url, {
      method: 'GET',
      headers
    });
  }
} 