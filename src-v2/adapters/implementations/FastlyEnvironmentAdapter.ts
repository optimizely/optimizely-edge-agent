/**
 * Fastly Environment Adapter
 * 
 * This adapter provides integration with the Fastly Compute@Edge environment.
 * It implements the IEnvironmentAdapter interface to support:
 * 
 * 1. waitUntil pattern (with appropriate fallbacks for Fastly)
 * 2. fetch wrapper for network requests
 * 3. environment variable access via Fastly's API
 * 
 * @see https://developer.fastly.com/learning/compute/
 */

import { IEnvironmentAdapter } from '../interfaces/IEnvironmentAdapter';
import { ILoggerAdapter } from '../interfaces/ILoggerAdapter';

/**
 * Implementation of the IEnvironmentAdapter for Fastly Compute@Edge environment.
 */
export class FastlyEnvironmentAdapter implements IEnvironmentAdapter {
  private logger: ILoggerAdapter;
  
  /**
   * Creates a new Fastly environment adapter.
   * 
   * @param logger - Logger adapter for logging.
   */
  constructor(logger: ILoggerAdapter) {
    this.logger = logger;
    this.logger.debug('FastlyEnvironmentAdapter: Initialized');
  }
  
  /**
   * Gets an environment variable from Fastly.
   * 
   * @param key - The environment variable name.
   * @returns The environment variable value or undefined if not found.
   */
  getVariable(key: string): string | undefined {
    try {
      // @ts-expect-error - Fastly specific global
      if (typeof fastly !== 'undefined' && fastly.env && typeof fastly.env.get === 'function') {
        // @ts-expect-error - Fastly specific global
        const value = fastly.env.get(key);
        return value !== undefined ? value : undefined;
      }
    } catch (error) {
      this.logger.error('FastlyEnvironmentAdapter: Error getting variable', { key, error });
    }
    return undefined;
  }
  
  /**
   * Gets a secret binding from Fastly.
   * 
   * @param bindingName - The binding name.
   * @returns The binding value or undefined if not found.
   */
  getBinding<T>(bindingName: string): T | undefined {
    // Fastly uses the same mechanism for env vars and secrets
    const value = this.getVariable(bindingName);
    return value as unknown as T;
  }
  
  /**
   * Gets a context value.
   * Note: Fastly doesn't have the same context concept as Cloudflare,
   * so this implementation provides a minimal interface compatibility.
   * 
   * @returns The context object (null wrapped as unknown).
   */
  getContext<T = unknown>(): T {
    // Fastly doesn't have equivalent context object
    this.logger.debug('FastlyEnvironmentAdapter: getContext called but not supported in Fastly');
    return null as unknown as T;
  }
  
  /**
   * Gets the environment variables and execution context.
   * Returns a simplified object with environment data.
   * 
   * @returns An object containing environment information.
   */
  getEnvironment(): { [key: string]: unknown; ctx?: unknown } {
    return {
      ctx: null,
      environment: this.getEnvironmentName(),
      // Add any other environment properties needed
    };
  }
  
  /**
   * Gets the environment name (helper method).
   * 
   * @returns The environment name or 'development' if not found.
   */
  private getEnvironmentName(): string {
    const env = this.getVariable('ENVIRONMENT') || this.getVariable('FASTLY_ENV');
    return env || 'development';
  }
  
  /**
   * Extends the lifetime of the current request to include the given promise.
   * 
   * Note: Fastly doesn't have a native waitUntil equivalent like Cloudflare.
   * This implementation executes the promise directly but doesn't wait for it.
   * 
   * @param promise - Promise to execute in the background.
   */
  waitUntil(promise: Promise<unknown>): void {
    this.logger.debug('FastlyEnvironmentAdapter: waitUntil called (using fallback implementation)');
    
    // No native waitUntil in Fastly, so we just execute the promise
    // and don't block but also ensure errors are caught and logged
    promise.catch(error => {
      this.logger.error('FastlyEnvironmentAdapter: Background task error', error);
    });
  }
  
  /**
   * Wrapper around the fetch API.
   * Provides consistent fetch functionality across environments.
   * Uses Fastly's fetch if available.
   * 
   * @param input - URL or Request object.
   * @param init - Request initialization options.
   * @returns Promise resolving to Response.
   */
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.logger.debug('FastlyEnvironmentAdapter: fetch called', { url: input.toString() });
    try {
      return await fetch(input, init);
    } catch (error) {
      this.logger.error('FastlyEnvironmentAdapter: fetch error', error);
      throw error;
    }
  }
  
  /**
   * Gets an environment variable value.
   * Alias to getVariable for interface compatibility.
   * 
   * @param key - The environment variable name.
   * @returns The environment variable value or undefined if not found.
   */
  getEnvironmentVariable(key: string): string | undefined {
    return this.getVariable(key);
  }
  
  /**
   * Checks if the code is running in the Fastly Compute@Edge environment.
   * 
   * @returns True if running in Fastly, false otherwise.
   */
  isFastlyComputeEnvironment(): boolean {
    // @ts-expect-error - Fastly specific global
    return typeof fastly !== 'undefined';
  }
} 