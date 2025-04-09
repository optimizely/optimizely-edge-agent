/**
 * @interface IEnvironmentAdapter
 * @description Defines the contract for accessing environment-specific configuration
 * and context (e.g., environment variables, Cloudflare execution context).
 */
export interface IEnvironmentAdapter {
  /**
   * Gets the value of an environment variable or configuration setting.
   * @param key - The name of the variable.
   * @returns The value as a string, or undefined if not found.
   */
  getVariable(key: string): string | undefined;

  /**
   * Gets a binding (like KV namespace, DO, etc.) from the environment.
   * Use specific types for known bindings.
   * @typeParam T - The expected type of the binding.
   * @param bindingName - The name of the binding.
   * @returns The binding object or undefined if not found.
   */
  getBinding<T>(bindingName: string): T | undefined;

  /**
   * Accesses the underlying execution context (e.g., Cloudflare's ExecutionContext).
   * Useful for operations like waitUntil.
   * @typeParam T - The expected type of the context object.
   * @returns The native context object.
   */
  getContext<T = unknown>(): T;

  /**
   * Performs an action after the response has been sent (e.g., logging, analytics).
   * Equivalent to Cloudflare's ctx.waitUntil.
   * @param promise - A promise representing the asynchronous task.
   */
  waitUntil(promise: Promise<unknown>): void;

  /**
   * Performs a network fetch operation with the environment's fetch implementation.
   * @param input - Request input, either a URL string or a Request object.
   * @param init - Optional request initialization options.
   * @returns A promise that resolves to a Response object.
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
} 