/**
 * Vercel Environment Adapter
 * 
 * This adapter provides integration with the Vercel Edge Runtime environment.
 * It implements the IEnvironmentAdapter interface to support:
 * 
 * 1. waitUntil for background tasks in Vercel Edge Functions
 * 2. fetch wrapper for network requests
 * 3. cache access using Vercel's Edge API
 * 4. environment variable access
 * 
 * @see https://vercel.com/docs/functions/edge-functions/edge-runtime
 */

import { IEnvironmentAdapter } from '../interfaces/IEnvironmentAdapter';
import { ILoggerAdapter } from '../interfaces/ILoggerAdapter';

// Augment the globalThis type to include Vercel Edge Runtime specific properties
declare global {
  var EdgeRuntime: string | undefined;
}

/**
 * Type definition for Vercel's Context object which contains waitUntil
 */
interface VercelContext {
  waitUntil?: (promise: Promise<any>) => void;
}

/**
 * Implementation of the IEnvironmentAdapter for Vercel Edge Functions environment.
 */
export class VercelEnvironmentAdapter implements IEnvironmentAdapter {
  private logger: ILoggerAdapter;
  private context: VercelContext | null;
  
  /**
   * Creates a new Vercel environment adapter.
   * 
   * @param logger - Logger adapter for logging.
   * @param context - Optional Vercel context object that contains waitUntil function.
   */
  constructor(logger: ILoggerAdapter, context?: VercelContext) {
    this.logger = logger;
    this.context = context || null;
    
    this.logger.debug('VercelEnvironmentAdapter: Initialized');
  }
  
  /**
   * Sets the Vercel context, which should contain the waitUntil function.
   * This is useful when the context isn't available at initialization time
   * but becomes available later (e.g., in middleware or request handlers).
   * 
   * @param context - The Vercel context object.
   */
  setContext(context: VercelContext): void {
    this.context = context;
    this.logger.debug('VercelEnvironmentAdapter: Context set');
  }
  
  /**
   * Gets the value of an environment variable from Vercel.
   * 
   * @param key - The environment variable name.
   * @returns The environment variable value or undefined if not found.
   */
  getVariable(key: string): string | undefined {
    if (typeof process !== 'undefined' && process.env && key in process.env) {
      return process.env[key];
    }
    this.logger.debug(`VercelEnvironmentAdapter: Variable '${key}' not found`);
    return undefined;
  }
  
  /**
   * Gets a binding from Vercel environment.
   * In Vercel, bindings are typically accessed as environment variables.
   * 
   * @param bindingName - The name of the binding.
   * @returns The binding value or undefined if not found.
   */
  getBinding<T>(bindingName: string): T | undefined {
    try {
      const value = this.getVariable(bindingName);
      return value as unknown as T;
    } catch (error) {
      this.logger.error('VercelEnvironmentAdapter: Error getting binding', { bindingName, error });
      return undefined;
    }
  }
  
  /**
   * Gets the Vercel context object that was provided.
   * 
   * @returns The context object or an empty object if not available.
   */
  getContext<T = unknown>(): T {
    return this.context as unknown as T;
  }
  
  /**
   * Extends the lifetime of the current request to include the given promise
   * using Vercel's waitUntil functionality if available.
   * 
   * @param promise - Promise to execute in the background.
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.context && typeof this.context.waitUntil === 'function') {
      try {
        this.context.waitUntil(promise);
        this.logger.debug('VercelEnvironmentAdapter: waitUntil called with context');
      } catch (error) {
        this.logger.error('VercelEnvironmentAdapter: Error in waitUntil', error);
        // Execute the promise anyway to ensure it runs
        promise.catch(promiseError => {
          this.logger.error('VercelEnvironmentAdapter: Background task error', promiseError);
        });
      }
    } else {
      // Fallback: if no context.waitUntil available, just execute the promise
      this.logger.debug('VercelEnvironmentAdapter: No waitUntil available, executing promise directly');
      promise.catch(error => {
        this.logger.error('VercelEnvironmentAdapter: Background task error in fallback execution', error);
      });
    }
  }
  
  /**
   * Wrapper around the fetch API.
   * Provides consistent fetch functionality across environments.
   * 
   * @param input - URL or Request object.
   * @param init - Request initialization options.
   * @returns Promise resolving to Response.
   */
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.logger.debug('VercelEnvironmentAdapter: fetch called', { url: input.toString() });
    try {
      return await fetch(input, init);
    } catch (error) {
      this.logger.error('VercelEnvironmentAdapter: fetch error', error);
      throw error;
    }
  }
  
  /**
   * Gets an environment variable value.
   * Alias to getVariable for backward compatibility.
   * 
   * @param key - The environment variable name.
   * @returns The environment variable value or undefined if not found.
   */
  getEnvironmentVariable(key: string): string | undefined {
    return this.getVariable(key);
  }
  
  /**
   * Returns the environment variables and execution context.
   * Required by the IEnvironmentAdapter interface.
   * 
   * @returns An object containing the execution context and environment variables.
   */
  getEnvironment(): { [key: string]: unknown; ctx?: unknown } {
    const env: Record<string, unknown> = {};
    
    // Add process.env values if available
    if (typeof process !== 'undefined' && process.env) {
      // Only add environment variables that we care about to avoid leaking sensitive data
      const safeEnvVars = ['NODE_ENV', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_URL'];
      
      for (const key of safeEnvVars) {
        if (key in process.env) {
          env[key] = process.env[key];
        }
      }
    }
    
    return {
      ctx: this.context,
      ...env,
      isVercelEnv: this.isVercelEdgeRuntime()
    };
  }
  
  /**
   * Checks if the code is running in the Vercel Edge Runtime.
   * 
   * @returns True if running in Vercel, false otherwise.
   */
  isVercelEdgeRuntime(): boolean {
    return typeof globalThis.EdgeRuntime === 'string';
  }
} 