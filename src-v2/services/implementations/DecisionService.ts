import {
  IDecisionService,
  // UserContext, // Replace with OptimizelyUserContext
  // DecisionResult // Replace with OptimizelyDecision
  OptimizelyUserContext,
  OptimizelyDecision,
  OptimizelyDecideOption,
  OptimizelyDecisionContext
} from "../interfaces/IDecisionService";
import { IConfigurationService } from "../interfaces/IConfigurationService";
import { ILoggerAdapter, LogLevel, LogContext } from "../../adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter, MetricTags } from "../../adapters/interfaces/IMetricsAdapter";
import * as optimizely from '@optimizely/optimizely-sdk';
import { OptimizelyUserProfileServiceAdapter } from '../storage/OptimizelyUserProfileServiceAdapter';
import { OptimizelyIdMapper } from "../../utils/sdkConfigUtils";

// Configure Optimizely SDK to use Node.js environment
// This needs to happen before any other SDK operations
const nodeJSLogger = {
  log: (level: any, message: string) => {
    // No-op logger to avoid browser APIs
    // Will be replaced with proper logger in client initialization
  }
};

// Following the pattern from the original codebase (optimizelyProvider.js)
// Set up SDK before any initialization
optimizely.setLogger(nodeJSLogger);
optimizely.setLogLevel(optimizely.enums.LOG_LEVEL.ERROR);

// Prepare a safe environment for the Optimizely SDK to run in Cloudflare Workers
// Mock browser APIs that might be used by the SDK to prevent errors
if (typeof globalThis.localStorage === 'undefined') {
  // Create a mock localStorage that does nothing
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

// Mock window for safety
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    // Minimal window mock for SDK compatibility
    location: { href: '' },
    addEventListener: () => {}
  };
}

// Interface for Optimizely client instance caching
interface OptimizelyClientCache {
  [sdkKey: string]: {
    revision: string;
    client: optimizely.Client;
    lastUsed: number; // Used for cache management
  };
}

// Type for audience targeting data
interface AudienceData {
  id: string;
  name: string;
  conditions: string;
}

// Interface definition for Optimizely logger
interface OptimizelyLogger {
  log(level: any, message: string): void;
}

// Add RequestContext interface at the top with the other interfaces
interface RequestContext {
  configMetadata?: {
    datafileFrom?: string;
    flagKeysFrom?: string;
    [key: string]: any;
  };
}

// Define extended OptimizelyUserContext with metadata for our implementation
interface ExtendedOptimizelyUserContext extends OptimizelyUserContext {
  metadata?: {
    requestContext?: RequestContext;
  };
  forcedDecisions?: Record<string, { variationKey: string }>;
}

// Interface for Optimizely decision results with our format
interface OptimizelyDecisionResult {
  variationKey: string;
  enabled: boolean;
  variables: Record<string, unknown>;
  ruleKey: string;
  flagKey: string;
  reasons?: string[];
}

/**
 * Service responsible for making Optimizely decisions (feature flags, experiments).
 * Integrates with the Optimizely Full Stack SDK.
 */
export class DecisionService implements IDecisionService {
  private configService: IConfigurationService;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | null = null;
  private clientCache: OptimizelyClientCache = {};
  private userContextCache: Map<string, any> = new Map(); // Cache for user contexts
  private maxCacheSize = 100; // Changed from readonly MAX_CACHE_SIZE to a variable
  private userContextCacheTtl = 5 * 60 * 1000; // 5 minutes in milliseconds (changed from readonly)
  private readonly componentName = 'DecisionService';
  private readonly LOG_PREFIX = '[v2]';
  private defaultSdkKey: string | null = null; // Default SDK key for operations
  private userProfileServiceAdapter: OptimizelyUserProfileServiceAdapter | null = null; // Add this field
  private optimizelyLoggerAdapter: OptimizelyLogger;
  private clientCachingEnabled: boolean = true; // Controls if clients are cached (for testing)
  private datafileUpdateTimers: Map<string, number> = new Map(); // Track datafile update times
  private idMapper: OptimizelyIdMapper; // Utility for mapping between flag keys and experiment IDs
  private optimizelyConfigCache: Map<string, { config: any, expiry: number }> = new Map(); // Cache for OptimizelyConfig
  private optimizelyConfigCacheTtl = 60 * 60 * 1000; // 60 minutes default TTL in milliseconds

  /**
   * Creates an instance of the DecisionService.
   * @param configService - Service to fetch Optimizely configuration.
   * @param logger - Logger adapter.
   * @param metrics - Optional metrics adapter.
   * @param defaultSdkKey - Optional default SDK key to use when none is provided.
   * @param userProfileServiceAdapter - Optional user profile service adapter for sticky bucketing.
   * @param options - Optional configuration options.
   */
  constructor(
    configService: IConfigurationService, 
    logger: ILoggerAdapter, 
    metrics?: IMetricsAdapter,
    defaultSdkKey?: string,
    userProfileServiceAdapter?: OptimizelyUserProfileServiceAdapter,
    options?: {
      clientCachingEnabled?: boolean;
      maxCacheSize?: number;
      userContextTtlMs?: number;
    }
  ) {
    if (!configService || !logger) {
      throw new Error("DecisionService requires configService and logger.");
    }
    this.configService = configService;
    this.logger = logger.forComponent(this.componentName);
    this.metrics = metrics || null;
    this.defaultSdkKey = defaultSdkKey || null;
    this.userProfileServiceAdapter = userProfileServiceAdapter || null;
    this.idMapper = new OptimizelyIdMapper(logger);

    // Apply options if provided
    if (options) {
      if (options.clientCachingEnabled !== undefined) {
        this.clientCachingEnabled = options.clientCachingEnabled;
      }
      if (options.maxCacheSize) {
        this.maxCacheSize = options.maxCacheSize;
      }
      if (options.userContextTtlMs) {
        this.userContextCacheTtl = options.userContextTtlMs;
      }
    }

    // Initialize the Optimizely logger adapter
    this.optimizelyLoggerAdapter = this.createOptimizelyLoggerAdapter("default");

    // Record configuration metrics
    if (this.metrics) {
      this.metrics.setGauge('cache_size_limit', this.maxCacheSize, { 
        component: this.componentName,
        cache_type: 'client' 
      });
      this.metrics.setGauge('cache_ttl_ms', this.userContextCacheTtl, { 
        component: this.componentName,
        cache_type: 'user_context' 
      });
      this.metrics.setGauge('caching_enabled', this.clientCachingEnabled ? 1 : 0, { 
        component: this.componentName,
        cache_type: 'client' 
      });
    }

    // Log initialization with structured data
    this.logger.info("Initialized with Node.js SDK configuration", {
      defaultSdkKey: this.defaultSdkKey ? this.maskSensitiveData(this.defaultSdkKey) : null,
      clientCachingEnabled: this.clientCachingEnabled,
      maxCacheSize: this.maxCacheSize,
      userContextTtlMs: this.userContextCacheTtl,
      hasMetrics: !!this.metrics,
      hasProfileService: !!this.userProfileServiceAdapter
    });

    // Start periodic cache cleanup
    setInterval(() => this.cleanupCaches(), 10 * 60 * 1000); // Run every 10 minutes
  }

  /**
   * Cleans up expired or least recently used items from caches
   * to prevent memory leaks and excessive memory usage.
   */
  private cleanupCaches(): void {
    const cleanupTimer = this.metrics?.startTimer('cache_cleanup_duration', {
      component: this.componentName
    });
    
    const now = Date.now();
    let userContextsRemoved = 0;
    let clientsRemoved = 0;
    let configsRemoved = 0;
    
    // Clean up user context cache based on TTL
    this.userContextCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.userContextCacheTtl) {
        this.userContextCache.delete(key);
        userContextsRemoved++;
      }
    });
    
    // Clean up OptimizelyConfig cache based on expiry
    this.optimizelyConfigCache.forEach((entry, key) => {
      if (entry.expiry < now) {
        this.optimizelyConfigCache.delete(key);
        configsRemoved++;
      }
    });
    
    // Limit client cache size by removing least recently used clients
    if (Object.keys(this.clientCache).length > this.maxCacheSize) {
      const entries = Object.entries(this.clientCache);
      entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      
      // Remove oldest entries until we're back to the max size
      const entriesToRemove = entries.slice(0, entries.length - this.maxCacheSize);
      for (const [sdkKey] of entriesToRemove) {
        delete this.clientCache[sdkKey];
        clientsRemoved++;
      }
    }
    
    // Record cache metrics after cleanup
    if (this.metrics) {
      this.metrics.setGauge('cache_size', this.userContextCache.size, { 
        component: this.componentName,
        cache_type: 'user_context' 
      });
      this.metrics.setGauge('cache_size', Object.keys(this.clientCache).length, { 
        component: this.componentName,
        cache_type: 'client' 
      });
      this.metrics.setGauge('cache_size', this.optimizelyConfigCache.size, { 
        component: this.componentName,
        cache_type: 'optimizely_config' 
      });
      this.metrics.incrementCounter('cache_items_removed', userContextsRemoved, {
        component: this.componentName,
        cache_type: 'user_context'
      });
      this.metrics.incrementCounter('cache_items_removed', clientsRemoved, {
        component: this.componentName,
        cache_type: 'client'
      });
      this.metrics.incrementCounter('cache_items_removed', configsRemoved, {
        component: this.componentName,
        cache_type: 'optimizely_config'
      });
    }
    
    // Log cleanup results with structured data
    this.logger.debug("Cache cleanup completed", {
      userContextCacheSize: this.userContextCache.size,
      userContextsRemoved,
      clientCacheSize: Object.keys(this.clientCache).length,
      clientsRemoved,
      optimizelyConfigCacheSize: this.optimizelyConfigCache.size,
      configsRemoved
    });
    
    if (cleanupTimer) {
      cleanupTimer.stop();
    }
  }

  /**
   * Gets the appropriate log level for the Optimizely SDK
   * @returns The Optimizely SDK log level
   */
  private getLogLevel(): any {
    return optimizely.enums.LOG_LEVEL.ERROR; // Default to ERROR level
  }

  /**
   * Gets (or initializes) an Optimizely client for a given SDK key
   * @param sdkKey The SDK key
   * @param requestContext Optional request context for tracking metadata sources
   * @returns The Optimizely client or null if error
   */
  private async getOptimizelyClient(
    sdkKey: string,
    requestContext?: RequestContext
  ): Promise<optimizely.Client | null> {
    // Start timer for client initialization
    const clientTimer = this.metrics?.startTimer('client_initialization_duration', {
      component: this.componentName,
      sdkKey: this.maskSensitiveData(sdkKey),
      operation: 'get_client'
    });
    
    // Check if we have a cached client
    const cached = this.clientCache[sdkKey];
    let clientSource = 'cache_miss';
    let client: optimizely.Client | null = null;
    
    try {
      // Fetch datafile with timing
      const datafileTimer = this.metrics?.startTimer('datafile_fetch_duration', {
        sdkKey: this.maskSensitiveData(sdkKey)
      });
      const datafile = await this.configService.getDatafile(sdkKey);
      let datafileFetchDuration = 0;
      if (datafileTimer) {
        datafileFetchDuration = datafileTimer.stop();
      }
      
      if (!datafile) {
        this.logger.error("Failed to fetch datafile", {
          sdkKey: this.maskSensitiveData(sdkKey),
          datafileFetchDurationMs: datafileFetchDuration
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('datafile_fetch_errors', 1, {
            sdkKey: this.maskSensitiveData(sdkKey),
            error_type: 'missing_datafile'
          });
        }
        
        return null;
      }
      
      // Parse datafile if it's a string
      let parsedDatafile: any;
      try {
        parsedDatafile = typeof datafile === 'string' ? JSON.parse(datafile) : datafile;
      } catch (error) {
        this.logger.error("Failed to parse datafile JSON", {
          sdkKey: this.maskSensitiveData(sdkKey),
          datafileFetchDurationMs: datafileFetchDuration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('datafile_fetch_errors', 1, {
            sdkKey: this.maskSensitiveData(sdkKey),
            error_type: 'invalid_json'
          });
        }
        
        return null;
      }
      
      if (!parsedDatafile || typeof parsedDatafile !== 'object' || !('revision' in parsedDatafile)) {
        this.logger.error("Datafile is missing required fields", {
          sdkKey: this.maskSensitiveData(sdkKey),
          datafileFetchDurationMs: datafileFetchDuration
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('datafile_fetch_errors', 1, {
            sdkKey: this.maskSensitiveData(sdkKey),
            error_type: 'invalid_datafile_format'
          });
        }
        
        return null;
      }

      const revision = String(parsedDatafile.revision);
      
      // Calculate time since last datafile update
      let datafileUpdateInterval = 0;
      const lastUpdateTime = this.datafileUpdateTimers.get(sdkKey);
      if (lastUpdateTime) {
        datafileUpdateInterval = Date.now() - lastUpdateTime;
      }
      
      // Check if we can use cached client
      if (this.clientCachingEnabled && cached && cached.revision === revision) {
        this.logger.debug("Using cached Optimizely client", {
          sdkKey: this.maskSensitiveData(sdkKey),
          revision,
          cacheHit: true
        });
        
        // Update client cache metrics
        if (this.metrics) {
          this.metrics.incrementCounter('client_cache_hits', 1, {
            sdkKey: this.maskSensitiveData(sdkKey)
          });
        }
        
        // Update last used timestamp
        this.clientCache[sdkKey].lastUsed = Date.now();
        client = cached.client;
        clientSource = 'cache_hit';
      } else {
        // Need to create a new client
        if (this.metrics) {
          if (this.clientCachingEnabled && cached) {
            this.metrics.incrementCounter('client_cache_revision_mismatches', 1, {
              sdkKey: this.maskSensitiveData(sdkKey),
              old_revision: cached.revision,
              new_revision: revision
            });
          } else {
            this.metrics.incrementCounter('client_cache_misses', 1, {
              sdkKey: this.maskSensitiveData(sdkKey),
              reason: cached ? 'revision_mismatch' : 'first_initialization'
            });
          }
        }
        
        const initTimer = this.metrics?.startTimer('client_creation_duration', {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        
        this.logger.info("Creating new Optimizely client instance", {
          sdkKey: this.maskSensitiveData(sdkKey),
          revision,
          datafileFetchDurationMs: datafileFetchDuration,
          datafileUpdateIntervalMs: datafileUpdateInterval || null
        });
        
        // Create a wrapper for the logger that converts between our log levels and Optimizely's
        const loggerAdapter: OptimizelyLogger = this.createOptimizelyLoggerAdapter(sdkKey);
        
        try {
          // Create enhanced client
          const clientConfig: any = {
            datafile: parsedDatafile,
            logger: loggerAdapter,
            logLevel: this.getLogLevel(),
            errorHandler: {
              handleError: (error: Error) => {
                this.logger.error("Optimizely SDK Error", error, {
                  sdkKey: this.maskSensitiveData(sdkKey),
                  errorName: error.name
                });
                
                if (this.metrics) {
                  this.metrics.incrementCounter('sdk_errors', 1, {
                    sdkKey: this.maskSensitiveData(sdkKey),
                    error_type: error.name
                  });
                }
              }
            }
          };

          // Add userProfileService if available
          if (this.userProfileServiceAdapter) {
            clientConfig.userProfileService = this.userProfileServiceAdapter.getSDKUserProfileService();
          }
          
          const client = optimizely.createInstance(clientConfig);
          
          // Record client creation time
          if (initTimer) {
            const duration = initTimer.stop();
            if (this.metrics) {
              this.metrics.recordHistogram('client_creation_time', duration, {
                sdkKey: this.maskSensitiveData(sdkKey)
              });
            }
          }
          
          if (!client) {
            throw new Error('optimizely.createInstance returned null or undefined.');
          }
          
          // Track datafile update time
          this.datafileUpdateTimers.set(sdkKey, Date.now());
          
          // Record datafile metrics
          if (this.metrics) {
            // Record datafile size
            if (parsedDatafile) {
              // Use string length as an estimate of size (works in all environments)
              const datafileSize = JSON.stringify(parsedDatafile).length;
              this.metrics.recordHistogram('datafile_size_bytes', datafileSize, {
                sdkKey: this.maskSensitiveData(sdkKey)
              });
              
              // Record feature flag count
              if ((parsedDatafile as any).featureFlags && Array.isArray((parsedDatafile as any).featureFlags)) {
                this.metrics.setGauge('feature_flag_count', (parsedDatafile as any).featureFlags.length, {
                  sdkKey: this.maskSensitiveData(sdkKey)
                });
              }
              
              // Record experiment count
              if ((parsedDatafile as any).experiments && Array.isArray((parsedDatafile as any).experiments)) {
                this.metrics.setGauge('experiment_count', (parsedDatafile as any).experiments.length, {
                  sdkKey: this.maskSensitiveData(sdkKey)
                });
              }
              
              // Record update interval if available
              if (datafileUpdateInterval > 0) {
                this.metrics.recordHistogram('datafile_update_interval_ms', datafileUpdateInterval, {
                  sdkKey: this.maskSensitiveData(sdkKey)
                });
              }
            }
          }
          
          // Store client in cache with timestamp
          if (this.clientCachingEnabled) {
            this.clientCache[sdkKey] = { 
              revision, 
              client,
              lastUsed: Date.now()
            };
          }
          
          // Clear any related user contexts from cache when client changes
          this.clearUserContextsForSdkKey(sdkKey);

          return client;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          this.logger.error("Failed to create Optimizely client", errorObj, {
            sdkKey: this.maskSensitiveData(sdkKey),
            errorName: errorObj.name,
            errorMessage: errorObj.message
          });
          
          if (this.metrics) {
            this.metrics.incrementCounter('client_creation_errors', 1, {
              sdkKey: this.maskSensitiveData(sdkKey),
              error_type: errorObj.name
            });
          }
          
          return null;
        }
      }
    } finally {
      // Stop the overall timer
      if (clientTimer) {
        const duration = clientTimer.stop();
        if (this.metrics) {
          this.metrics.recordHistogram('client_total_initialization_time', duration, {
            sdkKey: this.maskSensitiveData(sdkKey),
            source: clientSource
          });
        }
      }
    }
    
    return client;
  }

  /**
   * Converts our internal user context to the format expected by the SDK.
   * @param userContext - Our internal user context.
   * @returns SDK compliant user context.
   */
  private convertToSdkUserContext(userContext: ExtendedOptimizelyUserContext): { id: string, attributes: optimizely.UserAttributes } {
    return {
      id: userContext.userId,
      attributes: userContext.attributes || {},
    };
  }

  /**
   * Gets a cached user context or creates a new one if not available.
   * @param client - The Optimizely client.
   * @param userId - The user ID.
   * @param attributes - The user attributes.
   * @returns The Optimizely user context.
   */
  private getUserContext(client: optimizely.Client, userId: string, attributes: optimizely.UserAttributes = {}): any {
    const cacheKey = `${userId}:${JSON.stringify(attributes)}`;
    const contextTimer = this.metrics?.startTimer('user_context_creation_duration', {
      component: this.componentName,
      operation: 'get_user_context'
    });
    
    let contextSource = 'cache_miss';
    let context;
    
    try {
      // Check cache first
      const cached = this.userContextCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.userContextCacheTtl) {
        contextSource = 'cache_hit';
        context = cached.context;
        
        if (this.metrics) {
          this.metrics.incrementCounter('user_context_cache_hits', 1);
        }
      } else {
        // Create new user context
        const startTime = Date.now();
        context = client.createUserContext(userId, attributes);
        const creationTime = Date.now() - startTime;
        
        if (this.metrics) {
          this.metrics.incrementCounter('user_context_cache_misses', 1);
          this.metrics.recordHistogram('user_context_creation_time', creationTime);
        }
        
        // Store in cache
        this.userContextCache.set(cacheKey, {
          context,
          timestamp: Date.now()
        });
        
        this.logger.debug("Created new user context", {
          userId: this.maskSensitiveData(userId),
          attributeCount: Object.keys(attributes).length,
          creationTimeMs: creationTime
        });
      }
    } finally {
      if (contextTimer) {
        const duration = contextTimer.stop();
        if (this.metrics) {
          this.metrics.recordHistogram('user_context_total_time', duration, {
            source: contextSource
          });
        }
      }
    }
    
    return context;
  }

  /**
   * Clears all cached user contexts for a specific SDK key.
   * Used when a client instance changes due to datafile update.
   * @param sdkKey - The SDK key whose user contexts should be cleared.
   */
  private clearUserContextsForSdkKey(sdkKey: string): void {
    // In the current implementation, we can't easily tie user contexts to SDK keys
    // So we clear the entire cache when a client changes
    const previousSize = this.userContextCache.size;
    this.userContextCache.clear();
    
    this.logger.debug("Cleared user context cache", {
      sdkKey: this.maskSensitiveData(sdkKey),
      clearedContexts: previousSize
    });
    
    if (this.metrics && previousSize > 0) {
      this.metrics.incrementCounter('user_context_cache_cleared', previousSize, {
        reason: 'client_update',
        sdkKey: this.maskSensitiveData(sdkKey)
      });
    }
  }

  /**
   * Creates a fallback decision when the client is unavailable.
   * @param flagKey - The flag key for the decision.
   * @param userContext - The user context.
   * @param reason - The reason for using a fallback.
   * @returns A minimal valid OptimizelyDecision.
   */
  private createFallbackDecision(
    flagKey: string, 
    userContext: ExtendedOptimizelyUserContext, 
    reason: string
  ): OptimizelyDecision {
    const fallbackCreationTimer = this.metrics?.startTimer('fallback_decision_creation_duration', {
      component: this.componentName,
      reason
    });
    
    let decision: OptimizelyDecision;
    
    try {
      // Create a temporary client to get a properly structured decision object
      const tempClient = optimizely.createInstance({
        datafile: JSON.stringify({
          version: '4',
          rollouts: [],
          anonymizeIP: true,
          projectId: 'temp',
          variables: [],
          featureFlags: [
            {
              id: 'temp-flag',
              key: flagKey,
              experimentIds: [],
              rolloutId: '',
              variables: []
            }
          ],
          experiments: [],
          audiences: [],
          groups: [],
          attributes: [],
          botFiltering: false,
          events: [],
          revision: 'temporary'
        })
      });

      if (!tempClient) {
        decision = {
          variationKey: null,
          enabled: false,
          flagKey: flagKey,
          variables: {},
          reasons: [reason]
        } as OptimizelyDecision;
      } else {
        const tempUserContext = tempClient.createUserContext(userContext.userId, userContext.attributes || {});
        if (!tempUserContext) {
          decision = {
            variationKey: null,
            enabled: false,
            flagKey: flagKey,
            variables: {},
            reasons: [reason]
          } as OptimizelyDecision;
        } else {
          // Get a valid decision object with the expected shape
          const defaultDecision = tempUserContext.decide(flagKey, [optimizely.OptimizelyDecideOption.DISABLE_DECISION_EVENT]);
          // Override enabled to false since this is a default decision
          defaultDecision.enabled = false;
          defaultDecision.reasons = [reason];
          
          decision = defaultDecision;
        }
      }
    } catch (error) {
      // If all else fails, return a basic object with the essential properties
      this.logger.warn("Error creating structured fallback decision", {
        flagKey,
        userId: this.maskSensitiveData(userContext.userId),
        error: error instanceof Error ? error.message : String(error),
        reason
      });
      
      decision = {
        variationKey: null,
        enabled: false,
        flagKey: flagKey,
        variables: {},
        reasons: [reason]
      } as OptimizelyDecision;
      
      if (this.metrics) {
        this.metrics.incrementCounter('fallback_decision_errors', 1, {
          reason
        });
      }
    } finally {
      if (fallbackCreationTimer) {
        fallbackCreationTimer.stop();
      }
    }
    
    // Track fallback decisions
    if (this.metrics) {
      this.metrics.incrementCounter('fallback_decisions', 1, {
        flag_key: flagKey,
        reason
      });
    }
    
    return decision;
  }

  /**
   * Processes user attributes for enhanced audience targeting.
   * @param attributes - The raw user attributes.
   * @returns The processed attributes.
   */
  private processAttributes(attributes: optimizely.UserAttributes = {}): optimizely.UserAttributes {
    const processedAttributes: optimizely.UserAttributes = { ...attributes };
    
    // Add derived attributes if needed
    if (!processedAttributes.hasOwnProperty('currentTime')) {
      processedAttributes.currentTime = new Date().getTime();
    }
    
    // Handle special attribute types
    for (const [key, value] of Object.entries(processedAttributes)) {
      // Convert Date objects to ISO strings
      if (value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]') {
        processedAttributes[key] = (value as Date).toISOString();
      }
    }
    
    return processedAttributes;
  }

  private async applyForcedVariations(
    client: optimizely.Client,
    flagKey: string,
    userId: string,
    forcedVariationValue: string | null
  ): Promise<boolean> {
    try {
      console.log(`[SDK_DEBUG] Directly calling client.setForcedVariation for ${flagKey}, ${userId}, ${forcedVariationValue}`);
      
      // Use the lower-level SDK client method to directly force a variation
      const result = client.setForcedVariation(flagKey, userId, forcedVariationValue);
      
      console.log(`[SDK_DEBUG] Direct client.setForcedVariation result: ${result}`);
      
      return result;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} Error applying forced variation directly:`, error);
      console.log(`[SDK_DEBUG] Error in client.setForcedVariation: ${error}`);
      return false;
    }
  }

  /**
   * Makes a decision for a specific flag key and user context.
   * Handles Edge Mode vs Agent Mode behavior differences and integrates with Optimizely Full Stack SDK.
   * 
   * **Edge Mode:** Returns decisions with optional response headers/cookies for CDN integration
   * **Agent Mode:** Returns JSON decision data only for application consumption
   * 
   * @param flagKey - The feature flag or experiment key to decide for (e.g., 'checkout_flow', 'new_ui_v2')
   * @param userContext - User context containing userId and attributes for targeting
   * @param userContext.userId - Unique identifier for the user (required for consistent bucketing)
   * @param userContext.attributes - Key-value pairs for audience targeting (e.g., { platform: 'web', plan: 'premium' })
   * @param userContext.forcedDecisions - Optional map of flag keys to forced variation keys
   * @param userContext.metadata - Optional metadata including request context for tracking
   * @param options - Optional configuration for the decision request
   * @param options.sdkKey - Specific SDK key to use (defaults to service default if not provided)
   * @param options.decideOptions - Array of Optimizely decide options affecting decision behavior
   * 
   * @returns Promise resolving to OptimizelyDecision with variation details
   * @returns OptimizelyDecision.variationKey - The variation assigned to the user ('control', 'treatment', etc.)
   * @returns OptimizelyDecision.enabled - Whether the feature flag is enabled for this user
   * @returns OptimizelyDecision.variables - Variable values associated with the variation
   * @returns OptimizelyDecision.ruleKey - The rule (experiment/rollout) that made the decision
   * @returns OptimizelyDecision.flagKey - Echo of the input flag key
   * @returns OptimizelyDecision.reasons - Decision reasons when INCLUDE_REASONS option is used
   * 
   * @throws {Error} When SDK initialization fails or critical configuration is missing
   * 
   * @example
   * ```typescript
   * // Basic feature flag decision
   * const decision = await decisionService.decide('checkout_v2', {
   *   userId: 'user123',
   *   attributes: { platform: 'web', userType: 'premium' }
   * });
   * 
   * if (decision.enabled) {
   *   console.log(`User gets variation: ${decision.variationKey}`);
   *   console.log(`Feature variables:`, decision.variables);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Decision with specific SDK key and debug options
   * const decision = await decisionService.decide('feature-flag-1', 
   *   { userId: 'user456', attributes: { plan: 'enterprise' } },
   *   { 
   *     sdkKey: 'custom_sdk_key_123',
   *     decideOptions: [
   *       optimizely.OptimizelyDecideOption.INCLUDE_REASONS,
   *       optimizely.OptimizelyDecideOption.EXCLUDE_VARIABLES
   *     ]
   *   }
   * );
   * 
   * console.log('Decision reasons:', decision.reasons);
   * ```
   * 
   * @see {@link decideAll} for making decisions on multiple flags simultaneously
   * @see {@link getDecision} for retrieving cached decisions
   * @see {@link setForcedVariation} for overriding decisions in testing
   * @since v2.0.0
   */
  async decide(
    flagKey: string,
    userContext: ExtendedOptimizelyUserContext,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision> {
    const decisionTimer = this.metrics?.startTimer('decision_duration', {
      flag_key: flagKey,
      operation: 'decide'
    });
    
    // Create request-specific logger with context
    const decisionLogger = this.logger.child({
      operation: 'decide',
      flagKey,
      userId: this.maskSensitiveData(userContext.userId)
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        decisionLogger.error("No SDK key provided and no default SDK key configured");
        return this.createFallbackDecision(flagKey, userContext, 'missing_sdk_key');
      }
      
      // Check if we should ignore user profiles for this request
      const ignoreUserProfileService = (options?.decideOptions || [])
        .includes(optimizely.OptimizelyDecideOption.IGNORE_USER_PROFILE_SERVICE);
      
      // Preload user profile if enabled and not ignored for this request
      if (this.userProfileServiceAdapter && 
          userContext.userId && 
          !ignoreUserProfileService) {
        decisionLogger.debug("Preloading user profile", {
          userId: this.maskSensitiveData(userContext.userId)
        });
        
        // Preload the profile before getting the client
        await this.userProfileServiceAdapter.preloadProfile(userContext.userId);
      }
      
      decisionLogger.debug("Making decision", {
        sdkKey: this.maskSensitiveData(sdkKey),
        hasDecideOptions: options?.decideOptions ? options.decideOptions.length > 0 : false
      });

      const client = await this.getOptimizelyClient(sdkKey, userContext.metadata?.requestContext);
      if (!client) {
        decisionLogger.warn("Optimizely client not available", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('decision_errors', 1, {
            flag_key: flagKey,
            error_type: 'client_unavailable'
          });
        }
        
        return this.createFallbackDecision(flagKey, userContext, 'client_unavailable');
      }

      try {
        // Process attributes for enhanced audience targeting
        const processAttributesTimer = this.metrics?.startTimer('process_attributes_duration', {
          flag_key: flagKey
        });
        const processedAttributes = this.processAttributes(userContext.attributes);
        if (processAttributesTimer) {
          processAttributesTimer.stop();
        }
        
        // Get or create an SDK UserContext object
        const userContextTimer = this.metrics?.startTimer('get_user_context_duration', {
          flag_key: flagKey
        });
        const optimizelyUserContext = this.getUserContext(
          client, 
          userContext.userId, 
          processedAttributes
        );
        if (userContextTimer) {
          userContextTimer.stop();
        }
        
        // Apply forced decisions to the user context
        if (userContext.forcedDecisions && Object.keys(userContext.forcedDecisions).length > 0) {
          this.logger.info(`${this.LOG_PREFIX} Found forced decisions for user ${userContext.userId}:`, userContext.forcedDecisions);
          
          // Apply all forced decisions to the user context
          for (const [forcedFlagKey, decision] of Object.entries(userContext.forcedDecisions)) {
            if (decision && decision.variationKey) {
              this.logger.info(`${this.LOG_PREFIX} Setting forced decision for flag ${forcedFlagKey}: ${decision.variationKey}`);
              
              // Use the SDK's setForcedDecision method on the user context
              const forcedDecisionContext = { flagKey: forcedFlagKey };
              const forcedDecision = { variationKey: decision.variationKey };
              
              if (optimizelyUserContext.setForcedDecision) {
                const result = optimizelyUserContext.setForcedDecision(forcedDecisionContext, forcedDecision);
                this.logger.info(`${this.LOG_PREFIX} Set forced decision result: ${result}`);
              } else {
                this.logger.warn(`${this.LOG_PREFIX} User context does not support setForcedDecision method`);
              }
            }
          }
        }
        
        if (!optimizelyUserContext) {
          throw new Error('Failed to create Optimizely user context');
        }
        
        // Call decide on the user context object with specified options
        const sdkDecideTimer = this.metrics?.startTimer('sdk_decide_duration', {
          flag_key: flagKey
        });
        const decision = optimizelyUserContext.decide(flagKey, options?.decideOptions);
        if (sdkDecideTimer) {
          sdkDecideTimer.stop();
        }
        
        // Record decision metrics
        if (this.metrics) {
          this.metrics.incrementCounter('decisions_made', 1, {
            flag_key: flagKey,
            variation_key: decision.variationKey || 'null',
            enabled: decision.enabled ? 'true' : 'false',
            reason: decision.reasons?.[0] || 'unknown'
          });
        }
        
        // Check if this decision came from user profile storage (sticky bucketing)
        let decisionFromStorage = false;
        if (this.userProfileServiceAdapter && 
            userContext.userId && 
            flagKey) {
          
          // Check if this request should ignore user profiles
          const ignoreUserProfileService = (options?.decideOptions || [])
            .includes(optimizely.OptimizelyDecideOption.IGNORE_USER_PROFILE_SERVICE);
          
          // Only check profile if not explicitly ignored for this request
          if (!ignoreUserProfileService) {
            try {
              // Get all experiment IDs associated with this flag key
              // This is crucial because the SDK stores decisions in the user profile using experiment IDs
              const experimentIds = this.idMapper.getExperimentIdsForFlag(client, flagKey);
              
              this.logger.info(`[DecisionService] Found ${experimentIds.length} experiment IDs for flag ${flagKey}: ${experimentIds.join(', ')}`);
              
              // Also include the rule key and flag key as fallbacks
              const idsToCheck = [...experimentIds];
              
              if (decision?.ruleKey && !idsToCheck.includes(decision.ruleKey)) {
                idsToCheck.push(decision.ruleKey);
              }
              
              if (!idsToCheck.includes(flagKey)) {
                idsToCheck.push(flagKey);
              }
              
              // Try all possible IDs to see if any match a stored decision
              for (const id of idsToCheck) {
                if (!id) continue;
                
                this.logger.info(`[DecisionService] Checking if decision from storage using ID: ${userContext.userId}:${id}`);
                
                // Add a timestamp to help trace in logs
                const checkTime = Date.now();
                this.logger.info(`[DecisionService] [${checkTime}] Checking storage for ID: ${id}`);
                
                const isFromStorage = this.userProfileServiceAdapter.isDecisionFromStorage(
                  userContext.userId, 
                  id
                );
                
                this.logger.info(`[DecisionService] [${checkTime}] Storage check result for ID ${id}: ${isFromStorage}`);
                
                if (isFromStorage) {
                  decisionFromStorage = true;
                  this.logger.info(`[DecisionService] FOUND! Decision for ${userContext.userId}:${flagKey} from storage with ID: ${id}`);
                  break;
                }
              }
              
              // Log the final result
              this.logger.info(`[DecisionService] Final result - Decision for ${userContext.userId}:${flagKey} from storage: ${decisionFromStorage}`);
            } catch (error) {
              this.logger.error(`[DecisionService] Error checking if decision came from storage`, error);
            }
          } else {
            this.logger.info(`[DecisionService] User profile service ignored for this request (IGNORE_USER_PROFILE_SERVICE option)`);
          }
        }
        
        decisionLogger.debug("Decision made successfully", {
          variationKey: decision.variationKey,
          enabled: decision.enabled,
          reasons: decision.reasons,
          hasVariables: Object.keys(decision.variables || {}).length > 0,
          fromStorage: decisionFromStorage
        });
        
        // Add minimal storage source information to the decision metadata
        // Don't copy the entire decision object to reduce size
        decision.metadata = decision.metadata || {};
        decision.metadata.decisionFromStorage = decisionFromStorage;
        
        return decision;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        decisionLogger.error("Error making decision", errorObj, {
          errorName: errorObj.name,
          errorMessage: errorObj.message
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('decision_errors', 1, {
            flag_key: flagKey,
            error_type: errorObj.name
          });
        }
        
        return this.createFallbackDecision(flagKey, userContext, 'error_in_decision_process');
      }
    } finally {
      if (decisionTimer) {
        const duration = decisionTimer.stop();
        if (this.metrics) {
          this.metrics.recordHistogram('decision_time', duration, {
            flag_key: flagKey
          });
        }
      }
    }
  }

  /**
   * Makes decisions for multiple flag keys simultaneously for optimal performance.
   * Supports both "decide all flags" and "decide specific flags" modes with efficient batch processing.
   * 
   * **Flag Key Sources (precedence order):**
   * 1. `flagKeys` parameter: Specific flag keys provided in the call
   * 2. KV Storage: All flag keys stored for the SDK key (when flagKeys not provided)
   * 3. Datafile: All feature flags defined in the project datafile (fallback)
   * 
   * **Performance Optimization:**
   * - Single SDK client initialization for all decisions
   * - Batch metrics recording and logging
   * - Parallel decision processing when possible
   * - Shared user profile service calls
   * 
   * @param userContext - User context containing userId and attributes for targeting
   * @param userContext.userId - Unique identifier for the user (required for consistent bucketing)
   * @param userContext.attributes - Key-value pairs for audience targeting
   * @param userContext.forcedDecisions - Optional map of flag keys to forced variation keys
   * @param userContext.metadata - Optional metadata including request context for tracking
   * @param flagKeys - Optional array of specific flag keys to decide for. If not provided, decides for all available flags
   * @param options - Optional configuration for the batch decision request
   * @param options.sdkKey - Specific SDK key to use (defaults to service default if not provided)
   * @param options.decideOptions - Array of Optimizely decide options affecting all decisions in the batch
   * 
   * @returns Promise resolving to a record mapping flag keys to their OptimizelyDecision objects
   * @returns Record<string, OptimizelyDecision> - Map where keys are flag keys and values are decision objects
   * 
   * @throws {Error} When SDK initialization fails or critical configuration is missing
   * 
   * @example
   * ```typescript
   * // Decide for all available flags
   * const allDecisions = await decisionService.decideAll({
   *   userId: 'user123',
   *   attributes: { platform: 'web', plan: 'premium' }
   * });
   * 
   * Object.entries(allDecisions).forEach(([flagKey, decision]) => {
   *   console.log(`${flagKey}: ${decision.variationKey} (enabled: ${decision.enabled})`);
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Decide for specific flags only
   * const specificDecisions = await decisionService.decideAll(
   *   { userId: 'user456', attributes: { userType: 'beta' } },
   *   ['checkout_v2', 'new_ui', 'payment_flow'], // Only these flags
   *   { 
   *     decideOptions: [optimizely.OptimizelyDecideOption.INCLUDE_REASONS]
   *   }
   * );
   * 
   * const checkoutDecision = specificDecisions['checkout_v2'];
   * if (checkoutDecision?.enabled) {
   *   console.log('Checkout v2 enabled:', checkoutDecision.reasons);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Edge Mode usage with response integration
   * const decisions = await decisionService.decideAll(userContext, flagKeys, {
   *   sdkKey: 'edge_sdk_key',
   *   decideOptions: [optimizely.OptimizelyDecideOption.EXCLUDE_VARIABLES]
   * });
   * 
   * // Process decisions for CDN response headers/cookies
   * const enabledFlags = Object.entries(decisions)
   *   .filter(([_, decision]) => decision.enabled)
   *   .map(([flagKey, _]) => flagKey);
   * ```
   * 
   * @see {@link decide} for making decisions on individual flags
   * @see {@link getDecision} for retrieving cached decisions
   * @see {@link getAllDecisions} for retrieving all cached decisions
   * @since v2.0.0
   */
  async decideAll(
    userContext: ExtendedOptimizelyUserContext,
    flagKeys?: string[],
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>> {
    const batchDecisionTimer = this.metrics?.startTimer('batch_decision_duration', {
      operation: flagKeys && flagKeys.length > 0 ? 'decide_for_keys' : 'decide_all',
      flag_count: flagKeys ? flagKeys.length : -1
    });
    
    // Create request-specific logger with context
    const batchLogger = this.logger.child({
      operation: flagKeys && flagKeys.length > 0 ? 'decideForKeys' : 'decideAll',
      userId: this.maskSensitiveData(userContext.userId),
      flagCount: flagKeys ? flagKeys.length : null
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        batchLogger.error("No SDK key provided and no default SDK key configured");
        return {}; // Return empty object as fallback
      }

      batchLogger.debug("Making batch decisions", {
        sdkKey: this.maskSensitiveData(sdkKey),
        hasDecideOptions: options?.decideOptions ? options.decideOptions.length > 0 : false
      });

      const client = await this.getOptimizelyClient(sdkKey, userContext.metadata?.requestContext);
      if (!client) {
        batchLogger.warn("Optimizely client not available", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('batch_decision_errors', 1, {
            error_type: 'client_unavailable'
          });
        }
        
        return {};
      }

      try {
        // Apply forced variations for each flag if they exist
        if (userContext.forcedDecisions && Object.keys(userContext.forcedDecisions).length > 0) {
          // Get list of flags that have forced decisions
          const forcedFlags = flagKeys || Object.keys(userContext.forcedDecisions);
          
          // Apply each forced variation
          for (const key of forcedFlags) {
            const forcedVariation = userContext.forcedDecisions[key]?.variationKey;
            if (forcedVariation !== undefined) {
              await this.applyForcedVariations(client, key, userContext.userId, forcedVariation);
            }
          }
        }

        // Process attributes for enhanced audience targeting
        const processAttributesTimer = this.metrics?.startTimer('process_attributes_duration', {
          operation: 'batch'
        });
        const processedAttributes = this.processAttributes(userContext.attributes);
        if (processAttributesTimer) {
          processAttributesTimer.stop();
        }
        
        // Get or create an SDK UserContext object
        const userContextTimer = this.metrics?.startTimer('get_user_context_duration', {
          operation: 'batch'
        });
        const optimizelyUserContext = this.getUserContext(
          client, 
          userContext.userId, 
          processedAttributes
        );
        if (userContextTimer) {
          userContextTimer.stop();
        }
        
        if (!optimizelyUserContext) {
          throw new Error('Failed to create Optimizely user context');
        }
        
        // Call appropriate decide method based on flagKeys
        let decisions: Record<string, OptimizelyDecision>;
        const sdkDecideTimer = this.metrics?.startTimer('sdk_decide_duration', {
          operation: flagKeys && flagKeys.length > 0 ? 'decide_for_keys' : 'decide_all'
        });
        
        if (flagKeys && flagKeys.length > 0) {
          // Use decideForKeys for specific flags
          decisions = optimizelyUserContext.decideForKeys(flagKeys, options?.decideOptions);
        } else {
          // Use decideAll for all flags
          decisions = optimizelyUserContext.decideAll(options?.decideOptions);
        }
        
        if (sdkDecideTimer) {
          sdkDecideTimer.stop();
        }
        
        // Record batch decision metrics
        if (this.metrics) {
          this.metrics.incrementCounter('batch_decisions_made', 1, {
            flag_count: Object.keys(decisions).length
          });
          
          // Record specific decisions
          for (const [key, decision] of Object.entries(decisions)) {
            this.metrics.incrementCounter('decisions_made', 1, {
              flag_key: key,
              variation_key: decision.variationKey || 'null',
              enabled: decision.enabled ? 'true' : 'false',
              reason: decision.reasons?.[0] || 'unknown',
              source: 'batch'
            });
          }
        }
        
        batchLogger.debug("Batch decisions made successfully", {
          decisionCount: Object.keys(decisions).length,
          enabledCount: Object.values(decisions).filter(d => d.enabled).length
        });
        
        return decisions;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        batchLogger.error("Error making batch decisions", errorObj, {
          errorName: errorObj.name,
          errorMessage: errorObj.message
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('batch_decision_errors', 1, {
            error_type: errorObj.name
          });
        }
        
        return {};
      }
    } finally {
      if (batchDecisionTimer) {
        const duration = batchDecisionTimer.stop();
        if (this.metrics) {
          this.metrics.recordHistogram('batch_decision_time', duration, {
            flag_count: flagKeys ? flagKeys.length : -1
          });
        }
      }
    }
  }

  /**
   * Sets or removes a forced variation for a specific flag and user.
   * Used primarily for testing, debugging, and QA scenarios to override normal bucketing behavior.
   * 
   * **Use Cases:**
   * - Testing specific variations in development/staging environments
   * - QA validation of different feature flag states
   * - Customer support for troubleshooting user-specific issues
   * - Demo scenarios requiring consistent behavior
   * 
   * **Important Notes:**
   * - Forced variations override all targeting rules and traffic allocation
   * - Changes take effect immediately for subsequent decisions
   * - Forced variations are stored in memory and don't persist across worker restarts
   * - Use `null` as variationKey to remove an existing forced variation
   * 
   * @param flagKey - The feature flag or experiment key to set forced variation for
   * @param userId - The user ID to apply the forced variation to (must match exactly in subsequent decisions)
   * @param variationKey - The variation key to force for this user, or null to remove forced variation
   * @param options - Optional configuration for the forced variation request
   * @param options.sdkKey - Specific SDK key to use (defaults to service default if not provided)
   * 
   * @returns Promise that resolves when the forced variation is set or removed
   * 
   * @throws {Error} When SDK initialization fails or invalid parameters are provided
   * 
   * @example
   * ```typescript
   * // Force a user to see the 'treatment' variation
   * await decisionService.setForcedVariation(
   *   'checkout_redesign', 
   *   'test_user_123', 
   *   'treatment'
   * );
   * 
   * // Subsequent decisions will return the forced variation
   * const decision = await decisionService.decide('checkout_redesign', {
   *   userId: 'test_user_123',
   *   attributes: {}
   * });
   * console.log(decision.variationKey); // 'treatment'
   * ```
   * 
   * @example
   * ```typescript
   * // Remove a forced variation to restore normal bucketing
   * await decisionService.setForcedVariation(
   *   'checkout_redesign', 
   *   'test_user_123', 
   *   null  // Remove forced variation
   * );
   * 
   * // User will now be bucketed normally based on targeting rules
   * ```
   * 
   * @example
   * ```typescript
   * // Set forced variation with specific SDK key
   * await decisionService.setForcedVariation(
   *   'feature_flag_x', 
   *   'qa_user_456', 
   *   'variation_b',
   *   { sdkKey: 'staging_sdk_key' }
   * );
   * ```
   * 
   * @see {@link getForcedVariation} for retrieving current forced variations
   * @see {@link decide} for making decisions (which will use forced variations if set)
   * @since v2.0.0
   */
  async setForcedVariation(
    flagKey: string,
    userId: string,
    variationKey: string | null,
    options?: { sdkKey?: string }
  ): Promise<void> {
    const forcedVarTimer = this.metrics?.startTimer('forced_variation_duration', {
      operation: 'set',
      flag_key: flagKey
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        this.logger.error("No SDK key provided and no default SDK key configured for setForcedVariation");
        return;
      }

      this.logger.debug("Setting forced variation", {
        sdkKey: this.maskSensitiveData(sdkKey),
        flagKey,
        userId: this.maskSensitiveData(userId),
        variationKey: variationKey || 'null'
      });

      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.error("Optimizely client not available for setForcedVariation", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        return;
      }

      await this.applyForcedVariations(client, flagKey, userId, variationKey);
      
      if (this.metrics) {
        this.metrics.incrementCounter('forced_variations_set', 1, {
          flag_key: flagKey,
          user_id_hash: this.maskSensitiveData(userId),
          variation_key: variationKey || 'null'
        });
      }
    } catch (error) {
      this.logger.error("Error setting forced variation", error as Error, {
        flagKey,
        userId: this.maskSensitiveData(userId)
      });
      
      if (this.metrics) {
        this.metrics.incrementCounter('forced_variation_errors', 1, {
          operation: 'set',
          flag_key: flagKey,
          error_type: error instanceof Error ? error.name : 'unknown'
        });
      }
    } finally {
      if (forcedVarTimer) {
        forcedVarTimer.stop();
      }
    }
  }

  /**
   * Retrieves the current forced variation for a specific flag and user.
   * Used to check if a user has been assigned a forced variation for testing or debugging purposes.
   * 
   * **Use Cases:**
   * - Verify forced variations are correctly applied during testing
   * - Administrative interfaces showing current forced variation state
   * - Debugging user-specific decision behavior
   * - Audit trails for QA and support scenarios
   * 
   * **Important Notes:**
   * - Returns null if no forced variation is set for the flag/user combination
   * - Only returns forced variations set via setForcedVariation() method
   * - Forced variations are stored in memory and lost on worker restart
   * 
   * @param flagKey - The feature flag or experiment key to check for forced variations
   * @param userId - The user ID to check for forced variations (must match exactly what was used in setForcedVariation)
   * @param options - Optional configuration for the forced variation query
   * @param options.sdkKey - Specific SDK key to use (defaults to service default if not provided)
   * 
   * @returns Promise resolving to the forced variation key, or null if no forced variation is set
   * 
   * @throws {Error} When SDK initialization fails or invalid parameters are provided
   * 
   * @example
   * ```typescript
   * // Check if a user has a forced variation
   * const forcedVariation = await decisionService.getForcedVariation(
   *   'checkout_redesign',
   *   'test_user_123'
   * );
   * 
   * if (forcedVariation) {
   *   console.log(`User has forced variation: ${forcedVariation}`);
   * } else {
   *   console.log('User will be bucketed normally');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Check forced variation with specific SDK key
   * const forcedVariation = await decisionService.getForcedVariation(
   *   'feature_flag_x',
   *   'qa_user_456',
   *   { sdkKey: 'staging_sdk_key' }
   * );
   * ```
   * 
   * @example
   * ```typescript
   * // Validate forced variation before making decision
   * const forcedVariation = await decisionService.getForcedVariation('my_flag', userId);
   * 
   * if (forcedVariation) {
   *   console.log(`User will see variation: ${forcedVariation}`);
   * }
   * 
   * const decision = await decisionService.decide('my_flag', { userId, attributes: {} });
   * console.log(`Actual decision: ${decision.variationKey}`);
   * // decision.variationKey should match forcedVariation if one was set
   * ```
   * 
   * @see {@link setForcedVariation} for setting forced variations
   * @see {@link decide} for making decisions (which will use forced variations if set)
   * @since v2.0.0
   */
  async getForcedVariation(
    flagKey: string,
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<string | null> {
    const forcedVarTimer = this.metrics?.startTimer('forced_variation_duration', {
      operation: 'get',
      flag_key: flagKey
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        this.logger.error("No SDK key provided and no default SDK key configured for getForcedVariation");
        return null;
      }

      this.logger.debug("Getting forced variation", {
        sdkKey: this.maskSensitiveData(sdkKey),
        flagKey,
        userId: this.maskSensitiveData(userId)
      });

      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.error("Optimizely client not available for getForcedVariation", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        return null;
      }

      // Get the forced variation
      const variation = client.getForcedVariation(flagKey, userId);
      
      if (this.metrics) {
        this.metrics.incrementCounter('forced_variations_get', 1, {
          flag_key: flagKey,
          user_id_hash: this.maskSensitiveData(userId),
          found: variation !== null ? 'true' : 'false'
        });
      }
      
      return variation;
    } catch (error) {
      this.logger.error("Error getting forced variation", error as Error, {
        flagKey,
        userId: this.maskSensitiveData(userId)
      });
      
      if (this.metrics) {
        this.metrics.incrementCounter('forced_variation_errors', 1, {
          operation: 'get',
          flag_key: flagKey,
          error_type: error instanceof Error ? error.name : 'unknown'
        });
      }
      
      return null;
    } finally {
      if (forcedVarTimer) {
        forcedVarTimer.stop();
      }
    }
  }

  /**
   * Removes a forced decision for a specific context
   * @param context - The decision context (including flagKey)
   * @param userId - The user ID
   * @param options - Optional: { sdkKey: string }
   * @returns True if the forced decision was removed
   */
  async removeForcedDecision(
    context: OptimizelyDecisionContext,
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<boolean> {
    const forcedVarTimer = this.metrics?.startTimer('forced_variation_duration', {
      operation: 'remove_single',
      flag_key: context.flagKey || 'unknown'
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        this.logger.error("No SDK key provided and no default SDK key configured for removeForcedDecision");
        return false;
      }

      this.logger.debug("Removing forced decision", {
        sdkKey: this.maskSensitiveData(sdkKey),
        flagKey: context.flagKey || 'unknown',
        userId: this.maskSensitiveData(userId)
      });

      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.error("Optimizely client not available for removeForcedDecision", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        return false;
      }

      // Legacy implementation used setForcedVariation with null to remove forced decisions
      if (context.flagKey) {
        // This is a standard flag-based decision context
        const result = await this.applyForcedVariations(client, context.flagKey, userId, null);
        
        if (this.metrics) {
          this.metrics.incrementCounter('forced_variations_removed', 1, {
            flag_key: context.flagKey,
            user_id_hash: this.maskSensitiveData(userId),
            success: result ? 'true' : 'false'
          });
        }
        
        return result;
      } else {
        // We can't handle the more complex OptimizelyDecisionContext without flagKey in this version
        // Log error and return false
        this.logger.error("Cannot remove forced decision without flagKey", {
          userId: this.maskSensitiveData(userId),
          context: JSON.stringify(context)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('forced_variation_errors', 1, {
            operation: 'remove_single',
            error_type: 'missing_flag_key'
          });
        }
        
        return false;
      }
    } catch (error) {
      this.logger.error("Error removing forced decision", error as Error, {
        flagKey: context.flagKey || 'unknown',
        userId: this.maskSensitiveData(userId)
      });
      
      if (this.metrics) {
        this.metrics.incrementCounter('forced_variation_errors', 1, {
          operation: 'remove_single',
          flag_key: context.flagKey || 'unknown',
          error_type: error instanceof Error ? error.name : 'unknown'
        });
      }
      
      return false;
    } finally {
      if (forcedVarTimer) {
        forcedVarTimer.stop();
      }
    }
  }

  /**
   * Removes all forced decisions for a user
   * @param userId - The user ID
   * @param options - Optional: { sdkKey: string }
   * @returns True if the operation was successful
   */
  async removeAllForcedDecisions(
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<boolean> {
    const forcedVarTimer = this.metrics?.startTimer('forced_variation_duration', {
      operation: 'remove_all',
      user_id_hash: this.maskSensitiveData(userId)
    });
    
    try {
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        this.logger.error("No SDK key provided and no default SDK key configured for removeAllForcedDecisions");
        return false;
      }

      this.logger.debug("Removing all forced decisions", {
        sdkKey: this.maskSensitiveData(sdkKey),
        userId: this.maskSensitiveData(userId)
      });

      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.error("Optimizely client not available for removeAllForcedDecisions", {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        return false;
      }

      // In this implementation, we need to get all the feature flags from the client
      // and remove forced variations one by one
      try {
        const optimizelyConfig = client.getOptimizelyConfig();
        if (!optimizelyConfig) {
          this.logger.error("Failed to get Optimizely config");
          
          if (this.metrics) {
            this.metrics.incrementCounter('forced_variation_errors', 1, {
              operation: 'remove_all',
              error_type: 'config_unavailable'
            });
          }
          
          return false;
        }

        // Get all feature flags
        const featureKeys = Object.keys(optimizelyConfig.featuresMap || {});
        
        // Remove forced variation for each flag
        let allSucceeded = true;
        let removedCount = 0;
        
        for (const flagKey of featureKeys) {
          const success = await this.applyForcedVariations(client, flagKey, userId, null);
          if (success) {
            removedCount++;
          } else {
            allSucceeded = false;
          }
        }
        
        this.logger.info("Removed forced decisions", {
          userId: this.maskSensitiveData(userId),
          totalFlags: featureKeys.length,
          removedCount,
          allSucceeded
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('forced_variations_removed', removedCount, {
            user_id_hash: this.maskSensitiveData(userId),
            operation: 'bulk_remove'
          });
        }
        
        return allSucceeded;
      } catch (error) {
        this.logger.error("Error removing all forced decisions", error as Error, {
          userId: this.maskSensitiveData(userId)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('forced_variation_errors', 1, {
            operation: 'remove_all',
            error_type: error instanceof Error ? error.name : 'unknown'
          });
        }
        
        return false;
      }
    } finally {
      if (forcedVarTimer) {
        forcedVarTimer.stop();
      }
    }
  }

  /**
   * Retrieves the OptimizelyConfig for the given SDK key.
   * This provides access to feature flags, experiments, audiences, and other project configuration.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to the OptimizelyConfig object or null if not available.
   */
  async getOptimizelyConfig(sdkKey: string): Promise<any | null> {
    const configTimer = this.metrics?.startTimer('optimizely_config_fetch_duration', {
      sdkKey: this.maskSensitiveData(sdkKey)
    });

    try {
      // Check if sdkKey is provided
      if (!sdkKey) {
        this.logger.warn(`${this.LOG_PREFIX} No SDK key provided for getOptimizelyConfig`);
        return null;
      }

      // Check cache first
      const cacheKey = `optimizely_config:${sdkKey}`;
      const cached = this.optimizelyConfigCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && cached.expiry > now) {
        this.logger.debug(`${this.LOG_PREFIX} Returning cached OptimizelyConfig for SDK key: ${this.maskSensitiveData(sdkKey)}`);
        
        if (this.metrics) {
          this.metrics.incrementCounter('optimizely_config_cache_hits', 1, {
            sdkKey: this.maskSensitiveData(sdkKey)
          });
        }
        
        return cached.config;
      }

      this.logger.debug(`${this.LOG_PREFIX} Retrieving OptimizelyConfig for SDK key: ${this.maskSensitiveData(sdkKey)}`);

      // Get the Optimizely client
      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.warn(`${this.LOG_PREFIX} No client available for SDK key: ${this.maskSensitiveData(sdkKey)}`);
        return null;
      }

      // Get the OptimizelyConfig from the client
      try {
        const config = client.getOptimizelyConfig();
        
        if (!config) {
          this.logger.warn(`${this.LOG_PREFIX} OptimizelyConfig is null for SDK key: ${this.maskSensitiveData(sdkKey)}`);
          return null;
        }

        // Get cache TTL from environment variable or use default
        const ttlMinutes = parseInt(process.env.OPTIMIZELY_CONFIG_CACHE_TTL || '60', 10);
        const ttlMs = ttlMinutes * 60 * 1000;
        
        // Cache the config
        this.optimizelyConfigCache.set(cacheKey, {
          config,
          expiry: now + ttlMs
        });

        this.logger.debug(`${this.LOG_PREFIX} Successfully retrieved and cached OptimizelyConfig`, {
          sdkKey: this.maskSensitiveData(sdkKey),
          featuresCount: Object.keys(config.featuresMap || {}).length,
          experimentsCount: Object.keys(config.experimentsMap || {}).length,
          audiencesCount: (config.audiences || []).length,
          eventsCount: (config.events || []).length,
          revision: config.revision,
          cacheTtlMinutes: ttlMinutes
        });

        // Record metrics
        if (this.metrics) {
          this.metrics.incrementCounter('optimizely_config_requests', 1, {
            result: 'success',
            sdkKey: this.maskSensitiveData(sdkKey)
          });
          this.metrics.incrementCounter('optimizely_config_cache_misses', 1, {
            sdkKey: this.maskSensitiveData(sdkKey)
          });
        }

        return config;
      } catch (error) {
        this.logger.error(`${this.LOG_PREFIX} Error retrieving OptimizelyConfig:`, error as Error, {
          sdkKey: this.maskSensitiveData(sdkKey)
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('optimizely_config_requests', 1, {
            result: 'error',
            error_type: error instanceof Error ? error.name : 'unknown'
          });
        }
        
        return null;
      }
    } finally {
      if (configTimer) {
        configTimer.stop();
      }
    }
  }

  /**
   * Gets a decision for a specific user and flag key.
   * @param userId - The user ID.
   * @param flagKey - The flag key.
   * @param attributes - Optional user attributes.
   * @param options - Optional: { sdkKey?: string, decideOptions?: OptimizelyDecideOption[] }.
   * @returns A promise resolving to the OptimizelyDecision.
   */
  async getDecision(
    userId: string,
    flagKey: string,
    attributes?: optimizely.UserAttributes,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision> {
    // Create logger with operation context
    const opLogger = this.logger.child({
      operation: 'getDecision',
      userId: this.maskSensitiveData(userId),
      flagKey
    });

    opLogger.debug("getDecision called, forwarding to decide method");

    // Create user context from userId and attributes
    const context: ExtendedOptimizelyUserContext = {
      userId,
      attributes: attributes || {}
    };

    // Track method usage in metrics
    if (this.metrics) {
      this.metrics.incrementCounter('decision_method_calls', 1, {
        method: 'getDecision',
        flag_key: flagKey
      });
    }

    // Use provided sdkKey from options or fallback to default
    const sdkKey = options?.sdkKey || this.defaultSdkKey;

    if (!sdkKey) {
      opLogger.error("No SDK key provided and no default SDK key configured");
      return this.createFallbackDecision(flagKey, context, 'missing_sdk_key');
    }

    try {
      // Forward to the comprehensive decide method with combined options
      return await this.decide(flagKey, context, {
        sdkKey,
        decideOptions: options?.decideOptions
      });
    } catch (error) {
      opLogger.error("Error in getDecision", error);
      
      if (this.metrics) {
        this.metrics.incrementCounter('decision_errors', 1, {
          flag_key: flagKey,
          method: 'getDecision',
          error_type: error instanceof Error ? error.name : 'unknown'
        });
      }
      
      return this.createFallbackDecision(flagKey, context, 'error_in_decision_process');
    }
  }
  
  /**
   * Gets all decisions for a user across all flags.
   * @param userId - The user ID.
   * @param attributes - Optional user attributes.
   * @param options - Optional: { sdkKey?: string, decideOptions?: OptimizelyDecideOption[] }.
   * @returns A promise resolving to a map of flag keys to OptimizelyDecision.
   */
  async getAllDecisions(
    userId: string,
    attributes?: optimizely.UserAttributes,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>> {
    // Create logger with operation context
    const opLogger = this.logger.child({
      operation: 'getAllDecisions',
      userId: this.maskSensitiveData(userId)
    });

    opLogger.debug("getAllDecisions called, forwarding to decideAll method");

    // Create user context from userId and attributes
    const context: ExtendedOptimizelyUserContext = {
      userId,
      attributes: attributes || {}
    };

    // Track method usage in metrics
    if (this.metrics) {
      this.metrics.incrementCounter('decision_method_calls', 1, {
        method: 'getAllDecisions'
      });
    }

    // Use provided sdkKey from options or fallback to default
    const sdkKey = options?.sdkKey || this.defaultSdkKey;

    if (!sdkKey) {
      opLogger.error("No SDK key provided and no default SDK key configured");
      return {}; // Return empty object as fallback
    }

    try {
      // Forward to the comprehensive decideAll method with combined options
      return await this.decideAll(context, undefined, {
        sdkKey,
        decideOptions: options?.decideOptions
      });
    } catch (error) {
      opLogger.error("Error in getAllDecisions", error);
      
      if (this.metrics) {
        this.metrics.incrementCounter('batch_decision_errors', 1, {
          method: 'getAllDecisions',
          error_type: error instanceof Error ? error.name : 'unknown'
        });
      }
      
      return {}; // Return empty object on error
    }
  }

  /**
   * Masks sensitive data for logging and metrics.
   * @param value - Value to mask.
   * @returns Masked value.
   */
  private maskSensitiveData(value: string): string {
    if (!value) return '';
    if (value.length <= 6) return `${value.substring(0, 2)}***`;
    return `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
  }

  /**
   * Creates an Optimizely logger adapter that uses our enhanced logger.
   * @param sdkKey - The SDK key for context.
   * @returns An Optimizely logger implementation.
   */
  private createOptimizelyLoggerAdapter(sdkKey: string): OptimizelyLogger {
    return {
      log: (optimizelyLogLevel: any, message: string) => {
        // Create a structured context for SDK logs
        const context: LogContext = {
          source: 'OptimizelySDK',
          sdkKey: this.maskSensitiveData(sdkKey)
        };
        
        // Convert Optimizely log level to our log level
        let mappedLevel: LogLevel;
        switch (optimizelyLogLevel) {
          case optimizely.enums.LOG_LEVEL.ERROR:
            mappedLevel = LogLevel.ERROR;
            break;
          case optimizely.enums.LOG_LEVEL.WARNING:
            mappedLevel = LogLevel.WARN;
            break;
          case optimizely.enums.LOG_LEVEL.INFO:
            mappedLevel = LogLevel.INFO;
            break;
          case optimizely.enums.LOG_LEVEL.DEBUG:
            mappedLevel = LogLevel.DEBUG;
            break;
          default:
            mappedLevel = LogLevel.INFO;
        }
        
        // Log using the structured logging capabilities
        this.logger.logEntry({
          level: mappedLevel,
          message,
          timestamp: new Date().toISOString(),
          context
        });
        
        // Track SDK log counts by level for monitoring
        if (this.metrics) {
          this.metrics.incrementCounter('sdk_logs', 1, {
            level: mappedLevel,
            sdkKey: this.maskSensitiveData(sdkKey)
          });
        }
      }
    };
  }
}
