import * as optimizely from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';

/**
 * Represents the Optimizely configuration/datafile.
 * Using 'unknown' for now, as the exact SDK type might vary or be complex.
 * The ConfigService implementation should parse this appropriately.
 */
// export interface OptimizelyConfig { // Replace with actual type
//   sdkKey: string;
//   revision: string;
//   // ... other properties
// }
export type OptimizelyDatafile = unknown; // Use unknown or a specific SDK type if available/stable

/**
 * @interface IConfigService
 * @description Defines the contract for retrieving the Optimizely configuration (datafile).
 */
export interface IConfigService {
  /**
   * Gets the current Optimizely configuration datafile.
   * @param sdkKey - The SDK key for which to retrieve the config (optional, might be implicit).
   * @returns A promise resolving to the OptimizelyDatafile object or null if not available.
   */
  getDatafile(sdkKey?: string): Promise<OptimizelyDatafile | null>;

  /**
   * Allows subscribing to configuration updates (optional).
   * @param listener - A callback function to execute when the config updates.
   * @returns A function to unsubscribe.
   */
  onUpdate?(listener: (datafile: OptimizelyDatafile) => void): () => void;
  
  /**
   * Gets the Edge Agent version.
   * @returns The Edge Agent version string or null if not available.
   */
  getEdgeAgentVersion(): string | null;
  
  /**
   * Gets the current environment (e.g., 'production', 'development').
   * @returns The environment string or null if not available.
   */
  getEnvironment(): string | null;
  
  /**
   * Gets the CDN provider (e.g., 'cloudflare', 'vercel', 'fastly').
   * @returns The CDN provider string or null if not available.
   */
  getCdnProvider(): string | null;
  
  /**
   * Gets the admin token for secure operations.
   * @returns The admin token or null if not configured.
   */
  getAdminToken(): string | null;

  // === v1 Compatibility Getters ===
  /**
   * Gets the configured header name for user attributes (v1 compatibility).
   */
  getAttributesHeaderName(): string | undefined;
  /**
   * Gets the configured header name for event tags (v1 compatibility).
   */
  getEventTagsHeaderName(): string | undefined;
  /**
   * Gets the configured header name for event key (v1 compatibility).
   */
  getEventKeyHeaderName(): string | undefined;
  /**
   * Returns true if Feature Experimentation (FEX) is enabled (v1 compatibility).
   */
  getEnableFex(): boolean;
  /**
   * Returns true if cache override is enabled (v1 compatibility).
   */
  getOverrideCache(): boolean;
  /**
   * Returns true if response metadata should be included (v1 compatibility).
   */
  getEnableResponseMetadata(): boolean;
  /**
   * Returns true if flags should be loaded from KV storage (v1 compatibility).
   */
  getEnableFlagsFromKV(): boolean;
  /**
   * Returns true if datafile should be loaded from KV storage (v1 compatibility).
   */
  getEnableDatafileFromKV(): boolean;
} 