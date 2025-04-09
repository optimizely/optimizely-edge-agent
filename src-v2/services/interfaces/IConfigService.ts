import * as optimizely from '@optimizely/optimizely-sdk';

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
} 