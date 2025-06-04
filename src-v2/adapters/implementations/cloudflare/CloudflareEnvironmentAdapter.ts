import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

// Define a generic type for the Cloudflare environment object
// This typically holds variables and bindings defined in wrangler.toml
export type CloudflareEnv = Record<string, any> & {
  // Example: Add specific known binding types for better type safety
  // MY_KV_NAMESPACE: KVNamespace;
  // MY_VARIABLE: string;
  
  // Metrics configuration environment variables
  OPTIMIZELY_METRICS_ENABLED?: string;
  OPTIMIZELY_METRICS_PREFIX?: string;
  OPTIMIZELY_METRICS_SAMPLING_RATE?: string;
  OPTIMIZELY_METRICS_MAX_DIMENSIONS?: string;
  OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS?: string;
  OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS?: string; // JSON string of key-value pairs
  
  // Analytics Engine binding
  ANALYTICS_ENGINE?: any;
};

// Define a type for the Cloudflare ExecutionContext
// Actual type might be imported from '@cloudflare/workers-types' if needed elsewhere
// Using simple interface here for clarity
export interface CloudflareExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

/**
 * Cloudflare-specific implementation of IEnvironmentAdapter.
 * Wraps the Cloudflare Worker environment object (env) and ExecutionContext (ctx).
 */
export class CloudflareEnvironmentAdapter implements IEnvironmentAdapter {
  private env: CloudflareEnv;
  private ctx: CloudflareExecutionContext;

  /**
   * Creates an instance of the adapter.
   * @param env - The environment object (bindings and variables).
   * @param ctx - The execution context.
   */
  constructor(env: CloudflareEnv, ctx: CloudflareExecutionContext) {
    if (!env) {
      throw new Error("Cloudflare environment object (env) cannot be null or undefined.");
    }
    if (!ctx) {
      throw new Error("Cloudflare execution context (ctx) cannot be null or undefined.");
    }
    this.env = env;
    this.ctx = ctx;
  }

  getVariable(key: string): string | undefined {
    // Variables are typically strings in Cloudflare env
    const value = this.env[key];
    return typeof value === 'string' ? value : undefined;
  }

  getBinding<T>(bindingName: string): T | undefined {
    // Bindings can be of various types (KVNamespace, DurableObjectStub, etc.)
    const binding = this.env[bindingName] as T;
    // Basic check, might need refinement based on specific binding types
    return binding !== undefined ? binding : undefined;
  }

  getContext<T = CloudflareExecutionContext>(): T {
    // Type assertion might be needed depending on usage context
    return this.ctx as unknown as T;
  }

  waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }

  /**
   * Implements the fetch method required by IEnvironmentAdapter.
   * Uses the global fetch in the Cloudflare Workers environment.
   * @param input - The request info (URL or Request object)
   * @param init - Optional request initialization parameters
   * @returns A promise that resolves to a Response object
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Cloudflare Workers have access to global fetch
    return fetch(input, init);
  }

  /**
   * Returns the environment variables and execution context.
   * @returns An object containing the execution context and environment variables.
   */
  getEnvironment(): { ctx?: unknown; [key: string]: unknown } {
    return {
      ctx: this.ctx,
      ...this.env
    };
  }
} 