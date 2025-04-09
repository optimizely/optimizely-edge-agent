/**
 * Mock implementation of IRequestAdapter for testing
 */
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';

export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, string>;
}

export class MockRequestAdapter implements IRequestAdapter {
  private method: string;
  private url: string;
  private headers: Record<string, string>;
  private body: string | null;
  private params: Record<string, string>;

  constructor(options: MockRequestOptions = {}) {
    this.method = options.method || 'GET';
    this.url = options.url || 'https://example.com';
    this.headers = options.headers || {};
    this.body = options.body || null;
    this.params = options.params || {};

    // Parse query parameters from URL if not provided directly
    if (Object.keys(this.params).length === 0 && this.url.includes('?')) {
      const urlParts = this.url.split('?');
      const searchParams = new URLSearchParams(urlParts[1]);
      searchParams.forEach((value, key) => {
        this.params[key] = value;
      });
    }
  }

  getMethod(): string {
    return this.method;
  }

  getUrl(): URL {
    return new URL(this.url);
  }

  getHeader(name: string): string | null {
    return this.headers[name.toLowerCase()] || null;
  }

  getHeaders(): Headers {
    const headers = new Headers();
    Object.entries(this.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    return headers;
  }

  getParam(name: string): string | null {
    return this.params[name] || null;
  }

  getParams(): Record<string, string> {
    return { ...this.params };
  }

  async getBodyText(): Promise<string> {
    return this.body || '';
  }

  async getBodyJson<T>(): Promise<T> {
    if (!this.body) {
      return {} as T;
    }
    
    try {
      return JSON.parse(this.body) as T;
    } catch (error) {
      throw new Error('Failed to parse body as JSON');
    }
  }

  async getBody(): Promise<any> {
    if (!this.body) return null;
    
    try {
      return JSON.parse(this.body);
    } catch (error) {
      // Not JSON, return the raw string
      return this.body;
    }
  }

  getNativeRequest<T = unknown>(): T {
    // Return this adapter instance as the native request
    return this as unknown as T;
  }

  getPath(): string {
    // Return just the path portion of the URL
    return this.url.split('?')[0];
  }
} 