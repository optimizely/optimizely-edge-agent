import { IEnvironmentAdapter } from '../../../../adapters/interfaces/IEnvironmentAdapter';
import { vi } from 'vitest';

/**
 * Mock implementation of IEnvironmentAdapter for testing
 */
export class MockEnvironmentAdapter implements IEnvironmentAdapter {
  private variables: Record<string, string> = {};
  private bindings: Record<string, any> = {};
  private waitUntilFns: Array<Promise<any>> = [];
  
  /**
   * Gets an environment variable.
   */
  getVariable(key: string): string | undefined {
    return this.variables[key];
  }

  /**
   * Gets a binding from the environment.
   */
  getBinding<T>(bindingName: string): T | undefined {
    return this.bindings[bindingName] as T;
  }

  /**
   * Gets the current execution context.
   */
  getContext<T = unknown>(): T {
    return {
      waitUntil: this.waitUntil.bind(this)
    } as T;
  }

  /**
   * Schedules a promise to complete before the script terminates.
   */
  waitUntil(promise: Promise<unknown>): void {
    this.waitUntilFns.push(promise);
  }

  /**
   * Gets the current environment details.
   */
  getEnvironment(): { ctx?: unknown; [key: string]: unknown } {
    return {
      env: 'test',
      ctx: this.getContext()
    };
  }

  /**
   * Performs a network fetch operation with the environment's fetch implementation.
   */
  fetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>().mockImplementation(async (input, init) => {
    // Return a successful response by default
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  /**
   * Gets all scheduled promises.
   */
  getScheduledPromises(): Array<Promise<any>> {
    return this.waitUntilFns;
  }

  /**
   * Sets a mock environment variable.
   */
  setVariable(key: string, value: string): void {
    this.variables[key] = value;
  }

  /**
   * Sets a mock binding.
   */
  setBinding<T>(bindingName: string, value: T): void {
    this.bindings[bindingName] = value;
  }

  /**
   * Clears all mock variables and bindings.
   */
  reset(): void {
    this.variables = {};
    this.bindings = {};
    this.waitUntilFns = [];
    vi.mocked(this.fetch).mockClear();
  }

  /**
   * Configures the fetch mock to return a specific response for a URL.
   */
  mockFetchForUrl(url: string, responseData: any, status = 200): void {
    vi.mocked(this.fetch).mockImplementation(async (input, init) => {
      const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      
      if (inputUrl === url) {
        return new Response(JSON.stringify(responseData), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Default response for other URLs
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }

  /**
   * Checks if a binding exists in the environment.
   */
  hasBinding(bindingName: string): boolean {
    return bindingName in this.bindings;
  }
} 