import {
  IDecisionService,
  OptimizelyUserContext,
  OptimizelyDecision,
  OptimizelyDecideOption
} from "../interfaces/IDecisionService";
import { IConfigurationService } from "../interfaces/IConfigurationService";
import { ILoggerAdapter, LogLevel, LogContext } from "../../adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter, MetricTags } from "../../adapters/interfaces/IMetricsAdapter";
import * as optimizely from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';

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

// Prepare a safe environment for the Optimizely SDK to run in Edge Workers
// Mock browser APIs that might be used by the SDK to prevent errors
const globalAny = globalThis as any;

if (typeof globalAny.localStorage === 'undefined') {
  // Create a mock localStorage that does nothing
  globalAny.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

// Mock window for safety
if (typeof globalAny.window === 'undefined') {
  globalAny.window = {
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

/**
 * Enhanced DecisionService with improved metrics and logging.
 * Responsible for making Optimizely decisions (feature flags, experiments).
 * Integrates with the Optimizely Full Stack SDK.
 */
export class DecisionServiceV2 implements IDecisionService {
  private configService: IConfigurationService;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | null;
  private clientCache: OptimizelyClientCache = {};
  private userContextCache: Map<string, any> = new Map(); // Cache for user contexts
  private maxCacheSize = 100; // Changed from readonly MAX_CACHE_SIZE to a variable
  private userContextCacheTtl = 5 * 60 * 1000; // 5 minutes in milliseconds (changed from readonly)
  private readonly componentName = 'DecisionService';
  private defaultSdkKey: string | null = null; // Default SDK key for operations
  private clientCachingEnabled: boolean = true; // Controls if clients are cached (for testing)
  private datafileUpdateTimers: Map<string, number> = new Map(); // Track datafile update times

  /**
   * Creates an instance of the DecisionService.
   * @param configService - Service to fetch Optimizely configuration.
   * @param logger - Logger adapter.
   * @param metrics - Optional metrics adapter.
   * @param defaultSdkKey - Optional default SDK key to use when none is provided.
   * @param options - Optional configuration options.
   */
  constructor(
    configService: IConfigurationService, 
    logger: ILoggerAdapter, 
    metrics?: IMetricsAdapter,
    defaultSdkKey?: string,
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
      hasMetrics: !!this.metrics
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
    
    // Clean up user context cache based on TTL
    this.userContextCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.userContextCacheTtl) {
        this.userContextCache.delete(key);
        userContextsRemoved++;
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
      this.metrics.incrementCounter('cache_items_removed', userContextsRemoved, {
        component: this.componentName,
        cache_type: 'user_context'
      });
      this.metrics.incrementCounter('cache_items_removed', clientsRemoved, {
        component: this.componentName,
        cache_type: 'client'
      });
    }
    
    // Log cleanup results with structured data
    this.logger.debug("Cache cleanup completed", {
      userContextCacheSize: this.userContextCache.size,
      userContextsRemoved,
      clientCacheSize: Object.keys(this.clientCache).length,
      clientsRemoved
    });
    
    if (cleanupTimer) {
      cleanupTimer.stop();
    }
  }

  /**
   * Gets or creates an Optimizely client instance for a given SDK key.
   * Caches the client based on datafile revision.
   * @param sdkKey - The SDK key.
   * @returns A promise resolving to the Optimizely client instance or null.
   */
  private async getOptimizelyClient(sdkKey: string): Promise<optimizely.Client | null> {
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
      
      if (!datafile || typeof datafile !== 'object' || !('revision' in datafile)) {
        this.logger.error("Failed to fetch valid datafile", {
          sdkKey: this.maskSensitiveData(sdkKey),
          datafileFetchDurationMs: datafileFetchDuration
        });
        
        if (this.metrics) {
          this.metrics.incrementCounter('datafile_fetch_errors', 1, {
            sdkKey: this.maskSensitiveData(sdkKey),
            error_type: 'invalid_datafile'
          });
        }
        
        return null;
      }

      const revision = String((datafile as any).revision);
      
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
        
        // Create enhanced client
        try {
          // Following pattern from optimizelyProvider.js in the original codebase
          const params = {
            datafile: datafile,
            logger: loggerAdapter,
            clientEngine: 'javascript-sdk/cloudflare-agent', // From defaultSettings.js
            clientVersion: '1.0.0',                          // From defaultSettings.js
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
          
          client = optimizely.createInstance(params);
          
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
            if (datafile) {
              // Use string length as an estimate of size (works in all environments)
              const datafileSize = JSON.stringify(datafile).length;
              this.metrics.recordHistogram('datafile_size_bytes', datafileSize, {
                sdkKey: this.maskSensitiveData(sdkKey)
              });
              
              // Record feature flag count
              if ((datafile as any).featureFlags && Array.isArray((datafile as any).featureFlags)) {
                this.metrics.setGauge('feature_flag_count', (datafile as any).featureFlags.length, {
                  sdkKey: this.maskSensitiveData(sdkKey)
                });
              }
              
              // Record experiment count
              if ((datafile as any).experiments && Array.isArray((datafile as any).experiments)) {
                this.metrics.setGauge('experiment_count', (datafile as any).experiments.length, {
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

  /**
   * Converts our internal user context to the format expected by the SDK.
   * @param userContext - Our internal user context.
   * @returns SDK compliant user context.
   */
  private convertToSdkUserContext(userContext: OptimizelyUserContext): { id: string, attributes: optimizely.UserAttributes } {
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
    userContext: OptimizelyUserContext, 
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
   * Decides which variation, if any, is assigned for a feature flag or experiment.
   * @param flagKey - The key of the feature flag or experiment.
   * @param userContext - The user context (userId and attributes).
   * @param options - Optional: { sdkKey: string, decideOptions: OptimizelyDecideOption[] } to specify datafile/client and decision options.
   * @returns A promise resolving to the OptimizelyDecision.
   */
  async decide(
    flagKey: string,
    userContext: OptimizelyUserContext,
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
      const sdkKey = options?.sdkKey;
      if (!sdkKey) {
        throw new Error("DecisionService.decide requires an sdkKey in options (implementation detail)");
      }
      
      decisionLogger.debug("Making decision", {
        sdkKey: this.maskSensitiveData(sdkKey),
        hasDecideOptions: options?.decideOptions ? options.decideOptions.length > 0 : false
      });

      const client = await this.getOptimizelyClient(sdkKey);
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
        
        decisionLogger.debug("Decision made successfully", {
          variationKey: decision.variationKey,
          enabled: decision.enabled,
          reasons: decision.reasons,
          hasVariables: Object.keys(decision.variables || {}).length > 0
        });
        
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
   * Gets values for all flags for a given user.
   * @param userContext - The context for the user.
   * @param flagKeys - Optional list of specific flag keys to decide for.
   * @param options - Optional: { sdkKey: string, decideOptions: OptimizelyDecideOption[] }.
   * @returns A promise resolving to a map of flag keys to OptimizelyDecision.
   */
  async decideAll(
    userContext: OptimizelyUserContext,
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
      const sdkKey = options?.sdkKey;
      if (!sdkKey) {
        throw new Error(`DecisionService.${flagKeys ? 'decideForKeys' : 'decideAll'} requires an sdkKey in options (implementation detail)`);
      }

      batchLogger.debug("Making batch decisions", {
        sdkKey: this.maskSensitiveData(sdkKey),
        hasDecideOptions: options?.decideOptions ? options.decideOptions.length > 0 : false
      });

      const client = await this.getOptimizelyClient(sdkKey);
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
    const context: OptimizelyUserContext = {
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
    const context: OptimizelyUserContext = {
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
      return {}; // Return empty object on error
    }
  }

  // Rest of interface methods would be implemented similarly with enhanced metrics and logging
  // ...
} 