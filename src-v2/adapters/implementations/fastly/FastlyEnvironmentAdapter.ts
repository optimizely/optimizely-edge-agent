import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

// Define a generic type for the Fastly environment object
export type FastlyEnv = Record<string, any> & {
  // Example: Add specific known binding types for better type safety
  // Dictionary bindings, edge dictionaries, etc.
};

// Define a type for the Fastly execution context
export interface FastlyExecutionContext {
  // Fastly may have different methods than other platforms
  waitUntil?: (promise: Promise<any>) => void;
  // Add other context methods that Fastly provides
}

/**
 * Fastly-specific implementation of IEnvironmentAdapter.
 * Wraps the Fastly environment and execution context.
 */
export class FastlyEnvironmentAdapter implements IEnvironmentAdapter {
  private env: FastlyEnv;
  private ctx: FastlyExecutionContext;

  /**
   * Creates an instance of the adapter.
   * @param env - The environment object (bindings and variables).
   * @param ctx - The execution context.
   */
  constructor(env: FastlyEnv, ctx: FastlyExecutionContext) {
    if (!env) {
      throw new Error("Fastly environment object (env) cannot be null or undefined.");
    }
    if (!ctx) {
      throw new Error("Fastly execution context (ctx) cannot be null or undefined.");
    }
    this.env = env;
    this.ctx = ctx;
  }

  getVariable(key: string): string | undefined {
    // Variables are typically accessed from the environment in Fastly
    const value = this.env[key];
    return typeof value === 'string' ? value : undefined;
  }

  getBinding<T>(bindingName: string): T | undefined {
    // Bindings in Fastly environment (e.g., edge dictionaries)
    return this.env[bindingName] as T;
  }

  getContext<T = FastlyExecutionContext>(): T {
    return this.ctx as unknown as T;
  }

  waitUntil(promise: Promise<unknown>): void {
    if (this.ctx.waitUntil) {
      this.ctx.waitUntil(promise);
    } else {
      // Fallback implementation - Fastly may not have an exact equivalent
      console.warn('waitUntil not directly available in Fastly context, handling promise separately');
      // Execute the promise but don't wait for it
      promise.catch(error => console.error('Unhandled error in background task:', error));
    }
  }

  /**
   * Implements the fetch method required by IEnvironmentAdapter.
   * Uses the global fetch in the Fastly Compute@Edge environment.
   * @param input - The request info (URL or Request object)
   * @param init - Optional request initialization parameters
   * @returns A promise that resolves to a Response object
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Fastly Compute@Edge has access to global fetch
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