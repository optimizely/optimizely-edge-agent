import { OptimizelyDecision } from "./IDecisionService";

/**
 * @interface IFlagStorageService
 * @description Defines the contract for flag-specific storage operations.
 * This interface provides operations specific to storing and retrieving flag data,
 * using the same key format as the original Edge Agent implementation.
 */
export interface IFlagStorageService {
  /**
   * Retrieves a flag from KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to retrieve.
   * @returns A promise resolving to the flag data or null if not found.
   */
  getFlag<T = any>(sdkKey: string, flagKey: string): Promise<T | null>;

  /**
   * Stores a flag in KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to store.
   * @param flag - The flag data to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  putFlag<T = any>(sdkKey: string, flagKey: string, flag: T, ttl?: number): Promise<boolean>;

  /**
   * Retrieves a decision for a specific flag from KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key to retrieve.
   * @param userId - The user ID for the decision.
   * @returns A promise resolving to the decision data or null if not found.
   */
  getFlagDecision(sdkKey: string, flagKey: string, userId: string): Promise<Partial<OptimizelyDecision> | null>;

  /**
   * Stores a decision for a specific flag in KV storage.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKey - The flag key.
   * @param userId - The user ID for the decision.
   * @param decision - The decision data to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  putFlagDecision(
    sdkKey: string, 
    flagKey: string, 
    userId: string, 
    decision: Partial<OptimizelyDecision>, 
    ttl?: number
  ): Promise<boolean>;

  /**
   * Retrieves all flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to an array of flag keys or an empty array if none are found.
   */
  getFlagKeys(sdkKey: string): Promise<string[]>;

  /**
   * Stores the list of flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKeys - The array of flag keys to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  putFlagKeys(sdkKey: string, flagKeys: string[], ttl?: number): Promise<boolean>;

  /**
   * Retrieves all flag decisions for a user.
   * @param sdkKey - The Optimizely SDK key.
   * @param userId - The user ID.
   * @returns A promise resolving to a map of flag keys to decisions.
   */
  getAllFlagDecisions(sdkKey: string, userId: string): Promise<Record<string, Partial<OptimizelyDecision>> | null>;

  /**
   * Stores all flag decisions for a user.
   * @param sdkKey - The Optimizely SDK key.
   * @param userId - The user ID.
   * @param decisions - Map of flag keys to decisions.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  putAllFlagDecisions(
    sdkKey: string, 
    userId: string, 
    decisions: Record<string, Partial<OptimizelyDecision>>, 
    ttl?: number
  ): Promise<boolean>;

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
  manageFlagKeysAcrossEnvironments(
    sourceSdkKey: string,
    targetSdkKeys: string[],
    options?: {
      propagateOnly?: string[];
      excludeFlags?: string[];
      ttl?: number;
    }
  ): Promise<Record<string, boolean>>;

  /**
   * Purges expired entries from both memory cache and KV storage.
   * @param sdkKey - Optional SDK key to limit purge to specific SDK entries.
   * @returns A promise resolving to the number of entries purged.
   */
  purgeExpiredEntries(sdkKey?: string): Promise<number>;
  
  /**
   * Starts periodic cleanup of expired entries.
   * @param intervalMs - Interval in milliseconds between cleanup operations.
   */
  startPeriodicCleanup(intervalMs?: number): void;
  
  /**
   * Stops periodic cleanup of expired entries.
   */
  stopPeriodicCleanup(): void;
  
  /**
   * Performs an immediate cleanup of expired entries.
   * @param sdkKey - Optional SDK key to limit cleanup to a specific SDK.
   * @returns A promise that resolves when cleanup is complete.
   */
  performCleanup(sdkKey?: string): Promise<number>;
  
  /**
   * Clean up resources when service is no longer needed.
   * This should be called when the service is being disposed of.
   */
  dispose(): void;
} 