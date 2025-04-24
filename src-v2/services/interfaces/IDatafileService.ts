import { IStorageAdapter } from "../../adapters/interfaces/IStorageAdapter";
import { IEnvironmentAdapter } from "../../adapters/interfaces/IEnvironmentAdapter";

/**
 * @interface IDatafileService
 * @description Defines the contract for managing Optimizely datafiles and flag keys.
 */
export interface IDatafileService {
  /**
   * Gets an Optimizely datafile by sdkKey.
   * @param sdkKey - The Optimizely SDK key.
   * @param options - Optional configuration options.
   * @returns A promise resolving to the datafile JSON string or null if not found.
   */
  getDatafile(sdkKey: string, options?: { useKV?: boolean }): Promise<string | null>;

  /**
   * Updates or stores an Optimizely datafile.
   * @param sdkKey - The Optimizely SDK key.
   * @param datafileJson - The JSON string representation of the datafile.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  setDatafile(sdkKey: string, datafileJson: string, ttl?: number): Promise<boolean>;
  
  /**
   * Alias for setDatafile to maintain compatibility with existing code.
   * @param sdkKey - The Optimizely SDK key.
   * @param datafileJson - The JSON string representation of the datafile.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  saveDatafile(sdkKey: string, datafileJson: string, ttl?: number): Promise<boolean>;

  /**
   * Fetches a datafile from the Optimizely CDN.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to the datafile JSON string or null if retrieval failed.
   */
  fetchDatafileFromCDN(sdkKey: string): Promise<string | null>;

  /**
   * Gets all flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @param options - Optional configuration options.
   * @returns A promise resolving to an array of flag keys or null if none are found.
   */
  getFlagKeys(sdkKey: string, options?: { useKV?: boolean, requestContext?: any }): Promise<string[] | null>;

  /**
   * Updates the list of flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKeys - The array of flag keys to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  setFlagKeys(sdkKey: string, flagKeys: string[], ttl?: number): Promise<boolean>;
  
  /**
   * Alias for setFlagKeys to maintain compatibility with existing code.
   * @param sdkKey - The Optimizely SDK key.
   * @param flagKeys - The array of flag keys to store.
   * @param ttl - Optional time-to-live in seconds.
   * @returns A promise resolving to true if the operation was successful.
   */
  saveFlagKeys(sdkKey: string, flagKeys: string[], ttl?: number): Promise<boolean>;

  /**
   * Extracts flag keys from a datafile.
   * @param datafileJson - The JSON string representation of the datafile.
   * @returns An array of flag keys found in the datafile.
   */
  extractFlagKeys(datafileJson: string): string[];

  /**
   * Refreshes a datafile by fetching it from the CDN.
   * @param sdkKey - The Optimizely SDK key.
   * @param forceFetch - Whether to force fetching from CDN even if cached.
   * @returns A promise resolving to the datafile JSON string or null if retrieval failed.
   */
  refreshDatafile(sdkKey: string, forceFetch?: boolean): Promise<string | null>;

  /**
   * Deletes a datafile for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to true if the operation was successful.
   */
  purgeDatafile?(sdkKey: string): Promise<boolean>;

  /**
   * Deletes flag keys for a specific SDK key.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to true if the operation was successful.
   */
  purgeFlagKeys?(sdkKey: string): Promise<boolean>;

  /**
   * Gets the environment adapter used by this service.
   * @returns The environment adapter instance.
   */
  getEnvironmentAdapter(): IEnvironmentAdapter;

  /**
   * Synchronizes flag keys between environments.
   * This method leverages the FlagStorageService to synchronize flag keys across environments.
   * 
   * @param sourceSdkKey - The source SDK key to copy flag keys from.
   * @param targetSdkKeys - Array of target SDK keys to propagate flag keys to.
   * @param options - Optional configuration options.
   * @returns A promise resolving to a result object with success/failure information.
   */
  synchronizeFlagKeys(
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
  }>;
  
  /**
   * Initiates cleanup of expired flag keys and decisions.
   * @param sdkKey - Optional SDK key to limit cleanup to specific SDK data.
   * @returns A promise resolving to the number of items cleaned up.
   */
  cleanupExpiredFlags(sdkKey?: string): Promise<number>;

  /**
   * Gets flag keys from KV store.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to an array of flag keys or null if none are found.
   */
  getFlagsFromKV?(sdkKey: string): Promise<string[] | null>;

  /**
   * Gets datafile from KV store.
   * @param sdkKey - The Optimizely SDK key.
   * @returns A promise resolving to the datafile JSON string or null if not found.
   */
  getDatafileFromKV?(sdkKey: string): Promise<string | null>;
} 