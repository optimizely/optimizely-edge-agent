import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

// Define a generic type for the Vercel environment object
export type VercelEnv = Record<string, any> & {
  // Example: Add specific known binding types for better type safety
  // KV namespaces, etc.
};

// Define a type for the Vercel execution context
export interface VercelExecutionContext {
  waitUntil?(promise: Promise<any>): void;
  // Add other context methods that Vercel provides
}

// Augment the globalThis type to include Vercel Edge Runtime specific properties
declare global {
  var EdgeRuntime: string | undefined;
}

/**
 * Vercel-specific implementation of IEnvironmentAdapter.
 * Wraps the Vercel serverless environment and execution context.
 */
export class VercelEnvironmentAdapter implements IEnvironmentAdapter {
  private env: VercelEnv;
  private ctx: VercelExecutionContext;

  /**
   * Creates an instance of the adapter.
   * @param env - The environment object (bindings and variables).
   * @param ctx - The execution context.
   */
  constructor(env: VercelEnv, ctx: VercelExecutionContext) {
    if (!env) {
      throw new Error("Vercel environment object (env) cannot be null or undefined.");
    }
    if (!ctx) {
      throw new Error("Vercel execution context (ctx) cannot be null or undefined.");
    }
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * Gets an environment variable from the Vercel environment.
   * @param key - The name of the variable.
   * @returns The value as a string, or undefined if not found.
   */
  getVariable(key: string): string | undefined {
    const value = this.env[key];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Gets a binding from the Vercel environment.
   * @param bindingName - The name of the binding.
   * @returns The binding object or undefined if not found.
   */
  getBinding<T>(bindingName: string): T | undefined {
    const binding = this.env[bindingName] as T;
    return binding !== undefined ? binding : undefined;
  }

  /**
   * Accesses the underlying Vercel execution context.
   * @returns The native Vercel context object.
   */
  getContext<T = unknown>(): T {
    return this.ctx as unknown as T;
  }

  /**
   * Performs an action after the response has been sent.
   * Uses Vercel's waitUntil if available.
   * @param promise - A promise representing the asynchronous task.
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.ctx.waitUntil) {
      this.ctx.waitUntil(promise);
    } else {
      // Fallback implementation or warning
      console.warn('waitUntil not available in Vercel context, promise might not complete before response');
      // Make sure the promise doesn't throw unhandled errors
      promise.catch(error => console.error('Unhandled error in waitUntil fallback:', error));
    }
  }

  /**
   * Implements the fetch method required by IEnvironmentAdapter.
   * Uses the global fetch in the Vercel environment.
   * @param input - The request info (URL or Request object)
   * @param init - Optional request initialization parameters
   * @returns A promise that resolves to a Response object
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Vercel environment has access to global fetch
    return fetch(input, init);
  }

  /**
   * Returns the environment and execution context.
   * @returns An object containing the execution context and environment variables.
   */
  getEnvironment(): { [key: string]: unknown; ctx?: unknown } {
    return {
      ctx: this.ctx,
      ...this.env,
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