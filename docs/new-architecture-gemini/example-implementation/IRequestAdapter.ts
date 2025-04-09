/**
 * IRequestAdapter Interface
 * 
 * This interface abstracts the incoming request and response objects
 * for the Optimizely Edge Agent. It allows the core business logic
 * to remain independent of the specific environment (Cloudflare, Fastly, etc.)
 */
export interface IRequestAdapter {
  /**
   * Gets the request method
   * @returns The HTTP method (GET, POST, etc.)
   */
  getMethod(): string;

  /**
   * Gets the request URL
   * @returns The full request URL
   */
  getUrl(): string;

  /**
   * Gets the URL path from the request
   * @returns The URL path
   */
  getPath(): string;

  /**
   * Gets a query parameter by name
   * @param name The name of the query parameter
   * @returns The value of the query parameter, or null if not present
   */
  getQueryParam(name: string): string | null;

  /**
   * Gets all query parameters
   * @returns An object containing all query parameters
   */
  getQueryParams(): Record<string, string>;

  /**
   * Gets a header value by name
   * @param name The name of the header
   * @returns The value of the header, or null if not present
   */
  getHeader(name: string): string | null;

  /**
   * Gets all headers
   * @returns An object containing all headers
   */
  getHeaders(): Record<string, string>;

  /**
   * Gets the request body as text
   * @returns A promise that resolves to the request body as text
   */
  getBodyText(): Promise<string>;

  /**
   * Gets the request body as JSON
   * @returns A promise that resolves to the parsed JSON body
   */
  getBodyJson<T = any>(): Promise<T>;

  /**
   * Gets cookies from the request
   * @returns An object containing all cookies
   */
  getCookies(): Record<string, string>;

  /**
   * Creates a response
   * @param body The response body
   * @param options Response options including status code and headers
   * @returns The response object specific to the environment
   */
  createResponse(
    body: string | object | ArrayBuffer,
    options?: {
      status?: number;
      headers?: Record<string, string>;
      cookies?: Array<{
        name: string;
        value: string;
        options?: {
          maxAge?: number;
          domain?: string;
          path?: string;
          secure?: boolean;
          httpOnly?: boolean;
          sameSite?: 'Strict' | 'Lax' | 'None';
        }
      }>;
    }
  ): unknown; // The actual return type depends on the environment
}

/**
 * Example implementation for Cloudflare Workers environment
 */
export class CloudflareRequestAdapter implements IRequestAdapter {
  private request: Request;
  private url: URL;
  private cookies: Record<string, string> | null = null;

  constructor(request: Request) {
    this.request = request;
    this.url = new URL(request.url);
  }

  getMethod(): string {
    return this.request.method;
  }

  getUrl(): string {
    return this.request.url;
  }

  getPath(): string {
    return this.url.pathname;
  }

  getQueryParam(name: string): string | null {
    return this.url.searchParams.get(name);
  }

  getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    this.url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    this.request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  async getBodyText(): Promise<string> {
    // Clone the request to avoid consuming the body
    const clonedRequest = this.request.clone();
    return await clonedRequest.text();
  }

  async getBodyJson<T = any>(): Promise<T> {
    // Clone the request to avoid consuming the body
    const clonedRequest = this.request.clone();
    return await clonedRequest.json() as T;
  }

  getCookies(): Record<string, string> {
    if (this.cookies === null) {
      this.cookies = {};
      const cookieHeader = this.request.headers.get('Cookie');
      if (cookieHeader) {
        const pairs = cookieHeader.split(';');
        pairs.forEach(pair => {
          const [name, value] = pair.trim().split('=');
          if (name && value) {
            this.cookies![name] = value;
          }
        });
      }
    }
    return this.cookies;
  }

  createResponse(
    body: string | object | ArrayBuffer,
    options: {
      status?: number;
      headers?: Record<string, string>;
      cookies?: Array<{
        name: string;
        value: string;
        options?: {
          maxAge?: number;
          domain?: string;
          path?: string;
          secure?: boolean;
          httpOnly?: boolean;
          sameSite?: 'Strict' | 'Lax' | 'None';
        }
      }>;
    } = {}
  ): Response {
    const { status = 200, headers = {}, cookies = [] } = options;
    
    // Prepare headers
    const responseHeaders = new Headers();
    Object.entries(headers).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // Handle cookies
    cookies.forEach(cookie => {
      const { name, value, options = {} } = cookie;
      const cookieParts = [`${name}=${value}`];
      
      if (options.maxAge !== undefined) {
        cookieParts.push(`Max-Age=${options.maxAge}`);
      }
      
      if (options.domain) {
        cookieParts.push(`Domain=${options.domain}`);
      }
      
      if (options.path) {
        cookieParts.push(`Path=${options.path}`);
      }
      
      if (options.secure) {
        cookieParts.push('Secure');
      }
      
      if (options.httpOnly) {
        cookieParts.push('HttpOnly');
      }
      
      if (options.sameSite) {
        cookieParts.push(`SameSite=${options.sameSite}`);
      }
      
      responseHeaders.append('Set-Cookie', cookieParts.join('; '));
    });
    
    // Prepare body
    let responseBody: string | ArrayBuffer;
    if (typeof body === 'string') {
      responseBody = body;
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'text/plain');
      }
    } else if (body instanceof ArrayBuffer) {
      responseBody = body;
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/octet-stream');
      }
    } else {
      responseBody = JSON.stringify(body);
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json');
      }
    }
    
    return new Response(responseBody, {
      status,
      headers: responseHeaders
    });
  }
} 