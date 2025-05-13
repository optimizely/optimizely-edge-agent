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
import { ILoggerAdapter, LogLevel } from "../../adapters/interfaces/ILoggerAdapter";
import * as optimizely from '@optimizely/optimizely-sdk';
import { OptimizelyUserProfileServiceAdapter } from '../storage/OptimizelyUserProfileServiceAdapter';

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
  private clientCache: OptimizelyClientCache = {};
  private userContextCache: Map<string, any> = new Map(); // Cache for user contexts
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of client instances to cache
  private readonly USER_CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly LOG_PREFIX = '[v2]';
  private defaultSdkKey: string | null = null; // Default SDK key for operations
  private userProfileServiceAdapter: OptimizelyUserProfileServiceAdapter | null = null; // Add this field
  private optimizelyLoggerAdapter: OptimizelyLogger;

  /**
   * Creates an instance of the DecisionService.
   * @param configService - Service to fetch Optimizely configuration.
   * @param logger - Logger adapter.
   * @param defaultSdkKey - Optional default SDK key to use when none is provided.
   * @param userProfileServiceAdapter - Optional user profile service adapter for sticky bucketing.
   */
  constructor(
    configService: IConfigurationService, 
    logger: ILoggerAdapter, 
    defaultSdkKey?: string,
    userProfileServiceAdapter?: OptimizelyUserProfileServiceAdapter
  ) {
    if (!configService || !logger) {
      throw new Error("DecisionService requires configService and logger.");
    }
    this.configService = configService;
    this.logger = logger;
    this.defaultSdkKey = defaultSdkKey || null;
    this.userProfileServiceAdapter = userProfileServiceAdapter || null;

    // Initialize the Optimizely logger adapter
    this.optimizelyLoggerAdapter = {
      log: (level: any, message: string) => {
        // Convert Optimizely log level to our log level
        let mappedLevel: LogLevel;
        switch (level) {
          case 0: // ERROR
            mappedLevel = LogLevel.ERROR;
            break;
          case 1: // WARNING
            mappedLevel = LogLevel.WARN;
            break;
          case 2: // INFO
            mappedLevel = LogLevel.INFO;
            break;
          case 3: // DEBUG
            mappedLevel = LogLevel.DEBUG;
            break;
          default:
            mappedLevel = LogLevel.INFO;
        }
        
        // Log using the appropriate method based on the level
        if (mappedLevel === LogLevel.ERROR) {
          this.logger.error(`${this.LOG_PREFIX} OptimizelySDK: ${message}`);
        } else if (mappedLevel === LogLevel.WARN) {
          this.logger.warn(`${this.LOG_PREFIX} OptimizelySDK: ${message}`);
        } else if (mappedLevel === LogLevel.INFO) {
          this.logger.info(`${this.LOG_PREFIX} OptimizelySDK: ${message}`);
        } else {
          this.logger.debug(`${this.LOG_PREFIX} OptimizelySDK: ${message}`);
        }
      }
    };

    // Log initialization state
    this.logger.info(`${this.LOG_PREFIX} DecisionService: Initialized with Node.js SDK configuration`);
    if (this.userProfileServiceAdapter) {
      this.logger.info(`${this.LOG_PREFIX} DecisionService: User Profile Service enabled for sticky bucketing`);
    }

    // Start periodic cache cleanup
    setInterval(() => this.cleanupCaches(), 10 * 60 * 1000); // Run every 10 minutes
  }

  /**
   * Cleans up expired or least recently used items from caches
   * to prevent memory leaks and excessive memory usage.
   */
  private cleanupCaches(): void {
    const now = Date.now();
    
    // Clean up user context cache based on TTL
    this.userContextCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.USER_CONTEXT_CACHE_TTL) {
        this.userContextCache.delete(key);
      }
    });
    
    // Limit client cache size by removing least recently used clients
    if (Object.keys(this.clientCache).length > this.MAX_CACHE_SIZE) {
      const entries = Object.entries(this.clientCache);
      entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      
      // Remove oldest entries until we're back to the max size
      const entriesToRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      for (const [sdkKey] of entriesToRemove) {
        delete this.clientCache[sdkKey];
        this.logger.debug(`${this.LOG_PREFIX} DecisionService: Removed least recently used client for SDK key '${sdkKey}' from cache.`);
      }
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
    try {
      // First check if client already exists in cache
    const cached = this.clientCache[sdkKey];

      if (cached) {
      // Update last used timestamp
      this.clientCache[sdkKey].lastUsed = Date.now();
      return cached.client;
    }

      // If client not in cache, try to get datafile and create new client
      const datafile = await this.configService.getDatafile(sdkKey);
      
      if (!datafile || typeof datafile !== 'object' || !('revision' in datafile)) {
        this.logger.error(`${this.LOG_PREFIX} No valid datafile available for SDK key: ${sdkKey}`);
        return null;
          }
      
      const revision = String((datafile as any).revision);

      // Fetch default decide options (array of strings) from config if available
      let defaultDecideOptionStrings: string[] = [];
      if (this.configService && typeof (this.configService as any).getDefaultDecideOptions === 'function') {
        try {
          const opts = (this.configService as any).getDefaultDecideOptions();
          if (Array.isArray(opts)) {
            defaultDecideOptionStrings = opts;
          }
        } catch (e) {
          // Ignore errors – fall back to empty list
          this.logger.debug(`${this.LOG_PREFIX} getDefaultDecideOptions threw`, e);
        }
      }

      // Map string literals -> actual OptimizelyDecideOption enum members
      const defaultDecideOptions: optimizely.OptimizelyDecideOption[] = defaultDecideOptionStrings
        .map(s => s && typeof s === 'string' ? s.toUpperCase().trim() : '')
        .map(s => (optimizely.OptimizelyDecideOption as any)[s])
        .filter(Boolean);

      // Create and configure new client with default decide options
      const client = optimizely.createInstance({
        datafile,
        logger: this.optimizelyLoggerAdapter,
        logLevel: this.getLogLevel(),
        defaultDecideOptions,
      });

      if (!client) {
        this.logger.error(`${this.LOG_PREFIX} Failed to create Optimizely client for SDK key: ${sdkKey}`);
        return null;
      }

      // Cache client for future use
      this.clientCache[sdkKey] = { 
        revision, 
        client,
        lastUsed: Date.now()
      };
      
      return client;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} Error getting Optimizely client:`, error);
      return null;
    }
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
    try {
      // Add currentTime to the attributes
      const attributesWithTime = { 
        ...attributes, 
        currentTime: Date.now() 
      };
      
      // Check for cache key
      const cacheKey = `${userId}:${JSON.stringify(attributesWithTime)}`;
      
      // Check if user context exists in cache and is not expired
      const cachedContext = this.userContextCache.get(cacheKey);
      if (cachedContext) {
        const { context, timestamp } = cachedContext;
        
        // Check if the context is still valid (within TTL)
        if (Date.now() - timestamp < this.USER_CONTEXT_CACHE_TTL) {
          this.logger.debug(`${this.LOG_PREFIX} DecisionService: Using cached user context for user ${userId}`);
          return context;
        }
        
        // Remove expired entry
        this.userContextCache.delete(cacheKey);
      }
      
      // Create a new user context
      this.logger.debug(`${this.LOG_PREFIX} DecisionService: Creating new user context for user ${userId}`);
      
      // Create the user context
      const context = client.createUserContext(userId, attributesWithTime);
      
      if (context) {
        // Debug the user context and check for setForcedDecision method
        console.log('[USER_CONTEXT_DEBUG] User context methods:', Object.keys(context));
        console.log('[USER_CONTEXT_DEBUG] Has setForcedDecision:', typeof context.setForcedDecision === 'function');
        
        // Check if there are forced decisions in attributes
        if (attributes.forcedDecisions) {
          console.log('[USER_CONTEXT_DEBUG] Found forcedDecisions in attributes:', JSON.stringify(attributes.forcedDecisions));
          
          // Try to apply them using setForcedDecision if available
          if (typeof context.setForcedDecision === 'function') {
            try {
              // Loop through and set each forced decision
              for (const [flagKey, decision] of Object.entries(attributes.forcedDecisions)) {
                if (typeof decision === 'object' && decision !== null && 'variationKey' in decision) {
                  const result = context.setForcedDecision(
                    { flagKey },
                    { variationKey: decision.variationKey }
                  );
                  console.log(`[USER_CONTEXT_DEBUG] Set forced decision for ${flagKey}:`, result);
                }
              }
            } catch (error) {
              console.log('[USER_CONTEXT_DEBUG] Error setting forced decisions:', error);
            }
          } else {
            console.log('[USER_CONTEXT_DEBUG] No setForcedDecision method available on user context');
          }
        } else {
          console.log('[USER_CONTEXT_DEBUG] No forcedDecisions in attributes');
        }
        
        // Add to cache
        this.userContextCache.set(cacheKey, { context, timestamp: Date.now() });
      }
      
      return context;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error creating user context:`, error);
      return null;
    }
  }

  /**
   * Clears all cached user contexts for a specific SDK key.
   * Used when a client instance changes due to datafile update.
   * @param sdkKey - The SDK key whose user contexts should be cleared.
   */
  private clearUserContextsForSdkKey(sdkKey: string): void {
    // In the current implementation, we can't easily tie user contexts to SDK keys
    // So we clear the entire cache when a client changes
    this.userContextCache.clear();
    this.logger.debug(`${this.LOG_PREFIX} DecisionService: Cleared user context cache for SDK key '${sdkKey}'.`);
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
        }),
        eventBatchSize: 10,           // Default batch size to avoid warnings
        eventFlushInterval: 1000       // Default flush interval to avoid warnings
      });

      if (!tempClient) {
        return {
          variationKey: null,
          enabled: false,
          flagKey: flagKey,
          variables: {},
          reasons: [reason]
        } as OptimizelyDecision;
      }

      const tempUserContext = tempClient.createUserContext(userContext.userId, userContext.attributes || {});
      if (!tempUserContext) {
        return {
          variationKey: null,
          enabled: false,
          flagKey: flagKey,
          variables: {},
          reasons: [reason]
        } as OptimizelyDecision;
      }
      
      // Get a valid decision object with the expected shape
      const defaultDecision = tempUserContext.decide(flagKey, [optimizely.OptimizelyDecideOption.DISABLE_DECISION_EVENT]);
      // Override enabled to false since this is a default decision
      defaultDecision.enabled = false;
      defaultDecision.reasons = [reason];
      
      return defaultDecision;
    } catch (error) {
      // If all else fails, return a basic object with the essential properties
      return {
        variationKey: null,
        enabled: false,
        flagKey: flagKey,
        variables: {},
        reasons: [reason]
      } as OptimizelyDecision;
    }
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
   * Decides which variation, if any, is assigned for a feature flag or experiment.
   * @param flagKey - The key of the feature flag or experiment.
   * @param userContext - The user context (userId and attributes).
   * @param options - Optional: { sdkKey: string, decideOptions: OptimizelyDecideOption[] } to specify datafile/client and decision options.
   * @returns A promise resolving to the OptimizelyDecision.
   */
  async decide(
    flagKey: string,
    userContext: ExtendedOptimizelyUserContext,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision> {
    try {
      const selectedSdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!selectedSdkKey) {
        throw new Error("SDK key is required. Provide it in options or set a default.");
    }

      // Get/initialize Optimizely client - extract requestContext if available
      const requestContext = userContext.metadata?.requestContext;
      const client = await this.getOptimizelyClient(selectedSdkKey, requestContext);
      
      if (!client) {
        return this.createFallbackDecision(
            flagKey, 
          userContext,
          "Failed to initialize Optimizely client"
          );
        }
      
      // Get internal user context from SDK
      const processedAttributes = this.processAttributes(userContext.attributes || {});
      const sdkUserContext = client.createUserContext(userContext.userId, processedAttributes);
      
      if (!sdkUserContext) {
        return this.createFallbackDecision(
          flagKey, 
          userContext,
          "Failed to create user context"
        );
      }
      
      // Apply any forced variations if specified in the user context
      if (userContext.forcedDecisions && userContext.forcedDecisions[flagKey]) {
        const forcedVariation = userContext.forcedDecisions[flagKey].variationKey;
        await this.applyForcedVariations(client, flagKey, userContext.userId, forcedVariation);
      }
      
      // Convert options array to Optimizely SDK format if needed
      let sdkOptions: OptimizelyDecideOption[] = [];
      if (options?.decideOptions && options.decideOptions.length > 0) {
        sdkOptions = options.decideOptions;
      }
      
      // Call SDK decide method
      try {
        const decision = sdkUserContext.decide(flagKey, sdkOptions);
        
        // Convert SDK decision to our interface format
        return {
          variationKey: decision.variationKey,
          enabled: decision.enabled,
          variables: decision.variables,
          ruleKey: decision.ruleKey,
          flagKey: decision.flagKey,
          reasons: decision.reasons
        } as OptimizelyDecision;
      } catch (decideError) {
        this.logger.error(`${this.LOG_PREFIX} Error in decide call for flag "${flagKey}":`, decideError);
        return this.createFallbackDecision(
          flagKey,
          userContext,
          `Error during decide: ${decideError}`
        );
      }
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} Failed to get decision for flag "${flagKey}":`, error);
      return this.createFallbackDecision(
        flagKey,
        userContext,
        `Failed to get decision: ${error}`
      );
    }
  }

  /**
   * Gets decisions for all flags or a subset of flags.
   * @param userContext - The user context for decision-making.
   * @param flagKeys - Optional array of specific flag keys to decide. If not provided, all flags are decided.
   * @param options - Optional configuration options.
   * @returns A promise resolving to a map of flag keys to decisions.
   */
  async decideAll(
    userContext: ExtendedOptimizelyUserContext,
    flagKeys?: string[],
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>> {
    try {
      const selectedSdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!selectedSdkKey) {
        throw new Error("SDK key is required. Provide it in options or set a default.");
      }
      
      // Get/initialize Optimizely client - extract requestContext if available
      const requestContext = userContext.metadata?.requestContext;
      const client = await this.getOptimizelyClient(selectedSdkKey, requestContext);
      
    if (!client) {
        this.logger.error(`${this.LOG_PREFIX} Failed to initialize Optimizely client for decideAll`);
      return {};
    }

      // Get internal user context from SDK
      const processedAttributes = this.processAttributes(userContext.attributes || {});
      const sdkUserContext = client.createUserContext(userContext.userId, processedAttributes);
      
      if (!sdkUserContext) {
        this.logger.error(`${this.LOG_PREFIX} Failed to create user context for decideAll`);
        return {};
      }
      
      // Apply any forced variations if specified in the user context
      if (userContext.forcedDecisions) {
        for (const [flagKey, decision] of Object.entries(userContext.forcedDecisions)) {
          await this.applyForcedVariations(client, flagKey, userContext.userId, decision.variationKey);
            }
          }
      
      // Convert options array to Optimizely SDK format if needed
      let sdkOptions: OptimizelyDecideOption[] = [];
      if (options?.decideOptions && options.decideOptions.length > 0) {
        sdkOptions = options.decideOptions;
      }
      
      // Call appropriate SDK method based on whether specific flag keys were provided
      let sdkDecisions: Record<string, any>;
      try {
        if (flagKeys && flagKeys.length > 0) {
          // Use decideForKeys when specific flag keys are provided
          sdkDecisions = sdkUserContext.decideForKeys(flagKeys, sdkOptions);
        } else {
          // Use decideAll when no specific flag keys are provided
          sdkDecisions = sdkUserContext.decideAll(sdkOptions);
        }
      } catch (decideError) {
        this.logger.error(`${this.LOG_PREFIX} Error in decideAll/decideForKeys call:`, decideError);
        return {};
      }
      
      // Convert SDK decisions to our interface format
      const decisions: Record<string, OptimizelyDecision> = {};
      for (const [key, decision] of Object.entries(sdkDecisions)) {
        decisions[key] = {
          variationKey: decision.variationKey,
          enabled: decision.enabled,
          variables: decision.variables,
          ruleKey: decision.ruleKey,
          flagKey: decision.flagKey,
          reasons: decision.reasons
        } as OptimizelyDecision;
      }
      
      return decisions;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} Failed to get decisions:`, error);
      return {};
    }
  }

  /**
   * Forces a specific variation for debugging or testing.
   * @param flagKey - The flag or experiment key.
   * @param userId - The user ID.
   * @param variationKey - The variation key to force.
   * @param options - Optional: { sdkKey?: string }.
   * @returns A promise resolving on completion.
   */
  async setForcedVariation(
    flagKey: string,
    userId: string,
    variationKey: string | null,
    options?: { sdkKey?: string }
  ): Promise<void> {
    const sdkKey = options?.sdkKey;
    if (!sdkKey) {
      throw new Error("DecisionService.setForcedVariation requires an sdkKey in options (implementation detail)");
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Cannot set forced variation.`);
      return;
    }

    try {
      const result = client.setForcedVariation(flagKey, userId, variationKey);
      
      if (result) {
        this.logger.info(`${this.LOG_PREFIX} DecisionService: Successfully set forced variation '${variationKey}' for flag '${flagKey}', user '${userId}'`);
        
        // Clear user context cache to ensure that the next decide call uses the forced variation
        this.clearUserContextsForSdkKey(sdkKey);
      } else {
        this.logger.warn(`${this.LOG_PREFIX} DecisionService: Failed to set forced variation '${variationKey}' for flag '${flagKey}', user '${userId}'`);
      }
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error setting forced variation for flag '${flagKey}', user '${userId}'`, error);
    }
  }

  /**
   * Gets the forced variation for a user.
   * @param flagKey - The flag or experiment key.
   * @param userId - The user ID.
   * @param options - Optional: { sdkKey?: string }.
   * @returns A promise resolving to the forced variation key or null.
   */
  async getForcedVariation(
    flagKey: string,
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<string | null> {
    const sdkKey = options?.sdkKey;
    if (!sdkKey) {
      throw new Error("DecisionService.getForcedVariation requires an sdkKey in options (implementation detail)");
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Cannot get forced variation.`);
      return null;
    }

    try {
      const forcedVariation = client.getForcedVariation(flagKey, userId);
      this.logger.debug(`${this.LOG_PREFIX} DecisionService: Got forced variation '${forcedVariation}' for flag '${flagKey}', user '${userId}'`);
      return forcedVariation;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error getting forced variation for flag '${flagKey}', user '${userId}'`, error);
      return null;
    }
  }

  /**
   * Removes a forced decision for a specific context.
   * @param context - The decision context containing flagKey and optional ruleKey.
   * @param userId - The user ID.
   * @param options - Optional: { sdkKey?: string }.
   * @returns A promise resolving to a boolean indicating success or failure.
   */
  async removeForcedDecision(
    context: OptimizelyDecisionContext,
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<boolean> {
    const sdkKey = options?.sdkKey;
    if (!sdkKey) {
      throw new Error("DecisionService.removeForcedDecision requires an sdkKey in options (implementation detail)");
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Cannot remove forced decision.`);
      return false;
    }

    try {
      // First, try to get or create a user context
      const optimizelyUserContext = this.getUserContext(client, userId, {});
      if (!optimizelyUserContext) {
        this.logger.error(`${this.LOG_PREFIX} DecisionService: Failed to create user context for removing forced decision.`);
        return false;
      }

      // If the user context has the removeForcedDecision method, use it
      if (typeof optimizelyUserContext.removeForcedDecision === 'function') {
        const result = optimizelyUserContext.removeForcedDecision(context);
        
        if (result) {
          this.logger.info(`${this.LOG_PREFIX} DecisionService: Successfully removed forced decision for flag '${context.flagKey}', user '${userId}'${context.ruleKey ? `, rule '${context.ruleKey}'` : ''}`);
          
          // Clear user context cache to ensure that the next decide call doesn't use the cached forced variation
          this.clearUserContextsForSdkKey(sdkKey);
        } else {
          this.logger.warn(`${this.LOG_PREFIX} DecisionService: Failed to remove forced decision for flag '${context.flagKey}', user '${userId}'${context.ruleKey ? `, rule '${context.ruleKey}'` : ''}`);
        }
        
        return result;
      }
      
      // Fallback: If the SDK's userContext doesn't have removeForcedDecision, 
      // try to use setForcedVariation with null (only works for flagKey without ruleKey)
      if (!context.ruleKey) {
        const result = client.setForcedVariation(context.flagKey, userId, null);
        
        if (result) {
          this.logger.info(`${this.LOG_PREFIX} DecisionService: Successfully removed forced variation for flag '${context.flagKey}', user '${userId}' using setForcedVariation(null)`);
          
          // Clear user context cache to ensure that the next decide call doesn't use the cached forced variation
          this.clearUserContextsForSdkKey(sdkKey);
        } else {
          this.logger.warn(`${this.LOG_PREFIX} DecisionService: Failed to remove forced variation for flag '${context.flagKey}', user '${userId}' using setForcedVariation(null)`);
        }
        
        return result;
      }
      
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Cannot remove forced decision for flag '${context.flagKey}', rule '${context.ruleKey}', user '${userId}' - SDK doesn't support the operation.`);
      return false;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error removing forced decision for flag '${context.flagKey}', user '${userId}'`, error);
      return false;
    }
  }

  /**
   * Removes all forced decisions for a user.
   * @param userId - The user ID.
   * @param options - Optional: { sdkKey?: string }.
   * @returns A promise resolving to a boolean indicating success or failure.
   */
  async removeAllForcedDecisions(
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<boolean> {
    const sdkKey = options?.sdkKey;
    if (!sdkKey) {
      throw new Error("DecisionService.removeAllForcedDecisions requires an sdkKey in options (implementation detail)");
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Cannot remove all forced decisions.`);
      return false;
    }

    try {
      // First, try to get or create a user context
      const optimizelyUserContext = this.getUserContext(client, userId, {});
      if (!optimizelyUserContext) {
        this.logger.error(`${this.LOG_PREFIX} DecisionService: Failed to create user context for removing all forced decisions.`);
        return false;
      }

      // If the user context has the removeAllForcedDecisions method, use it
      if (typeof optimizelyUserContext.removeAllForcedDecisions === 'function') {
        const result = optimizelyUserContext.removeAllForcedDecisions();
        
        if (result) {
          this.logger.info(`${this.LOG_PREFIX} DecisionService: Successfully removed all forced decisions for user '${userId}'`);
          
          // Clear user context cache to ensure that the next decide call doesn't use any cached forced variations
          this.clearUserContextsForSdkKey(sdkKey);
        } else {
          this.logger.warn(`${this.LOG_PREFIX} DecisionService: Failed to remove all forced decisions for user '${userId}'`);
        }
        
        return result;
      }
      
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Cannot remove all forced decisions for user '${userId}' - SDK doesn't support the operation.`);
      return false;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error removing all forced decisions for user '${userId}'`, error);
      return false;
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
    const sdkKey = options?.sdkKey || this.defaultSdkKey;
    if (!sdkKey) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: No SDK key provided and no default set for getDecision. Returning default decision.`);
      return this.createFallbackDecision(flagKey, { userId, attributes }, 'no_sdk_key');
    }
    
    // Create a user context from the parameters
    const userContext: ExtendedOptimizelyUserContext = {
      userId,
      attributes
    };
    
    // Use the existing decide method with the constructed context and ensure we pass the sdkKey
    return this.decide(flagKey, userContext, { 
      sdkKey,
      decideOptions: options?.decideOptions 
    });
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
    const sdkKey = options?.sdkKey || this.defaultSdkKey;
    if (!sdkKey) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: No SDK key provided and no default set for getAllDecisions. Returning empty decisions.`);
      return {};
    }
    
    // Construct user context
    const userContext: ExtendedOptimizelyUserContext = {
      userId,
      attributes
    };
    
    try {
      // If decideAll is available, use it with the proper sdkKey
      if (this.decideAll) {
        return await this.decideAll(userContext, undefined, {
          sdkKey,
          decideOptions: options?.decideOptions
        });
      }
      
      // If we don't have decideAll, we need to use a different approach
      // Get or initialize the optimizely client
      const client = await this.getOptimizelyClient(sdkKey);
      if (!client) {
        this.logger.error(`${this.LOG_PREFIX} getAllDecisions: Failed to get Optimizely client for SDK key ${sdkKey}`);
        return {};
      }
      
      // Try to get all flagKeys from the client or config
      let allFlagKeys: string[] = [];
      try {
        // Get the datafile JSON from the client
        const datafileJSON = client.getOptimizelyConfig()?.getDatafile();
        if (datafileJSON) {
          // Parse the datafile to extract all feature keys
          const datafile = JSON.parse(datafileJSON);
          if (datafile && datafile.featureFlags && Array.isArray(datafile.featureFlags)) {
            allFlagKeys = datafile.featureFlags.map((flag: any) => flag.key);
          }
        }
      } catch (error) {
        this.logger.error(`${this.LOG_PREFIX} getAllDecisions: Error extracting flag keys from datafile`, error);
      }
      
      if (allFlagKeys.length === 0) {
        this.logger.warn(`${this.LOG_PREFIX} getAllDecisions: No flag keys found in datafile.`);
        return {};
      }
      
      // Decide each flag individually, ensuring we consistently pass the same sdkKey
      const decisions: Record<string, OptimizelyDecision> = {};
      for (const flagKey of allFlagKeys) {
        try {
          decisions[flagKey] = await this.decide(flagKey, userContext, {
            sdkKey,
            decideOptions: options?.decideOptions
          });
        } catch (error) {
          this.logger.error(`${this.LOG_PREFIX} getAllDecisions: Error deciding flag ${flagKey}`, error);
        }
      }
      
      return decisions;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} getAllDecisions: Unexpected error`, error);
      return {};
    }
  }
}