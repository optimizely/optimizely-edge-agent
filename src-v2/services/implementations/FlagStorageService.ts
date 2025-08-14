import { IFlagStorageService } from "../interfaces/IFlagStorageService";
import { OptimizelyDecision } from "../interfaces/IDecisionService";
import { IStorageAdapter } from "../../adapters/interfaces/IStorageAdapter";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";

/**
 * Constants for key formats and TTLs to match original implementation
 */
const FLAG_KEY_PREFIX = 'flag:';
const FLAG_DECISION_PREFIX = 'flag-decision:';
const FLAG_KEYS_PREFIX = 'flagkeys:';
const ALL_DECISIONS_PREFIX = 'all-decisions:';
const DEFAULT_FLAG_TTL = 3600; // 1 hour in seconds
const DEFAULT_DECISION_TTL = 600; // 10 minutes in seconds
const DEFAULT_FLAG_KEYS_TTL = 3600; // 1 hour in seconds

/**
 * Implementation of IFlagStorageService for flag-specific KV storage operations.
 * Uses the same key format as the original Edge Agent implementation.
 */
export class FlagStorageService implements IFlagStorageService {
  private storage: IStorageAdapter;
  private logger: ILoggerAdapter;
  private memoryCache: Map<string, { value: any, expiry: number }>;
  private cacheEnabled: boolean;
  private cleanupInterval: any = null;
  private isCleanupRunning: boolean = false;
  
  /**
   * Creates a new instance of FlagStorageService.
   * @param storage - The storage adapter for KV operations.
   * @param logger - The logger adapter.
   * @param options - Optional configuration options.
   */
  constructor(
    storage: IStorageAdapter, 
    logger: ILoggerAdapter,
    options?: { 
      cacheEnabled?: boolean,
      autoCleanup?: boolean,
      cleanupIntervalMs?: number
    }
  ) {
    if (!storage) {
      throw new Error("Storage adapter is required for FlagStorageService");
    }
    this.storage = storage;
    this.logger = logger;
    this.cacheEnabled = options?.cacheEnabled !== false; // Default to true
    this.memoryCache = new Map();
    
    this.logger.debug("[FlagStorageService] Initialized with memory caching " +
      (this.cacheEnabled ? "enabled" : "disabled"));
    
    // Start automatic cleanup if enabled
    if (options?.autoCleanup !== false) {
      const intervalMs = options?.cleanupIntervalMs || 300000; // Default: 5 minutes
      this.startPeriodicCleanup(intervalMs);
    }
  }
  
  /**
   * Builds a KV storage key for a flag.
   * Format: flag:<sdkKey>:<flagKey>
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key.
   * @returns The constructed storage key.
   */
  private getFlagStorageKey(sdkKey: string, flagKey: string): string {
    return `${FLAG_KEY_PREFIX}${sdkKey}:${flagKey}`;
  }
  
  /**
   * Builds a KV storage key for a flag decision.
   * Format: flag-decision:<sdkKey>:<flagKey>:<userId>
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key.
   * @param userId - The user ID.
   * @returns The constructed storage key.
   */
  private getFlagDecisionStorageKey(sdkKey: string, flagKey: string, userId: string): string {
    return `${FLAG_DECISION_PREFIX}${sdkKey}:${flagKey}:${userId}`;
  }
  
  /**
   * Builds a KV storage key for flag keys.
   * Format: flagkeys:<sdkKey>
   * @param sdkKey - The Optimizely SDK key.
   * @returns The constructed storage key.
   */
  private getFlagKeysStorageKey(sdkKey: string): string {
    return `${FLAG_KEYS_PREFIX}${sdkKey}`;
  }
  
  /**
   * Builds a KV storage key for all flag decisions.
   * Format: all-decisions:<sdkKey>:<userId>
   * @param sdkKey - The Optimizely SDK key.
   * @param userId - The user ID.
   * @returns The constructed storage key.
   */
  private getAllDecisionsStorageKey(sdkKey: string, userId: string): string {
    return `${ALL_DECISIONS_PREFIX}${sdkKey}:${userId}`;
  }
  
  /**
   * Tries to get a value from the memory cache.
   * @param key - The cache key.
   * @returns The cached value or null if not found or expired.
   */
  private getFromMemoryCache<T>(key: string): T | null {
    if (!this.cacheEnabled) return null;
    
    const cachedItem = this.memoryCache.get(key);
    if (!cachedItem) return null;
    
    // Check if the item is expired
    if (cachedItem.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cachedItem.value as T;
  }
  
  /**
   * Stores a value in the memory cache.
   * @param key - The cache key.
   * @param value - The value to store.
   * @param ttlSeconds - Time-to-live in seconds.
   */
  private storeInMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
    if (!this.cacheEnabled) return;
    
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { value, expiry });
  }
  
  /**
   * Retrieves a flag from KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to retrieve.
   * @returns A promise resolving to the flag data or null if not found.
   */
  async getFlag<T = any>(sdkKey: string, flagKey: string): Promise<T | null> {
    if (!sdkKey || !flagKey) {
      this.logger.error("[FlagStorageService] Cannot get flag: SDK key and flag key are required");
      return null;
    }
    
    const storageKey = this.getFlagStorageKey(sdkKey, flagKey);
    
    try {
      // Check memory cache first
      const cachedValue = this.getFromMemoryCache<T>(storageKey);
      if (cachedValue !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag ${flagKey} (memory cache)`);
        return cachedValue;
      }
      
      // Try to get from KV storage
      const storedValue = await this.storage.get<T>(storageKey, 'json');
      
      if (storedValue !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag ${flagKey} (KV storage)`);
        // Store in memory cache for future use
        this.storeInMemoryCache(storageKey, storedValue, DEFAULT_FLAG_TTL);
        return storedValue;
      }
      
      this.logger.debug(`[FlagStorageService] Cache miss for flag ${flagKey}`);
      return null;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error getting flag ${flagKey}:`, error);
      return null;
    }
  }
  
  /**
   * Stores a flag in KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to store.
   * @param flag - The flag data to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async putFlag<T = any>(sdkKey: string, flagKey: string, flag: T, ttl = DEFAULT_FLAG_TTL): Promise<boolean> {
    if (!sdkKey || !flagKey) {
      this.logger.error("[FlagStorageService] Cannot put flag: SDK key and flag key are required");
      return false;
    }
    
    const storageKey = this.getFlagStorageKey(sdkKey, flagKey);
    
    try {
      // Store in KV storage
      await this.storage.put(storageKey, JSON.stringify(flag), { expirationTtl: ttl });
      
      // Store in memory cache
      this.storeInMemoryCache(storageKey, flag, ttl);
      
      this.logger.debug(`[FlagStorageService] Stored flag ${flagKey} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error storing flag ${flagKey}:`, error);
      return false;
    }
  }
  
  /**
   * Retrieves a decision for a specific flag from KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to retrieve.
   * @param userId - The user ID for the decision.
   * @returns A promise resolving to the decision data or null if not found.
   */
  async getFlagDecision(sdkKey: string, flagKey: string, userId: string): Promise<Partial<OptimizelyDecision> | null> {
    if (!sdkKey || !flagKey || !userId) {
      this.logger.error("[FlagStorageService] Cannot get flag decision: SDK key, flag key, and user ID are required");
      return null;
    }
    
    const storageKey = this.getFlagDecisionStorageKey(sdkKey, flagKey, userId);
    
    try {
      // Check memory cache first
      const cachedDecision = this.getFromMemoryCache<Partial<OptimizelyDecision>>(storageKey);
      if (cachedDecision !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag decision ${flagKey}:${userId} (memory cache)`);
        return cachedDecision;
      }
      
      // Try to get from KV storage
      const storedDecision = await this.storage.get<Partial<OptimizelyDecision>>(storageKey, 'json');
      
      if (storedDecision !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag decision ${flagKey}:${userId} (KV storage)`);
        // Store in memory cache for future use
        this.storeInMemoryCache(storageKey, storedDecision, DEFAULT_DECISION_TTL);
        return storedDecision;
      }
      
      this.logger.debug(`[FlagStorageService] Cache miss for flag decision ${flagKey}:${userId}`);
      return null;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error getting flag decision ${flagKey}:${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Stores a decision for a specific flag in KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key.
   * @param userId - The user ID for the decision.
   * @param decision - The decision data to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async putFlagDecision(
    sdkKey: string, 
    flagKey: string, 
    userId: string, 
    decision: Partial<OptimizelyDecision>, 
    ttl = DEFAULT_DECISION_TTL
  ): Promise<boolean> {
    if (!sdkKey || !flagKey || !userId) {
      this.logger.error("[FlagStorageService] Cannot put flag decision: SDK key, flag key, and user ID are required");
      return false;
    }
    
    const storageKey = this.getFlagDecisionStorageKey(sdkKey, flagKey, userId);
    
    try {
      // Store in KV storage
      await this.storage.put(storageKey, JSON.stringify(decision), { expirationTtl: ttl });
      
      // Store in memory cache
      this.storeInMemoryCache(storageKey, decision, ttl);
      
      this.logger.debug(`[FlagStorageService] Stored flag decision ${flagKey}:${userId} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error storing flag decision ${flagKey}:${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Retrieves all flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to an array of flag keys or an empty array if none are found.
   */
  async getFlagKeys(sdkKey: string): Promise<string[]> {
    if (!sdkKey) {
      this.logger.error("[FlagStorageService] Cannot get flag keys: SDK key is required");
      return [];
    }
    
    const storageKey = this.getFlagKeysStorageKey(sdkKey);
    
    try {
      // Check memory cache first
      const cachedKeys = this.getFromMemoryCache<string[]>(storageKey);
      if (cachedKeys !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag keys (memory cache)`);
        return cachedKeys;
      }
      
      // Try to get from KV storage
      const storedKeys = await this.storage.get<string[]>(storageKey, 'json');
      
      if (storedKeys !== null && Array.isArray(storedKeys)) {
        this.logger.debug(`[FlagStorageService] Cache hit for flag keys (KV storage)`);
        // Store in memory cache for future use
        this.storeInMemoryCache(storageKey, storedKeys, DEFAULT_FLAG_KEYS_TTL);
        return storedKeys;
      }
      
      this.logger.debug(`[FlagStorageService] Cache miss for flag keys`);
      return [];
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error getting flag keys for SDK key ${sdkKey}:`, error);
      return [];
    }
  }
  
  /**
   * Stores the list of flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKeys - The array of flag keys to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async putFlagKeys(sdkKey: string, flagKeys: string[], ttl = DEFAULT_FLAG_KEYS_TTL): Promise<boolean> {
    if (!sdkKey || !Array.isArray(flagKeys)) {
      this.logger.error("[FlagStorageService] Cannot put flag keys: SDK key and flag keys array are required");
      return false;
    }
    
    const storageKey = this.getFlagKeysStorageKey(sdkKey);
    
    try {
      // Deduplicate flag keys
      const uniqueFlagKeys = [...new Set(flagKeys)];
      
      // Store in KV storage
      await this.storage.put(storageKey, JSON.stringify(uniqueFlagKeys), { expirationTtl: ttl });
      
      // Store in memory cache
      this.storeInMemoryCache(storageKey, uniqueFlagKeys, ttl);
      
      this.logger.debug(`[FlagStorageService] Stored ${uniqueFlagKeys.length} flag keys with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error storing flag keys for SDK key ${sdkKey}:`, error);
      return false;
    }
  }
  
  /**
   * Retrieves all flag decisions for a user.
   * @param sdkKey - The Optimizely SDK key.
   * @param userId - The user ID.
   * @returns A promise resolving to a map of flag keys to decisions.
   */
  async getAllFlagDecisions(sdkKey: string, userId: string): Promise<Record<string, Partial<OptimizelyDecision>> | null> {
    if (!sdkKey || !userId) {
      this.logger.error("[FlagStorageService] Cannot get all flag decisions: SDK key and user ID are required");
      return null;
    }
    
    const storageKey = this.getAllDecisionsStorageKey(sdkKey, userId);
    
    try {
      // Check memory cache first
      const cachedDecisions = this.getFromMemoryCache<Record<string, Partial<OptimizelyDecision>>>(storageKey);
      if (cachedDecisions !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for all flag decisions (memory cache)`);
        return cachedDecisions;
      }
      
      // Try to get from KV storage
      const storedDecisions = await this.storage.get<Record<string, Partial<OptimizelyDecision>>>(storageKey, 'json');
      
      if (storedDecisions !== null) {
        this.logger.debug(`[FlagStorageService] Cache hit for all flag decisions (KV storage)`);
        // Store in memory cache for future use
        this.storeInMemoryCache(storageKey, storedDecisions, DEFAULT_DECISION_TTL);
        return storedDecisions;
      }
      
      this.logger.debug(`[FlagStorageService] Cache miss for all flag decisions`);
      return null;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error getting all flag decisions for user ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Stores all flag decisions for a user.
   * @param sdkKey - The Optimizely SDK key.
   * @param userId - The user ID.
   * @param decisions - Map of flag keys to decisions.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  async putAllFlagDecisions(
    sdkKey: string, 
    userId: string, 
    decisions: Record<string, Partial<OptimizelyDecision>>, 
    ttl = DEFAULT_DECISION_TTL
  ): Promise<boolean> {
    if (!sdkKey || !userId || !decisions) {
      this.logger.error("[FlagStorageService] Cannot put all flag decisions: SDK key, user ID, and decisions are required");
      return false;
    }
    
    const storageKey = this.getAllDecisionsStorageKey(sdkKey, userId);
    
    try {
      // Store in KV storage
      await this.storage.put(storageKey, JSON.stringify(decisions), { expirationTtl: ttl });
      
      // Store in memory cache
      this.storeInMemoryCache(storageKey, decisions, ttl);
      
      // Also store individual flag decisions for direct access
      for (const [flagKey, decision] of Object.entries(decisions)) {
        const individualKey = this.getFlagDecisionStorageKey(sdkKey, flagKey, userId);
        this.storeInMemoryCache(individualKey, decision, ttl);
      }
      
      this.logger.debug(`[FlagStorageService] Stored all flag decisions for user ${userId} with TTL ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error storing all flag decisions for user ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Manages flag keys across different environments.
   * This method synchronizes flag keys between environments, optionally propagating key changes.
   * 
   * @param sourceSdkKey - The source SDK key to copy flag keys from.
   * @param targetSdkKeys - Array of target SDK keys to propagate flag keys to.
   * @param options - Optional configuration options.
   * @param options.propagateOnly - Array of flag keys to propagate (if not provided, all keys are propagated).
   * @param options.excludeFlags - Array of flag keys to exclude from propagation.
   * @param options.ttl - Time-to-live in seconds for the propagated keys.
   * @returns A promise resolving to a map of target SDK keys to success/failure status.
   */
  async manageFlagKeysAcrossEnvironments(
    sourceSdkKey: string,
    targetSdkKeys: string[],
    options?: {
      propagateOnly?: string[];
      excludeFlags?: string[];
      ttl?: number;
    }
  ): Promise<Record<string, boolean>> {
    if (!sourceSdkKey || !targetSdkKeys || !Array.isArray(targetSdkKeys) || targetSdkKeys.length === 0) {
      this.logger.error("[FlagStorageService] Cannot manage flag keys across environments: Invalid parameters");
      return {};
    }
    
    const result: Record<string, boolean> = {};
    const ttl = options?.ttl || DEFAULT_FLAG_KEYS_TTL;
    
    try {
      // Get flag keys from source environment
      let sourceFlags = await this.getFlagKeys(sourceSdkKey);
      
      if (sourceFlags.length === 0) {
        this.logger.warn(`[FlagStorageService] No flag keys found for source SDK key: ${sourceSdkKey}`);
        // Initialize result with failure for all target environments
        targetSdkKeys.forEach(targetSdkKey => {
          result[targetSdkKey] = false;
        });
        return result;
      }
      
      // Apply filters if provided
      if (options?.propagateOnly && Array.isArray(options.propagateOnly) && options.propagateOnly.length > 0) {
        sourceFlags = sourceFlags.filter(flag => options.propagateOnly!.includes(flag));
      }
      
      if (options?.excludeFlags && Array.isArray(options.excludeFlags) && options.excludeFlags.length > 0) {
        sourceFlags = sourceFlags.filter(flag => !options.excludeFlags!.includes(flag));
      }
      
      // Propagate flags to each target environment
      for (const targetSdkKey of targetSdkKeys) {
        try {
          // Skip if target is the same as source
          if (targetSdkKey === sourceSdkKey) {
            result[targetSdkKey] = true;
            continue;
          }
          
          // Get existing target flags
          const existingTargetFlags = await this.getFlagKeys(targetSdkKey);
          
          // Merge flags (preserve any target-specific flags)
          const mergedFlags = [...new Set([...existingTargetFlags, ...sourceFlags])];
          
          // Store merged flags in target environment
          const success = await this.putFlagKeys(targetSdkKey, mergedFlags, ttl);
          
          result[targetSdkKey] = success;
          
          if (success) {
            this.logger.debug(`[FlagStorageService] Successfully propagated ${sourceFlags.length} flags from ${sourceSdkKey} to ${targetSdkKey}`);
          } else {
            this.logger.error(`[FlagStorageService] Failed to propagate flags from ${sourceSdkKey} to ${targetSdkKey}`);
          }
        } catch (error) {
          this.logger.error(`[FlagStorageService] Error propagating flags to ${targetSdkKey}:`, error);
          result[targetSdkKey] = false;
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error managing flag keys across environments:`, error);
      // Initialize result with failure for all target environments
      targetSdkKeys.forEach(targetSdkKey => {
        result[targetSdkKey] = false;
      });
      return result;
    }
  }
  
  /**
   * Purges expired entries from both memory cache and KV storage.
   * @param sdkKey - Optional SDK key to limit purge to specific SDK entries.
   * @returns A promise resolving to the number of entries purged.
   */
  async purgeExpiredEntries(sdkKey?: string): Promise<number> {
    let purgedCount = 0;
    
    try {
      // Always purge expired entries from memory cache
      const now = Date.now();
      let memoryCachePurgedCount = 0;
      
      // Filter memory cache based on SDK key if provided
      for (const [key, item] of this.memoryCache.entries()) {
        // Check if entry is expired
        if (item.expiry < now) {
          // If SDK key is provided, only purge entries for that SDK
          if (sdkKey) {
            // Skip if key doesn't match the SDK pattern
            if (!key.includes(`:${sdkKey}:`)) {
              continue;
            }
          }
          
          this.memoryCache.delete(key);
          memoryCachePurgedCount++;
        }
      }
      
      this.logger.debug(`[FlagStorageService] Purged ${memoryCachePurgedCount} expired entries from memory cache`);
      purgedCount += memoryCachePurgedCount;
      
      if (sdkKey) {
        // Get all flag keys for the specified SDK
        const flagKeys = await this.getFlagKeys(sdkKey);
        
        // Get all decisions for each flag to check expiration
        // Note: This approach requires keys to have TTL set in KV storage
        // If key expiration is handled by the KV storage itself, this step may be unnecessary
        
        this.logger.debug(`[FlagStorageService] Purged expired entries for SDK: ${sdkKey}`);
      }
      
      return purgedCount;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error purging expired entries:`, error);
      return purgedCount;
    }
  }
  
  /**
   * Clears the memory cache.
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    this.logger.debug("[FlagStorageService] Memory cache cleared");
  }
  
  /**
   * Starts periodic cleanup of expired entries.
   * @param intervalMs - Interval in milliseconds between cleanup operations.
   */
  startPeriodicCleanup(intervalMs: number = 300000): void {
    // Clear any existing interval
    this.stopPeriodicCleanup();
    
    this.logger.debug(`[FlagStorageService] Starting periodic cleanup every ${intervalMs}ms`);
    
    // Set up new interval
    this.cleanupInterval = setInterval(async () => {
      // Skip if cleanup is already running
      if (this.isCleanupRunning) {
        this.logger.debug("[FlagStorageService] Skipping cleanup as previous is still running");
        return;
      }
      
      this.isCleanupRunning = true;
      try {
        // Perform cleanup of expired entries
        const purgedCount = await this.purgeExpiredEntries();
        if (purgedCount > 0) {
          this.logger.debug(`[FlagStorageService] Periodic cleanup purged ${purgedCount} expired entries`);
        }
      } catch (error) {
        this.logger.error("[FlagStorageService] Error during periodic cleanup:", error);
      } finally {
        this.isCleanupRunning = false;
      }
    }, intervalMs);
  }
  
  /**
   * Stops periodic cleanup of expired entries.
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.debug("[FlagStorageService] Stopped periodic cleanup");
    }
  }
  
  /**
   * Performs an immediate cleanup of expired entries.
   * @param sdkKey - Optional SDK key to limit cleanup to a specific SDK.
   * @returns A promise that resolves when cleanup is complete.
   */
  async performCleanup(sdkKey?: string): Promise<number> {
    // Skip if cleanup is already running
    if (this.isCleanupRunning) {
      this.logger.debug("[FlagStorageService] Skipping requested cleanup as another cleanup is already running");
      return 0;
    }
    
    this.isCleanupRunning = true;
    try {
      const purgedCount = await this.purgeExpiredEntries(sdkKey);
      this.logger.debug(`[FlagStorageService] Manual cleanup purged ${purgedCount} expired entries`);
      return purgedCount;
    } catch (error) {
      this.logger.error(`[FlagStorageService] Error during manual cleanup:`, error);
      return 0;
    } finally {
      this.isCleanupRunning = false;
    }
  }
  
  /**
   * Clean up resources when service is no longer needed.
   * This should be called when the service is being disposed of.
   */
  dispose(): void {
    this.stopPeriodicCleanup();
    this.clearMemoryCache();
    this.logger.debug("[FlagStorageService] Service disposed");
  }
} 