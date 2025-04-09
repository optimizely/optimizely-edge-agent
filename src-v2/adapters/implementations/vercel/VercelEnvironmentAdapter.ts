import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

// Define a generic type for the Vercel environment object
export type VercelEnv = Record<string, any> & {
  // Example: Add specific known binding types for better type safety
  // You may customize these based on actual Vercel bindings
};

// Define a type for the Vercel execution context
export interface VercelExecutionContext {
  waitUntil(promise: Promise<any>): void;
  // Add other context methods that Vercel provides
}

/**
 * Vercel-specific implementation of IEnvironmentAdapter.
 * Wraps the Vercel environment and execution context.
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

  getVariable(key: string): string | undefined {
    // Variables are typically strings in Vercel env
    const value = this.env[key];
    return typeof value === 'string' ? value : undefined;
  }

  getBinding<T>(bindingName: string): T | undefined {
    // Bindings in Vercel environment
    const binding = this.env[bindingName] as T;
    // Basic check, might need refinement based on specific binding types
    return binding !== undefined ? binding : undefined;
  }

  getContext<T = VercelExecutionContext>(): T {
    // Type assertion might be needed depending on usage context
    return this.ctx as unknown as T;
  }

  waitUntil(promise: Promise<unknown>): void {
    // Use Vercel's equivalent of waitUntil if available
    // If Vercel doesn't have a waitUntil equivalent, implement a fallback
    if (this.ctx.waitUntil) {
      this.ctx.waitUntil(promise);
    } else {
      // Fallback implementation or warning
      console.warn('waitUntil not available in Vercel context, promise might not complete before response');
      // Potentially use a different mechanism to ensure promise completion
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
    // Vercel Edge Functions have access to global fetch
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