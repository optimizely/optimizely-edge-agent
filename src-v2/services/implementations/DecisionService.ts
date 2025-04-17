import {
  IDecisionService,
  // UserContext, // Replace with OptimizelyUserContext
  // DecisionResult // Replace with OptimizelyDecision
  OptimizelyUserContext,
  OptimizelyDecision,
  OptimizelyDecideOption
} from "../interfaces/IDecisionService";
import { IConfigService } from "../interfaces/IConfigService";
import { ILoggerAdapter, LogLevel } from "../../adapters/interfaces/ILoggerAdapter";
import * as optimizely from '@optimizely/optimizely-sdk';

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

/**
 * Service responsible for making Optimizely decisions (feature flags, experiments).
 * Integrates with the Optimizely Full Stack SDK.
 */
export class DecisionService implements IDecisionService {
  private configService: IConfigService;
  private logger: ILoggerAdapter;
  private clientCache: OptimizelyClientCache = {};
  private userContextCache: Map<string, any> = new Map(); // Cache for user contexts
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of client instances to cache
  private readonly USER_CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly LOG_PREFIX = '[v2]';
  private defaultSdkKey: string | null = null; // Default SDK key for operations

  /**
   * Creates an instance of the DecisionService.
   * @param configService - Service to fetch Optimizely configuration.
   * @param logger - Logger adapter.
   * @param defaultSdkKey - Optional default SDK key to use when none is provided.
   */
  constructor(configService: IConfigService, logger: ILoggerAdapter, defaultSdkKey?: string) {
    if (!configService || !logger) {
      throw new Error("DecisionService requires configService and logger.");
    }
    this.configService = configService;
    this.logger = logger;
    this.defaultSdkKey = defaultSdkKey || null;

    // Log that we're using Node.js SDK configuration
    this.logger.info(`${this.LOG_PREFIX} DecisionService: Initialized with Node.js SDK configuration`);

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
   * Gets or creates an Optimizely client instance for a given SDK key.
   * Caches the client based on datafile revision.
   * @param sdkKey - The SDK key.
   * @returns A promise resolving to the Optimizely client instance or null.
   */
  private async getOptimizelyClient(sdkKey: string): Promise<optimizely.Client | null> {
    const datafile = await this.configService.getDatafile(sdkKey);
    if (!datafile || typeof datafile !== 'object' || !('revision' in datafile)) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Failed to fetch valid datafile for SDK key '${sdkKey}'.`);
      return null;
    }

    const revision = String((datafile as any).revision);
    const cached = this.clientCache[sdkKey];

    if (cached && cached.revision === revision) {
      this.logger.debug(`${this.LOG_PREFIX} DecisionService: Using cached Optimizely client for SDK key '${sdkKey}', revision '${revision}'.`);
      // Update last used timestamp
      this.clientCache[sdkKey].lastUsed = Date.now();
      return cached.client;
    }

    this.logger.info(`${this.LOG_PREFIX} DecisionService: Creating new Optimizely client instance for SDK key '${sdkKey}', revision '${revision}'.`);
    try {
      // Create a wrapper for the logger that converts between our log levels and Optimizely's
      const loggerAdapter: OptimizelyLogger = {
        log: (optimizelyLogLevel: any, message: string) => {
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

      // Following pattern from optimizelyProvider.js in the original codebase
      const params = {
        datafile: datafile,
        logger: loggerAdapter,
        clientEngine: 'javascript-sdk/cloudflare-agent', // From defaultSettings.js
        clientVersion: '1.0.0',                          // From defaultSettings.js
        eventBatchSize: 10,                              // Default batch size to avoid warnings
        eventFlushInterval: 1000,                        // Default flush interval to avoid warnings
        errorHandler: {
          handleError: (error: Error) => {
            this.logger.error(`${this.LOG_PREFIX} OptimizelySDK Error: ${error.message}`, error);
          }
        }
      };
      
      // Create enhanced client with datafile and error handling
      const client = optimizely.createInstance(params);

      if (!client) {
        throw new Error('optimizely.createInstance returned null or undefined.');
      }

      // Store client in cache with timestamp
      this.clientCache[sdkKey] = { 
        revision, 
        client,
        lastUsed: Date.now()
      };
      
      // Clear any related user contexts from cache when client changes
      this.clearUserContextsForSdkKey(sdkKey);
      
      return client;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Failed to create Optimizely client for SDK key '${sdkKey}'.`, error);
      return null;
    }
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
    userContext: OptimizelyUserContext, 
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
    userContext: OptimizelyUserContext,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision> {
    const sdkKey = options?.sdkKey || this.defaultSdkKey;
    if (!sdkKey) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: No SDK key provided and no default set. Returning default decision.`);
      return this.createFallbackDecision(flagKey, userContext, 'no_sdk_key');
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Returning default decision.`);
      return this.createFallbackDecision(flagKey, userContext, 'client_unavailable');
    }

    try {
      // Process attributes for enhanced audience targeting
      const processedAttributes = this.processAttributes(userContext.attributes);
      
      // Add debug logging to check forcedDecisions
      console.log('[DECISION_DEBUG] userContext:', JSON.stringify(userContext));
      
      // Check for forcedDecisions safely
      let forcedDecisions: any = undefined;
      if (userContext && userContext.attributes) {
        const attributes = userContext.attributes;
        if (typeof attributes === 'object' && attributes !== null && 'forcedDecisions' in attributes) {
          forcedDecisions = attributes.forcedDecisions;
        }
      }

      if (forcedDecisions) {
        console.log('[DECISION_DEBUG] forcedDecisions found in attributes:', JSON.stringify(forcedDecisions));
        
        // Apply forced variation directly via SDK client if relevant
        if (forcedDecisions[flagKey] && typeof forcedDecisions[flagKey] === 'object' &&
            forcedDecisions[flagKey].variationKey) {
          
          // Ensure variation key is preserved exactly as provided (e.g., lowercase "on")
          const variationKey = forcedDecisions[flagKey].variationKey;
          
          console.log(`[DECISION_DEBUG] Applying forced variation for ${flagKey}: ${variationKey}`);
          
          // Apply forced variation directly through the client for this specific flag
          await this.applyForcedVariations(
            client, 
            flagKey, 
            userContext.userId, 
            variationKey
          );
        }
      } else {
        console.log('[DECISION_DEBUG] No forcedDecisions in userContext');
      }
      
      // Get or create an SDK UserContext object
      const optimizelyUserContext = this.getUserContext(
        client, 
        userContext.userId, 
        processedAttributes
      );
      
      if (!optimizelyUserContext) {
        throw new Error('Failed to create Optimizely user context');
      }
      
      // Important: Directly apply forced decisions to the SDK UserContext object if needed
      // This is the most reliable way to apply forced decisions
      if (forcedDecisions && typeof forcedDecisions === 'object') {
        // If we have forcedDecisions and the UserContext has setForcedDecision method
        if (typeof optimizelyUserContext.setForcedDecision === 'function') {
          console.log('[DECISION_DEBUG] Applying forced decisions directly via SDK setForcedDecision');
          
          // Apply the specific forced decision for this flag if it exists
          if (flagKey in forcedDecisions) {
            const decision = forcedDecisions[flagKey];
            if (typeof decision === 'object' && decision !== null && 'variationKey' in decision) {
              const context = { flagKey }; // flagKey context
              const decisionToApply = { variationKey: decision.variationKey }; // variationKey to force
              
              // Set the forced decision
              const result = optimizelyUserContext.setForcedDecision(context, decisionToApply);
              console.log(`[DECISION_DEBUG] Applied forced decision for ${flagKey}, result:`, result);
            }
          }
        } else {
          console.log('[DECISION_DEBUG] SDK UserContext does not have setForcedDecision method');
        }
      }
      
      // Add debugging to check if forced decisions are in the SDK userContext
      console.log('[DECISION_DEBUG] optimizelyUserContext created:', optimizelyUserContext);
      if (optimizelyUserContext && typeof optimizelyUserContext.getForcedDecision === 'function') {
        const forcedDecision = optimizelyUserContext.getForcedDecision({ flagKey });
        console.log(`[DECISION_DEBUG] getForcedDecision(${flagKey}) result:`, forcedDecision);
      } else {
        console.log('[DECISION_DEBUG] getForcedDecision not available on userContext');
      }
      
      // Also check for forced variation directly in the client
      if (typeof client.getForcedVariation === 'function') {
        const forcedVariation = client.getForcedVariation(flagKey, userContext.userId);
        console.log(`[DECISION_DEBUG] Direct client.getForcedVariation result:`, forcedVariation);
      }
      
      // Call decide on the user context object with specified options
      const decision = optimizelyUserContext.decide(flagKey, options?.decideOptions);
      
      console.log(`[DECISION_DEBUG] Final decision for flag '${flagKey}':`, JSON.stringify(decision));
      
      this.logger.debug(`${this.LOG_PREFIX} DecisionService: Decision made for flag '${flagKey}', user '${userContext.userId}'`, decision);
      return decision;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error making decision for flag '${flagKey}', user '${userContext.userId}'`, error);
      return this.createFallbackDecision(flagKey, userContext, 'error_in_decision_process');
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
    const sdkKey = options?.sdkKey || this.defaultSdkKey;
    if (!sdkKey) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: No SDK key provided and no default set. Returning empty decisions.`);
      return {};
    }

    const client = await this.getOptimizelyClient(sdkKey);
    if (!client) {
      this.logger.warn(`${this.LOG_PREFIX} DecisionService: Optimizely client not available for SDK key '${sdkKey}'. Returning empty decisions.`);
      return {};
    }

    try {
      // Process attributes for enhanced audience targeting
      const processedAttributes = this.processAttributes(userContext.attributes);
      
      // Add debug logging for decideAll
      console.log('[DECIDEALL_DEBUG] userContext:', JSON.stringify(userContext));
      
      // Check for forcedDecisions safely
      let forcedDecisions: any = undefined;
      if (userContext && userContext.attributes) {
        const attributes = userContext.attributes;
        if (typeof attributes === 'object' && attributes !== null && 'forcedDecisions' in attributes) {
          forcedDecisions = attributes.forcedDecisions;
        }
      }

      if (forcedDecisions) {
        console.log('[DECIDEALL_DEBUG] forcedDecisions found in attributes:', JSON.stringify(forcedDecisions));
        
        // Apply all forced decisions directly to the client for each flag
        if (typeof forcedDecisions === 'object') {
          for (const [fKey, decision] of Object.entries(forcedDecisions)) {
            if (typeof decision === 'object' && decision !== null && 'variationKey' in decision) {
              // Make sure we have the exact variation key value as provided (e.g., lowercase "on")
              // Cast to string or null to satisfy the type requirement
              const variationKey = typeof decision.variationKey === 'string' 
                ? decision.variationKey   // Keep original string value (e.g. lowercase "on")
                : decision.variationKey === null 
                  ? null 
                  : String(decision.variationKey); // Fallback to string conversion
              
              console.log(`[DECIDEALL_DEBUG] Applying forced variation for ${fKey}: ${variationKey}`);
              
              // Apply forced variation directly through the client 
              await this.applyForcedVariations(
                client, 
                fKey, 
                userContext.userId, 
                variationKey
              );
            }
          }
        }
      } else {
        console.log('[DECIDEALL_DEBUG] No forcedDecisions in userContext');
      }
      
      // Get or create an SDK UserContext object
      const optimizelyUserContext = this.getUserContext(
        client, 
        userContext.userId, 
        processedAttributes
      );
      
      if (!optimizelyUserContext) {
        throw new Error('Failed to create Optimizely user context');
      }
      
      // Important: Directly apply forced decisions to the SDK UserContext object if needed
      if (forcedDecisions && typeof forcedDecisions === 'object') {
        // If we have forcedDecisions and the UserContext has setForcedDecision method
        if (typeof optimizelyUserContext.setForcedDecision === 'function') {
          console.log('[DECIDEALL_DEBUG] Applying forced decisions directly via SDK setForcedDecision');
          
          // Apply all forced decisions
          for (const [fKey, decision] of Object.entries(forcedDecisions)) {
            if (typeof decision === 'object' && decision !== null && 'variationKey' in decision) {
              const context = { flagKey: fKey }; // flagKey context
              const decisionToApply = { variationKey: decision.variationKey }; // variationKey to force
              
              // Set the forced decision
              const result = optimizelyUserContext.setForcedDecision(context, decisionToApply);
              console.log(`[DECIDEALL_DEBUG] Applied forced decision for ${fKey}, result:`, result);
            }
          }
        } else {
          console.log('[DECIDEALL_DEBUG] SDK UserContext does not have setForcedDecision method');
        }
      }
      
      // Log all current forced variations directly from client
      if (typeof client.getForcedVariation === 'function') {
        console.log(`[DECIDEALL_DEBUG] Checking all forced variations directly in client...`);
        
        // Check forced variations for requested flagKeys or all flags
        const keysToCheck = flagKeys && flagKeys.length > 0 ? flagKeys : (
          // If we have forcedDecisions, check all keys there, otherwise we don't have a way to know all flags
          forcedDecisions ? Object.keys(forcedDecisions) : []
        );
        
        for (const key of keysToCheck) {
          const forcedVariation = client.getForcedVariation(key, userContext.userId);
          console.log(`[DECIDEALL_DEBUG] Direct client.getForcedVariation(${key}) result:`, forcedVariation);
        }
      }
      
      // Call appropriate decide method based on flagKeys
      let decisions: Record<string, OptimizelyDecision>;
      
      if (flagKeys && flagKeys.length > 0) {
        // Use decideForKeys for specific flags
        console.log('[DECIDEALL_DEBUG] Calling decideForKeys with flagKeys:', flagKeys);
        decisions = optimizelyUserContext.decideForKeys(flagKeys, options?.decideOptions);
      } else {
        // Use decideAll for all flags
        console.log('[DECIDEALL_DEBUG] Calling decideAll for all flags');
        decisions = optimizelyUserContext.decideAll(options?.decideOptions);
      }
      
      console.log('[DECIDEALL_DEBUG] Final decisions:', Object.keys(decisions));
      
      this.logger.debug(`${this.LOG_PREFIX} DecisionService: Decisions made for user '${userContext.userId}'`, decisions);
      return decisions;
    } catch (error) {
      this.logger.error(`${this.LOG_PREFIX} DecisionService: Error making decisions for user '${userContext.userId}'`, error);
      return {};
    }
  }

  /**
   * Forces a specific variation for debugging or testing.
   * @param flagKey - The flag or experiment key.
   * @param userId - The user ID.
   * @param variationKey - The variation key to force.
   * @param options - Optional: { sdkKey: string }.
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
    // Create a user context from the parameters
    const userContext: OptimizelyUserContext = {
      userId,
      attributes
    };
    
    // Use the existing decide method with the constructed context
    return this.decide(flagKey, userContext, options);
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
    // Construct user context
    const userContext: OptimizelyUserContext = {
      userId,
      attributes
    };
    
    try {
      // If decideAll is available, use it
      if (this.decideAll) {
        return await this.decideAll(userContext, undefined, options);
      }
      
      // If we don't have decideAll, we need to use a different approach
      // First, get the datafile to extract all flag keys
      const sdkKey = options?.sdkKey || this.defaultSdkKey;
      if (!sdkKey) {
        this.logger.error(`${this.LOG_PREFIX} getAllDecisions: No SDK key provided and no default set.`);
        return {};
      }
      
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
      
      // Decide each flag individually
      const decisions: Record<string, OptimizelyDecision> = {};
      for (const flagKey of allFlagKeys) {
        try {
          decisions[flagKey] = await this.decide(flagKey, userContext, options);
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